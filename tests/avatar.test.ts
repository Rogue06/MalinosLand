import { describe, expect, it } from 'vitest';
import { HAIR_STYLES } from '../src/content/avatars';
import { HAIR_BOUNDS, drawHair } from '../src/game/art/characters';

interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

/** Boîtes dessinées par une coiffure (tête posée en z = 0). */
function hairBoxes(style: number): Box[] {
  const boxes: Box[] = [];
  drawHair((x, y, z, w, d, h) => boxes.push({ x, y, z, w, d, h }), style, '#000', 0);
  return boxes;
}

describe('accessoires de tête', () => {
  it('chaque coiffure a un volume déclaré', () => {
    expect(HAIR_BOUNDS).toHaveLength(HAIR_STYLES.length);
  });

  // Le casque : écouteurs à l'extérieur de halfWidth (hauteur des oreilles 0,07–0,22),
  // arceau au-dessus de `top` dans la bande y 0,075–0,115.
  HAIR_STYLES.forEach((name, style) => {
    it(`le casque ne traverse pas la coiffure « ${name} »`, () => {
      const { halfWidth, top } = HAIR_BOUNDS[style]!;
      for (const b of hairBoxes(style)) {
        const atEarHeight = b.z < 0.22 && b.z + b.h > 0.07;
        if (atEarHeight) {
          expect(b.x).toBeGreaterThanOrEqual(-halfWidth - 1e-9);
          expect(b.x + b.w).toBeLessThanOrEqual(halfWidth + 1e-9);
        }
        const underBand = b.y < 0.115 && b.y + b.d > 0.075;
        if (underBand) expect(b.z + b.h).toBeLessThanOrEqual(top + 1e-9);
      }
    });
  });
});
