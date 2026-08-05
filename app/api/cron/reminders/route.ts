import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error:'No autorizado' }, { status:401 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const from = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
  const { data: appointments, error } = await db.from('appointments').select('id,starts_at,customers!inner(phone,full_name,whatsapp_opt_in),services!inner(name)').eq('status','confirmed').gte('starts_at',from).lte('starts_at',to);
  if (error) return NextResponse.json({ error:error.message },{status:500});
  const results = await Promise.all((appointments ?? []).filter((a:any)=>a.customers.whatsapp_opt_in).map(async (a: any) => {
    const phone=a.customers.phone, customerName=a.customers.full_name, serviceName=a.services.name;
    const res = await fetch(`https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:phone,type:'template',template:{name:process.env.WHATSAPP_TEMPLATE_NAME,language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'es_AR'},components:[{type:'body',parameters:[{type:'text',text:customerName},{type:'text',text:new Date(a.starts_at).toLocaleString('es-AR')},{type:'text',text:serviceName}]}]}})});
    const payload=await res.json(); await db.from('notification_log').insert({appointment_id:a.id,channel:'whatsapp',kind:'reminder_24h',status:res.ok?'sent':'failed',provider_message_id:payload.messages?.[0]?.id,payload}); return {id:a.id,ok:res.ok};
  }));
  return NextResponse.json({ processed:results.length, results });
}

