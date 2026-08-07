import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { adminSupabase } from './supabase-admin';

type CustomerToken = {
  v: 1;
  jti: string;
  sub: string;
  org: string;
  slug: string;
  dni: string;
  exp: number;
};

function secret() {
  const value = process.env.BOOKING_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value || value.length < 32) throw new Error('Falta BOOKING_TOKEN_SECRET.');
  return value;
}

function signature(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

export function normalizeDni(value: string) {
  return value.replace(/\D/g, '');
}

export function signCustomerToken(input: { customerId: string; organizationId: string; slug: string; dni: string }) {
  const payload: CustomerToken = {
    v: 1,
    jti: randomUUID(),
    sub: input.customerId,
    org: input.organizationId,
    slug: input.slug,
    dni: createHash('sha256').update(input.dni).digest('hex'),
    exp: Math.floor(Date.now() / 1000) + 20 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded)}`;
}

export function verifyCustomerToken(token: string, slug: string): CustomerToken | null {
  const [encoded, supplied] = token.split('.');
  if (!encoded || !supplied) return null;
  const expected = signature(encoded);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as CustomerToken;
    if (payload.v !== 1 || payload.slug !== slug || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function enforcePublicRateLimit(request: NextRequest, scope: string, limit: number, windowSeconds = 60) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip') || 'unknown';
  const agent = request.headers.get('user-agent') || 'unknown';
  const keyHash = createHmac('sha256', secret()).update(`${ip}|${agent}`).digest('hex');
  const { data, error } = await adminSupabase().rpc('consume_public_rate_limit', {
    p_key_hash: keyHash,
    p_scope: scope,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return !error && data === true;
}
