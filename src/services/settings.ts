import { Store } from '../core/store';
import { storage } from './storage';

export type Quality = 'low' | 'normal' | 'high';

export interface Settings {
  quality: Quality;
  /** 0 = pas de limite (synchronisé sur l'écran). */
  fpsLimit: 0 | 30 | 60;
  reducedMotion: boolean;
  showNames: boolean;
  showStats: boolean;
  /** Démo multijoueur locale entre onglets du même navigateur. */
  multiTab: boolean;
  /** Son discret à l'arrivée d'un message et d'une mention @pseudo. */
  sounds: boolean;
  /** Ambiance sonore selon le lieu (oiseaux dehors…). */
  ambience: boolean;
  /** Volume général des sons, de 0 à 1. */
  volume: number;
  /** Toujours de jour : pas de nuit à l'heure de Paris (lot C). */
  alwaysDay: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'normal',
  fpsLimit: 60,
  reducedMotion: false,
  showNames: true,
  showStats: false,
  multiTab: true,
  sounds: true,
  ambience: true,
  volume: 0.6,
  alwaysDay: false,
};

const KEY = 'settings';
const VERSION = 1;

export function parseSettings(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<
    Record<keyof Settings, unknown>
  >;
  const s = { ...DEFAULT_SETTINGS };
  if (r.quality === 'low' || r.quality === 'normal' || r.quality === 'high') s.quality = r.quality;
  if (r.fpsLimit === 0 || r.fpsLimit === 30 || r.fpsLimit === 60) s.fpsLimit = r.fpsLimit;
  for (const k of [
    'reducedMotion',
    'showNames',
    'showStats',
    'multiTab',
    'sounds',
    'ambience',
    'alwaysDay',
  ] as const) {
    if (typeof r[k] === 'boolean') s[k] = r[k];
  }
  if (typeof r.volume === 'number' && Number.isFinite(r.volume))
    s.volume = Math.min(1, Math.max(0, r.volume));
  return s;
}

function initial(): Settings {
  const stored = storage.read(KEY, VERSION, parseSettings);
  if (stored) return stored;
  const prefersReduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const weakDevice = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 4) <= 2;
  return {
    ...DEFAULT_SETTINGS,
    reducedMotion: prefersReduced,
    quality: weakDevice ? 'low' : 'normal',
    fpsLimit: weakDevice ? 30 : 60,
  };
}

export const settingsStore = new Store<Settings>(initial());
settingsStore.subscribe((s) => storage.write(KEY, VERSION, s));

/** Paramètres de rendu dérivés de la qualité. */
export function renderProfile(q: Quality): {
  textureScale: number;
  pixelRatio: number;
  effects: boolean;
} {
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  switch (q) {
    case 'low':
      return { textureScale: 1, pixelRatio: 1, effects: false };
    case 'normal':
      return { textureScale: 2, pixelRatio: Math.min(dpr, 1.5), effects: true };
    case 'high':
      return { textureScale: 2, pixelRatio: Math.min(dpr, 2), effects: true };
  }
}
