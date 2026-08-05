import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
export async function GET(request:Request){const url=new URL(request.url);const code=url.searchParams.get('code');const store=await cookies();const response=NextResponse.redirect(new URL('/panel',url.origin));const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>store.getAll(),setAll:(items)=>items.forEach(({name,value,options})=>response.cookies.set(name,value,options))}});if(code)await db.auth.exchangeCodeForSession(code);return response;}

