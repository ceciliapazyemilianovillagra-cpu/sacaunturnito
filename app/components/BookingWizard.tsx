'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import AppLogo from './AppLogo';

type Catalog = {
  organization: { name: string; slug: string; description?: string; hold_minutes: number };
  locations: Array<{ id: string; name: string; address?: string; description?: string }>;
  services: Array<{ id: string; name: string; description?: string; duration_minutes: number; price: number | string; color: string }>;
  professionals: Array<{ id: string; full_name: string; specialty?: string; color: string }>;
};

const provinces = ['Buenos Aires','Ciudad Autónoma de Buenos Aires','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán'];

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function BookingBrand() {
  return (
    <header className="booking-brand">
      <Link className="booking-brand-logo" href="/" aria-label="Volver al inicio"><AppLogo title="SACA UN TURNITO" /></Link>
      <div><b>SACA UN TURNITO</b><span>Reservas online</span></div>
      <Link className="booking-account" href="/ingresar">Acceso profesional</Link>
    </header>
  );
}

export default function BookingWizard({ tenantSlug }: { tenantSlug: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [dni, setDni] = useState('');
  const [needsDetails, setNeedsDetails] = useState(false);
  const [customerToken, setCustomerToken] = useState('');
  const [service, setService] = useState('');
  const [professional, setProfessional] = useState('');
  const [locationId, setLocationId] = useState('');
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  const selectedService = useMemo(() => catalog?.services.find((item) => item.id === service), [catalog, service]);
  const selectedProfessional = useMemo(() => catalog?.professionals.find((item) => item.id === professional), [catalog, professional]);
  const selectedLocation = useMemo(() => catalog?.locations.find((item) => item.id === locationId), [catalog, locationId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const response = await fetch(`/api/public/catalog/${encodeURIComponent(tenantSlug)}`, { cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        setMessage(result?.error || 'No pudimos cargar esta agenda.');
        setLoading(false);
        return;
      }
      const next = result as Catalog;
      setCatalog(next);
      setService(next.services[0]?.id || '');
      setProfessional(next.professionals[0]?.id || '');
      setLocationId(next.locations[0]?.id || '');
      setLoading(false);
    })();
  }, [tenantSlug]);

  useEffect(() => {
    if (!(customerToken && service && professional && locationId && date)) {
      setSlots([]);
      setSlot('');
      return;
    }
    const controller = new AbortController();
    void (async () => {
      setMessage('');
      const params = new URLSearchParams({ slug: tenantSlug, service, professional, location: locationId, date });
      const response = await fetch(`/api/public/slots?${params}`, { cache: 'no-store', signal: controller.signal });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(result?.error || 'No pudimos consultar los horarios.');
        return;
      }
      setSlots(result.slots || []);
      setSlot('');
    })().catch((error) => { if (error?.name !== 'AbortError') setMessage('No pudimos consultar los horarios.'); });
    return () => controller.abort();
  }, [customerToken, date, locationId, professional, service, tenantSlug]);

  async function identify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const normalized = dni.replace(/\D/g, '');
    const response = await fetch('/api/public/customer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: tenantSlug, dni: normalized }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) setMessage(result?.error || 'No pudimos validar el DNI.');
    else if (result.exists) setCustomerToken(result.customerToken);
    else setNeedsDetails(true);
    setBusy(false);
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/public/customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: tenantSlug,
        dni: dni.replace(/\D/g, ''),
        details: {
          fullName: String(form.get('fullName')),
          email: String(form.get('email')),
          phone: String(form.get('phone')),
          address: String(form.get('address')),
          city: String(form.get('city')),
          province: String(form.get('province')),
          whatsappOptIn: form.get('whatsappOptIn') === 'on',
        },
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) setMessage(result?.error || 'No pudimos guardar tus datos.');
    else setCustomerToken(result.customerToken);
    setBusy(false);
  }

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot || !customerToken || busy) return;
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/public/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: tenantSlug, customerToken, serviceId: service, professionalId: professional, locationId, startsAt: slot }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(result?.error || 'No pudimos reservar el turno.');
      if (response.status === 401) resetIdentity();
      setBusy(false);
      return;
    }
    setDone(true);
  }

  function resetIdentity() {
    setCustomerToken('');
    setNeedsDetails(false);
    setDni('');
    setSlot('');
  }

  if (loading) return <main className="public-booking"><div className="booking-loader">Preparando la agenda...</div></main>;
  if (!catalog) return <main className="public-booking"><BookingBrand /><section className="booking-success booking-error"><div>!</div><h1>Agenda no disponible</h1><p>{message}</p><Link className="primary-link" href="/">Volver al inicio</Link></section></main>;

  if (done) {
    return (
      <main className="public-booking">
        <BookingBrand />
        <section className="booking-success">
          <div>✓</div><p className="page-kicker">SOLICITUD RECIBIDA</p><h1>Tu horario quedó reservado</h1>
          <p>{catalog.organization.name} tiene {catalog.organization.hold_minutes} minutos para confirmar el turno. Te avisaremos al correo registrado.</p>
          <Link className="primary-link" href="/">Volver al inicio</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="public-booking">
      <BookingBrand />
      <section className="booking-hero booking-hero-warm">
        <div><p className="page-kicker">AGENDA DE {catalog.organization.name.toUpperCase()}</p><h1>Tu turno, fácil y rápido.</h1><p>{catalog.organization.description || 'Validá tu DNI una sola vez y elegí entre los horarios realmente disponibles.'}</p></div>
        <div className="booking-progress" aria-label="Progreso de la reserva"><span className="active">1 <b>Datos</b></span><i /><span className={customerToken ? 'active' : ''}>2 <b>Turno</b></span><i /><span>3 <b>Listo</b></span></div>
      </section>

      {message ? <div className="booking-notice" role="alert">{message}</div> : null}

      {!customerToken ? (
        <section className="identity-shell">
          <article className="identity-copy">
            <span className="identity-icon" aria-hidden="true">DNI</span>
            <p className="page-kicker">IDENTIFICACIÓN SIMPLE</p>
            <h2>{needsDetails ? 'Completá tus datos por única vez' : 'Ingresá tu DNI para comenzar'}</h2>
            <p>{needsDetails ? 'La próxima vez, con el mismo DNI recuperaremos estos datos de forma privada.' : 'No necesitás crear una cuenta, recordar una contraseña ni entrar con Google.'}</p>
            <ul><li>Tu información no se muestra públicamente.</li><li>Solo se usa para gestionar tus turnos.</li><li>La empresa verá únicamente sus propios clientes.</li></ul>
          </article>
          {!needsDetails ? (
            <form className="identity-form" onSubmit={identify}>
              <label>Número de DNI<input value={dni} onChange={(event) => setDni(event.target.value.replace(/\D/g, '').slice(0, 9))} inputMode="numeric" autoComplete="off" minLength={6} maxLength={9} placeholder="Ejemplo: 30123456" autoFocus required /></label>
              <small>Escribilo sin puntos ni espacios.</small>
              <button className="primary-button" disabled={busy || dni.length < 6}>{busy ? 'Validando...' : 'Continuar con mi DNI'} <span>→</span></button>
            </form>
          ) : (
            <form className="identity-form identity-form-details" onSubmit={register}>
              <div className="dni-confirmed"><span>DNI</span><b>{dni}</b><button type="button" onClick={resetIdentity}>Cambiar</button></div>
              <label>Nombre y apellido<input name="fullName" autoComplete="name" minLength={2} maxLength={120} required /></label>
              <div className="identity-grid"><label>Correo electrónico<input name="email" type="email" autoComplete="email" maxLength={254} required /></label><label>Celular<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="Código de área + número" required /><small>Sin 0 y sin 15.</small></label></div>
              <label>Dirección<input name="address" autoComplete="street-address" maxLength={180} required /></label>
              <div className="identity-grid"><label>Localidad<input name="city" autoComplete="address-level2" maxLength={100} required /></label><label>Provincia<select name="province" autoComplete="address-level1" defaultValue="" required><option value="" disabled>Seleccioná</option>{provinces.map((province) => <option key={province}>{province}</option>)}</select></label></div>
              <label className="check"><input name="whatsappOptIn" type="checkbox" /> Acepto recibir por WhatsApp el único mensaje de confirmación del turno.</label>
              <button className="primary-button" disabled={busy}>{busy ? 'Guardando...' : 'Guardar y elegir turno'} <span>→</span></button>
            </form>
          )}
        </section>
      ) : (
        <form className="booking-workspace" onSubmit={book}>
          <section className="booking-main">
            <div className="identity-ready"><span>✓</span><div><b>Datos identificados de forma segura</b><small>Usaremos la información registrada para este turno.</small></div><button type="button" onClick={resetIdentity}>Cambiar DNI</button></div>
            <div className="booking-step"><span>1</span><div><b>Elegí un servicio</b><small>Duración y valor</small></div></div>
            <div className="service-choices">
              {catalog.services.map((item) => <button type="button" key={item.id} className={service === item.id ? 'selected' : ''} aria-pressed={service === item.id} onClick={() => setService(item.id)}><i style={{ background: item.color }} /><div><b>{item.name}</b><small>{item.description || `${item.duration_minutes} minutos`}</small></div><span>{item.duration_minutes} min</span></button>)}
            </div>
            <div className="booking-step"><span>2</span><div><b>Elegí profesional y sucursal</b><small>Dónde querés atenderte</small></div></div>
            <div className="choice-grid"><label>Sucursal<select value={locationId} onChange={(event) => setLocationId(event.target.value)}>{catalog.locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Profesional<select value={professional} onChange={(event) => setProfessional(event.target.value)}>{catalog.professionals.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label></div>
            <div className="booking-step"><span>3</span><div><b>Elegí fecha y horario</b><small>Solo mostramos disponibilidad real</small></div></div>
            <label className="date-field">Fecha<input type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <div className="slot-grid">{slots.length ? slots.map((item) => <button type="button" key={item} className={slot === item ? 'selected' : ''} aria-pressed={slot === item} onClick={() => setSlot(item)}>{new Date(item).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</button>) : <p className="no-slots">No hay horarios para esta selección. Probá otra fecha o profesional.</p>}</div>
          </section>
          <aside className="booking-summary">
            <p className="page-kicker">TU TURNO</p><h2>Resumen</h2>
            <div className="summary-line"><span>Servicio</span><b>{selectedService?.name || 'A elegir'}</b></div>
            <div className="summary-line"><span>Profesional</span><b>{selectedProfessional?.full_name || 'A elegir'}</b></div>
            <div className="summary-line"><span>Sucursal</span><b>{selectedLocation?.name || 'A elegir'}</b></div>
            <div className="summary-line"><span>Fecha</span><b>{date ? new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : '-'}</b></div>
            <div className="summary-line"><span>Horario</span><b>{slot ? new Date(slot).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'A elegir'}</b></div>
            <hr /><button className="primary-button" disabled={!slot || busy}>{busy ? 'Reservando...' : 'Reservar este turno'}</button>
            <small className="hold-note">El horario se guarda por {catalog.organization.hold_minutes} minutos hasta su confirmación.</small>
          </aside>
        </form>
      )}
    </main>
  );
}
