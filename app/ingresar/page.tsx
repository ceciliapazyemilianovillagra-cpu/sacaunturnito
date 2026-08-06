'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase-browser';
import AppLogo from '../components/AppLogo';

type AccessType = 'chooser' | 'client' | 'professional';
type ClientMode = 'login' | 'register';

const accountLabels = {
  client: 'cliente o paciente',
  professional: 'profesional',
} as const;

const salesNumber = (process.env.NEXT_PUBLIC_SPC_WHATSAPP || '').replace(/\D/g, '');
const salesMessage = encodeURIComponent('Hola, quiero contratar SACA UN TURNITO para mi negocio.');
const salesWhatsappUrl = salesNumber ? `https://wa.me/${salesNumber}?text=${salesMessage}` : `https://wa.me/?text=${salesMessage}`;

function safeRequestedPath(access: Exclude<AccessType, 'chooser'>) {
  const requested = new URLSearchParams(location.search).get('next') || '';
  const safe = requested.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\');
  if (access === 'professional') return safe && requested.startsWith('/panel') ? requested : '/panel';
  return safe && requested.startsWith('/reservar') ? requested : '/reservar';
}

function PersonIcon({ professional = false }: { professional?: boolean }) {
  return professional ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm-7 8.4c.4-4 3-6.2 7-6.2s6.6 2.2 7 6.2M17.2 5.7h3.6m-1.8-1.8v3.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12.2a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6ZM4.8 20.4c.5-4.1 3-6.3 7.2-6.3s6.7 2.2 7.2 6.3" />
    </svg>
  );
}

export default function Ingresar() {
  const [access, setAccess] = useState<AccessType>('chooser');
  const [clientMode, setClientMode] = useState<ClientMode>('login');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const type = query.get('tipo');
    if (type === 'cliente') setAccess('client');
    if (type === 'profesional') setAccess('professional');
    if (query.get('error') === 'metodo') {
      setAccess('professional');
      setMessage('Esta cuenta pertenece al equipo profesional. Ingresa con las credenciales asignadas por tu organización.');
    } else if (query.get('error')) {
      setMessage('No pudimos completar el ingreso. Intenta nuevamente.');
    }
    if (query.get('estado') === 'inactivo') {
      setAccess('professional');
      setMessage('Esta cuenta fue desactivada. Contacta al administrador de tu organización.');
    }
  }, []);

  function choose(next: Exclude<AccessType, 'chooser'>) {
    setAccess(next);
    setMessage('');
    setSuccess(false);
    const query = new URLSearchParams(location.search);
    query.set('tipo', next === 'client' ? 'cliente' : 'profesional');
    history.replaceState(null, '', `${location.pathname}?${query.toString()}`);
  }

  function goBack() {
    setAccess('chooser');
    setMessage('');
    setSuccess(false);
    const query = new URLSearchParams(location.search);
    query.delete('tipo');
    history.replaceState(null, '', query.size ? `${location.pathname}?${query.toString()}` : location.pathname);
  }

  async function validateAccount(userId: string, expected: 'client' | 'professional') {
    const db = supabase();
    const { data: profile } = await db.from('profiles').select('role,active').eq('id', userId).maybeSingle();
    const isStaff = Boolean(profile);
    const allowed = expected === 'professional' ? isStaff && profile?.active : !isStaff;
    if (!allowed) {
      await db.auth.signOut();
      setMessage(
        expected === 'professional'
          ? 'Estas credenciales no corresponden a una cuenta profesional activa.'
          : 'Esta cuenta pertenece al equipo profesional. Usa el acceso para profesionales.',
      );
      return false;
    }
    return true;
  }

  async function passwordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (access === 'chooser') return;
    setBusy(true);
    setSuccess(false);
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
    if (await validateAccount(data.user.id, access)) location.replace(safeRequestedPath(access));
    else setBusy(false);
  }

  async function registerClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSuccess(false);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (password !== String(form.get('password_confirmation'))) {
      setMessage('Las contraseñas no coinciden.');
      setBusy(false);
      return;
    }
    const { data, error } = await supabase().auth.signUp({
      email: String(form.get('email')).trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?tipo=cliente&next=${encodeURIComponent('/reservar')}`,
        data: { full_name: String(form.get('name')).trim(), account_type: 'customer' },
      },
    });
    if (error) {
      setMessage('No pudimos crear la cuenta. Revisa los datos o intenta con otro correo.');
      setBusy(false);
      return;
    }
    if (data.session && data.user) {
      location.replace('/reservar');
      return;
    }
    setSuccess(true);
    setMessage('Te enviamos un correo para confirmar tu cuenta. Ábrelo y ya podrás reservar.');
    setBusy(false);
  }

  async function googleLogin() {
    setBusy(true);
    setSuccess(false);
    setMessage('');
    const next = safeRequestedPath('client');
    const { error } = await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?tipo=cliente&next=${encodeURIComponent(next)}`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setMessage('No pudimos iniciar con Google. Intenta nuevamente.');
      setBusy(false);
    }
  }

  return (
    <main className="auth-page auth-page-warm">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-experience">
        <aside className="auth-showcase">
          <a className="auth-logo" href="/" aria-label="Volver al inicio">
            <AppLogo title="SACA UN TURNITO" />
            <div><b>SACA UN TURNITO</b><small>Tu agenda, más simple</small></div>
          </a>
          <div className="auth-showcase-copy">
            <span className="warm-pill">Turnos simples · personas conectadas</span>
            <h1>Un espacio para cuidar tu tiempo.</h1>
            <p>Reservá, organizá y seguí cada turno desde una experiencia clara, cálida y segura.</p>
          </div>
          <div className="mini-agenda" aria-hidden="true">
            <div className="mini-agenda-head"><span>Tu próximo turno</span><b>Todo listo</b></div>
            <div className="mini-appointment"><time>10:30</time><i>CM</i><div><b>Consulta programada</b><small>Miércoles · Confirmado</small></div><span>✓</span></div>
          </div>
          <div className="showcase-dots" aria-hidden="true"><i /><i /><i /></div>
        </aside>

        <section className="auth-panel">
          {access === 'chooser' ? (
            <div className="auth-panel-content access-chooser">
              <p className="page-kicker">BIENVENIDO</p>
              <h2>¿Cómo querés ingresar?</h2>
              <p className="auth-intro">Elegí el acceso que corresponde para mostrarte las opciones correctas.</p>
              <div className="persona-grid">
                <button className="persona-card client-card" type="button" onClick={() => choose('client')}>
                  <span className="persona-icon"><PersonIcon /></span>
                  <span><b>Soy cliente / paciente</b><small>Quiero reservar o consultar mis turnos</small></span>
                  <i>→</i>
                </button>
                <button className="persona-card professional-card" type="button" onClick={() => choose('professional')}>
                  <span className="persona-icon"><PersonIcon professional /></span>
                  <span><b>Soy profesional</b><small>Quiero administrar mi agenda</small></span>
                  <i>→</i>
                </button>
              </div>
              <p className="secure-note"><span>✓</span> Tus datos y tus turnos están protegidos.</p>
            </div>
          ) : (
            <div className="auth-panel-content auth-form-view">
              <button className="auth-back" type="button" onClick={goBack}>← Cambiar tipo de acceso</button>
              <div className={`access-label ${access}`}><PersonIcon professional={access === 'professional'} /> Acceso para {accountLabels[access]}</div>
              <h2>{access === 'professional' ? 'Ingresá a tu agenda' : clientMode === 'register' ? 'Creá tu cuenta' : 'Reservá tu próximo turno'}</h2>
              <p className="auth-intro">
                {access === 'professional'
                  ? 'Usá el correo y la contraseña que te asignó tu organización.'
                  : clientMode === 'register'
                    ? 'Solo necesitamos algunos datos para proteger tus reservas.'
                    : 'Ingresá de la manera que te resulte más cómoda.'}
              </p>

              {access === 'client' && clientMode === 'login' ? (
                <button type="button" className="google google-rich" onClick={googleLogin} disabled={busy}>
                  <span className="google-mark">G</span><span>Continuar con Google</span>
                </button>
              ) : null}

              {access === 'client' && clientMode === 'login' ? <div className="divider"><span>o ingresá con tu correo</span></div> : null}

              <form className="auth-form" onSubmit={access === 'client' && clientMode === 'register' ? registerClient : passwordLogin}>
                {access === 'client' && clientMode === 'register' ? (
                  <label>Nombre completo<input required name="name" autoComplete="name" minLength={2} maxLength={120} placeholder="Tu nombre y apellido" /></label>
                ) : null}
                <label>{access === 'professional' ? 'Usuario (correo asignado)' : 'Correo electrónico'}<input required name="email" type="email" autoComplete="email" maxLength={254} placeholder="nombre@correo.com" /></label>
                <label>Contraseña<input required name="password" type="password" autoComplete={clientMode === 'register' ? 'new-password' : 'current-password'} minLength={8} maxLength={128} placeholder="Mínimo 8 caracteres" /></label>
                {access === 'client' && clientMode === 'register' ? (
                  <label>Repetir contraseña<input required name="password_confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="Repetí tu contraseña" /></label>
                ) : null}
                <button className="primary-button auth-submit" disabled={busy}>
                  {busy ? 'Un momento...' : access === 'professional' ? 'Ingresar a mi agenda' : clientMode === 'register' ? 'Crear mi cuenta' : 'Ingresar y reservar'}
                </button>
              </form>

              {message ? <p className={`message auth-message ${success ? 'success' : ''}`} role="alert">{message}</p> : null}

              {access === 'client' ? (
                <button className="mode-switch" type="button" onClick={() => { setClientMode(clientMode === 'login' ? 'register' : 'login'); setMessage(''); setSuccess(false); }}>
                  {clientMode === 'login' ? '¿Primera vez? Crear una cuenta' : 'Ya tengo cuenta · Ingresar'}
                </button>
              ) : (
                <div className="professional-sale">
                  <span>¿Todavía no usás SACA UN TURNITO?</span>
                  <a href={salesWhatsappUrl} target="_blank" rel="noreferrer">Quiero el servicio <b>↗</b></a>
                  <small>Te atenderá el equipo de SOY PULSO CREATIVO por WhatsApp.</small>
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
