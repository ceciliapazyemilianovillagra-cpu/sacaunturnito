import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function copySession(source:NextResponse,target:NextResponse){
 source.cookies.getAll().forEach(cookie=>target.cookies.set(cookie));
 target.headers.set('Cache-Control','private, no-store, max-age=0');
 target.headers.set('Pragma','no-cache');
 return target;
}

export async function updateSession(request:NextRequest){
 let response=NextResponse.next({request});
 const db=createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {cookies:{
   getAll:()=>request.cookies.getAll(),
   setAll:(items,headers)=>{
    items.forEach(({name,value})=>request.cookies.set(name,value));
    response=NextResponse.next({request});
    items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
    if(headers)Object.entries(headers).forEach(([key,value])=>response.headers.set(key,String(value)));
   }
  }}
 );
 const {data}=await db.auth.getClaims();
 const claims=data?.claims;
 const path=request.nextUrl.pathname;

 if(path.startsWith('/panel')&&!claims){
  const url=request.nextUrl.clone();
  url.pathname='/ingresar';
  url.search='';
  url.searchParams.set('next',`${path}${request.nextUrl.search}`);
  return copySession(response,NextResponse.redirect(url));
 }

 if(path.startsWith('/panel')&&claims?.sub){
  const {data:profile}=await db.from('profiles').select('role,active').eq('id',claims.sub).maybeSingle();
  if(profile&&!profile.active){
   const url=request.nextUrl.clone();url.pathname='/ingresar';url.search='';url.searchParams.set('estado','inactivo');
   return copySession(response,NextResponse.redirect(url));
  }
  const operational=path==='/panel'||path.startsWith('/panel/turnos');
  if(profile?.role==='professional'&&!operational){
   const url=request.nextUrl.clone();url.pathname='/panel/turnos';url.search='';
   return copySession(response,NextResponse.redirect(url));
  }
  if(!profile&&path!=='/panel'){
   const url=request.nextUrl.clone();url.pathname='/panel';url.search='';
   return copySession(response,NextResponse.redirect(url));
  }
 }

 if(path.startsWith('/panel')||path.startsWith('/auth/')){
  response.headers.set('Cache-Control','private, no-store, max-age=0');
  response.headers.set('Pragma','no-cache');
 }
 return response;
}
