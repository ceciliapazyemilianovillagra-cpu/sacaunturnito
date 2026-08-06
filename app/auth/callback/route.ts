import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function safePath(value: string | null) {
  const requested = value || '/panel';
  return requested.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\') ? requested : '/panel';
}

function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

function redirectWithCookies(source: NextResponse, destination: URL) {
  const target = noStore(NextResponse.redirect(destination));
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const accountType = url.searchParams.get('tipo');
  let next = safePath(url.searchParams.get('next'));
  const initialNext = next;
  const store = await cookies();
  let response = noStore(NextResponse.redirect(new URL(next, url.origin)));

  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items, headers) => {
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          if (headers) Object.entries(headers).forEach(([key, value]) => response.headers.set(key, String(value)));
        },
      },
    },
  );

  if (!code) return noStore(NextResponse.redirect(new URL('/ingresar?error=oauth', url.origin)));
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) return noStore(NextResponse.redirect(new URL('/ingresar?error=oauth', url.origin)));

  const { data: { user } } = await db.auth.getUser();
  if (!user) return noStore(NextResponse.redirect(new URL('/ingresar?error=oauth', url.origin)));
  const { data: profile } = await db.from('profiles').select('role,active').eq('id', user.id).maybeSingle();

  // Google and public registration are client-only. Internal accounts must use
  // the credentials issued by their organization, even if an OAuth link is forced.
  const usedGoogle = user.identities?.some((identity) => identity.provider === 'google') ?? false;
  if (profile && (accountType === 'cliente' || usedGoogle)) {
    response = noStore(NextResponse.redirect(new URL('/ingresar?tipo=profesional&error=metodo', url.origin)));
    await db.auth.signOut();
    return response;
  }

  if (!profile && next.startsWith('/panel')) next = '/reservar';
  if (profile && next.startsWith('/reservar') && accountType !== 'cliente') next = '/panel';
  if (next !== initialNext) response = redirectWithCookies(response, new URL(next, url.origin));
  return response;
}
