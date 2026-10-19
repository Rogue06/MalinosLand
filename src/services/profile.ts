import { sanitizeAppearance, type AvatarAppearance } from '../content/avatars';
import { Store } from '../core/store';
import { sanitizeName } from '../core/text';
import { storage, type VersionedStorage } from './storage';

export interface Profile {
  name: string;
  look: AvatarAppearance;
}

const KEY = 'profile';
const VERSION = 1;

export function parseProfile(raw: unknown): Profile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = sanitizeName(r.name);
  if (!name) return null;
  return { name, look: sanitizeAppearance(r.look) };
}

export function loadProfile(s: VersionedStorage = storage): Profile | null {
  return s.read(KEY, VERSION, parseProfile);
}

export function saveProfile(p: Profile, s: VersionedStorage = storage): void {
  s.write(KEY, VERSION, p);
}

/** Profil courant (null tant que le joueur n'a pas créé son personnage). */
export const profileStore = new Store<Profile | null>(loadProfile());

profileStore.subscribe((p) => {
  if (p) saveProfile(p);
});
