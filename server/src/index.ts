/**
 * Serveur temps réel de MalinosLand (Cloudflare Worker).
 *   GET /health  → état du service
 *   GET /ws      → connexion WebSocket au monde (Durable Object « WorldRoom »)
 *   GET /visits  → historique des connexions, pour le responsable du site seulement
 */
import { ACCOUNT_HEADER, encodeAccountHeader, readProtocols, verifyAccount } from './account';
import { originAllowed, visits, WORLD_NAME } from './routes';
import type { Env } from './WorldRoom';

export { WorldRoom } from './WorldRoom';
export { originAllowed } from './routes';

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
      // Compte du joueur (jeton vérifié par la base) ; l'en-tête interne est toujours réécrit.
      const { token } = readProtocols(request.headers.get('Sec-WebSocket-Protocol'));
      const account = await verifyAccount(token, env);
      const headers = new Headers(request.headers);
      headers.delete(ACCOUNT_HEADER);
      if (account) headers.set(ACCOUNT_HEADER, encodeAccountHeader(account));
      const stub = env.WORLD.get(env.WORLD.idFromName(WORLD_NAME));
      return stub.fetch(new Request(request, { headers }));
    }
    if (url.pathname === '/visits') return visits(request, env);
    return new Response('Introuvable', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
