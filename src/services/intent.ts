import type { Intent } from '../content/activities';
import { Store } from '../core/store';
import { storage } from './storage';

/**
 * Envie choisie à l'arrivée et carte « Reprends ici » (PR 12, DEC-042). Gardé **uniquement dans
 * ce navigateur** : rien n'est envoyé au serveur ni à la base (pas de nouvelle mesure).
 */
export interface IntentState {
  /** Envie choisie (null : pas encore choisie ou « Passer »). */
  intent: Intent | null;
  /** La question des envies a reçu une réponse (choix ou « Passer ») : on ne la repose plus. */
  answered: boolean;
  /** Jour (numéro local) où la carte d'arrivée ou de retour a été montrée pour la dernière fois. */
  shownDay: number | null;
}

const KEY = 'intent';
const VERSION = 1;
const INTENT_IDS: readonly Intent[] = ['learn', 'create', 'meet'];

export const EMPTY_INTENT: IntentState = { intent: null, answered: false, shownDay: null };

export function parseIntent(raw: unknown): IntentState {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    intent: INTENT_IDS.includes(r.intent as Intent) ? (r.intent as Intent) : null,
    answered: r.answered === true,
    shownDay:
      typeof r.shownDay === 'number' && Number.isInteger(r.shownDay) && r.shownDay >= 0
        ? r.shownDay
        : null,
  };
}

export const intentStore = new Store<IntentState>(
  storage.read(KEY, VERSION, parseIntent) ?? EMPTY_INTENT,
);
intentStore.subscribe((s) => storage.write(KEY, VERSION, s));

/** Choisit une envie (null : « Passer »). La question n'est plus reposée. */
export function chooseIntent(intent: Intent | null): void {
  intentStore.set({ ...intentStore.get(), intent, answered: true });
}

/** Note que la carte du jour a été montrée (une fois par jour au plus). */
export function markCardShown(day: number): void {
  intentStore.set({ ...intentStore.get(), shownDay: day });
}
