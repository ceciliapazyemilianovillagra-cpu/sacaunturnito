'use client';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase-browser';

const nav=[
  ['/panel','IN','Inicio'],['/panel/turnos','TU','Turnos'],['/panel/empresa','EM','Empresa'],
  ['/panel/sucursales','SU','Sucursales'],['/panel/profesionales','PR','Profesionales'],
  ['/panel/servicios','SE','Servicios'],['/panel/disponibilidad','DI','Disponibilidad'],
  ['/panel/configuracion','CO','Configuracion']
];
export default function AdminShell({children,role}:{children:React.ReactNode;role?:string}){
 const path=usePathname();
 const visibleNav=role==='professional'?nav.filter(([href])=>href==='/panel'||href==='/panel/turnos'):role?nav:nav.filter(([href])=>href==='/panel');
 async function exit(){await supabase().auth.signOut();location.href='/ingresar';}
 return <div className="admin-layout"><aside className="admin-sidebar"><a className="admin-logo" href="/panel"><span>ST</span><div><b>SACA UN TURNITO</b><small>Panel de gestion</small></div></a><nav>{visibleNav.map(([href,icon,label])=><a key={href} href={href} className={path===href?'active':''}><span>{icon}</span>{label}</a>)}</nav><div className="sidebar-bottom"><a href="/reservar" target="_blank" rel="noreferrer">AB <b>Abrir reservas</b></a><button onClick={exit}>SA <b>Cerrar sesion</b></button></div></aside><div className="admin-content"><header className="mobile-admin-bar"><a href="/panel">SACA UN TURNITO</a><a href="/reservar">Reservar</a></header>{children}</div></div>
}
