'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase-browser';

export default function CrearClave() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase().auth.getUser();
      if (!user) {
        location.replace('/ingresar?tipo=profesional');
        return;
      }
      const { data: profile } = await supabase().from('profiles').select('active').eq('id', user.id).maybeSingle();
      if (!profile?.active) {
        await supabase().auth.signOut();
        location.replace('/ingresar?tipo=profesional&estado=inactivo');
        return;
      }
      setReady(true);
    })();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (password !== String(form.get('confirmation'))) {
      setMessage('Las contraseñas no coinciden.');
      setBusy(false);
      return;
    }
    const { error } = await supabase().auth.updateUser({ password });
    if (error) {
      setMessage('No pudimos guardar la contraseña. Usa al menos 8 caracteres e intenta nuevamente.');
      setBusy(false);
      return;
    }
    location.replace('/panel');
  }

  if (!ready) return <main className="auth-page auth-page-warm"><div className="booking-loader">Verificando tu invitación...</div></main>;

  return (
    <main className="auth-page auth-page-warm">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="credential-card">
        <a className="auth-logo compact" href="/">
          <span>ST</span><div><b>SACA UN TURNITO</b><small>Acceso profesional</small></div>
        </a>
        <div className="credential-icon">✓</div>
        <p className="page-kicker">INVITACIÓN CONFIRMADA</p>
        <h1>Creá tu contraseña profesional</h1>
        <p>Esta clave será personal. No la compartas con otros integrantes del equipo.</p>
        <form className="auth-form" onSubmit={save}>
          <label>Nueva contraseña<input required name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="Mínimo 8 caracteres" /></label>
          <label>Repetir contraseña<input required name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="Repetí tu contraseña" /></label>
          <button className="primary-button auth-submit" disabled={busy}>{busy ? 'Guardando...' : 'Guardar e ingresar'}</button>
        </form>
        {message ? <p className="message auth-message" role="alert">{message}</p> : null}
      </section>
    </main>
  );
}
