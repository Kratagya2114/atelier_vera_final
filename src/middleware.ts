import { NextRequest, NextResponse } from 'next/server';

/**
 * Node/Next.js middleware for every /api/* request:
 *  1. Request ID           2. Method + content-type + body-size guards
 *  3. CORS (allow-list)    4. Rate limiting (per IP)
 *  5. Security headers
 *
 * NOTE: the rate-limit store is in memory (per server instance). For multi-instance
 * production deployments swap it for Redis/Upstash.
 */

const ALLOWED_METHODS = ['GET', 'POST', 'OPTIONS', 'HEAD'];
const MAX_BODY_BYTES = 100 * 1024;

const WINDOW_MS = 60_000;
const GENERAL_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE || 60);
// Stricter limits for routes that write data or send email
const STRICT_ROUTES: Record<string, { limit: number; windowMs: number }> = {
  '/api/inquiries': { limit: Number(process.env.RATE_LIMIT_INQUIRIES || 5), windowMs: 10 * 60_000 },
  '/api/configurator/calculate': { limit: 20, windowMs: 60_000 },
  '/api/mail/test': { limit: 3, windowMs: 60_000 },
};

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip')) || 'local';
}

function hit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 5000) {
    buckets.forEach((b, k) => { if (b.resetAt < now) buckets.delete(k); });
  }
  let b = buckets.get(key);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
}

function allowedOrigins(req: NextRequest): string[] {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [req.nextUrl.origin, 'http://localhost:3000', ...configured];
}

function applyHeaders(res: NextResponse, req: NextRequest, requestId: string) {
  const origin = req.headers.get('origin');
  if (origin && allowedOrigins(req).includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
    res.headers.set('Access-Control-Max-Age', '86400');
  }
  res.headers.set('X-Request-Id', requestId);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.method !== 'GET') res.headers.set('Cache-Control', 'no-store');
  return res;
}

function reject(req: NextRequest, requestId: string, status: number, error: string, extra?: Record<string, string>) {
  const res = NextResponse.json({ error, requestId }, { status });
  if (extra) Object.entries(extra).forEach(([k, v]) => res.headers.set(k, v));
  return applyHeaders(res, req, requestId);
}

export function middleware(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const path = req.nextUrl.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return applyHeaders(new NextResponse(null, { status: 204 }), req, requestId);
  }

  if (!ALLOWED_METHODS.includes(req.method)) {
    return reject(req, requestId, 405, 'Method not allowed.', { Allow: ALLOWED_METHODS.join(', ') });
  }

  // Block cross-origin browser calls from origins not on the allow-list
  const origin = req.headers.get('origin');
  if (origin && !allowedOrigins(req).includes(origin)) {
    return reject(req, requestId, 403, 'Origin not allowed.');
  }

  if (req.method === 'POST') {
    const type = req.headers.get('content-type') || '';
    if (!type.includes('application/json')) {
      return reject(req, requestId, 415, 'Content-Type must be application/json.');
    }
    const len = Number(req.headers.get('content-length') || 0);
    if (len > MAX_BODY_BYTES) return reject(req, requestId, 413, 'Request body too large.');
  }

  // Rate limiting
  const strict = STRICT_ROUTES[path];
  const ip = clientIp(req);
  const { limit, windowMs } = strict || { limit: GENERAL_LIMIT, windowMs: WINDOW_MS };
  const result = hit(`${strict ? path : 'general'}:${ip}`, limit, windowMs);
  if (!result.allowed) {
    const retry = Math.ceil((result.resetAt - Date.now()) / 1000);
    return reject(req, requestId, 429, 'Too many requests. Please slow down and try again shortly.', {
      'Retry-After': String(retry),
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0',
    });
  }

  // Pass through, forwarding the request id to route handlers
  const headers = new Headers(req.headers);
  headers.set('x-request-id', requestId);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('X-RateLimit-Limit', String(limit));
  res.headers.set('X-RateLimit-Remaining', String(result.remaining));
  return applyHeaders(res, req, requestId);
}

export const config = { matcher: '/api/:path*' };
