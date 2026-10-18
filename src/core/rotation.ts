import type { Facing, Vec2 } from './iso';

/**
 * Rotation d'un quart de tour d'un objet posé sur la grille.
 * Convention : en rotation 0 l'objet « regarde » +y (vers le bas-gauche de l'écran).
 *  - rot 0 → regarde +y   - rot 1 → regarde +x
 *  - rot 2 → regarde -y   - rot 3 → regarde -x
 */
export type Rotation = 0 | 1 | 2 | 3;

const FACING_BY_ROT: readonly Facing[] = ['py', 'px', 'ny', 'nx'];

/** Empreinte (largeur x, profondeur y) après rotation. */
export function rotatedFootprint(w: number, d: number, rot: Rotation): [number, number] {
  return rot % 2 === 0 ? [w, d] : [d, w];
}

/**
 * Transforme un point exprimé dans l'empreinte canonique [0,w]×[0,d]
 * vers l'empreinte tournée.
 */
export function rotatePoint(x: number, y: number, rot: Rotation, w: number, d: number): Vec2 {
  switch (rot) {
    case 0:
      return { x, y };
    case 1:
      return { x: y, y: w - x };
    case 2:
      return { x: w - x, y: d - y };
    case 3:
      return { x: d - y, y: x };
  }
}

/** Orientation monde d'une orientation canonique après rotation. */
export function rotateFacing(f: Facing, rot: Rotation): Facing {
  const base = FACING_BY_ROT.indexOf(f);
  return FACING_BY_ROT[(base + rot) % 4]!;
}

/** Rotation qui fait regarder un objet canonique (+y) dans la direction donnée. */
export function rotationForFacing(f: Facing): Rotation {
  return FACING_BY_ROT.indexOf(f) as Rotation;
}

/** L'orientation regarde-t-elle vers la caméra (+x ou +y) ? */
export function facesCamera(f: Facing): boolean {
  return f === 'px' || f === 'py';
}
