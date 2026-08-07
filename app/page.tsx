import Image from 'next/image';
import Link from 'next/link';
import AppLogo from './components/AppLogo';

export default function Home() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link href="/" className="landing-brand" aria-label="SACA UN TURNITO, inicio">
          <AppLogo title="SACA UN TURNITO" />
          <span><b>SACA UN TURNITO</b><small>Tu tiempo, mejor organizado</small></span>
        </Link>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-kicker">TURNOS ONLINE, SIMPLES Y SEGUROS</p>
          <h1>Tu próximo turno, sin vueltas.</h1>
          <p className="landing-lead">Encontrá el profesional que necesitás, elegí un horario disponible y reservá desde cualquier dispositivo.</p>
          <div className="landing-actions">
            <Link className="landing-primary" href="/turnos/saca-un-turnito">Sacar un turno <span aria-hidden="true">→</span></Link>
            <Link className="landing-secondary" href="/ingresar">Ingresar</Link>
          </div>
        </div>

        <div className="landing-visual" aria-label="Mujer reservando un turno desde su celular">
          <Image
            src="/hero-woman.webp"
            alt="Mujer de 50 años reservando un turno desde su celular"
            fill
            priority
            sizes="(max-width: 760px) 100vw, (max-width: 1080px) 52vw, 650px"
          />
        </div>
      </section>
    </main>
  );
}
