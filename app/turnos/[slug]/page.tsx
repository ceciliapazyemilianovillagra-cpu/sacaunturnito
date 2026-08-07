import type { Metadata } from 'next';
import BookingWizard from '../../components/BookingWizard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Reservar en ${slug.replace(/-/g, ' ')}`, robots: { index: true, follow: true } };
}

export default async function TenantBooking({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BookingWizard tenantSlug={slug} />;
}
