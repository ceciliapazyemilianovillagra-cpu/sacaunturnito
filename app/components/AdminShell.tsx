'use client';

import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase-browser';
import AppLogo from './AppLogo';

const nav = [
  ['/panel', 'IN', 'Inicio'],
  ['/panel/turnos', 'TU', 'Turnos'],
  ['/panel/empresa', 'EM', 'Empresa'],
  ['/panel/sucursales', 'SU', 'Sucursales'],
  ['/panel/profesionales', 'PR', 'Profesionales'],
  ['/panel/servicios', 'SE', 'Servicios'],
  ['/panel/disponibilidad', 'DI', 'Disponibilidad'],
  ['/panel/configuracion', 'CO', 'Configuración'],
];

export default function AdminShell({ children, role }: { children: React.ReactNode; role?: string }) {
  const path = usePathname();
  const isProfessional = role === 'professional';
  const visibleNav = isProfessional
    ? nav.filter(([href]) => href === '/panel' || href === '/panel/turnos')
    : role
      ? nav
      : nav.filter(([href]) => href === '/panel');

  async function exit() {
    await supabase().auth.signOut();
    location.href = '/ingresar?tipo=profesional';
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <a className="admin-logo" href="/panel">
          <AppLogo title="SACA UN TURNITO" />
          <div><b>SACA UN TURNITO</b><small>Panel de gestión</small></div>
        </a>
        <nav>
          {visibleNav.map(([href, icon, label]) => (
            <a key={href} href={href} className={path === href ? 'active' : ''}>
              <span>{icon}</span>{label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/reservar" target="_blank" rel="noreferrer"><span>AB</span><b>Abrir reservas</b></a>
          {!isProfessional && <a href="/panel/configuracion"><span>CO</span><b>Configuración</b></a>}
          <button onClick={exit}><span>SA</span><b>Cerrar sesión</b></button>
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <div className="topbar-context"><span className="topbar-live" /> Espacio profesional</div>
          <div className="topbar-actions">
            {!isProfessional && <a href="/panel/configuracion" className={path === '/panel/configuracion' ? 'active' : ''}>Configuración</a>}
            <button type="button" onClick={exit}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4m4-4H9" /></svg>
              Cerrar sesión
            </button>
          </div>
        </header>
        <header className="mobile-admin-bar">
          <a className="mobile-brand" href="/panel"><AppLogo title="SACA UN TURNITO" /><b>SACA UN TURNITO</b></a>
          <div>
            {!isProfessional && <a href="/panel/configuracion" aria-label="Configuración">Config.</a>}
            <button type="button" onClick={exit}>Salir</button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
