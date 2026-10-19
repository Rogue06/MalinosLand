/**
 * Serveur temps réel de MalinosLand (Cloudflare Worker).
 *   GET /health  → état du service
 *   GET /ws      → connexion WebSocket au monde (Durable Object « WorldRoom »)
 */
import type { Env } from './WorldRoom';

export { WorldRoom } from './WorldRoom';

/** Une seule instance de monde pour commencer (voir docs/REALTIME_NETWORK.md). */
const WORLD_NAME = 'monde-1';

export function originAllowed(origin: string | null, allowed: string): boolean {
  const list = allowed
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (list.includes('*')) return true;
  return origin !== null && list.includes(origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'malinosland-realtime' });
    }
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Connexion WebSocket attendue', { status: 426 });
      }
      if (!originAllowed(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) {
        return new Response('Origine non autorisée', { status: 403 });
      }
      const stub = env.WORLD.get(env.WORLD.idFromName(WORLD_NAME));
      return stub.fetch(request);
    }
    return new Response('Introuvable', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
