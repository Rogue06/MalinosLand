import { AIR, BUCKET, FIRE, LAVA, LIGHTER, WATER, WATER_BUCKET } from './blocks';
import type { Inventory } from './inventory';
import type { VoxelWorld } from './world';

/**
 * Objets que l'on utilise d'un clic droit (logique pure et testée, la même pour le jeu et pour
 * le serveur du monde partagé) :
 * - **seau** : vise l'eau pour la prendre (l'eau des lacs ne s'épuise pas ; celle qu'un joueur
 *   a versée, si) ;
 * - **seau d'eau** : verse un cube d'eau (le seau redevient vide) ;
 * - **briquet** : allume un feu sur le dessus d'un cube (il ne se propage pas).
 *
 * `index` : la case d'eau visée (seau vide), sinon la case où verser ou allumer.
 * Renvoie les cases changées (indice, cube), ou la raison du refus.
 */
export function useItem(
  world: VoxelWorld,
  inv: Inventory,
  held: number,
  index: number,
  opts: { consume: boolean } = { consume: true },
): { changes: Array<[number, number]> } | { problem: string } {
  if (!inv.has(held)) return { problem: 'Tu n’as pas cet objet.' };
  const c = world.cellOf(index);
  const here = world.get(c.x, c.y, c.z);
  if (held === BUCKET) {
    if (here !== WATER)
      return {
        problem:
          here === LAVA
            ? 'La lave ne se met pas dans un seau.'
            : 'Vise de l’eau pour remplir ton seau.',
      };
    if (world.protectedCell(c.x, c.y, c.z)) return { problem: 'Cet endroit est protégé.' };
    const changes: Array<[number, number]> = [];
    // L'eau d'un lac reste ; un cube d'eau versé par un joueur se reprend.
    if (world.baseAt(c.x, c.y, c.z) !== WATER) {
      world.write(index, AIR, false);
      changes.push([index, AIR]);
    }
    if (opts.consume) {
      inv.remove(BUCKET, 1);
      inv.add(WATER_BUCKET, 1);
    }
    return { changes };
  }
  if (held === WATER_BUCKET) {
    const problem = world.placeProblem(c.x, c.y, c.z, WATER);
    if (problem) return { problem };
    world.write(index, WATER, false);
    if (opts.consume) {
      inv.remove(WATER_BUCKET, 1);
      inv.add(BUCKET, 1);
    }
    return { changes: [[index, WATER]] };
  }
  if (held === LIGHTER) {
    if (here !== AIR) return { problem: 'Allume le feu sur le dessus d’un cube.' };
    if (!world.solidAt(c.x, c.y, c.z - 1) || c.z === 0)
      return { problem: 'Allume le feu sur le dessus d’un cube.' };
    const problem = world.placeProblem(c.x, c.y, c.z, FIRE);
    if (problem) return { problem };
    world.write(index, FIRE, false);
    return { changes: [[index, FIRE]] };
  }
  return { problem: 'Cet objet ne s’utilise pas ainsi.' };
}
