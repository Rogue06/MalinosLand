import Phaser from 'phaser';
import { LOCAL_ART_PREVIEW } from '../config';
import { renderProfile, settingsStore } from '../services/settings';
import { pushToast } from '../state';
import { CHANTIER_ARRIVAL, fromChantier, withoutOrigin } from '../world/portal';
import { WorldScene } from './scenes/WorldScene';

/**
 * Crée l'instance Phaser. Le canvas est dimensionné en pixels physiques
 * (× pixelRatio) puis réduit en CSS : rendu net sur écrans haute densité,
 * sans coût supplémentaire en qualité « basse ».
 */
export async function createGame(parent: HTMLElement, selfId: string): Promise<Phaser.Game> {
  // L'import et ses images sont supprimés du build public par Vite.
  const preview =
    import.meta.env.DEV && LOCAL_ART_PREVIEW
      ? (await import('../dev/inGamePrototype')).inGamePrototype
      : undefined;
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
  // Retour du Chantier des mondes (son portail) : on réapparaît devant la borne de la salle de
  // jeux. L'adresse est nettoyée, pour qu'un rechargement ne refasse pas l'arrivée.
  const back = fromChantier(location.search);
  if (back) {
    history.replaceState(history.state, '', withoutOrigin(location.href));
    pushToast('De retour à MalinosLand, devant la borne du Chantier des mondes !', '🌀', 6000);
  }
  const spawn = preview?.spawn ?? (back ? CHANTIER_ARRIVAL : undefined);
  game.scene.add('world', WorldScene, true, { selfId, preview, spawn });

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
