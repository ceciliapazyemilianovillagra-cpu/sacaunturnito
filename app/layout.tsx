import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import PwaRegister from './components/PwaRegister';
import './styles.css';
import './management.css';
import './auth.css';
import './polish.css';

const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope' });
const instagram = process.env.NEXT_PUBLIC_SPC_INSTAGRAM || 'https://www.instagram.com/soypulsocreativo/';

export const metadata: Metadata = {
  metadataBase: new URL('https://sacaunturnito.vercel.app'),
  applicationName: 'SACA UN TURNITO',
  title: { default: 'SACA UN TURNITO', template: '%s | SACA UN TURNITO' },
  description: 'Turnos online simples, seguros y ordenados.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SACA UN TURNITO' },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: '/',
    siteName: 'SACA UN TURNITO',
    title: 'SACA UN TURNITO',
    description: 'Tu próximo turno, sin vueltas.',
    images: [{ url: '/hero-woman.webp', width: 1800, height: 766, alt: 'Reservá tu próximo turno con SACA UN TURNITO' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SACA UN TURNITO',
    description: 'Tu próximo turno, sin vueltas.',
    images: ['/hero-woman.webp'],
  },
};

export const viewport: Viewport = { themeColor: '#f27a5d' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={manrope.variable}>
      <body>
        <PwaRegister />
        {children}
        <footer className="creator-footer">
          <a className="creator-credit" href={instagram} target="_blank" rel="noreferrer" aria-label="Visitar Instagram de SOY PULSO CREATIVO">
            Diseñado por <strong>SOY PULSO CREATIVO</strong>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
          </a>
        </footer>
      </body>
    </html>
  );
}
