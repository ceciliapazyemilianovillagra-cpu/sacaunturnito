import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { serverSupabase } from '../../../../lib/supabase-server';

export const dynamic='force-dynamic';
const inputSchema=z.object({
 email:z.string().trim().toLowerCase().email().max(254),
 full_name:z.string().trim().min(2).max(120),
 role:z.enum(['admin','reception','professional']).default('professional'),
 specialty:z.string().trim().max(120).default(''),
 is_bookable:z.boolean().default(false)
}).strict();

function reply(body:Record<string,unknown>,status=200){
 return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache'}});
}

function isSameOrigin(request:Request){
 const origin=request.headers.get('origin');
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}
}

export async function POST(request:Request){
 try{
  if(!isSameOrigin(request))return reply({error:'Solicitud rechazada por seguridad.'},403);
  const contentLength=Number(request.headers.get('content-length')||0);
  if(contentLength>8192)return reply({error:'Solicitud demasiado grande.'},413);

  const auth=await serverSupabase();
  const {data:{user},error:userError}=await auth.auth.getUser();
  if(userError||!user)return reply({error:'Debes iniciar sesión.'},401);

  const parsed=inputSchema.safeParse(await request.json());
  if(!parsed.success)return reply({error:'Revisa el nombre, correo y rol ingresados.'},400);
  const input=parsed.data;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceKey){console.error('[admin/staff] missing server credentials');return reply({error:'El servicio no está configurado.'},503)}
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:manager}=await admin.from('profiles').select('organization_id,role,active').eq('id',user.id).maybeSingle();
  if(!manager?.active||!['admin','reception'].includes(manager.role))return reply({error:'No tienes permiso para administrar el equipo.'},403);
  if(manager.role==='reception'&&input.role!=='professional')return reply({error:'Solo un administrador puede asignar roles administrativos.'},403);

  const oneHourAgo=new Date(Date.now()-60*60*1000).toISOString();
  const {count}=await admin.from('security_audit_log').select('id',{count:'exact',head:true}).eq('actor_user_id',user.id).eq('action','staff.invite_attempt').gte('created_at',oneHourAgo);
  if((count??0)>=10)return reply({error:'Se alcanzó el límite de invitaciones. Intenta nuevamente más tarde.'},429);
  await admin.from('security_audit_log').insert({organization_id:manager.organization_id,actor_user_id:user.id,action:'staff.invite_attempt',entity:'profiles',details:{role:input.role}});

  const callback=new URL('/auth/callback?next=/crear-clave',request.url).toString();
  const {data:invite,error:inviteError}=await admin.auth.admin.inviteUserByEmail(input.email,{redirectTo:callback,data:{full_name:input.full_name}});
  if(inviteError){console.warn('[admin/staff] invite rejected',inviteError.message);return reply({error:'No se pudo enviar la invitación. Verifica si el correo ya tiene una cuenta.'},400)}
  const {error:profileError}=await admin.from('profiles').upsert({id:invite.user.id,organization_id:manager.organization_id,full_name:input.full_name,role:input.role,specialty:input.specialty,is_bookable:input.role==='professional'&&input.is_bookable,active:true});
  if(profileError){
   console.error('[admin/staff] profile creation failed',profileError.message);
   await admin.auth.admin.deleteUser(invite.user.id);
   return reply({error:'No se pudo crear el perfil. La invitación fue anulada.'},500);
  }
  await admin.from('security_audit_log').insert({organization_id:manager.organization_id,actor_user_id:user.id,action:'staff.invited',entity:'profiles',entity_id:invite.user.id,details:{role:input.role}});
  return reply({ok:true});
 }catch(error){console.error('[admin/staff] failed',error);return reply({error:'No se pudo invitar al integrante.'},500)}
}
