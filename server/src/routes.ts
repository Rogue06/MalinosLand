/**
 * Petites routes HTTP du Worker, sans dépendance au moteur Cloudflare (testables dans Node).
 */
import { isSiteOwner, type SupabaseConfig } from './account';

/** Ce dont ces routes ont besoin (le vrai `Env` est défini dans WorldRoom.ts). */
export interface RoutesEnv extends SupabaseConfig {
  ALLOWED_ORIGINS: string;
  WORLD: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(url: string): Promise<Response> };
  };
}

/** Une seule instance de monde pour commencer (voir docs/REALTIME_NETWORK.md). */
export const WORLD_NAME = 'monde-1';
/** Le Chantier des mondes partagé : une seule instance, un seul monde pour tous. */
export const CHANTIER_NAME = 'chantier-1';

export function originAllowed(origin: string | null, allowed: string): boolean {
  const list = allowed
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (list.includes('*')) return true;
  return origin !== null && list.includes(origin);
}

/** Historique des connexions : le jeton doit être celui du responsable (vérifié par la base). */
export async function visits(
  request: Request,
  env: RoutesEnv,
  ownerCheck: typeof isSiteOwner = isSiteOwner,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const cors: Record<string, string> =
    origin && originAllowed(origin, env.ALLOWED_ORIGINS)
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers': 'authorization',
          'Access-Control-Allow-Methods': 'GET',
          Vary: 'Origin',
        }
      : {};
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: cors });
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!(await ownerCheck(token, env)))
    return Response.json(
      { error: 'réservé au responsable du site' },
      { status: 403, headers: cors },
    );
  const stub = env.WORLD.get(env.WORLD.idFromName(WORLD_NAME));
  const res = await stub.fetch('https://monde/visits');
  return new Response(res.body, {
    status: res.status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
