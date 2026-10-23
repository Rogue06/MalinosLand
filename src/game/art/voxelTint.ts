import { VOXEL_PALETTES, type AvatarAppearance, type VoxelColorKey } from '../../content/avatars';
import { hexToRgb } from './color';

/** Interpolation entre noir, couleur de référence et blanc : conserve les ombres. */
function channel(value: number, base: number, target: number): number {
  return value <= base
    ? (value / base) * target
    : target + ((value - base) / (255 - base)) * (255 - target);
}

/** Masque RGB : peau rouge, cheveux verts, veste bleue, pantalon blanc. Alpha inchangé. */
export function tintVoxelPixels(
  pixels: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  look: AvatarAppearance,
): void {
  const keys = Object.keys(VOXEL_PALETTES) as VoxelColorKey[];
  const colors = keys.map((key) => {
    const palette = VOXEL_PALETTES[key];
    return { base: hexToRgb(palette[0]), target: hexToRgb(palette[look[key] ?? 0] ?? palette[0]) };
  });
  if (keys.every((key) => !look[key])) return;
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const r = mask[i]! / 255,
      g = mask[i + 1]! / 255,
      b = mask[i + 2]! / 255;
    const pants = Math.min(r, g, b);
    const weights = [r - pants, g - pants, b - pants, pants];
    for (let c = 0; c < 3; c++) {
      const original = pixels[i + c]!;
      let result = original;
      for (let j = 0; j < 4; j++) {
        const color = colors[j]!;
        result += weights[j]! * (channel(original, color.base[c]!, color.target[c]!) - original);
      }
      pixels[i + c] = result;
    }
  }
}
