'use client';

import { supabase } from '../../lib/supabase-browser';
import AppLogo from './AppLogo';
import InstallAppButton from './InstallAppButton';

export default function SettingsTools() {
  async function logout() {
    await supabase().auth.signOut();
    location.href = '/ingresar?tipo=profesional';
  }

  return (
    <section className="settings-tools" aria-label="Configuración de la aplicación">
      <article className="settings-tool-card install-card">
        <AppLogo className="settings-logo" title="SACA UN TURNITO" />
        <div>
          <p className="page-kicker">APLICACIÓN</p>
          <h2>Instalá SACA UN TURNITO</h2>
          <p>Usala desde Chrome o Safari como una aplicación, con acceso directo, nombre e icono propios.</p>
          <InstallAppButton />
        </div>
      </article>

      <article className="settings-tool-card security-card">
        <span className="settings-shield" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>
        </span>
        <div>
          <p className="page-kicker">SEGURIDAD</p>
          <h2>Control de la sesión</h2>
          <p>Al cerrar la sesión se elimina el acceso de este dispositivo al panel profesional.</p>
          <button className="logout-danger" type="button" onClick={logout}>Cerrar sesión en este dispositivo</button>
        </div>
      </article>
    </section>
  );
}
