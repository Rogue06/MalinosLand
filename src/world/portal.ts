import type { Facing } from '../core/iso';

/**
 * Passage entre MalinosLand et le Chantier des mondes (DEC-051), côté Hub. Logique pure et
 * testée. Dans la salle de jeux, une borne d'arcade ouvre une faille vers le monde en cubes ; au
 * retour (le Portail des Malinos, dans le Chantier), on réapparaît devant cette borne.
 */

/** Place de la borne dans la carte du Hub (src/content/maps/hub.json). */
export const CHANTIER_ARCADE = { x: 40, y: 1, id: 'arcade-chantier' } as const;

/** Adresse du Chantier depuis le jeu (`/jouer/`) : il saura qu'on vient du Hub. */
export const CHANTIER_URL = '../chantier/?depuis=hub';

/** Durée de l'animation de changement de monde avant de partir (ms). */
export const WORLD_SHIFT_MS = 1900;

/** Où l'on réapparaît en revenant du Chantier : devant la borne, face à elle. */
export const CHANTIER_ARRIVAL: { x: number; y: number; facing: Facing } = {
  x: CHANTIER_ARCADE.x + 0.5,
  y: CHANTIER_ARCADE.y + 1.6,
  facing: 'ny',
};

/** La page a été ouverte depuis le portail du Chantier (`?depuis=chantier`). */
export function fromChantier(search: string): boolean {
  return new URLSearchParams(search).get('depuis') === 'chantier';
}

/** L'adresse sans `depuis` (pour qu'un rechargement ne refasse pas l'arrivée). */
export function withoutOrigin(url: string): string {
  const u = new URL(url);
  // (À la main : URLSearchParams écrirait « ?debug= » au lieu de « ?debug ».)
  const rest = u.search
    .slice(1)
    .split('&')
    .filter((part) => part !== '' && !part.startsWith('depuis='));
  return u.pathname + (rest.length > 0 ? `?${rest.join('&')}` : '') + u.hash;
}
