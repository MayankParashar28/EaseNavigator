// Server-side proxy for OpenChargeMap so the API key never ships to the browser.
// The client calls /api/ocm?latitude=..&longitude=..; this forwards to /v3/poi/.
import { json, serverEnv } from './_env';
import { guard } from './_guard';

export const config = { runtime: 'edge' };

const OCM_REQUESTS_PER_MINUTE = 60;

const OCM_POI_URL = 'https://api.openchargemap.io/v3/poi/';
const ALLOWED_PARAMS = ['output', 'latitude', 'longitude', 'distance', 'distanceunit', 'maxresults', 'compact', 'verbose'];

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const blocked = await guard(request, 'ocm', OCM_REQUESTS_PER_MINUTE);
  if (blocked) return blocked;

  const incoming = new URL(request.url).searchParams;
  const target = new URL(OCM_POI_URL);
  for (const name of ALLOWED_PARAMS) {
    const value = incoming.get(name);
    if (value !== null) target.searchParams.set(name, value);
  }

  const key = serverEnv('OCM_API_KEY');
  if (key) target.searchParams.set('key', key);

  try {
    const upstream = await fetch(target.toString(), { headers: { Accept: 'application/json' } });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return json({ error: 'Charging station service unavailable' }, 502);
  }
}
