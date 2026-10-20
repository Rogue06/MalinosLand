/**
 * Salles du monde : le Hub, et un logement (studio) par compte (`home-` + identifiant réseau du
 * compte). Partagé par le jeu et le serveur temps réel (dimensions, sortie des logements).
 */
import type { Facing } from '../core/iso';
import { homeOwner } from '../multiplayer/protocol';

export const HUB_ROOM = 'hub';

/** Carte utilisée par une salle : le Hub, ou le gabarit « studio » pour tous les logements. */
export function mapIdForRoom(room: string): 'hub' | 'studio' | null {
  if (room === HUB_ROOM) return 'hub';
  return homeOwner(room) ? 'studio' : null;
}

/** En sortant d'un logement (ou si l'entrée est refusée) : devant l'ascenseur du Hub. */
export const HOME_EXIT: { room: string; x: number; y: number; facing: Facing } = {
  room: HUB_ROOM,
  x: 11.9,
  y: 10.6,
  facing: 'py',
};

/** Nombre maximal de personnes en même temps dans un logement. */
export const MAX_PER_HOME = 12;
