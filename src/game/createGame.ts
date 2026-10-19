import Phaser from 'phaser';
import { renderProfile, settingsStore } from '../services/settings';
import { WorldScene } from './scenes/WorldScene';

/**
 * Crée l'instance Phaser. Le canvas est dimensionné en pixels physiques
 * (× pixelRatio) puis réduit en CSS : rendu net sur écrans haute densité,
 * sans coût supplémentaire en qualité « basse ».
 */
export function createGame(parent: HTMLElement, selfId: string): Phaser.Game {
  const settings = settingsStore.get();
  const { pixelRatio } = renderProfile(settings.quality);
  const size = () => ({
    w: Math.round(window.innerWidth * pixelRatio),
    h: Math.round(window.innerHeight * pixelRatio),
  });
  const { w, h } = size();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: w,
    height: h,
    backgroundColor: '#141a2b',
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / pixelRatio },
    render: {
      antialias: true,
      roundPixels: false,
      mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
      powerPreference: 'low-power',
    },
    fps: { target: 60, limit: settings.fpsLimit, smoothStep: true },
    disableContextMenu: true,
    banner: false,
    audio: { noAudio: true },
  });
  game.scene.add('world', WorldScene, true, { selfId });

  const onResize = () => {
    const s = size();
    game.scale.resize(s.w, s.h);
  };
  window.addEventListener('resize', onResize);
  game.events.once(Phaser.Core.Events.DESTROY, () =>
    window.removeEventListener('resize', onResize),
  );
  return game;
}
