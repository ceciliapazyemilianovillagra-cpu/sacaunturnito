import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
export async function GET(request:Request){
 const url=new URL(request.url);const code=url.searchParams.get('code');const requested=url.searchParams.get('next')||'/panel';
 const next=requested.startsWith('/')&&!requested.startsWith('//')&&!requested.includes('\\')?requested:'/panel';
 const store=await cookies();const response=NextResponse.redirect(new URL(next,url.origin));
 response.headers.set('Cache-Control','private, no-store, max-age=0');response.headers.set('Pragma','no-cache');
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>store.getAll(),setAll:(items,headers)=>{items.forEach(({name,value,options})=>response.cookies.set(name,value,options));if(headers)Object.entries(headers).forEach(([key,value])=>response.headers.set(key,String(value)))}}});
 if(!code)return NextResponse.redirect(new URL('/ingresar?error=oauth',url.origin));
 const {error}=await db.auth.exchangeCodeForSession(code);
 if(error){const failed=NextResponse.redirect(new URL('/ingresar?error=oauth',url.origin));response.cookies.getAll().forEach(cookie=>failed.cookies.set(cookie));return failed}
 return response;
}
