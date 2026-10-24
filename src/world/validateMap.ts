import { FACINGS } from '../core/iso';
import { rotatedFootprint, type Rotation } from '../core/rotation';
import {
  FLOOR_TYPES,
  MAP_FORMAT_VERSION,
  PANEL_IDS,
  WALL_TYPES,
  type CatalogEntry,
  type InteractionDef,
  type MapFile,
} from './types';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;

/**
 * Vérifie la cohérence d'une carte. Renvoie la liste des erreurs (vide si OK).
 * Appelée au chargement et dans les tests : une carte invalide ne doit jamais
 * atteindre le joueur.
 */
export function validateMap(map: MapFile, catalog: Record<string, CatalogEntry>): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);

  if (map.formatVersion !== MAP_FORMAT_VERSION) {
    err(`formatVersion ${map.formatVersion} non supportée (attendue : ${MAP_FORMAT_VERSION})`);
  }
  if (!ID_RE.test(map.id)) err(`id de carte invalide : « ${map.id} »`);
  if (
    !Number.isInteger(map.width) ||
    !Number.isInteger(map.height) ||
    map.width < 1 ||
    map.height < 1
  ) {
    err('dimensions invalides');
    return errors;
  }
  if (map.width * map.height > 256 * 256) err('carte trop grande (max 65 536 tuiles)');

  for (const [ch, entry] of Object.entries(map.legend)) {
    if (ch.length !== 1) err(`clé de légende « ${ch} » : un seul caractère attendu`);
    if (entry.floor && !FLOOR_TYPES.includes(entry.floor)) err(`sol inconnu « ${entry.floor} »`);
    if (entry.wall && !WALL_TYPES.includes(entry.wall)) err(`mur inconnu « ${entry.wall} »`);
  }

  if (map.tiles.length !== map.height) err(`${map.tiles.length} lignes au lieu de ${map.height}`);
  map.tiles.forEach((row, y) => {
    if (row.length !== map.width)
      err(`ligne ${y} : ${row.length} colonnes au lieu de ${map.width}`);
    for (const ch of row) {
      if (!map.legend[ch]) err(`ligne ${y} : caractère « ${ch} » absent de la légende`);
    }
  });

  const isWall = (x: number, y: number) => {
    const ch = map.tiles[y]?.[x];
    return ch !== undefined && !!map.legend[ch]?.wall;
  };
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;

  // Objets
  const ids = new Set<string>();
  const occupied = new Map<string, number>();
  map.objects.forEach((obj, i) => {
    const where = `objet #${i} (${obj.type} @ ${obj.x},${obj.y})`;
    const entry = catalog[obj.type];
    if (!entry) {
      err(`${where} : type inconnu du catalogue`);
      return;
    }
    const rot = (obj.rot ?? 0) as Rotation;
    if (![0, 1, 2, 3].includes(rot)) err(`${where} : rotation invalide`);
    if (!Number.isInteger(obj.x) || !Number.isInteger(obj.y))
      err(`${where} : position non entière`);
    if (obj.id !== undefined) {
      if (!ID_RE.test(obj.id)) err(`${where} : id invalide « ${obj.id} »`);
      if (ids.has(obj.id)) err(`${where} : id « ${obj.id} » en double`);
      ids.add(obj.id);
    }
    if (obj.label !== undefined && (obj.label.length < 1 || obj.label.length > 30)) {
      err(`${where} : label de 1 à 30 caractères`);
    }
    const interaction = obj.interaction ?? entry.defaultInteraction;
    if (interaction) {
      if (!obj.id) err(`${where} : un objet interactif doit avoir un id`);
      errors.push(...validateInteraction(interaction).map((e) => `${where} : ${e}`));
    }
    const [w, d] = rotatedFootprint(entry.footprint[0], entry.footprint[1], rot);
    for (let y = obj.y; y < obj.y + d; y++) {
      for (let x = obj.x; x < obj.x + w; x++) {
        if (!inBounds(x, y)) {
          err(`${where} : déborde de la carte`);
          continue;
        }
        if (!entry.blocking) continue;
        if (isWall(x, y)) err(`${where} : posé sur un mur en ${x},${y}`);
        const key = `${x},${y}`;
        if (occupied.has(key)) err(`${where} : chevauche l’objet #${occupied.get(key)} en ${key}`);
        occupied.set(key, i);
      }
    }
  });

  for (const [i, decor] of map.wallDecor.entries()) {
    if (!isWall(decor.x, decor.y)) err(`décor mural #${i} (${decor.type}) : pas sur un mur`);
    if (decor.side !== 'px' && decor.side !== 'py') err(`décor mural #${i} : face invalide`);
  }

  const zoneIds = new Set<string>();
  for (const zone of map.zones) {
    if (!ID_RE.test(zone.id)) err(`zone « ${zone.id} » : id invalide`);
    if (zoneIds.has(zone.id)) err(`zone « ${zone.id} » en double`);
    zoneIds.add(zone.id);
    const r = zone.rect;
    if (r.w < 1 || r.h < 1 || !inBounds(r.x, r.y) || !inBounds(r.x + r.w - 1, r.y + r.h - 1)) {
      err(`zone « ${zone.id} » : rectangle hors carte`);
    }
  }

  if (!FACINGS.includes(map.spawn.facing)) err('orientation de départ invalide');
  const sx = Math.floor(map.spawn.x);
  const sy = Math.floor(map.spawn.y);
  if (!inBounds(sx, sy) || isWall(sx, sy) || occupied.has(`${sx},${sy}`)) {
    err('le point de départ doit être une case libre');
  }

  return errors;
}

function validateInteraction(it: InteractionDef): string[] {
  const errors: string[] = [];
  if (!it.label || it.label.length > 60) errors.push('libellé d’interaction manquant ou trop long');
  switch (it.kind) {
    case 'dialog':
      if (!Array.isArray(it.lines) || it.lines.length === 0) errors.push('dialogue vide');
      break;
    case 'panel':
      if (!PANEL_IDS.includes(it.panel)) errors.push(`panneau inconnu « ${it.panel} »`);
      break;
    case 'emote':
      if (!it.emoji || !it.text) errors.push('emote incomplète');
      break;
    case 'stand':
      if (!Number.isInteger(it.slot) || it.slot < 0 || it.slot >= 20)
        errors.push(`place de stand invalide « ${String(it.slot)} »`);
      break;
    default:
      errors.push('type d’interaction inconnu');
  }
  return errors;
}
