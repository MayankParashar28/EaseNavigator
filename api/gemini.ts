// Server-side proxy for Google Gemini so the API key never ships to the browser.
// The client POSTs a generateContent request body to /api/gemini.
import { json, serverEnv } from './_env';

export const config = { runtime: 'edge' };

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const MAX_BODY_BYTES = 64 * 1024;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const key = serverEnv('GEMINI_API_KEY');
  if (!key) return json({ error: 'AI is not configured' }, 503);

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);

  try {
    const upstream = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch {
    return json({ error: 'AI service unavailable' }, 502);
  }
}
