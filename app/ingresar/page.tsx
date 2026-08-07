'use client';

import Image from 'next/image';
import { FormEvent, useState } from 'react';
import { supabase } from '../../lib/supabase-browser';
import AppLogo from '../components/AppLogo';

const salesNumber = (process.env.NEXT_PUBLIC_SPC_WHATSAPP || '').replace(/\D/g, '');
const salesMessage = encodeURIComponent('Hola, quiero contratar SACA UN TURNITO para mi negocio.');
const salesWhatsappUrl = salesNumber ? `https://wa.me/${salesNumber}?text=${salesMessage}` : `https://wa.me/?text=${salesMessage}`;

function requestedPanelPath() {
  const requested = new URLSearchParams(location.search).get('next') || '';
  return requested.startsWith('/panel') && !requested.startsWith('//') && !requested.includes('\\') ? requested : '/panel';
}

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const db = supabase();
    const { data, error } = await db.auth.signInWithPassword({
      email: String(form.get('email')).trim().toLowerCase(),
      password: String(form.get('password')),
    });
    if (error || !data.user) {
      setMessage('El usuario o la contraseña no son correctos.');
      setBusy(false);
      return;
    }
    const { data: profile } = await db.from('profiles').select('active').eq('id', data.user.id).maybeSingle();
    if (!profile?.active) {
      await db.auth.signOut();
      setMessage('Esta cuenta no tiene acceso profesional activo. Consultá con tu organización.');
      setBusy(false);
      return;
    }
    location.replace(requestedPanelPath());
  }

  return (
    <main className="auth-page auth-page-warm professional-only-login">
      <div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" />
      <section className="auth-experience">
        <aside className="auth-showcase auth-showcase-professional">
          <Image className="professional-login-image" src="/professional-login.webp" alt="Profesional organizando su agenda desde una notebook" fill priority sizes="(max-width: 860px) 100vw, 460px" />
          <a className="auth-logo" href="/" aria-label="Volver al inicio"><AppLogo title="SACA UN TURNITO" /><div><b>SACA UN TURNITO</b><small>Tu agenda, más simple</small></div></a>
          <div className="auth-showcase-copy"><span className="warm-pill">ACCESO PROFESIONAL</span><h1>Tu agenda, siempre al día.</h1><p>Organizá la atención de tu empresa, tus sucursales y todo tu equipo desde un mismo lugar.</p></div>
        </aside>
        <section className="auth-panel">
          <div className="auth-panel-content auth-form-view">
            <a className="auth-back" href="/">← Volver al inicio</a>
            <div className="access-label professional">PRO · Acceso profesional</div>
            <h2>Ingresá a tu agenda</h2>
            <p className="auth-intro">Usá el usuario y la contraseña que te asignó tu organización. Este acceso no utiliza Google.</p>
            <form className="auth-form" onSubmit={login}>
              <label>Usuario (correo asignado)<input required name="email" type="email" autoComplete="username" maxLength={254} placeholder="nombre@empresa.com" /></label>
              <label>Contraseña<input required name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} placeholder="Tu contraseña" /></label>
              <button className="primary-button auth-submit" disabled={busy}>{busy ? 'Ingresando...' : 'Ingresar a mi agenda'}</button>
            </form>
            {message ? <p className="message auth-message" role="alert">{message}</p> : null}
            <div className="professional-sale"><span>¿Todavía no usás SACA UN TURNITO?</span><a href={salesWhatsappUrl} target="_blank" rel="noreferrer">Quiero contratar el servicio <b>↗</b></a><small>Te atenderá SOY PULSO CREATIVO por WhatsApp.</small></div>
          </div>
        </section>
      </section>
    </main>
  );
}
