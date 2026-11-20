import { beforeEach, describe, expect, it, vi } from 'vitest';
import gemini from './gemini';
import ocm from './ocm';
import { resetRateLimitsForTests } from './_guard';

const SITE = 'https://ease.example.com';

function req(path: string, init: RequestInit & { origin?: string | null; ip?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set('host', 'ease.example.com');
  if (init.origin !== null) headers.set('origin', init.origin ?? SITE);
  headers.set('x-forwarded-for', init.ip ?? '1.2.3.4');
  return new Request(`${SITE}${path}`, { ...init, headers });
}

function mockUpstream() {
  const fn = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => resetRateLimitsForTests());

describe('/api/ocm', () => {
  it('forwards whitelisted params and adds the server key', async () => {
    vi.stubEnv('OCM_API_KEY', 'SERVER_KEY');
    const upstream = mockUpstream();
    const res = await ocm(req('/api/ocm?latitude=1&longitude=2&key=CLIENT&evil=1'));
    expect(res.status).toBe(200);
    const url = new URL(upstream.mock.calls[0][0]);
    expect(url.searchParams.get('key')).toBe('SERVER_KEY');
    expect(url.searchParams.has('evil')).toBe(false);
    expect(url.searchParams.get('latitude')).toBe('1');
  });

  it('rejects other websites', async () => {
    mockUpstream();
    expect((await ocm(req('/api/ocm', { origin: 'https://evil.example' }))).status).toBe(403);
  });

  it('accepts same-origin GETs that only send a Referer', async () => {
    mockUpstream();
    const headers = { referer: `${SITE}/plan` };
    expect((await ocm(req('/api/ocm?latitude=1', { origin: null, headers }))).status).toBe(200);
  });

  it('rejects requests with no origin information', async () => {
    mockUpstream();
    expect((await ocm(req('/api/ocm', { origin: null }))).status).toBe(403);
  });
});

describe('/api/gemini', () => {
  it('returns 503 when AI is not configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const res = await gemini(req('/api/gemini', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(503);
  });

  it('sends the key in a header, not the URL', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'GKEY');
    const upstream = mockUpstream();
    const res = await gemini(req('/api/gemini', { method: 'POST', body: '{"contents":[]}' }));
    expect(res.status).toBe(200);
    const [url, init] = upstream.mock.calls[0];
    expect(url).not.toContain('GKEY');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('GKEY');
  });

  it('rejects oversized bodies and wrong methods', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'GKEY');
    mockUpstream();
    expect((await gemini(req('/api/gemini', { method: 'POST', body: 'x'.repeat(70_000) }))).status).toBe(413);
    expect((await gemini(req('/api/gemini'))).status).toBe(405);
  });

  it('rate limits each client IP', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'GKEY');
    mockUpstream();
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      statuses.push((await gemini(req('/api/gemini', { method: 'POST', body: '{}' }))).status);
    }
    expect(statuses.slice(0, 30).every(s => s === 200)).toBe(true);
    const limited = await gemini(req('/api/gemini', { method: 'POST', body: '{}' }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('60');
    // A different client is unaffected
    expect((await gemini(req('/api/gemini', { method: 'POST', body: '{}', ip: '9.9.9.9' }))).status).toBe(200);
  });
});
