import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminSupabase } from '../../../../lib/supabase-admin';
import { enforcePublicRateLimit, verifyCustomerToken } from '../../../../lib/public-booking-security';

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  customerToken: z.string().min(40).max(1600),
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  locationId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
});

export async function POST(request: NextRequest) {
  if (!(await enforcePublicRateLimit(request, 'booking', 10))) {
    return NextResponse.json({ error: 'Demasiadas reservas desde este dispositivo. Esperá un minuto.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'La reserva está incompleta.' }, { status: 400 });
  const input = parsed.data;
  const customer = verifyCustomerToken(input.customerToken, input.slug);
  if (!customer) return NextResponse.json({ error: 'La validación del DNI venció. Volvé a ingresarlo.' }, { status: 401 });
  const { data: appointmentId, error } = await adminSupabase().rpc('create_booking_dni_secure', {
    p_slug: input.slug,
    p_customer_id: customer.sub,
    p_service_id: input.serviceId,
    p_professional_id: input.professionalId,
    p_location_id: input.locationId,
    p_starts_at: input.startsAt,
  });
  if (error || !appointmentId) {
    const message = error?.message?.includes('limite') || error?.message?.includes('tres reservas')
      ? error.message
      : 'Ese horario ya no está disponible. Elegí otro e intentá nuevamente.';
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return NextResponse.json({ appointmentId }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
