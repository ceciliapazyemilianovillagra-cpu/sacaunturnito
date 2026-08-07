import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminSupabase } from '../../../../lib/supabase-admin';
import { enforcePublicRateLimit } from '../../../../lib/public-booking-security';

const querySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  service: z.string().uuid(),
  professional: z.string().uuid(),
  location: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest) {
  if (!(await enforcePublicRateLimit(request, 'slots', 90))) {
    return NextResponse.json({ error: 'Demasiadas consultas. Esperá un minuto.' }, { status: 429 });
  }
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Selección inválida.' }, { status: 400 });
  const input = parsed.data;
  const { data, error } = await adminSupabase().rpc('available_slots_public', {
    p_slug: input.slug,
    p_service_id: input.service,
    p_professional_id: input.professional,
    p_location_id: input.location,
    p_date: input.date,
  });
  if (error) return NextResponse.json({ error: 'No pudimos consultar la disponibilidad.' }, { status: 500 });
  return NextResponse.json({ slots: (data || []).map((item: { slot_start: string }) => item.slot_start) }, { headers: { 'Cache-Control': 'no-store' } });
}
