/**
 * Vérification du compte d'un joueur à l'ouverture de sa connexion.
 *
 * Le navigateur ne peut pas ajouter d'en-tête à une WebSocket : le jeton de connexion Supabase
 * voyage donc dans la liste des sous-protocoles (`Sec-WebSocket-Protocol`), jamais dans l'URL.
 * Le serveur n'a aucun secret : il demande à la base (`my_profile`, avec le jeton du joueur)
 * à quel profil correspond ce jeton. Un jeton absent, invalide ou expiré = visiteur.
 */
import { accountPlayerId } from '../../src/multiplayer/protocol';
import { sanitizeName } from '../../src/core/text';
import type { Account } from './hub';

/** Sous-protocole renvoyé au navigateur (obligatoire dès qu'il en propose). */
export const WS_PROTOCOL = 'malinos.v1';
const TOKEN_PREFIX = 'jwt.';
const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
/** En-tête interne Worker → Durable Object (toujours réécrit par le Worker). */
export const ACCOUNT_HEADER = 'X-Malinos-Account';

export interface SupabaseConfig {
  SUPABASE_URL?: string;
  /** Clé publique (« publishable ») : pas un secret. */
  SUPABASE_KEY?: string;
}

export function readProtocols(header: string | null): { offered: boolean; token: string | null } {
  const list = (header ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const raw = list.find((p) => p.startsWith(TOKEN_PREFIX))?.slice(TOKEN_PREFIX.length) ?? null;
  return {
    offered: list.includes(WS_PROTOCOL),
    token: raw && raw.length <= 4096 && TOKEN_RE.test(raw) ? raw : null,
  };
}

/** Valide un compte (venant de la base ou de l'en-tête interne). */
export function parseAccount(raw: unknown): Account | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = sanitizeName(r.name);
  if (typeof r.id !== 'string' || !accountPlayerId(r.id) || !name) return null;
  return { id: r.id, name };
}

export async function verifyAccount(
  token: string | null,
  env: SupabaseConfig,
  fetcher: typeof fetch = fetch,
): Promise<Account | null> {
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_KEY) return null;
  try {
    const res = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/my_profile`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) return null;
    const rows: unknown = await res.json();
    return Array.isArray(rows) ? parseAccount(rows[0]) : null;
  } catch {
    return null; // base injoignable : on joue en visiteur
  }
}

export function encodeAccountHeader(account: Account): string {
  return encodeURIComponent(JSON.stringify(account));
}

export function decodeAccountHeader(value: string | null): Account | null {
  if (!value) return null;
  try {
    return parseAccount(JSON.parse(decodeURIComponent(value)));
  } catch {
    return null;
  }
}
