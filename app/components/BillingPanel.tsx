'use client';

import { FormEvent, useEffect, useState } from 'react';

type BillingState = {
  configured: boolean;
  amount: number;
  email?: string;
  status: 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled';
  validUntil?: string | null;
  subscription?: { status: string; amount_ars: number; next_payment_at?: string | null; checkout_url?: string | null } | null;
};
const labels = { trialing: 'Período de prueba', active: 'Suscripción activa', past_due: 'Pago pendiente', paused: 'Suscripción pausada', cancelled: 'Suscripción cancelada' };

export default function BillingPanel() {
  const [state, setState] = useState<BillingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void fetch('/api/billing/mercadopago/subscribe', { cache: 'no-store' })
      .then((response) => response.json())
      .then(setState)
      .catch(() => setMessage('No pudimos consultar el estado de la suscripción.'));
  }, []);

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/billing/mercadopago/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: String(form.get('email')) }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(result?.error || 'No pudimos iniciar el pago.');
      setBusy(false);
      return;
    }
    location.href = result.checkoutUrl;
  }

  return (
    <section className="billing-panel surface" aria-label="Suscripción mensual">
      <div className="billing-heading"><span className="billing-mark">MP</span><div><p className="page-kicker">PLAN MENSUAL</p><h2>Suscripción con Mercado Pago</h2><p>El cobro se renueva automáticamente cada mes y la agenda se habilita según el estado real del pago.</p></div></div>
      {!state ? <p className="billing-loading">Consultando tu plan...</p> : (
        <div className="billing-content">
          <div className={`billing-status billing-${state.status}`}><span>Estado</span><b>{labels[state.status] || state.status}</b>{state.amount > 0 ? <small>${state.amount.toLocaleString('es-AR')} ARS por mes</small> : null}</div>
          {state.status === 'active' ? <div className="billing-ok"><b>Tu agenda está habilitada.</b><span>Mercado Pago notificará automáticamente cada cambio de estado.</span></div> : (
            <form className="billing-form" onSubmit={subscribe}><label>Correo de facturación<input name="email" type="email" defaultValue={state.email || ''} required /></label><button className="primary-button" disabled={busy || !state.configured}>{busy ? 'Abriendo Mercado Pago...' : 'Suscribirme con Mercado Pago'}</button></form>
          )}
          {!state.configured ? <p className="billing-pending">La integración está preparada. Falta cargar las credenciales productivas y definir el precio mensual para habilitar el botón de cobro.</p> : null}
          {message ? <p className="message" role="alert">{message}</p> : null}
        </div>
      )}
    </section>
  );
}
