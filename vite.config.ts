import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (not just VITE_*) so secret keys stay server-side.
  // These are used only by the dev proxy below and are never bundled.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      // Mirrors the Vercel functions in /api so dev and production behave the same.
      proxy: {
        '/api/ocm': {
          target: 'https://api.openchargemap.io',
          changeOrigin: true,
          rewrite: (path) => {
            const query = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
            const key = env.OCM_API_KEY ? `${query ? '&' : ''}key=${encodeURIComponent(env.OCM_API_KEY)}` : '';
            return `/v3/poi/?${query}${key}`;
          },
        },
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: () => '/v1beta/models/gemini-2.5-flash:generateContent',
          headers: env.GEMINI_API_KEY ? { 'x-goog-api-key': env.GEMINI_API_KEY } : undefined,
        },
      },
    },
  };
});
