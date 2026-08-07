import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase } from '../../../../../lib/supabase-admin';
import { enforcePublicRateLimit } from '../../../../../lib/public-booking-security';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!(await enforcePublicRateLimit(request, 'catalog', 90))) {
    return NextResponse.json({ error: 'Demasiadas consultas. Intentá nuevamente en un minuto.' }, { status: 429 });
  }
  const { slug } = await context.params;
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return NextResponse.json({ error: 'Agenda inválida.' }, { status: 400 });
  const db = adminSupabase();
  const { data: organization, error } = await db
    .from('organizations')
    .select('id,name,slug,description,hold_minutes,subscription_status,subscription_valid_until')
    .eq('slug', slug)
    .eq('booking_enabled', true)
    .maybeSingle();
  const enabled = organization && (
    organization.subscription_status === 'active'
    || (organization.subscription_status === 'trialing' && organization.subscription_valid_until && Date.parse(organization.subscription_valid_until) > Date.now())
  );
  if (error || !enabled) return NextResponse.json({ error: 'Esta agenda no está disponible.' }, { status: 404 });
  const [locations, services, professionals] = await Promise.all([
    db.from('locations').select('id,name,address,description').eq('organization_id', organization.id).eq('active', true).order('name'),
    db.from('services').select('id,name,description,duration_minutes,price,color').eq('organization_id', organization.id).eq('active', true).order('name'),
    db.from('profiles').select('id,full_name,specialty,color').eq('organization_id', organization.id).eq('active', true).eq('is_bookable', true).order('full_name'),
  ]);
  if (locations.error || services.error || professionals.error) {
    return NextResponse.json({ error: 'No pudimos cargar la agenda.' }, { status: 500 });
  }
  return NextResponse.json({
    organization: {
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      hold_minutes: organization.hold_minutes,
    },
    locations: locations.data || [],
    services: services.data || [],
    professionals: professionals.data || [],
  }, { headers: { 'Cache-Control': 'no-store' } });
}
