import { h, render } from 'preact';
import type Phaser from 'phaser';
import { randomId } from './multiplayer/protocol';
import { profileStore } from './services/profile';
import { App } from './ui/App';
import './ui/styles.css';

/**
 * Point d'entrée : l'interface s'affiche immédiatement ; le moteur de jeu
 * (Phaser, le plus gros morceau) n'est chargé qu'une fois le personnage créé.
 */
const uiRoot = document.getElementById('ui')!;
const gameRoot = document.getElementById('game')!;
const selfId = randomId();
let game: Phaser.Game | null = null;

render(h(App, null), uiRoot);
document.getElementById('boot')?.remove();

async function startGame(): Promise<void> {
  if (game) return;
  const { createGame } = await import('./game/createGame');
  if (game) return;
  game = createGame(gameRoot, selfId);
}

if (profileStore.get()) void startGame();
else {
  const off = profileStore.subscribe((p) => {
    if (!p) return;
    off();
    void startGame();
  });
}
