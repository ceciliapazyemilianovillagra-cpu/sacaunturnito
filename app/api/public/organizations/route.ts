import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase } from '../../../../lib/supabase-admin';
import { enforcePublicRateLimit } from '../../../../lib/public-booking-security';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await enforcePublicRateLimit(request, 'organizations', 60))) {
    return NextResponse.json({ error: 'Demasiadas consultas. Intentá nuevamente en un minuto.' }, { status: 429 });
  }
  const { data, error } = await adminSupabase()
    .from('organizations')
    .select('name,slug,description,subscription_status,subscription_valid_until')
    .eq('booking_enabled', true)
    .order('name')
    .limit(50);
  if (error) return NextResponse.json({ error: 'No pudimos cargar las agendas.' }, { status: 500 });
  const now = Date.now();
  const organizations = (data || [])
    .filter((item) => item.subscription_status === 'active' || (item.subscription_status === 'trialing' && item.subscription_valid_until && Date.parse(item.subscription_valid_until) > now))
    .map(({ name, slug, description }) => ({ name, slug, description }));
  return NextResponse.json({ organizations }, { headers: { 'Cache-Control': 'no-store' } });
}
