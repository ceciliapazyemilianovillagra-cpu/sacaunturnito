import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serverSupabase } from '../../../../../lib/supabase-server';
import { adminSupabase } from '../../../../../lib/supabase-admin';

const emailSchema = z.object({ email: z.string().trim().email().max(254) });

async function billingContext() {
  const sessionDb = await serverSupabase();
  const { data: { user } } = await sessionDb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sessionDb.from('profiles').select('organization_id,role,active').eq('id', user.id).maybeSingle();
  if (!profile?.active || profile.role !== 'admin') return null;
  return { user, organizationId: profile.organization_id };
}

export async function GET() {
  const context = await billingContext();
  if (!context) return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: 401 });
  const db = adminSupabase();
  const [{ data: organization }, { data: subscription }] = await Promise.all([
    db.from('organizations').select('name,email,subscription_status,subscription_valid_until').eq('id', context.organizationId).single(),
    db.from('organization_subscriptions').select('status,amount_ars,next_payment_at,checkout_url').eq('organization_id', context.organizationId).maybeSingle(),
  ]);
  const amount = Number(process.env.MERCADOPAGO_MONTHLY_PRICE_ARS || 0);
  return NextResponse.json({
    configured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && amount > 0),
    amount,
    email: subscription?.status ? undefined : (organization?.email || context.user.email || ''),
    status: organization?.subscription_status || 'trialing',
    validUntil: organization?.subscription_valid_until || null,
    subscription: subscription || null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const context = await billingContext();
  if (!context) return NextResponse.json({ error: 'Solo un administrador puede gestionar la suscripción.' }, { status: 403 });
  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ingresá un correo válido para la facturación.' }, { status: 400 });
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const amount = Number(process.env.MERCADOPAGO_MONTHLY_PRICE_ARS || 0);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://sacaunturnito.vercel.app').replace(/\/$/, '');
  if (!accessToken || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Mercado Pago todavía no está configurado para cobrar.' }, { status: 503 });
  }
  const db = adminSupabase();
  const { data: organization } = await db.from('organizations').select('name').eq('id', context.organizationId).single();
  if (!organization) return NextResponse.json({ error: 'No encontramos la empresa.' }, { status: 404 });

  const response = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify({
      reason: `SACA UN TURNITO · ${organization.name}`,
      external_reference: context.organizationId,
      payer_email: parsed.data.email.toLowerCase(),
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: amount, currency_id: 'ARS' },
      back_url: `${appUrl}/panel/configuracion?cobro=procesado`,
      notification_url: `${appUrl}/api/billing/mercadopago/webhook`,
      status: 'pending',
    }),
  });
  const result = await response.json().catch(() => null) as { id?: string; init_point?: string; status?: string } | null;
  if (!response.ok || !result?.id || !result.init_point) {
    return NextResponse.json({ error: 'Mercado Pago no pudo iniciar la suscripción. Intentá nuevamente.' }, { status: 502 });
  }
  const { error } = await db.from('organization_subscriptions').upsert({
    organization_id: context.organizationId,
    provider: 'mercadopago',
    provider_subscription_id: result.id,
    status: result.status || 'pending',
    payer_email: parsed.data.email.toLowerCase(),
    amount_ars: amount,
    checkout_url: result.init_point,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id' });
  if (error) return NextResponse.json({ error: 'Se creó el cobro, pero no pudimos guardar su estado.' }, { status: 500 });
  return NextResponse.json({ checkoutUrl: result.init_point });
}
