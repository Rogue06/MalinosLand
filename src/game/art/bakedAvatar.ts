import type { Facing } from '../../core/iso';
import avatarUrl from '../assets/avatar.png';
import avatarMaskUrl from '../assets/avatar-mask.png';
import { voxelColorKey, type AvatarAppearance } from '../../content/avatars';
import { tintVoxelPixels } from './voxelTint';
import { AVATAR_FACINGS, AVATAR_POSES, frameName, type AvatarSheet } from './characters';

export { avatarUrl, avatarMaskUrl };

/** Même découpe dans Phaser et dans l'éditeur ; aucun fichier 3D en jeu. */
export function renderBakedAvatar(
  source: CanvasImageSource,
  scale: number,
  look?: AvatarAppearance,
  mask?: CanvasImageSource,
): AvatarSheet {
  const frameW = 96 * scale;
  const frameH = 128 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = frameW * 4;
  canvas.height = frameH * 4;
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (look && mask) applyTint(canvas, mask, look);
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

function applyTint(
  canvas: HTMLCanvasElement,
  mask: CanvasImageSource,
  look: AvatarAppearance,
): void {
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const maskCtx = maskCanvas.getContext('2d')!;
  maskCtx.drawImage(mask, 0, 0, canvas.width, canvas.height);
  tintVoxelPixels(pixels.data, maskCtx.getImageData(0, 0, canvas.width, canvas.height).data, look);
  ctx.putImageData(pixels, 0, 0);
}
let loaded: Promise<HTMLImageElement[]> | undefined;
const previews = new Map<string, HTMLCanvasElement>();

/** Image partagée et recadrée une seule fois par orientation pour toutes les vignettes. */
export async function bakedAvatarPreview(
  facing: Facing,
  look: AvatarAppearance,
): Promise<HTMLCanvasElement> {
  if (!loaded) {
    loaded = Promise.all(
      [avatarUrl, avatarMaskUrl].map((url) => {
        const image = new Image();
        image.src = url;
        return image.decode().then(() => image);
      }),
    ).catch((error: unknown) => {
      loaded = undefined;
      throw error;
    });
  }
  const [image, mask] = await loaded;
  const key = `${facing}:${voxelColorKey(look)}`;
  const cached = previews.get(key);
  if (cached) return cached;
  const frame = document.createElement('canvas');
  frame.width = 384;
  frame.height = 512;
  const ctx = frame.getContext('2d')!;
  const rowY = AVATAR_FACINGS.indexOf(facing) * 512;
  ctx.drawImage(image!, 0, rowY, 384, 512, 0, 0, 384, 512);
  const maskFrame = document.createElement('canvas');
  maskFrame.width = 384;
  maskFrame.height = 512;
  maskFrame.getContext('2d')!.drawImage(mask!, 0, rowY, 384, 512, 0, 0, 384, 512);
  applyTint(frame, maskFrame, look);
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
  if (previews.size >= 96) previews.delete(previews.keys().next().value!);
  previews.set(key, canvas);
  return canvas;
}
