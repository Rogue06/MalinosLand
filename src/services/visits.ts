/**
 * Historique des connexions (DEC-022) : lu par le responsable du site seulement. Le serveur
 * temps réel vérifie lui-même, auprès de la base, que le jeton est celui du responsable.
 */
import { REALTIME_HTTP } from '../config';
import { sanitizeName } from '../core/text';
import { AccountError, accessToken } from './account';

export interface Visit {
  /** Identifiant réseau : stable pour un compte, nouveau à chaque chargement pour un visiteur. */
  player: string;
  name: string;
  account: boolean;
  arrived: number;
  /** null : encore en ligne. */
  left: number | null;
}

export function parseVisits(raw: unknown): Visit[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r: Record<string, unknown>) => {
    const arrived = Number(r?.arrived);
    if (!Number.isFinite(arrived)) return [];
    const left = r.left === null || r.left === undefined ? null : Number(r.left);
    const player =
      typeof r.player === 'string' && /^[a-z0-9]{8,32}$/.test(r.player) ? r.player : '';
    return [
      {
        player,
        name: sanitizeName(r.name) || '?',
        account: r.account === true,
        arrived,
        left: left !== null && Number.isFinite(left) ? left : null,
      },
    ];
  });
}

export async function listVisits(): Promise<Visit[]> {
  if (!REALTIME_HTTP) throw new AccountError('Disponible dans la version en ligne.');
  const token = await accessToken();
  if (!token) throw new AccountError('Connecte-toi d’abord.');
  let res: Response;
  try {
    res = await fetch(`${REALTIME_HTTP}/visits`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new AccountError('Le serveur ne répond pas. Réessaie dans un instant.');
  }
  if (res.status === 403) throw new AccountError('Réservé au responsable du site.');
  if (!res.ok) throw new AccountError('Historique indisponible pour le moment.');
  return parseVisits(await res.json());
}

/** Résumé : nombre de visites et de pseudos différents depuis `since`. */
export function summarize(visits: Visit[], since: number): { visits: number; people: number } {
  const recent = visits.filter((v) => v.arrived >= since);
  return { visits: recent.length, people: new Set(recent.map((v) => v.name.toLowerCase())).size };
}

/**
 * Mesures de fréquentation (PR 6 du plan d'évolution), calculées **uniquement** à partir du
 * journal existant (90 jours, 3 000 visites au plus), sans rien collecter de plus. Limites,
 * affichées avec les chiffres :
 * - on ne suit que les **comptes** (identifiant stable) ; un visiteur change d'identifiant à
 *   chaque chargement de page, et c'est voulu : on ne compte que ses visites ;
 * - la durée est une **durée de connexion** (un onglet oublié compte comme présent) ;
 * - on ne sait rien des activités faites pendant la visite.
 */
export interface Attendance {
  /** Les 7 derniers jours (le plus récent d'abord) : comptes différents et visites de visiteurs. */
  days: Array<{ day: string; accounts: number; guestVisits: number }>;
  accounts7: number;
  accounts90: number;
  guestVisits7: number;
  /** Comptes venus au moins deux jours différents. */
  anotherDay: { returned: number; total: number };
  /** Comptes revenus 7 jours ou plus après leur première visite (parmi ceux arrivés il y a 7 jours ou plus). */
  after7: { returned: number; total: number };
  /** Durée médiane de connexion des visites terminées, en minutes (null : aucune). */
  medianMinutes: number | null;
  /** Le journal a atteint sa limite de 3 000 visites : les plus anciennes manquent. */
  truncated: boolean;
}

const DAY_MS = 24 * 3600 * 1000;
export const VISITS_LIMIT = 3000;

/** Jour local (AAAA-MM-JJ) d'un instant. */
function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function attendance(visits: Visit[], now: number): Attendance {
  const accounts = visits.filter((v) => v.account && v.player);
  const byPlayer = new Map<string, Visit[]>();
  for (const v of accounts) byPlayer.set(v.player, [...(byPlayer.get(v.player) ?? []), v]);

  const days: Attendance['days'] = [];
  for (let i = 0; i < 7; i++) {
    const key = dayKey(now - i * DAY_MS);
    const same = visits.filter((v) => dayKey(v.arrived) === key);
    days.push({
      day: key,
      accounts: new Set(same.filter((v) => v.account && v.player).map((v) => v.player)).size,
      guestVisits: same.filter((v) => !v.account).length,
    });
  }

  let anotherDay = 0;
  let after7Total = 0;
  let after7 = 0;
  for (const list of byPlayer.values()) {
    if (new Set(list.map((v) => dayKey(v.arrived))).size > 1) anotherDay++;
    const first = Math.min(...list.map((v) => v.arrived));
    if (first > now - 7 * DAY_MS) continue;
    after7Total++;
    if (list.some((v) => v.arrived >= first + 7 * DAY_MS)) after7++;
  }

  const durations = visits
    .filter((v) => v.left !== null && v.left >= v.arrived)
    .map((v) => (v.left! - v.arrived) / 60_000)
    .sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  const median =
    durations.length === 0
      ? null
      : durations.length % 2
        ? durations[mid]!
        : (durations[mid - 1]! + durations[mid]!) / 2;

  const since7 = now - 7 * DAY_MS;
  return {
    days,
    accounts7: new Set(accounts.filter((v) => v.arrived >= since7).map((v) => v.player)).size,
    accounts90: byPlayer.size,
    guestVisits7: visits.filter((v) => !v.account && v.arrived >= since7).length,
    anotherDay: { returned: anotherDay, total: byPlayer.size },
    after7: { returned: after7, total: after7Total },
    medianMinutes: median === null ? null : Math.round(median),
    truncated: visits.length >= VISITS_LIMIT,
  };
}
