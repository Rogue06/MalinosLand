/**
 * Historique des connexions (DEC-022) : lu par le responsable du site seulement. Le serveur
 * temps réel vérifie lui-même, auprès de la base, que le jeton est celui du responsable.
 */
import { REALTIME_HTTP } from '../config';
import { sanitizeName } from '../core/text';
import { AccountError, accessToken } from './account';

export interface Visit {
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
    return [
      {
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
