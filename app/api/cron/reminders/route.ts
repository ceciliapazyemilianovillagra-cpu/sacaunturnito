import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache'};
const response=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:noStore});

export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<24||request.headers.get('authorization')!==`Bearer ${secret}`)return response({error:'No autorizado'},401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!serviceKey)return response({error:'Servicio no configurado'},503);
 const db=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});

 // Release expired one-hour holds so they cannot block availability indefinitely.
 const {data:expired}=await db.from('booking_holds').select('appointment_id').lte('expires_at',new Date().toISOString()).limit(500);
 const expiredIds=(expired??[]).map(item=>item.appointment_id);
 if(expiredIds.length){
  await db.from('appointments').update({status:'cancelled'}).in('id',expiredIds).eq('status','pending');
  await db.from('booking_holds').delete().in('appointment_id',expiredIds);
 }

 const resendKey=process.env.RESEND_API_KEY;const from=process.env.RESEND_FROM_EMAIL;
 if(!resendKey||!from)return response({ok:true,expired:expiredIds.length,email:{configured:false,processed:0}});
 const resend=new Resend(resendKey);
 const fromTime=new Date().toISOString();const toTime=new Date(Date.now()+18*60*60*1000).toISOString();
 const {data:appointments,error}=await db.from('appointments').select('id,starts_at,customers!inner(email,full_name),services!inner(name),profiles!appointments_professional_id_fkey(full_name),locations(name)').eq('status','confirmed').gte('starts_at',fromTime).lte('starts_at',toTime).limit(500);
 if(error){console.error('[cron/reminders] query failed',error.message);return response({error:'No se pudieron consultar los recordatorios'},500)}
 const ids=(appointments??[]).map((item:any)=>item.id);
 const {data:sent}=ids.length?await db.from('notification_log').select('appointment_id').in('appointment_id',ids).eq('channel','email').eq('kind','same_day'):{data:[] as Array<{appointment_id:string}>};
 const already=new Set((sent??[]).map(item=>item.appointment_id));
 let processed=0;
 for(const appointment of (appointments??[]) as any[]){
  if(already.has(appointment.id)||!appointment.customers?.email)continue;
  const {error:claimError}=await db.from('notification_log').insert({appointment_id:appointment.id,channel:'email',kind:'same_day',status:'processing',payload:{}});
  if(claimError)continue;
  const when=new Date(appointment.starts_at).toLocaleString('es-AR',{dateStyle:'long',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'});
  const {data:mail,error:mailError}=await resend.emails.send({from,to:appointment.customers.email,subject:'Tu turno es hoy',html:`<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Tu turno es hoy</h1><p>Hola ${escapeHtml(appointment.customers.full_name)}, te esperamos ${escapeHtml(when)}.</p><p><b>${escapeHtml(appointment.services?.name||'Turno')}</b><br>${escapeHtml(appointment.profiles?.full_name||'Profesional')} · ${escapeHtml(appointment.locations?.name||'Sucursal')}</p></div>`});
  await db.from('notification_log').update({status:mailError?'failed':'sent',provider_message_id:mail?.id??null,payload:mailError?{error:'provider_rejected'}:{}}).eq('appointment_id',appointment.id).eq('channel','email').eq('kind','same_day');
  processed++;
 }
 return response({ok:true,expired:expiredIds.length,email:{configured:true,processed}});
}

function escapeHtml(value:string){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]!))}
