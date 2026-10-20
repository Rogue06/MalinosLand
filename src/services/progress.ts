import { QUESTS } from '../content/quests';
import { SECRETS } from '../content/secrets';
import { Store } from '../core/store';
import { storage } from './storage';

const KEY = 'progress';
const VERSION = 1;
const KNOWN = new Set(QUESTS.map((q) => q.id));

export function parseProgress(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && KNOWN.has(id)))];
}

/** Objectifs « Premiers pas » terminés. */
export const progressStore = new Store<string[]>(storage.read(KEY, VERSION, parseProgress) ?? []);
progressStore.subscribe((done) => storage.write(KEY, VERSION, done));

/** Marque un objectif comme accompli. Renvoie true s'il vient d'être terminé. */
export function completeQuest(id: string): boolean {
  if (!KNOWN.has(id) || progressStore.get().includes(id)) return false;
  progressStore.set([...progressStore.get(), id]);
  return true;
}

export function resetProgress(): void {
  progressStore.set([]);
}

const SECRETS_KEY = 'secrets';
const KNOWN_SECRETS = new Set(SECRETS.map((s) => s.id));

export function parseSecrets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(raw.filter((id): id is string => typeof id === 'string' && KNOWN_SECRETS.has(id))),
  ];
}

/** Secrets du Hub découverts (gardés dans ce navigateur, comme les objectifs). */
export const secretsStore = new Store<string[]>(
  storage.read(SECRETS_KEY, VERSION, parseSecrets) ?? [],
);
secretsStore.subscribe((found) => storage.write(SECRETS_KEY, VERSION, found));

/** Note un secret découvert. Renvoie true s'il vient d'être trouvé. */
export function findSecret(id: string): boolean {
  if (!KNOWN_SECRETS.has(id) || secretsStore.get().includes(id)) return false;
  secretsStore.set([...secretsStore.get(), id]);
  return true;
}
