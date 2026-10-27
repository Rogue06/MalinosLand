import { sanitizeName } from '../core/text';
import { PORTAL, SIZE_X, SIZE_Y, SPAWN_X, SPAWN_Y, SIZE_Z } from './world';

/**
 * Zones protégées du monde partagé (DEC-048), logique pure et testée, la même pour le jeu et le
 * serveur. Un joueur connecté à son compte pose une **borne de protection** : les colonnes à
 * moins de ZONE_RADIUS cubes autour d'elle (toute la hauteur) sont à lui. Les autres joueurs n'y
 * cassent et n'y posent rien (les modérateurs, si : pour réparer). Sans visite ni modification
 * pendant ZONE_TTL, la protection tombe et la construction se défait petit à petit.
 */
export interface Zone {
  id: string;
  /** Identifiant (compte) du propriétaire. */
  owner: string;
  /** Pseudo du propriétaire, pour les messages. */
  name: string;
  /** La borne. */
  x: number;
  y: number;
  z: number;
  /** Dernière activité du propriétaire (visite ou modification dans la zone), en ms. */
  active: number;
}

/** Demi-côté de la zone : 17 × 17 colonnes autour de la borne. */
export const ZONE_RADIUS = 8;
/** Zones par compte. */
export const MAX_ZONES = 2;
/** Deux semaines sans visite ni modification : la protection tombe. */
export const ZONE_TTL = 14 * 24 * 3600 * 1000;
/** Distance minimale au portail et à la dalle de départ (lieux communs). */
const COMMON_MARGIN = 6;

/** Zone qui couvre cette colonne (null : aucune). */
export function zoneAt(zones: readonly Zone[], x: number, y: number): Zone | null {
  return (
    zones.find((z) => Math.abs(x - z.x) <= ZONE_RADIUS && Math.abs(y - z.y) <= ZONE_RADIUS) ?? null
  );
}

/** Qui agit : identifiant, et modérateur ou non. */
export interface Actor {
  id: string;
  staff: boolean;
}

/** La zone qui empêche cet acteur de modifier cette colonne (null : il peut). */
export function blockingZone(
  zones: readonly Zone[],
  who: Actor,
  x: number,
  y: number,
): Zone | null {
  const z = zoneAt(zones, x, y);
  return z && z.owner !== who.id && !who.staff ? z : null;
}

/** Pourquoi on ne peut pas poser une borne ici (null : possible). */
export function zoneProblem(
  zones: readonly Zone[],
  owner: string,
  x: number,
  y: number,
): string | null {
  if (zones.filter((z) => z.owner === owner).length >= MAX_ZONES)
    return `Tu as déjà ${MAX_ZONES} zones protégées : casse une de tes bornes pour en poser une autre.`;
  const reach = 2 * ZONE_RADIUS + 1;
  if (zones.some((z) => Math.abs(x - z.x) < reach && Math.abs(y - z.y) < reach))
    return 'Trop près d’une autre zone protégée.';
  const dx = Math.max(PORTAL.x0 - x, 0, x - (PORTAL.x0 + PORTAL.w - 1));
  const dy = Math.max(PORTAL.y0 - y, 0, y - (PORTAL.y0 + PORTAL.d - 1));
  const portal = Math.max(dx, dy) - ZONE_RADIUS < COMMON_MARGIN;
  const spawn =
    Math.max(Math.abs(x - SPAWN_X), Math.abs(y - SPAWN_Y)) - ZONE_RADIUS < COMMON_MARGIN;
  if (portal || spawn) return 'Le portail et la dalle de départ restent à tout le monde.';
  return null;
}

/** Jours de protection qu'il reste (arrondi au-dessus, 0 : expirée). */
export function daysLeft(zone: Zone, now: number): number {
  return Math.max(0, Math.ceil((zone.active + ZONE_TTL - now) / (24 * 3600 * 1000)));
}

const ID_RE = /^[a-z0-9]{8,40}$/;
const int = (v: unknown, lo: number, hi: number): v is number =>
  Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

/** Relit une liste de zones prudemment (stockage du serveur, message du serveur). */
export function parseZones(raw: unknown): Zone[] {
  if (!Array.isArray(raw)) return [];
  const out: Zone[] = [];
  for (const e of raw.slice(0, 500)) {
    if (typeof e !== 'object' || e === null) continue;
    const r = e as Record<string, unknown>;
    const name = sanitizeName(r.name);
    if (typeof r.id !== 'string' || !ID_RE.test(r.id)) continue;
    if (typeof r.owner !== 'string' || !ID_RE.test(r.owner) || !name) continue;
    if (!int(r.x, 0, SIZE_X - 1) || !int(r.y, 0, SIZE_Y - 1) || !int(r.z, 0, SIZE_Z - 1)) continue;
    if (typeof r.active !== 'number' || !Number.isFinite(r.active) || r.active < 0) continue;
    out.push({ id: r.id, owner: r.owner, name, x: r.x, y: r.y, z: r.z, active: r.active });
  }
  return out;
}
