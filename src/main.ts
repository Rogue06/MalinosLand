import { h, render } from 'preact';
import type Phaser from 'phaser';
import { randomId } from './multiplayer/protocol';
import { accountReady, initAccount, networkId } from './services/account';
import { profileStore } from './services/profile';
import { startProgressSync } from './services/progressSync';
import { settingsStore } from './services/settings';
import { App } from './ui/App';
import './ui/styles.css';

/**
 * Point d'entrée : l'interface s'affiche immédiatement ; le moteur de jeu
 * (Phaser, le plus gros morceau) n'est chargé qu'une fois le personnage créé.
 */
const uiRoot = document.getElementById('ui')!;
const gameRoot = document.getElementById('game')!;
let game: Phaser.Game | null = null;
let starting = false;

// La qualité graphique pilote aussi l'interface (ex. pas de flou d'arrière-plan en « basse »).
const applyQuality = () => (document.documentElement.dataset.quality = settingsStore.get().quality);
applyQuality();
settingsStore.subscribe(applyQuality);

render(h(App, null), uiRoot);
document.getElementById('boot')?.remove();

// Comptes : rapide pour un visiteur ; pour un joueur connecté, récupère son profil.
void initAccount();
// Objectifs et secrets suivent le joueur connecté sur tous ses appareils.
startProgressSync();

async function startGame(): Promise<void> {
  if (game || starting) return;
  starting = true;
  // L'identifiant réseau dépend du compte : on attend de savoir si le joueur est connecté.
  const [{ createGame }] = await Promise.all([import('./game/createGame'), accountReady()]);
  game = createGame(gameRoot, networkId(randomId()));
}

if (profileStore.get()) void startGame();
else {
  const off = profileStore.subscribe((p) => {
    if (!p) return;
    off();
    void startGame();
  });
}
