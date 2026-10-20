import { CATALOG } from './catalog';
import hub from './maps/hub.json';
import studio from './maps/studio.json';
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
