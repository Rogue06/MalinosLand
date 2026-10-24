/**
 * Musée des Malinos : aperçu automatique des projets (v0.4, DEC-040).
 *
 *   POST /preview  { id, action: 'capture' | 'remove' } → un modérateur demande (ou retire) la
 *                  capture du site d'un projet. Rôle et plafond (20 par heure, partagé avec les
 *                  vérifications de démo) tenus par la base ; adresse lue dans la base.
 *   GET /apercu/:id → l'image (WebP, ≈ 20 Ko), servie depuis le stockage gratuit du Worker.
 *
 * La capture est faite par le navigateur de Cloudflare (offre gratuite : 10 minutes par jour),
 * jamais sur la machine d'un joueur. Pendant la capture, seules les adresses https publiques sont
 * chargées (pas d'IP, d'adresse locale ni de MalinosLand) ; dialogues fermés, rien n'est cliqué.
 * La logique des routes est testée dans Node (tests/preview.test.ts), la capture est injectée.
 */
import { demoTargetProblem, gameOrigins, type EmbedEnv, type Fetcher } from './embed';

/** Stockage des aperçus : le sous-ensemble de Workers KV utilisé ici. */
export interface PreviewStore {
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  put(key: string, value: ArrayBuffer | Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PreviewEnv extends EmbedEnv {
  PREVIEWS?: PreviewStore;
}

/** Prend la capture d'une adresse déjà vérifiée ; renvoie l'image WebP. */
export type Capture = (url: string, ownHosts: readonly string[]) => Promise<Uint8Array>;

/** Taille maximale d'un aperçu (au-delà, refus : il doit rester très léger). */
export const PREVIEW_MAX_BYTES = 80_000;
/** Largeur et hauteur de l'image (page de 1280 × 800 réduite de moitié). */
export const PREVIEW_SIZE = { width: 640, height: 400 } as const;

const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const key = (id: number) => `apercu:${id}`;

/** Une image WebP commence par « RIFF….WEBP » : on ne range rien d'autre. */
export function isWebp(bytes: Uint8Array): boolean {
  const tag = (from: number) => String.fromCharCode(...bytes.slice(from, from + 4));
  return bytes.length > 12 && tag(0) === 'RIFF' && tag(8) === 'WEBP';
}

function cors(request: Request, env: EmbedEnv): Record<string, string> {
  const origin = request.headers.get('Origin');
  return origin && gameOrigins(env.ALLOWED_ORIGINS).includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'POST',
        Vary: 'Origin',
      }
    : {};
}

function ownHosts(request: Request, env: EmbedEnv): string[] {
  return [
    new URL(request.url).hostname,
    ...gameOrigins(env.ALLOWED_ORIGINS).map((o) => new URL(o).hostname),
  ];
}

/** POST /preview : capture (ou retrait) de l'aperçu d'un projet, par un modérateur. */
export async function previewRoute(
  request: Request,
  env: PreviewEnv,
  capture: Capture | null,
  fetcher: Fetcher = fetch,
  now: () => number = Date.now,
): Promise<Response> {
  const headers = { ...cors(request, env), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers });
  const deny = (status: number, error: string) => Response.json({ error }, { status, headers });
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) return deny(503, 'base non configurée');
  if (!env.PREVIEWS || !capture) return deny(503, 'aperçus non disponibles sur ce serveur');
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!TOKEN_RE.test(token) || token.length > 4096) return deny(403, 'réservé aux modérateurs');
  let id: number;
  let action: unknown;
  try {
    const body = (await request.json()) as { id?: unknown; action?: unknown };
    id = Number(body.id);
    action = body.action;
  } catch {
    return deny(400, 'demande invalide');
  }
  if (!Number.isSafeInteger(id) || id <= 0) return deny(400, 'projet invalide');
  if (action !== 'capture' && action !== 'remove') return deny(400, 'action inconnue');
  const db = (path: string, init: RequestInit = {}) =>
    fetcher(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: env.SUPABASE_KEY!,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  const setVersion = async (version: string | null) => {
    const res = await db('rpc/set_project_preview', {
      method: 'POST',
      body: JSON.stringify({ p_id: id, p_preview: version }),
    });
    if (!res.ok) throw new Error('base');
  };
  try {
    if (action === 'remove') {
      // Le rôle est vérifié par la base avant de toucher au stockage.
      await setVersion(null);
      await env.PREVIEWS.delete(key(id));
      return Response.json({ ok: true, preview: null }, { headers });
    }
    const quota = await db('rpc/embed_check_quota', { method: 'POST', body: '{}' });
    if (!quota.ok || (await quota.json()) !== true)
      return deny(403, 'réservé aux modérateurs (20 par heure au plus)');
    const res = await db(`projects?id=eq.${id}&select=url`);
    const rows = (await res.json()) as Array<{ url?: unknown }>;
    if (!res.ok || typeof rows[0]?.url !== 'string') return deny(404, 'projet introuvable');
    const url = rows[0].url;
    const problem = demoTargetProblem(url, ownHosts(request, env));
    if (problem) return deny(400, `adresse refusée : ${problem}`);
    let image: Uint8Array;
    try {
      image = await capture(url, ownHosts(request, env));
    } catch {
      return deny(502, 'capture impossible (site trop lent ou injoignable)');
    }
    if (!isWebp(image)) return deny(502, 'capture invalide');
    if (image.byteLength > PREVIEW_MAX_BYTES) return deny(413, 'aperçu trop lourd');
    const version = now().toString(36);
    await env.PREVIEWS.put(key(id), image);
    await setVersion(version);
    return Response.json({ ok: true, preview: version, bytes: image.byteLength }, { headers });
  } catch {
    return deny(502, 'base ou stockage injoignable');
  }
}

/** GET /apercu/:id : l'image d'un aperçu (publique, comme le site qu'elle montre). */
export async function previewImage(request: Request, env: PreviewEnv): Promise<Response> {
  const id = /^\/apercu\/(\d{1,12})$/.exec(new URL(request.url).pathname)?.[1];
  const plain = (status: number) =>
    new Response(null, { status, headers: { 'Cache-Control': 'public, max-age=300' } });
  if (request.method !== 'GET') return plain(405);
  if (!id || !env.PREVIEWS) return plain(404);
  const bytes = await env.PREVIEWS.get(key(Number(id)), 'arrayBuffer');
  if (!bytes) return plain(404);
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/webp',
      // L'adresse contient la version de l'aperçu : elle ne change jamais de contenu.
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Lisible par le jeu pour le dessiner sur les affiches (canevas).
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
