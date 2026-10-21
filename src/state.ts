import type { AvatarAppearance } from './content/avatars';
import { EventBus } from './core/eventBus';
import type { Vec2 } from './core/iso';
import { Store } from './core/store';
import type { ChatScope, Emote } from './multiplayer/protocol';
import type { MapFile, PanelId, ZoneDef } from './world/types';

/**
 * État partagé entre le jeu (Phaser) et l'interface (Preact).
 * Le jeu écrit dans ces stores, l'interface les lit ; l'interface envoie des
 * commandes au jeu via `commands`. Aucun des deux ne référence l'autre.
 */

export interface ChatEntry {
  id: number;
  from: string;
  text: string;
  kind: 'self' | 'peer' | 'system';
  scope: ChatScope;
  /** Identifiant du joueur qui a écrit (messages de pairs). */
  peerId?: string;
  /** Le message mentionne le joueur local (@pseudo). */
  mention?: boolean;
}

export interface PresenceEntry {
  id: string;
  name: string;
  look: AvatarAppearance;
  self: boolean;
  room: string;
  /** Connecté à son compte (marque ✓). */
  verified: boolean;
  /** Absent (onglet caché). */
  away: boolean;
}

export interface DialogState {
  speaker: string;
  lines: string[];
  index: number;
}

export interface Toast {
  id: number;
  text: string;
  icon?: string;
}

export interface Stats {
  fps: number;
  peers: number;
  kbSent: number;
  transport: string;
}

export const zoneStore = new Store<ZoneDef | null>(null);
export const hintStore = new Store<string | null>(null);
export const panelStore = new Store<
  PanelId | 'settings' | 'help' | 'players' | 'moderation' | null
>(null);
export const dialogStore = new Store<DialogState | null>(null);
export const chatStore = new Store<ChatEntry[]>([]);
export const presenceStore = new Store<PresenceEntry[]>([]);
export const playerPosStore = new Store<Vec2>({ x: 0, y: 0 });
export const peersPosStore = new Store<Vec2[]>([]);
export const statsStore = new Store<Stats>({ fps: 0, peers: 0, kbSent: 0, transport: '' });
export const toastStore = new Store<Toast[]>([]);
export const worldInfoStore = new Store<MapFile | null>(null);

/** Nombre de Malinos qui liraient un message « autour de moi » (à moins de 8 cases). */
export const nearbyStore = new Store<number>(0);

/** Salle où se trouve le joueur : le Hub, ou un logement (`home-…`). */
export interface RoomInfo {
  room: string;
  /** Logement : pseudo du propriétaire (null dans le Hub). */
  ownerName: string | null;
  /** Le joueur est chez lui. */
  mine: boolean;
}
export const roomStore = new Store<RoomInfo>({ room: 'hub', ownerName: null, mine: false });
/** Vrai quand le joueur tape au clavier dans l'interface (chat, pseudo…). */
export const typingStore = new Store<boolean>(false);

let nextId = 1;

export function pushChat(entry: Omit<ChatEntry, 'id'>): void {
  chatStore.update((list) => [...list.slice(-49), { ...entry, id: nextId++ }]);
}

export function pushToast(text: string, icon?: string, durationMs = 3500): void {
  const toast: Toast = { id: nextId++, text, ...(icon ? { icon } : {}) };
  toastStore.update((list) => [...list.slice(-2), toast]);
  setTimeout(() => toastStore.update((list) => list.filter((t) => t.id !== toast.id)), durationMs);
}

let inputCooldownUntil = 0;

/**
 * Bloque brièvement le clavier du jeu (ex. la touche E qui ferme un dialogue
 * ne doit pas le rouvrir aussitôt).
 */
export function cooldownInput(ms = 250): void {
  inputCooldownUntil = performance.now() + ms;
}

/** Le clavier du jeu doit-il être ignoré ? */
export function isInputLocked(): boolean {
  return (
    typingStore.get() ||
    panelStore.get() !== null ||
    dialogStore.get() !== null ||
    performance.now() < inputCooldownUntil
  );
}

panelStore.subscribe((p) => p === null && cooldownInput());
dialogStore.subscribe((d) => d === null && cooldownInput());

export interface Commands extends Record<string, unknown> {
  'chat-send': { text: string; scope: ChatScope };
  emote: { emoji: Emote };
  'look-changed': { name: string; look: AvatarAppearance };
  /** Utiliser l'objet le plus proche (bouton d'action, comme la touche E). */
  use: Record<string, never>;
  /** Aller dans une salle : le Hub, son logement ou celui d'un autre (vérifié par le serveur). */
  travel: { room: string; ownerName?: string };
  /**
   * Le propriétaire a changé l'accès ou ses invitations : le jeu fait sortir les personnes
   * présentes qui n'y ont plus droit (`guests` : identifiants réseau des invités).
   */
  'home-access': { access: 'private' | 'invite' | 'public'; guests: string[] };
  /** Éditeur de décoration du logement (voir decorEditorStore). `type` : meuble choisi. */
  decor: { action: DecorAction; type?: string };
}

export const commands = new EventBus<Commands>();

/** Actions de l'éditeur de décoration (boutons de l'interface ou touches). */
export type DecorAction =
  | 'start'
  | 'pick'
  | 'rotate'
  | 'color'
  | 'move'
  | 'remove'
  | 'deselect'
  | 'reset'
  | 'save'
  | 'cancel';

/** État de l'éditeur de décoration, publié par le jeu pour l'interface. */
export interface DecorEditorState {
  active: boolean;
  /** Meuble en main (type), en attente d'être posé. */
  held: string | null;
  /** Meuble sélectionné : son type et son nombre de couleurs. */
  selected: { type: string; colors: number } | null;
  count: number;
  max: number;
  /** Modifié depuis l'ouverture de l'éditeur. */
  dirty: boolean;
  saving: boolean;
  /** Dernier conseil ou refus (« la place est prise »…), ou null. */
  message: string | null;
}

export const decorEditorStore = new Store<DecorEditorState>({
  active: false,
  held: null,
  selected: null,
  count: 0,
  max: 0,
  dirty: false,
  saving: false,
  message: null,
});
