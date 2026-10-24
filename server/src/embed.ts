/**
 * Musée des Malinos, « Essayer ici » (v0.4, PR 10, DEC-038) : deux petites routes du Worker.
 *
 *   POST /embed-check  → vérification technique d'une démo, pour un modérateur (jeton vérifié et
 *                        plafond de 20 par heure tenus par la base). Lit seulement les en-têtes
 *                        du site (jamais le contenu), suit les redirections à la main.
 *   GET  /demo/:id     → visionneuse : une page minuscule qui encadre le site du projet, avec une
 *                        CSP construite pour ce seul projet, affichable seulement dans le jeu.
 *
 * On ne contourne jamais le refus d'un site d'être intégré : ni proxy, ni copie, ni réécriture.
 * Sans dépendance au moteur Cloudflare : testé dans Node (tests/embed.test.ts).
 */
import type { SupabaseConfig } from './account';

export interface EmbedEnv extends SupabaseConfig {
  /** Origines du jeu (les seules qui peuvent afficher la visionneuse). */
  ALLOWED_ORIGINS: string;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const LOCAL_HOST_RE = /(^|\.)(localhost|local|internal|lan|home|arpa|test|example|invalid)$/;
const OWN_HOST_RE = /(^|\.)(malinosland\.pages\.dev|supabase\.(co|com|in))$/;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
/** Redirections suivies au plus. */
export const MAX_REDIRECTS = 3;
/** Délai total d'une vérification. */
export const CHECK_TIMEOUT_MS = 5000;

/** Origines du jeu déclarées dans ALLOWED_ORIGINS (sans « * »). */
export function gameOrigins(allowed: string): string[] {
  return allowed
    .split(',')
    .map((o) => o.trim())
    .filter((o) => /^https?:\/\/[^/\s]+$/.test(o));
}

/**
 * Pourquoi une adresse ne peut pas être vérifiée ni encadrée (null : elle convient).
 * L'analyse suit le navigateur : une IP écrite en décimal, en hexadécimal ou en octal est
 * ramenée à sa forme habituelle, puis refusée comme les autres. `ownHosts` : hôtes du jeu et du
 * serveur, toujours refusés.
 */
export function demoTargetProblem(raw: string, ownHosts: readonly string[] = []): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return 'adresse invalide';
  }
  if (u.protocol !== 'https:') return 'adresse non sécurisée (https uniquement)';
  if (u.username || u.password) return 'identifiants dans l’adresse';
  if (u.port && u.port !== '443') return 'port interdit (443 uniquement)';
  const host = u.hostname;
  if (host.startsWith('[') || host.includes(':') || /^[0-9.]+$/.test(host))
    return 'adresse IP interdite (nom de domaine obligatoire)';
  if (!HOST_RE.test(host)) return 'nom de domaine invalide';
  if (LOCAL_HOST_RE.test(host)) return 'adresse locale';
  if (OWN_HOST_RE.test(host) || ownHosts.includes(host)) return 'adresse de MalinosLand';
  return null;
}

/** Une source de `frame-ancestors` autorise-t-elle cette origine (ex. https://jeu.pages.dev) ? */
export function sourceAllows(source: string, origin: string): boolean {
  const o = new URL(origin);
  const s = source.toLowerCase();
  if (s === '*') return o.protocol === 'https:' || o.protocol === 'http:';
  if (s === "'none'" || s === "'self'" || s.startsWith("'")) return false;
  if (/^[a-z][a-z0-9+.-]*:$/.test(s))
    return s === o.protocol || (s === 'http:' && o.protocol === 'https:');
  const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([a-z0-9.-]+)(?::(\d+|\*))?(?:\/.*)?$/.exec(s);
  if (!m) return false;
  const [, scheme, wildcard, host, port] = m;
  if (scheme && !(`${scheme}:` === o.protocol || (scheme === 'http' && o.protocol === 'https:')))
    return false;
  const hostOk = wildcard ? o.hostname.endsWith(`.${host}`) : o.hostname === host;
  if (!hostOk) return false;
  if (port && port !== '*') {
    const own = o.port || (o.protocol === 'https:' ? '443' : '80');
    if (port !== own) return false;
  }
  return true;
}

/**
 * Le site accepte-t-il d'être affiché dans le cadre ? `ancestors` : toutes les pages qui
 * l'entourent (la visionneuse et le jeu). Prudent : un seul refus suffit.
 */
export function readFraming(
  headers: Headers,
  ancestors: readonly string[],
): { ok: boolean; reason: string } {
  const xfo = (headers.get('x-frame-options') ?? '')
    .toLowerCase()
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (xfo.includes('deny'))
    return { ok: false, reason: 'le site refuse tout cadre (X-Frame-Options : DENY)' };
  if (xfo.includes('sameorigin'))
    return {
      ok: false,
      reason: 'le site n’accepte que ses propres cadres (X-Frame-Options : SAMEORIGIN)',
    };
  if (xfo.some((v) => v.startsWith('allow-from')))
    return {
      ok: false,
      reason: 'en-tête X-Frame-Options ALLOW-FROM (obsolète) : refus par prudence',
    };
  // Plusieurs politiques possibles (séparées par des virgules) : chacune doit accepter.
  const policies = (headers.get('content-security-policy') ?? '').split(',');
  for (const policy of policies) {
    const directive = policy
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .find((parts) => parts[0]?.toLowerCase() === 'frame-ancestors');
    if (!directive) continue;
    const sources = directive.slice(1);
    const refused = ancestors.find((a) => !sources.some((s) => sourceAllows(s, a)));
    if (refused)
      return {
        ok: false,
        reason: `le site limite les cadres (frame-ancestors : ${sources.join(' ') || "'none'"})`,
      };
  }
  return { ok: true, reason: 'aucun en-tête n’interdit le cadre' };
}

export type CheckVerdict = 'accepte' | 'refuse' | 'injoignable';
export interface CheckResult {
  verdict: CheckVerdict;
  reason: string;
}

/**
 * Suit l'adresse à la main (3 redirections au plus, chacune revérifiée, jamais vers une autre
 * origine) puis lit les en-têtes de la page finale. Le contenu n'est jamais lu.
 */
export async function checkEmbed(
  start: string,
  opts: {
    ancestors: readonly string[];
    ownHosts: readonly string[];
    fetcher: Fetcher;
    signal?: AbortSignal;
  },
): Promise<CheckResult> {
  let url = start;
  let origin = '';
  try {
    origin = new URL(start).origin;
  } catch {
    /* adresse invalide : refusée juste après */
  }
  for (let hop = 0; ; hop++) {
    const problem = demoTargetProblem(url, opts.ownHosts);
    if (problem)
      return {
        verdict: 'refuse',
        reason: hop === 0 ? problem : `redirection refusée vers ${url} : ${problem}`,
      };
    if (new URL(url).origin !== origin)
      return {
        verdict: 'refuse',
        reason: `le site redirige vers une autre adresse (${new URL(url).origin}) : le projet doit utiliser celle-ci`,
      };
    let res: Response;
    try {
      res = await opts.fetcher(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'MalinosLand-verification-demo/1.0', Accept: 'text/html' },
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
    } catch {
      return { verdict: 'injoignable', reason: 'le site ne répond pas (5 secondes au plus)' };
    }
    // Le contenu n'est jamais lu : on libère la connexion aussitôt.
    await res.body?.cancel().catch(() => {});
    if (REDIRECTS.has(res.status)) {
      const location = res.headers.get('location');
      if (!location) return { verdict: 'injoignable', reason: 'redirection sans adresse' };
      if (hop >= MAX_REDIRECTS)
        return { verdict: 'refuse', reason: `trop de redirections (${MAX_REDIRECTS} au plus)` };
      url = new URL(location, url).toString();
      continue;
    }
    if (res.status >= 400)
      return { verdict: 'injoignable', reason: `le site répond par une erreur (${res.status})` };
    const framing = readFraming(res.headers, opts.ancestors);
    return { verdict: framing.ok ? 'accepte' : 'refuse', reason: framing.reason };
  }
}

function cors(request: Request, env: EmbedEnv, methods: string): Record<string, string> {
  const origin = request.headers.get('Origin');
  return origin && gameOrigins(env.ALLOWED_ORIGINS).includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': methods,
        Vary: 'Origin',
      }
    : {};
}

/** Hôtes à ne jamais vérifier ni encadrer : le jeu et ce serveur. */
function ownHosts(request: Request, env: EmbedEnv): string[] {
  return [
    new URL(request.url).hostname,
    ...gameOrigins(env.ALLOWED_ORIGINS).map((o) => new URL(o).hostname),
  ];
}

/** POST /embed-check : vérification technique demandée par un modérateur. */
export async function embedCheck(
  request: Request,
  env: EmbedEnv,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const headers = { ...cors(request, env, 'POST'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers });
  const deny = (status: number, error: string) => Response.json({ error }, { status, headers });
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) return deny(503, 'base non configurée');
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!TOKEN_RE.test(token) || token.length > 4096) return deny(403, 'réservé aux modérateurs');
  let id: number;
  try {
    id = Number(((await request.json()) as { id?: unknown }).id);
  } catch {
    return deny(400, 'demande invalide');
  }
  if (!Number.isSafeInteger(id) || id <= 0) return deny(400, 'projet invalide');
  const db = (path: string, init: RequestInit = {}) =>
    fetcher(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: env.SUPABASE_KEY!,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  // Rôle et plafond (20 par heure) vérifiés et comptés par la base.
  try {
    const quota = await db('rpc/embed_check_quota', { method: 'POST', body: '{}' });
    if (!quota.ok || (await quota.json()) !== true)
      return deny(403, 'réservé aux modérateurs (20 vérifications par heure au plus)');
  } catch {
    return deny(502, 'base injoignable');
  }
  let url: string;
  try {
    const res = await db(`projects?id=eq.${id}&select=url`);
    const rows = (await res.json()) as Array<{ url?: unknown }>;
    if (!res.ok || typeof rows[0]?.url !== 'string') return deny(404, 'projet introuvable');
    url = rows[0].url;
  } catch {
    return deny(502, 'base injoignable');
  }
  const ancestors = [new URL(request.url).origin, ...gameOrigins(env.ALLOWED_ORIGINS)];
  const result = await checkEmbed(url, {
    ancestors,
    ownHosts: ownHosts(request, env),
    fetcher,
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  });
  return Response.json(result, { headers });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const VIEWER_STYLE =
  'html,body{margin:0;height:100%;background:#141a2b}iframe{display:block;border:0;width:100%;height:100%;background:#fff}';

async function sha256Base64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

/** CSP de la visionneuse : ce seul projet dans le cadre, et seulement à l'intérieur du jeu. */
export async function demoCsp(
  projectOrigin: string,
  ancestors: readonly string[],
): Promise<string> {
  return [
    "default-src 'none'",
    `style-src 'sha256-${await sha256Base64(VIEWER_STYLE)}'`,
    `frame-src ${projectOrigin}`,
    `frame-ancestors ${ancestors.length > 0 ? ancestors.join(' ') : "'none'"}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/** Page de la visionneuse : un cadre isolé, rien d'autre (aucun script). */
export function demoHtml(url: string): string {
  const host = new URL(url).hostname;
  return [
    '<!doctype html>',
    '<html lang="fr"><head><meta charset="utf-8">',
    `<title>Démo : ${escapeHtml(host)}</title>`,
    `<style>${VIEWER_STYLE}</style></head><body>`,
    `<iframe src="${escapeHtml(url)}" title="Démo de ${escapeHtml(host)}"`,
    ' sandbox="allow-scripts allow-same-origin allow-forms" allow=""',
    ' referrerpolicy="no-referrer" credentialless loading="eager"></iframe>',
    '</body></html>',
  ].join('');
}

function plain(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** GET /demo/:id[?essai] : la visionneuse d'un projet intégrable (essai : modérateur). */
export async function demoPage(
  request: Request,
  env: EmbedEnv,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  if (request.method !== 'GET') return plain(405, 'Méthode non autorisée');
  const url = new URL(request.url);
  const id = /^\/demo\/(\d{1,12})$/.exec(url.pathname)?.[1];
  if (!id) return plain(404, 'Introuvable');
  // Seulement dans un cadre (le jeu) : jamais comme page à part entière.
  if (request.headers.get('Sec-Fetch-Dest') !== 'iframe')
    return plain(403, 'Cette démo ne s’affiche que dans MalinosLand.');
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) return plain(503, 'Base non configurée');
  let target: unknown;
  try {
    const res = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/museum_demo`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: Number(id), p_trial: url.searchParams.has('essai') }),
    });
    target = res.ok ? await res.json() : null;
  } catch {
    return plain(502, 'Base injoignable');
  }
  if (typeof target !== 'string' || demoTargetProblem(target, ownHosts(request, env)))
    return plain(404, 'Cette démo n’est pas disponible.');
  return new Response(demoHtml(target), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': await demoCsp(
        new URL(target).origin,
        gameOrigins(env.ALLOWED_ORIGINS),
      ),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Permissions-Policy':
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(), clipboard-read=(), clipboard-write=()',
    },
  });
}
