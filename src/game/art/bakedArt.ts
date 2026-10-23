import type Phaser from 'phaser';
import oak from '../assets/oak.png';
import sakura from '../assets/sakura.png';
import type { TextureArt } from '../textures';
import { avatarUrl, avatarMaskUrl, renderBakedAvatar } from './bakedAvatar';
import { renderAvatarSheet } from './characters';
import { IsoBuilder } from './iso3d';
import { OBJECT_ART } from './objects';

const assets = { avatar: avatarUrl, mask: avatarMaskUrl, oak, sakura };

export function preloadBakedArt(scene: Phaser.Scene): void {
  for (const [name, url] of Object.entries(assets)) {
    if (!scene.textures.exists(`baked:${name}`)) scene.load.image(`baked:${name}`, url);
  }
}

/** Trois atlas partagés ; le sapin et l'avatar classique restent procéduraux. */
export function bakedArt(scene: Phaser.Scene): TextureArt {
  const source = (name: keyof typeof assets) =>
    scene.textures.get(`baked:${name}`).getSourceImage() as HTMLImageElement;
  return {
    id: 'baked-v1',
    avatar(look, scale) {
      return look.model !== 0 && scene.textures.exists('baked:avatar')
        ? renderBakedAvatar(
            source('avatar'),
            scale,
            look,
            scene.textures.exists('baked:mask') ? source('mask') : undefined,
          )
        : renderAvatarSheet(look, scale);
    },
    objectRenders: {
      tree(rot, variant, scale) {
        const name = variant % 3 === 2 ? 'sakura' : 'oak';
        if (variant % 3 === 1 || !scene.textures.exists(`baked:${name}`)) {
          const b = new IsoBuilder(rot, 1, 1);
          OBJECT_ART.tree!(b, variant);
          return b.render(scale);
        }
        const pink = name === 'sakura';
        const canvas = document.createElement('canvas');
        canvas.width = (pink ? 128 : 96) * scale;
        canvas.height = (pink ? 160 : 128) * scale;
        const h = pink ? 480 : 512;
        canvas
          .getContext('2d')!
          .drawImage(
            source(name),
            (rot % 2) * 384,
            Math.floor(rot / 2) * h,
            384,
            h,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        return {
          canvas,
          anchorX: (pink ? 64 : 48) * scale,
          anchorY: (pink ? 136 : 104) * scale,
          scale,
        };
      },
    },
  };
}
