import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminSupabase } from '../../../../lib/supabase-admin';
import { enforcePublicRateLimit, normalizeDni, signCustomerToken } from '../../../../lib/public-booking-security';

const detailsSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(10).max(24),
  address: z.string().trim().min(3).max(180),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  whatsappOptIn: z.boolean().default(false),
});
const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  dni: z.string().min(6).max(20),
  details: detailsSchema.optional(),
});

export async function POST(request: NextRequest) {
  if (!(await enforcePublicRateLimit(request, 'customer', 20))) {
    return NextResponse.json({ error: 'Demasiados intentos. Esperá un minuto antes de continuar.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Revisá los datos ingresados.' }, { status: 400 });
  const { slug, details } = parsed.data;
  const dni = normalizeDni(parsed.data.dni);
  if (!/^\d{6,9}$/.test(dni)) return NextResponse.json({ error: 'Ingresá un DNI válido, solo con números.' }, { status: 400 });
  const db = adminSupabase();
  const { data: organization } = await db
    .from('organizations')
    .select('id,subscription_status,subscription_valid_until')
    .eq('slug', slug)
    .eq('booking_enabled', true)
    .maybeSingle();
  const enabled = organization && (
    organization.subscription_status === 'active'
    || (organization.subscription_status === 'trialing' && organization.subscription_valid_until && Date.parse(organization.subscription_valid_until) > Date.now())
  );
  if (!enabled) return NextResponse.json({ error: 'Esta agenda no está disponible.' }, { status: 404 });

  const { data: existing } = await db
    .from('customers')
    .select('id')
    .eq('organization_id', organization.id)
    .eq('document_number', dni)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      exists: true,
      customerToken: signCustomerToken({ customerId: existing.id, organizationId: organization.id, slug, dni }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (!details) return NextResponse.json({ exists: false }, { headers: { 'Cache-Control': 'no-store' } });

  const phone = details.phone.replace(/\D/g, '');
  if (!/^\d{10,13}$/.test(phone)) {
    return NextResponse.json({ error: 'Ingresá el celular con código de área, sin 0 y sin 15.' }, { status: 400 });
  }
  const { data: customerId, error } = await db.rpc('register_customer_dni_secure', {
    p_slug: slug,
    p_document_number: dni,
    p_full_name: details.fullName,
    p_email: details.email,
    p_phone: phone,
    p_address: details.address,
    p_city: details.city,
    p_province: details.province,
    p_whatsapp_opt_in: details.whatsappOptIn,
  });
  if (error || !customerId) return NextResponse.json({ error: 'No pudimos guardar tus datos. Revisalos e intentá nuevamente.' }, { status: 400 });
  return NextResponse.json({
    exists: false,
    created: true,
    customerToken: signCustomerToken({ customerId, organizationId: organization.id, slug, dni }),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
