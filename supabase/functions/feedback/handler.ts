/**
 * Fonction Edge « feedback » : idées et bugs envoyés par les VISITEURS (sans compte).
 *
 * 1. Vérifie le jeton Cloudflare Turnstile (anti-robots) avec la clé secrète, rangée dans les
 *    secrets des fonctions Edge de Supabase (`TURNSTILE_SECRET_KEY`), jamais dans le dépôt.
 * 2. Contrôle le message (type, longueur, contexte borné).
 * 3. L'enregistre avec la clé serveur : le rôle anonyme ne peut plus écrire dans la table
 *    (migration 20261021090000). La limite de 30 messages par heure reste vérifiée par la base.
 *
 * Logique pure (ni Deno ni Supabase) : testée par tests/feedback-function.test.ts ; `index.ts`
 * ne fait que la brancher sur l'environnement Deno.
 */

export interface FeedbackDeps {
  /** Clé secrète Turnstile (secret des fonctions Edge). */
  turnstileSecret: string | undefined;
  supabaseUrl: string | undefined;
  /** Clé serveur Supabase (`sb_secret_…` ou ancienne clé `service_role`). */
  serviceKey: string | undefined;
  /** Origines autorisées à appeler la fonction (le site du jeu). */
  allowedOrigins: string[];
  fetch: typeof fetch;
}

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_BODY = 4096;
const KINDS = new Set(['bug', 'idee']);

export const DEFAULT_ORIGINS = [
  'https://malinosland.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
];

/** Origines autorisées : variable `ALLOWED_ORIGINS` (séparées par des virgules) ou défaut. */
export function parseOrigins(value: string | undefined): string[] {
  const list = (value ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => /^https?:\/\/[a-z0-9.:-]+$/i.test(o));
  return list.length ? list : DEFAULT_ORIGINS;
}

/** Clé serveur : nouvelle clé `default` de SUPABASE_SECRET_KEYS, sinon l'ancienne. */
export function pickServiceKey(
  secretKeysJson: string | undefined,
  legacy: string | undefined,
): string | undefined {
  try {
    const keys = JSON.parse(secretKeysJson ?? '') as Record<string, unknown>;
    const key = keys['default'] ?? Object.values(keys)[0];
    if (typeof key === 'string' && key) return key;
  } catch {
    // Pas de nouvelles clés : on prend l'ancienne.
  }
  return legacy || undefined;
}

export interface FeedbackInput {
  kind: 'bug' | 'idee';
  message: string;
  author_name: string | null;
  context: Record<string, string>;
  token: string;
}

// Caractères de contrôle (sauf saut de ligne) retirés des textes reçus.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f]/g;

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(CONTROL, '').trim();
  return Array.from(text).length <= max ? text : null;
}

/** Valide le corps de la requête ; null s'il est invalide. */
export function parseInput(raw: unknown): FeedbackInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const body = raw as Record<string, unknown>;
  const kind = body.kind;
  if (typeof kind !== 'string' || !KINDS.has(kind)) return null;
  const message = clean(body.message, 1000);
  if (!message || Array.from(message).length < 5) return null;
  let author: string | null = null;
  if (body.author_name !== null && body.author_name !== undefined) {
    author = clean(body.author_name, 40);
    if (!author) return null;
  }
  const token = body.token;
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return null;
  const context: Record<string, string> = {};
  if (body.context !== undefined) {
    if (typeof body.context !== 'object' || body.context === null) return null;
    const entries = Object.entries(body.context as Record<string, unknown>);
    if (entries.length > 6) return null;
    for (const [k, v] of entries) {
      const value = clean(v, 60);
      if (!/^[a-z_]{1,20}$/.test(k) || value === null) return null;
      context[k] = value;
    }
  }
  return { kind: kind as 'bug' | 'idee', message, author_name: author, context, token };
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function reply(status: number, body: object, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Vérifie le jeton Turnstile auprès de Cloudflare. */
async function verifyTurnstile(
  deps: FeedbackDeps,
  token: string,
  ip: string | null,
): Promise<boolean> {
  const form = new URLSearchParams({ secret: deps.turnstileSecret ?? '', response: token });
  if (ip) form.set('remoteip', ip);
  try {
    const res = await deps.fetch(SITEVERIFY, { method: 'POST', body: form });
    const data = (await res.json()) as { success?: unknown };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function handleFeedback(req: Request, deps: FeedbackDeps): Promise<Response> {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin, deps.allowedOrigins);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'methode' }, cors);
  if (!origin || !deps.allowedOrigins.includes(origin))
    return reply(403, { error: 'origine' }, cors);
  if (!deps.turnstileSecret || !deps.supabaseUrl || !deps.serviceKey)
    return reply(503, { error: 'configuration' }, cors);

  const text = await req.text();
  if (text.length > MAX_BODY) return reply(413, { error: 'taille' }, cors);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return reply(400, { error: 'format' }, cors);
  }
  const input = parseInput(raw);
  if (!input) return reply(400, { error: 'format' }, cors);

  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;
  if (!(await verifyTurnstile(deps, input.token, ip))) return reply(403, { error: 'robot' }, cors);

  const { token: _token, ...row } = input;
  const key = deps.serviceKey;
  // Nouvelle clé (`sb_secret_…`) : en-tête apikey seul. Ancienne clé (JWT) : aussi en Bearer.
  const auth: Record<string, string> = key.startsWith('sb_')
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
  const res = await deps.fetch(`${deps.supabaseUrl.replace(/\/+$/, '')}/rest/v1/feedback`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (res.ok) return reply(201, { ok: true }, cors);
  const detail = await res.text().catch(() => '');
  if (/Trop de messages/.test(detail)) return reply(429, { error: 'limite' }, cors);
  return reply(502, { error: 'base' }, cors);
}
