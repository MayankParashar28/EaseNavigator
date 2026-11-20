// Abuse protection for the API proxies: only our own site may call them, and
// each client IP gets a limited number of requests per minute.
//
// Rate limiting uses Upstash Redis when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set (shared across all function instances).
// Otherwise it falls back to a per-instance in-memory counter, which is
// best-effort only.
import { json, serverEnv } from './_env';

const WINDOW_SECONDS = 60;

function hostOf(value: string): string | null {
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).host;
  } catch {
    return null;
  }
}

/** True when the request comes from a page on this deployment (or ALLOWED_ORIGINS). */
export function isAllowedOrigin(request: Request): boolean {
  const allowed = new Set<string>();
  const ownHost = request.headers.get('host') ?? new URL(request.url).host;
  allowed.add(ownHost);
  for (const entry of (serverEnv('ALLOWED_ORIGINS') ?? '').split(',')) {
    const host = entry.trim() ? hostOf(entry.trim()) : null;
    if (host) allowed.add(host);
  }

  // Browsers send Origin on POST/CORS requests and Referer on same-origin GETs.
  const source = request.headers.get('origin') ?? request.headers.get('referer');
  if (source) {
    const host = hostOf(source);
    return host !== null && allowed.has(host);
  }
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

const memoryCounters = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, now: number): number {
  const entry = memoryCounters.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryCounters.set(key, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
    if (memoryCounters.size > 5000) {
      for (const [k, v] of memoryCounters) if (v.resetAt <= now) memoryCounters.delete(k);
    }
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

async function redisHit(url: string, token: string, key: string): Promise<number | null> {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(WINDOW_SECONDS), 'NX'],
      ]),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: unknown }>;
    const count = Number(data[0]?.result);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

/** Counts this request against the limit; returns true if it is allowed. */
export async function checkRateLimit(request: Request, bucket: string, limitPerMinute: number): Promise<boolean> {
  const now = Date.now();
  const windowId = Math.floor(now / (WINDOW_SECONDS * 1000));
  const key = `rl:${bucket}:${clientIp(request)}:${windowId}`;

  const url = serverEnv('UPSTASH_REDIS_REST_URL');
  const token = serverEnv('UPSTASH_REDIS_REST_TOKEN');
  const count = (url && token ? await redisHit(url, token, key) : null) ?? memoryHit(key, now);
  return count <= limitPerMinute;
}

/** Runs both checks; returns an error Response to send, or null to continue. */
export async function guard(request: Request, bucket: string, limitPerMinute: number): Promise<Response | null> {
  if (!isAllowedOrigin(request)) return json({ error: 'Forbidden' }, 403);
  if (!(await checkRateLimit(request, bucket, limitPerMinute))) {
    const res = json({ error: 'Too many requests. Please wait a minute and try again.' }, 429);
    res.headers.set('Retry-After', String(WINDOW_SECONDS));
    return res;
  }
  return null;
}

/** Test helper: clears the in-memory counters. */
export function resetRateLimitsForTests(): void {
  memoryCounters.clear();
}
