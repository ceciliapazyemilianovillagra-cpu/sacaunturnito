'use client';
import { FormEvent, useState } from 'react';
import { supabase } from '../../lib/supabase-browser';
export default function Ingresar(){
 const [message,setMessage]=useState('');
 async function password(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await supabase().auth.signInWithPassword({email:String(f.get('email')),password:String(f.get('password'))});if(error)setMessage(error.message);else location.href='/panel';}
 async function google(){const {error}=await supabase().auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/auth/callback'}});if(error)setMessage(error.message);}
 return <main className="auth-page"><section className="card auth-card"><a className="muted" href="/">Volver al inicio</a><p className="brand">SACA UN TURNITO</p><h1>Ingresar</h1><p className="muted">Accede para organizar tus turnos.</p><form onSubmit={password}><label>Correo<input required name="email" type="email"/></label><label>Contrasena<input required name="password" type="password"/></label><button className="primary-button">Ingresar</button><div className="divider"><span>o</span></div><button type="button" className="google" onClick={google}><span className="google-mark">G</span>Continuar con Google</button>{message&&<p className="message">{message}</p>}</form></section></main>;
}