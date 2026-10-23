import type { Facing } from '../../core/iso';
import avatarUrl from '../assets/avatar.png';
import { AVATAR_FACINGS, AVATAR_POSES, frameName, type AvatarSheet } from './characters';

export { avatarUrl };

/** Même découpe dans Phaser et dans l'éditeur ; aucun fichier 3D en jeu. */
export function renderBakedAvatar(source: CanvasImageSource, scale: number): AvatarSheet {
  const frameW = 96 * scale;
  const frameH = 128 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = frameW * 4;
  canvas.height = frameH * 4;
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return {
    canvas,
    frameW,
    frameH,
    anchorX: 48 * scale,
    anchorY: 104 * scale,
    scale,
    frames: AVATAR_FACINGS.flatMap((f, row) =>
      AVATAR_POSES.map((p, col) => ({
        name: frameName(f, p),
        x: col * frameW,
        y: row * frameH,
      })),
    ),
  };
}

let loaded: Promise<HTMLImageElement> | undefined;
const previews = new Map<Facing, HTMLCanvasElement>();

/** Image partagée et recadrée une seule fois par orientation pour toutes les vignettes. */
export async function bakedAvatarPreview(facing: Facing): Promise<HTMLCanvasElement> {
  if (!loaded) {
    const image = new Image();
    image.src = avatarUrl;
    loaded = image
      .decode()
      .then(() => image)
      .catch((error: unknown) => {
        loaded = undefined;
        throw error;
      });
  }
  const image = await loaded;
  const cached = previews.get(facing);
  if (cached) return cached;
  const frame = document.createElement('canvas');
  frame.width = 384;
  frame.height = 512;
  const ctx = frame.getContext('2d')!;
  ctx.drawImage(image, 0, AVATAR_FACINGS.indexOf(facing) * 512, 384, 512, 0, 0, 384, 512);
  const pixels = ctx.getImageData(0, 0, 384, 512).data;
  let left = 384,
    top = 512,
    right = 0,
    bottom = 0;
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 384; x++) {
      if (pixels[(y * 384 + x) * 4 + 3]! > 8) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  const canvas = document.createElement('canvas');
  canvas.width = right - left + 5;
  canvas.height = bottom - top + 5;
  canvas.getContext('2d')!.drawImage(frame, -left + 2, -top + 2);
  previews.set(facing, canvas);
  return canvas;
}
