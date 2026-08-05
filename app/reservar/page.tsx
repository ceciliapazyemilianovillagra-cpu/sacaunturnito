'use client';
import { useState } from 'react';
export default function Reservar(){ const [sent,setSent]=useState(false); return <main className="booking"><a href="/">â† Inicio</a><h1>SolicitÃ¡ tu turno</h1>{sent?<div className="success"><h2>Â¡Solicitud recibida!</h2><p>Te confirmaremos el turno por WhatsApp.</p></div>:<form onSubmit={async e=>{e.preventDefault();setSent(true)}}><label>Nombre completo<input required /></label><label>WhatsApp<input required type="tel" placeholder="11 5555 5555" /></label><label>Servicio<select required><option value="">ElegÃ­ un servicio</option></select></label><label>Fecha y horario preferido<input required type="datetime-local" /></label><button>Enviar solicitud</button></form>}</main> }

