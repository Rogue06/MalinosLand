import '@fontsource-variable/fredoka/wght.css';
import './landing.css';
import { ACCOUNTS_ENABLED } from '../config';
import { AVATAR_PRESETS } from '../content/avatars';
import { CATALOG } from '../content/catalog';
import { ROADMAP } from '../content/roadmap';
import type { Facing } from '../core/iso';
import { renderAvatarPreview } from '../game/art/characters';
import { IsoBuilder } from '../game/art/iso3d';
import { OBJECT_ART } from '../game/art/objects';
import { hasStoredSession, signIn, type AccountProvider } from '../services/account';
import { profileStore } from '../services/profile';

/**
 * Site d'accueil (page racine) : présente le projet et invite à se connecter avant d'entrer.
 * Léger : pas de Phaser ni de Preact. Les personnages et objets sont dessinés par le même
 * générateur que le jeu ; Supabase n'est téléchargé qu'au clic sur « Continuer avec… ».
 */

/** Page du jeu, résolue depuis l'adresse actuelle (fonctionne aussi en local). */
const GAME_URL = new URL('jouer/', location.href).href;

/**
 * Filet de sécurité : si Supabase renvoie la connexion vers la racine (adresse de retour non
 * autorisée), on transmet le code au jeu, qui termine la connexion (même site, même stockage).
 */
function forwardLoginReturn(): boolean {
  const params = new URLSearchParams(location.search);
  if (!params.has('code') && !params.has('error')) return false;
  location.replace(GAME_URL + location.search);
  return true;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- Connexion ----------

function setupAccount(): void {
  const guestBlocks = document.querySelectorAll<HTMLElement>('[data-auth="guest"]');
  const back = document.querySelector<HTMLElement>('[data-auth="back"]');
  const error = document.querySelector<HTMLElement>('.etiquette-error');
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-provider]');
  const name = profileStore.get()?.name ?? null;

  if (!ACCOUNTS_ENABLED) {
    // Version sans comptes (développement local) : on entre directement en visiteur.
    buttons.forEach((b) => (b.hidden = true));
    document.querySelectorAll<HTMLElement>('.etiquette-hint').forEach((p) => (p.hidden = true));
  }

  if (hasStoredSession() && back) {
    // Déjà connecté sur cet appareil : un seul bouton pour reprendre.
    guestBlocks.forEach((g) => (g.hidden = true));
    back.hidden = false;
    const slot = back.querySelector<HTMLElement>('[data-name]');
    if (slot && name) slot.textContent = name;
    return;
  }

  const visitor = document.querySelector<HTMLAnchorElement>('.lien-visiteur');
  if (visitor && name) visitor.textContent = `ou continuer en visiteur, ${name} →`;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const provider = button.dataset.provider as AccountProvider;
      buttons.forEach((b) => (b.disabled = true));
      if (error) error.hidden = true;
      void signIn(provider, GAME_URL).then((ok) => {
        if (ok) return; // Départ vers Google / GitHub.
        buttons.forEach((b) => (b.disabled = false));
        if (error) {
          error.textContent = 'La connexion n’a pas pu démarrer. Réessayez, ou entrez en visiteur.';
          error.hidden = false;
        }
      });
    });
  });
}

// ---------- Autocollants : nos personnages et quelques objets du monde ----------

interface StickerSpec {
  avatar?: number;
  facing?: Facing;
  object?: string;
  /** Position dans la scène (en % de sa largeur / hauteur). */
  left: number;
  bottom: number;
  width: number;
  tilt: number;
  /** Masqué sur petit écran. */
  wide?: boolean;
}

const STICKERS: StickerSpec[] = [
  { object: 'tree', left: 0, bottom: 34, width: 140, tilt: -3, wide: true },
  { avatar: 0, facing: 'px', left: 5, bottom: 6, width: 96, tilt: -4 },
  { avatar: 2, left: 16, bottom: 3, width: 90, tilt: 3, wide: true },
  { object: 'arcade', left: 30, bottom: 2, width: 72, tilt: -5, wide: true },
  { object: 'cat', left: 52, bottom: 4, width: 64, tilt: 4 },
  { avatar: 3, facing: 'nx', left: 68, bottom: 4, width: 94, tilt: -2, wide: true },
  { avatar: 4, left: 81, bottom: 8, width: 96, tilt: 4 },
  { object: 'campfire', left: 89, bottom: 40, width: 80, tilt: 3, wide: true },
];

function stickerCanvas(spec: StickerSpec): HTMLCanvasElement | null {
  if (spec.avatar !== undefined) {
    const preset = AVATAR_PRESETS[spec.avatar];
    return preset ? renderAvatarPreview(preset.look, spec.facing ?? 'py', 3) : null;
  }
  const art = spec.object ? OBJECT_ART[spec.object] : undefined;
  const entry = spec.object ? CATALOG[spec.object] : undefined;
  if (!art || !entry) return null;
  const b = new IsoBuilder(0, entry.footprint[0], entry.footprint[1]);
  art(b, 0);
  return b.render(3).canvas;
}

function setupStickers(): void {
  const host = document.querySelector<HTMLElement>('[data-stickers]');
  if (!host) return;
  const small = matchMedia('(max-width: 620px)').matches;
  STICKERS.forEach((spec, i) => {
    if (small && spec.wide) return;
    const canvas = stickerCanvas(spec);
    if (!canvas) return;
    canvas.className = 'sticker';
    const width = small ? Math.round(spec.width * 0.7) : spec.width;
    canvas.style.width = `${width}px`;
    canvas.style.left = `${spec.left}%`;
    canvas.style.bottom = `${spec.bottom}%`;
    canvas.style.setProperty('--r', `${spec.tilt}deg`);
    canvas.style.animationDelay = `${-i * 0.45}s`;
    host.append(canvas);
  });
}

// ---------- Feuille de route (même source que dans le jeu) ----------

const STATUS_LABEL = { done: 'Terminé', current: 'En cours', planned: 'Prévu' } as const;

function setupRoadmap(): void {
  const list = document.querySelector<HTMLElement>('[data-roadmap]');
  if (!list) return;
  for (const step of ROADMAP) {
    const li = el('li', `etape etape-${step.status}`);
    li.append(el('span', 'bouton-couture'));
    const head = el('div', 'etape-head');
    head.append(
      el('span', 'etape-version', `v${step.version}`),
      el('span', 'etape-statut', STATUS_LABEL[step.status]),
    );
    const items = el('ul');
    for (const item of step.items) items.append(el('li', undefined, item));
    li.append(head, el('h3', undefined, step.title), items);
    list.append(li);
  }
}

if (!forwardLoginReturn()) {
  setupAccount();
  setupRoadmap();
  setupStickers();
}
