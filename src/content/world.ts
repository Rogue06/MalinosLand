import { CATALOG } from './catalog';
import { FURNITURE_COLORS, FURNITURE_TYPES, MAX_DECOR_ITEMS } from './furniture';
import hub from './maps/hub.json';
import studio from './maps/studio.json';
import { buildHomeMap, type DecorItem, type DecorRules } from '../world/decor';
import type { MapFile } from '../world/types';
import { WorldModel } from '../world/WorldModel';

/** Cartes disponibles. Les futures salles (étages, logements) s'ajouteront ici. */
export const MAPS: Record<string, MapFile> = {
  hub: hub as MapFile,
  studio: studio as MapFile,
};

export function loadWorld(mapId: string): WorldModel {
  const map = MAPS[mapId];
  if (!map) throw new Error(`Carte inconnue : ${mapId}`);
  return new WorldModel(map, CATALOG);
}

/** Règles de décoration des logements (meubles autorisés, couleurs, nombre maximal). */
export const HOME_RULES: DecorRules = {
  catalog: CATALOG,
  allowed: FURNITURE_TYPES,
  colors: FURNITURE_COLORS,
  max: MAX_DECOR_ITEMS,
};

/** Monde d'un logement avec sa décoration (null : studio d'origine) ; meubles retenus. */
export function loadHomeWorld(decor: DecorItem[] | null): {
  world: WorldModel;
  items: DecorItem[];
} {
  const { map, items } = buildHomeMap(MAPS.studio!, decor, HOME_RULES);
  return { world: new WorldModel(map, CATALOG), items };
}
