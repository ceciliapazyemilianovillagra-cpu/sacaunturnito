import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { serverSupabase } from '../../../../lib/supabase-server';

export async function POST(request:Request){
 try{
  const auth=await serverSupabase();const {data:{user},error:userError}=await auth.auth.getUser();
  if(userError||!user)return NextResponse.json({error:'Debes iniciar sesion.'},{status:401});
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:manager}=await admin.from('profiles').select('organization_id,role,active').eq('id',user.id).single();
  if(!manager?.active||!['admin','reception'].includes(manager.role))return NextResponse.json({error:'No tenes permiso para administrar el equipo.'},{status:403});
  const body=await request.json();
  if(!body.email||!body.full_name)return NextResponse.json({error:'Nombre y correo son obligatorios.'},{status:400});
  const {data:invite,error:inviteError}=await admin.auth.admin.inviteUserByEmail(String(body.email),{redirectTo:new URL('/auth/callback',request.url).toString(),data:{full_name:String(body.full_name)}});
  if(inviteError)return NextResponse.json({error:inviteError.message},{status:400});
  const {error:profileError}=await admin.from('profiles').upsert({id:invite.user.id,organization_id:manager.organization_id,full_name:String(body.full_name),role:['admin','reception','professional'].includes(body.role)?body.role:'professional',specialty:String(body.specialty||''),is_bookable:Boolean(body.is_bookable),active:true});
  if(profileError)return NextResponse.json({error:profileError.message},{status:400});
  return NextResponse.json({ok:true});
 }catch(error){console.error('[admin/staff] failed',error);return NextResponse.json({error:'No se pudo invitar al integrante.'},{status:500})}
}
