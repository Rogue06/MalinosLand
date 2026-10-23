import type Phaser from 'phaser';
import { AVATAR_FACINGS, AVATAR_POSES, frameName } from '../game/art/characters';
import { IsoBuilder } from '../game/art/iso3d';
import { OBJECT_ART } from '../game/art/objects';
import type { TextureArt } from '../game/textures';
import avatar from '../game/assets/avatar.png';
import oak from '../game/assets/oak.png';
import sakura from './voxel-assets/sakura.png';

export const BLENDER_ASSETS = { avatar, oak, sakura };

/** Les images restent dans l'atelier local : aucun import depuis le jeu public. */
export function blenderArt(scene: Phaser.Scene): TextureArt {
  const source = (name: keyof typeof BLENDER_ASSETS) =>
    scene.textures.get(`blender-source:${name}`).getSourceImage() as HTMLImageElement;
  return {
    id: 'blender-study',
    avatar(_look, scale) {
      const frameW = 96 * scale;
      const frameH = 128 * scale;
      const canvas = document.createElement('canvas');
      canvas.width = frameW * 4;
      canvas.height = frameH * 4;
      canvas.getContext('2d')!.drawImage(source('avatar'), 0, 0, canvas.width, canvas.height);
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
    },
    objectRenders: {
      tree(rot, variant, scale) {
        if (variant % 3 === 1) {
          const b = new IsoBuilder(rot, 1, 1);
          OBJECT_ART.tree!(b, variant);
          return b.render(scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = 96 * scale;
        canvas.height = 128 * scale;
        canvas
          .getContext('2d')!
          .drawImage(
            source(variant % 3 === 2 ? 'sakura' : 'oak'),
            (rot % 2) * 384,
            Math.floor(rot / 2) * 512,
            384,
            512,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        return { canvas, anchorX: 48 * scale, anchorY: 104 * scale, scale };
      },
    },
  };
}
