import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'SACA UN TURNITO', description: 'Turnos online simples y ordenados.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }