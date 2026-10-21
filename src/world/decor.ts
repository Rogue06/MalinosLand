import type { Vec2 } from '../core/iso';
import { rotatedFootprint, type Rotation } from '../core/rotation';
import type { CatalogEntry, InteractionDef, MapFile, PlacedObject } from './types';
import { WorldModel } from './WorldModel';

/**
 * Décoration d'un logement (v0.3) : la liste des meubles posés par le propriétaire, enregistrée
 * en base (colonne `homes.decor`). Les objets fixes de la carte (ascenseur, paillasson, décors
 * muraux) ne bougent jamais. Logique pure, testée par tests/decor.test.ts.
 *
 * Toute liste reçue du réseau est revérifiée ici, meuble par meuble : un meuble mal placé est
 * simplement ignoré, et le chemin jusqu'à l'ascenseur reste toujours libre.
 */
export interface DecorItem {
  /** Type du catalogue. */
  t: string;
  x: number;
  y: number;
  r: Rotation;
  /** Couleur (variante de dessin). */
  v: number;
}

export interface DecorRules {
  catalog: Record<string, CatalogEntry>;
  /** Types autorisés dans un logement. */
  allowed: ReadonlySet<string>;
  /** Nombre de couleurs par type (1 par défaut). */
  colors: Readonly<Record<string, number>>;
  max: number;
}

/** Raison d'un refus de placement (null : c'est possible). */
export type PlaceProblem =
  'type' | 'full' | 'outside' | 'entrance' | 'overlap' | 'person' | 'blocks' | null;

export const PLACE_PROBLEMS: Record<NonNullable<PlaceProblem>, string> = {
  type: 'Cet objet ne peut pas aller dans un logement.',
  full: 'Ton logement est plein : range un objet avant d’en ajouter un autre.',
  outside: 'Pose-le sur le sol du studio.',
  entrance: 'Laisse l’entrée et l’ascenseur dégagés.',
  overlap: 'La place est déjà prise.',
  person: 'Quelqu’un se tient là.',
  blocks: 'Il faut garder un passage jusqu’à l’ascenseur et vers chaque meuble.',
};

/** Préfixe des identifiants des meubles posés (le reste de l'id est leur rang). */
export const DECOR_ID_PREFIX = 'decor-';

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Lit une décoration venue de la base ; null si absente (studio d'origine). */
export function parseDecor(raw: unknown, rules: DecorRules): DecorItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: DecorItem[] = [];
  for (const it of raw.slice(0, rules.max)) {
    if (typeof it !== 'object' || it === null) continue;
    const { t, x, y, r, v } = it as Record<string, unknown>;
    if (typeof t !== 'string' || !rules.allowed.has(t) || !rules.catalog[t]) continue;
    if (!isInt(x, 0, 255) || !isInt(y, 0, 255) || !isInt(r, 0, 3) || !isInt(v, 0, 3)) continue;
    items.push({ t, x, y, r: r as Rotation, v: v % (rules.colors[t] ?? 1) });
  }
  return items;
}

/** Sépare une carte de logement en objets fixes et meubles déplaçables (décoration d'origine). */
export function splitHomeMap(
  map: MapFile,
  rules: DecorRules,
): { fixed: PlacedObject[]; furniture: DecorItem[] } {
  const fixed: PlacedObject[] = [];
  const furniture: DecorItem[] = [];
  for (const o of map.objects) {
    if (rules.allowed.has(o.type))
      furniture.push({ t: o.type, x: o.x, y: o.y, r: o.rot ?? 0, v: o.variant ?? 0 });
    else fixed.push(o);
  }
  return { fixed, furniture };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

export function footprint(item: DecorItem, catalog: Record<string, CatalogEntry>): Rect {
  const entry = catalog[item.t];
  const [w, d] = entry ? rotatedFootprint(entry.footprint[0], entry.footprint[1], item.r) : [1, 1];
  return { x: item.x, y: item.y, w, d };
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
const covers = (r: Rect, x: number, y: number) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d;

/**
 * Interaction d'un meuble posé : celle du catalogue, sans quête ni secret (on ne débloque pas un
 * secret du Hub chez soi). Une table basse ouvre le panneau du logement, comme à l'origine.
 */
function decorInteraction(item: DecorItem, entry: CatalogEntry): InteractionDef | undefined {
  if (item.t === 'coffee_table')
    return { kind: 'panel', label: 'Accès et invités du logement', panel: 'home' };
  const base = entry.defaultInteraction;
  if (!base) return undefined;
  const { quest: _quest, secret: _secret, ...rest } = base;
  return rest as InteractionDef;
}

function toObjects(items: DecorItem[], rules: DecorRules): PlacedObject[] {
  return items.map((item, i) => {
    const entry = rules.catalog[item.t]!;
    const interaction = decorInteraction(item, entry);
    return {
      id: `${DECOR_ID_PREFIX}${i}`,
      type: item.t,
      x: item.x,
      y: item.y,
      rot: item.r,
      variant: item.v,
      ...(interaction ? { interaction } : {}),
    };
  });
}

/** Carte du logement : objets fixes de la carte de base + meubles (sans vérification). */
export function composeHomeMap(base: MapFile, items: DecorItem[], rules: DecorRules): MapFile {
  const { fixed } = splitHomeMap(base, rules);
  return { ...base, objects: [...fixed, ...toObjects(items, rules)] };
}

/**
 * Peut-on ajouter `item` aux meubles `items` ? `people` : positions des personnes présentes
 * (on ne pose pas un meuble sur quelqu'un, ni ne l'enferme).
 */
export function checkPlacement(
  base: MapFile,
  items: DecorItem[],
  item: DecorItem,
  rules: DecorRules,
  people: Vec2[] = [],
): PlaceProblem {
  const entry = rules.catalog[item.t];
  if (!entry || !rules.allowed.has(item.t)) return 'type';
  if (items.length >= rules.max) return 'full';
  const rect = footprint(item, rules.catalog);
  const legendAt = (x: number, y: number) => base.legend[base.tiles[y]?.[x] ?? ''];
  for (let y = rect.y; y < rect.y + rect.d; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const tile = legendAt(x, y);
      if (!tile?.floor || tile.wall) return 'outside';
    }
  }
  // Entrée : objets fixes (ascenseur, paillasson) et case d'arrivée.
  const { fixed } = splitHomeMap(base, rules);
  for (const o of fixed) {
    const fe = rules.catalog[o.type];
    if (!fe) continue;
    const [w, d] = rotatedFootprint(fe.footprint[0], fe.footprint[1], o.rot ?? 0);
    if (overlaps(rect, { x: o.x, y: o.y, w, d })) return 'entrance';
  }
  if (covers(rect, Math.floor(base.spawn.x), Math.floor(base.spawn.y))) return 'entrance';
  // Un tapis peut passer sous un meuble ; deux meubles (ou deux tapis) ne se superposent pas.
  for (const other of items) {
    const oe = rules.catalog[other.t];
    if (!oe || oe.blocking !== entry.blocking) continue;
    if (overlaps(rect, footprint(other, rules.catalog))) return 'overlap';
  }
  if (!entry.blocking) return null;
  if (people.some((p) => covers(rect, Math.floor(p.x), Math.floor(p.y)))) return 'person';
  return keepsPassages(composeHomeMap(base, [...items, item], rules), people, rules)
    ? null
    : 'blocks';
}

/**
 * Passages : depuis l'arrivée, on atteint l'ascenseur, chaque meuble utilisable (siège,
 * interaction) et chaque personne présente.
 */
function keepsPassages(map: MapFile, people: Vec2[], rules: DecorRules): boolean {
  let world: WorldModel;
  try {
    world = new WorldModel(map, rules.catalog);
  } catch {
    return false;
  }
  const reach = world.reachableTiles(map.spawn);
  const reachable = (x: number, y: number) => reach.has(`${x},${y}`);
  const besideReachable = (o: { x: number; y: number; w: number; d: number }) => {
    for (let x = o.x; x < o.x + o.w; x++)
      if (reachable(x, o.y - 1) || reachable(x, o.y + o.d)) return true;
    for (let y = o.y; y < o.y + o.d; y++)
      if (reachable(o.x - 1, y) || reachable(o.x + o.w, y)) return true;
    return false;
  };
  for (const o of world.objects) {
    const usable = o.interaction !== null || o.seats.length > 0;
    if (usable && o.entry.blocking && !besideReachable(o)) return false;
  }
  return people.every((p) => reachable(Math.floor(p.x), Math.floor(p.y)));
}

/**
 * Carte d'un logement à partir de sa décoration (null : studio d'origine). Chaque meuble est
 * revérifié dans l'ordre ; ceux qui ne respectent pas les règles sont ignorés.
 */
export function buildHomeMap(
  base: MapFile,
  decor: DecorItem[] | null,
  rules: DecorRules,
): { map: MapFile; items: DecorItem[] } {
  const wanted = decor ?? splitHomeMap(base, rules).furniture;
  const items: DecorItem[] = [];
  for (const item of wanted) {
    if (checkPlacement(base, items, item, rules) === null) items.push(item);
  }
  return { map: composeHomeMap(base, items, rules), items };
}

/** Meuble posé sur la case (x, y) : de préférence un meuble plutôt qu'un tapis. -1 si aucun. */
export function itemAt(
  items: DecorItem[],
  x: number,
  y: number,
  catalog: Record<string, CatalogEntry>,
): number {
  let found = -1;
  items.forEach((item, i) => {
    if (!covers(footprint(item, catalog), x, y)) return;
    if (found === -1 || catalog[item.t]?.blocking) found = i;
  });
  return found;
}

/** Rang d'un meuble à partir de l'id de son objet (`decor-3` → 3), ou -1. */
export function decorIndex(objectId: string): number {
  if (!objectId.startsWith(DECOR_ID_PREFIX)) return -1;
  const n = Number(objectId.slice(DECOR_ID_PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : -1;
}
