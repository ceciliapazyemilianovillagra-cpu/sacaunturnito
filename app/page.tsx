import AppLogo from './components/AppLogo';

const specialties = ['Clínica', 'Odontología', 'Estética'];

export default function Home() {
  return (
    <main className="product-home">
      <header className="product-nav">
        <a href="/" className="product-wordmark"><AppLogo title="SACA UN TURNITO" /><span>SACA UN TURNITO</span></a>
        <nav aria-label="Acciones principales">
          <a href="/ingresar">Ingresar</a>
          <a className="nav-primary" href="/reservar">Sacar un turno</a>
        </nav>
      </header>

      <section className="product-hero">
        <div className="hero-watermark" aria-hidden="true">TURNITO</div>
        <div className="product-copy">
          <p className="product-kicker">TU TIEMPO, MEJOR ORGANIZADO</p>
          <h1>Tu próximo turno, sin vueltas.</h1>
          <p>Encontrá profesionales, elegí un horario real y gestioná tus reservas desde una experiencia simple y segura.</p>
          <div className="product-actions">
            <a href="/reservar">Reservar ahora <span>→</span></a>
            <a href="/ingresar?tipo=profesional" className="ghost-action">Soy profesional</a>
          </div>
          <div className="trust-line"><span>✓</span> Reservas protegidas y disponibilidad en tiempo real</div>
        </div>

        <div className="app-showcase" aria-hidden="true">
          <article className="app-phone phone-explore">
            <div className="phone-bar"><small>9:41</small><i /></div>
            <div className="phone-greeting"><span>Hola 👋</span><b>¿Qué necesitás?</b></div>
            <label className="phone-search">⌕ <span>Buscar servicio o profesional</span></label>
            <div className="specialty-pills">{specialties.map((item, index) => <span className={index === 0 ? 'active' : ''} key={item}>{item}</span>)}</div>
            <div className="featured-doctor"><div className="doctor-avatar">MV</div><div><small>PRÓXIMO DISPONIBLE</small><b>Dra. Martina Vera</b><span>Clínica general · 10:30</span></div><i>→</i></div>
            <div className="mini-doctors"><span><i>LR</i><b>Dr. Luis Ríos</b><small>Cardiología</small></span><span><i>AC</i><b>Dra. Ana Cruz</b><small>Odontología</small></span></div>
            <div className="phone-dock"><b>⌂</b><span>⌕</span><span>▣</span><span>●</span></div>
          </article>

          <article className="app-phone phone-appointments">
            <div className="phone-bar"><small>9:41</small><i /></div>
            <div className="phone-title"><span>Mis turnos</span><b>Próximos</b></div>
            <div className="appointment-tabs"><span className="active">Próximos</span><span>Historial</span></div>
            <div className="preview-turn"><div className="doctor-avatar light">MR</div><div><b>Dr. Martín Rojas</b><small>Cardiología</small><span>Hoy · 10:30</span></div><i>•••</i></div>
            <div className="preview-turn"><div className="doctor-avatar light">SF</div><div><b>Dra. Sofía Ferreyra</b><small>Dermatología</small><span>Jueves · 15:00</span></div><i>•••</i></div>
            <button>Ver detalles</button>
            <div className="phone-dock"><span>⌂</span><span>⌕</span><b>▣</b><span>●</span></div>
          </article>

          <article className="app-phone phone-profile">
            <div className="phone-bar"><small>9:41</small><i /></div>
            <div className="profile-head"><div className="profile-avatar">TB</div><div><small>PROFESIONAL</small><b>Dr. Tomás Benítez</b><span>Clínica general</span></div></div>
            <div className="profile-stats"><span><b>8+</b><small>Años</small></span><span><b>10k+</b><small>Turnos</small></span><span><b>4.9</b><small>Valoración</small></span></div>
            <h3>Horarios disponibles</h3>
            <div className="preview-days"><span>Lun<small>12</small></span><span className="active">Mar<small>13</small></span><span>Mié<small>14</small></span><span>Jue<small>15</small></span></div>
            <div className="preview-slots"><span>09:00</span><span>10:30</span><span>12:00</span><span>15:30</span></div>
            <a href="/reservar">Reservar turno</a>
          </article>
        </div>
      </section>

      <section className="product-benefits">
        <article><span>01</span><div><b>Disponibilidad real</b><p>Elegís únicamente horarios que están libres.</p></div></article>
        <article><span>02</span><div><b>Todo en un lugar</b><p>Clientes, profesionales, sedes y servicios conectados.</p></div></article>
        <article><span>03</span><div><b>Recordatorios claros</b><p>Confirmaciones y avisos para reducir ausencias.</p></div></article>
      </section>
    </main>
  );
}
