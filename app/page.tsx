const features = ['Agenda en tiempo real', 'Reservas online', 'Recordatorios automÃ¡ticos por WhatsApp', 'Clientes, profesionales y servicios'];
export default function Home() {
  return <main><section className="hero"><p className="eyebrow">SISTEMA DE TURNOS</p><h1>Tu agenda, clara y siempre disponible.</h1><p className="lead">AdministrÃ¡ reservas, clientes y recordatorios desde un Ãºnico lugar.</p><div className="actions"><a href="/reservar">Reservar un turno</a><a className="secondary" href="/ingresar">Ingresar al panel</a></div></section><section className="grid">{features.map(f=><article key={f}><span>âœ“</span>{f}</article>)}</section></main>
}

