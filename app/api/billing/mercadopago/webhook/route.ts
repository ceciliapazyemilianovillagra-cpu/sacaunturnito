import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminSupabase } from '../../../../../lib/supabase-admin';

function validSignature(signatureHeader: string | null, requestId: string | null, dataId: string, secret: string) {
  if (!signatureHeader || !requestId) return false;
  const entries = Object.fromEntries(signatureHeader.split(',').map((part) => part.trim().split('=')));
  const ts = entries.ts;
  const supplied = entries.v1;
  if (!ts || !supplied) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!secret || !accessToken) return NextResponse.json({ error: 'Webhook no configurado.' }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { type?: string; topic?: string; data?: { id?: string } };
  const dataId = request.nextUrl.searchParams.get('data.id') || body.data?.id || '';
  const requestId = request.headers.get('x-request-id');
  if (!dataId || !validSignature(request.headers.get('x-signature'), requestId, dataId, secret)) {
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
  }
  const topic = body.type || body.topic || request.nextUrl.searchParams.get('type') || '';
  if (topic !== 'subscription_preapproval') return NextResponse.json({ received: true });

  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(dataId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const subscription = await response.json().catch(() => null) as null | {
    id?: string;
    external_reference?: string;
    status?: string;
    payer_email?: string;
    init_point?: string;
    next_payment_date?: string;
    auto_recurring?: { transaction_amount?: number };
  };
  if (!response.ok || !subscription?.id || !z.string().uuid().safeParse(subscription.external_reference).success) {
    return NextResponse.json({ error: 'No pudimos verificar la suscripción.' }, { status: 502 });
  }
  const organizationId = subscription.external_reference as string;
  const db = adminSupabase();
  const eventKey = `${dataId}:${requestId}`;
  const { error: eventError } = await db.from('payment_webhook_events').insert({
    provider: 'mercadopago', provider_event_id: eventKey, request_id: requestId, topic,
  });
  if (eventError?.code === '23505') return NextResponse.json({ received: true });
  if (eventError) return NextResponse.json({ error: 'No pudimos registrar el evento.' }, { status: 500 });

  const rawStatus = subscription.status || 'pending';
  const appStatus = rawStatus === 'authorized' ? 'active'
    : rawStatus === 'paused' ? 'paused'
      : rawStatus === 'cancelled' || rawStatus === 'canceled' ? 'cancelled'
        : 'trialing';
  const amount = Number(subscription.auto_recurring?.transaction_amount || process.env.MERCADOPAGO_MONTHLY_PRICE_ARS || 0);
  const { error: subscriptionError } = await db.from('organization_subscriptions').upsert({
    organization_id: organizationId,
    provider: 'mercadopago',
    provider_subscription_id: subscription.id,
    status: rawStatus,
    payer_email: subscription.payer_email || null,
    amount_ars: amount,
    checkout_url: subscription.init_point || null,
    next_payment_at: subscription.next_payment_date || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id' });
  if (subscriptionError) return NextResponse.json({ error: 'No pudimos actualizar la suscripción.' }, { status: 500 });
  await db.from('organizations').update({
    subscription_status: appStatus,
    subscription_valid_until: subscription.next_payment_date || null,
  }).eq('id', organizationId);
  return NextResponse.json({ received: true });
}
