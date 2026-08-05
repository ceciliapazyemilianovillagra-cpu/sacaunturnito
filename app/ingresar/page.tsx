'use client';
import { FormEvent, useState } from 'react';
import { supabase } from '../../lib/supabase-browser';
export default function Ingresar(){
 const [message,setMessage]=useState('');
 async function password(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await supabase().auth.signInWithPassword({email:String(f.get('email')),password:String(f.get('password'))});if(error)setMessage(error.message);else location.href='/panel';}
 async function google(){const {error}=await supabase().auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/auth/callback'}});if(error)setMessage(error.message);}
 return <main className="booking"><a href="/">â† Inicio</a><h1>Ingresar</h1><form onSubmit={password}><label>Correo<input required name="email" type="email"/></label><label>ContraseÃ±a<input required name="password" type="password"/></label><button>Ingresar</button><button type="button" className="google" onClick={google}>Continuar con Google</button>{message&&<p>{message}</p>}</form></main>;
}

