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
}

export interface PresenceEntry {
  id: string;
  name: string;
  look: AvatarAppearance;
  self: boolean;
  room: string;
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
export const panelStore = new Store<PanelId | 'settings' | 'help' | null>(null);
export const dialogStore = new Store<DialogState | null>(null);
export const chatStore = new Store<ChatEntry[]>([]);
export const presenceStore = new Store<PresenceEntry[]>([]);
export const playerPosStore = new Store<Vec2>({ x: 0, y: 0 });
export const peersPosStore = new Store<Vec2[]>([]);
export const statsStore = new Store<Stats>({ fps: 0, peers: 0, kbSent: 0, transport: '' });
export const toastStore = new Store<Toast[]>([]);
export const worldInfoStore = new Store<MapFile | null>(null);
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
}

export const commands = new EventBus<Commands>();
