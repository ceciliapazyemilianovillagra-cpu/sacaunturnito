import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = { title: 'Sistema de Turnos', description: 'GestiÃ³n de turnos online' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }

