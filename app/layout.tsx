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
  applicationName: 'SACA UN TURNITO',
  title: { default: 'SACA UN TURNITO', template: '%s | SACA UN TURNITO' },
  description: 'Turnos online simples, seguros y ordenados.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-icon' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SACA UN TURNITO' },
};

export const viewport: Viewport = { themeColor: '#3157f6' };

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
