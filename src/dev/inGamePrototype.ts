import { IsoBuilder } from '../game/art/iso3d';
import { OBJECT_ART } from '../game/art/objects';
import type { LocalArtPreview } from '../game/scenes/WorldScene';
import { BLENDER_ASSETS, blenderArt } from './blenderArt';
import sakura from '../game/assets/sakura.png';

/** Trois arbres existants : aucune modification du JSON, des collisions ou des sauvegardes. */
export const PREVIEW_TREES = [
  { x: 16, y: 28, variant: 100 },
  { x: 19, y: 31, variant: 102 },
  { x: 16, y: 31, variant: 102 },
];

export const inGamePrototype: LocalArtPreview = {
  spawn: { x: 17.5, y: 30.5, facing: 'py' },
  preload(scene) {
    // Référence de test stable même après le rechargement d'un module par Vite.
    (window as unknown as Record<string, unknown>).__localArtPreview = scene;
    if (!document.getElementById('local-art-preview')) {
      const label = document.createElement('a');
      label.id = 'local-art-preview';
      label.textContent = 'Essai local · personnage + 3 arbres · Revenir au jeu habituel';
      label.href = '/jouer/';
      label.style.cssText =
        'position:fixed;bottom:8px;left:50%;transform:translateX(-50%);z-index:1000;background:#141a2b;color:#fff;padding:6px 12px;border-radius:8px;font:12px sans-serif;text-align:center;max-width:90vw';
      document.body.append(label);
    }
    for (const [name, url] of Object.entries({
      avatar: BLENDER_ASSETS.avatar,
      oak: BLENDER_ASSETS.oak,
      'sakura-study': sakura,
    })) {
      if (!scene.textures.exists(`blender-source:${name}`))
        scene.load.image(`blender-source:${name}`, url);
    }
  },
  prepareWorld(world) {
    if (world.map.id !== 'hub') return;
    for (const selected of PREVIEW_TREES) {
      const tree = world.objects.find(
        (o) => o.type === 'tree' && o.x === selected.x && o.y === selected.y,
      );
      if (tree) tree.variant = selected.variant;
    }
  },
  art(scene) {
    const base = blenderArt(scene);
    return {
      id: 'local-garden-study',
      avatar: base.avatar,
      objectRenders: {
        tree(rot, variant, scale) {
          if (variant === 100) return base.objectRenders!.tree!(rot, 0, scale);
          if (variant !== 102) {
            const b = new IsoBuilder(rot, 1, 1);
            OBJECT_ART.tree!(b, variant);
            return b.render(scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = 128 * scale;
          canvas.height = 160 * scale;
          const image = scene.textures
            .get('blender-source:sakura-study')
            .getSourceImage() as HTMLImageElement;
          canvas
            .getContext('2d')!
            .drawImage(
              image,
              (rot % 2) * 384,
              Math.floor(rot / 2) * 480,
              384,
              480,
              0,
              0,
              canvas.width,
              canvas.height,
            );
          return { canvas, anchorX: 64 * scale, anchorY: 136 * scale, scale };
        },
      },
    };
  },
};
