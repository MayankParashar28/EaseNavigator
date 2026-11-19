// Minimal typing for the server-side environment (avoids pulling in @types/node).
declare const process: { env: Record<string, string | undefined> };

export function serverEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
