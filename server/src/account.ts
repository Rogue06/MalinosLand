/**
 * Vérification du compte d'un joueur à l'ouverture de sa connexion.
 *
 * Le navigateur ne peut pas ajouter d'en-tête à une WebSocket : le jeton de connexion Supabase
 * voyage donc dans la liste des sous-protocoles (`Sec-WebSocket-Protocol`), jamais dans l'URL.
 * Le serveur n'a aucun secret : il demande à la base (`my_account`, avec le jeton du joueur)
 * à quel profil correspond ce jeton. Un jeton absent, invalide ou expiré = visiteur.
 */
import { accountPlayerId, ROLES, type Role } from '../../src/multiplayer/protocol';
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
  return { id: r.id, name, role: parseRole(r.role), ...(r.staff === true ? { staff: true } : {}) };
}

function parseRole(raw: unknown): Role | null {
  return ROLES.includes(raw as Role) ? (raw as Role) : null;
}

/**
 * Rôle visible d'un compte (`account_role`, information publique : sans jeton). Lève une erreur
 * si la base ne répond pas, pour que le hub garde le rôle connu.
 */
export async function fetchAccountRole(
  uuid: string,
  env: SupabaseConfig,
  fetcher: typeof fetch = fetch,
): Promise<Role | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) throw new Error('base non configurée');
  const res = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/account_role`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user: uuid }),
  });
  if (!res.ok) throw new Error(`base : ${res.status}`);
  return parseRole(await res.json());
}

export async function verifyAccount(
  token: string | null,
  env: SupabaseConfig,
  fetcher: typeof fetch = fetch,
): Promise<Account | null> {
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_KEY) return null;
  try {
    const res = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/my_account`, {
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

/**
 * Le joueur peut-il entrer dans le logement de `ownerUuid` ? On demande à la base
 * (`can_enter_home`) avec le jeton du joueur, ou sans jeton pour un visiteur : c'est elle qui
 * applique le mode d'accès et les invitations. Base injoignable ou erreur = entrée refusée.
 */
export async function checkHomeAccess(
  ownerUuid: string,
  token: string | null,
  env: SupabaseConfig,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) return false;
  const jwt = token && token.length <= 4096 && TOKEN_RE.test(token) ? token : null;
  try {
    const res = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/can_enter_home`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_KEY,
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_owner: ownerUuid }),
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch {
    return false;
  }
}

/** Le jeton est-il celui du responsable du site (`is_site_owner`) ? Erreur = non. */
export async function isSiteOwner(
  token: string | null,
  env: SupabaseConfig,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!token || !TOKEN_RE.test(token) || !env.SUPABASE_URL || !env.SUPABASE_KEY) return false;
  try {
    const res = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/is_site_owner`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    return res.ok && (await res.json()) === true;
  } catch {
    return false;
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
