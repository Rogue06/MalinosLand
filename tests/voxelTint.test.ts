import { describe, expect, it } from 'vitest';
import {
  appearanceKey,
  DEFAULT_APPEARANCE,
  sanitizeAppearance,
  VOXEL_PALETTES,
  VOXEL_PRESETS,
  type VoxelColorKey,
} from '../src/content/avatars';
import { hexToRgb } from '../src/game/art/color';
import { tintVoxelPixels } from '../src/game/art/voxelTint';

describe('couleurs Malino 3D', () => {
  const keys = Object.keys(VOXEL_PALETTES) as VoxelColorKey[];
  const mask = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 0,
  ]);
  const source = () =>
    new Uint8ClampedArray([
      ...keys.flatMap((k) => [...hexToRgb(VOXEL_PALETTES[k][0]), 180]),
      245,
      245,
      245,
      255,
      150,
      100,
      80,
      0,
    ]);
  it('conserve exactement le rendu original sans personnalisation', () => {
    const pixels = source();
    tintVoxelPixels(pixels, mask, DEFAULT_APPEARANCE);
    expect(pixels).toEqual(source());
  });
  it.each(keys)(
    'ne modifie que la matière %s, sans toucher aux détails ni à la transparence',
    (key) => {
      const pixels = source();
      tintVoxelPixels(pixels, mask, { ...DEFAULT_APPEARANCE, [key]: 1 });
      const expected = source();
      expected.set(hexToRgb(VOXEL_PALETTES[key][1]), keys.indexOf(key) * 4);
      expect(pixels).toEqual(expected);
    },
  );
  it('conserve les nuances des ombres aux reflets', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255, 25, 30, 45, 255, 51, 61, 96, 255, 180, 190, 200, 255, 255, 255, 255, 255,
    ]);
    const tags = new Uint8ClampedArray(Array.from({ length: 5 }, () => [0, 0, 255, 255]).flat());
    tintVoxelPixels(pixels, tags, { ...DEFAULT_APPEARANCE, voxelTop: 3 });
    for (let c = 0; c < 3; c++)
      for (let i = 1; i < 5; i++)
        expect(pixels[i * 4 + c]).toBeGreaterThan(pixels[(i - 1) * 4 + c]!);
    expect([...pixels.slice(0, 3)]).toEqual([0, 0, 0]);
    expect([...pixels.slice(16, 19)]).toEqual([255, 255, 255]);
  });
  it('valide les valeurs reçues et garde les anciens profils compatibles', () => {
    for (const key of keys) {
      for (const invalid of [-1, 1.5, VOXEL_PALETTES[key].length, '1', null])
        expect(sanitizeAppearance({ [key]: invalid })[key]).toBe(0);
      expect(sanitizeAppearance({ [key]: 1 })[key]).toBe(1);
    }
    expect(sanitizeAppearance({ skin: 3 }).voxelSkin).toBe(0);
    for (const p of VOXEL_PRESETS) expect(sanitizeAppearance(p.colors)).toMatchObject(p.colors);
  });
  it('partage les textures identiques et distingue chaque nouvelle palette', () => {
    const original = appearanceKey(DEFAULT_APPEARANCE);
    for (const key of keys)
      expect(appearanceKey({ ...DEFAULT_APPEARANCE, [key]: 1 })).not.toBe(original);
    expect(
      new Set(VOXEL_PRESETS.map((p) => appearanceKey({ ...DEFAULT_APPEARANCE, ...p.colors }))).size,
    ).toBe(6);
    expect(appearanceKey({ ...DEFAULT_APPEARANCE, model: 0, voxelTop: 3 })).toBe(
      appearanceKey({ ...DEFAULT_APPEARANCE, model: 0 }),
    );
  });
});
