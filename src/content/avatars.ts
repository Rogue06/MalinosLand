/**
 * Apparence des avatars. Toutes les couleurs sont des index dans des palettes
 * fermées : c'est compact à transmettre et impossible à détourner (aucune
 * valeur libre venant d'un autre joueur n'est utilisée telle quelle).
 */
export const BODY_SHAPES = ['standard', 'mince', 'carrure'] as const;
export const HAIR_STYLES = [
  'court',
  'long',
  'chignon',
  'boucles',
  'rase',
  'casquette',
  'queue',
  'aucun',
] as const;
export const ACCESSORIES = ['aucun', 'lunettes', 'casque', 'micro'] as const;
export const BEARDS = ['aucune', 'courte', 'longue'] as const;

export const SKIN_TONES = [
  '#f6d3b8',
  '#eab48f',
  '#d39a6c',
  '#b07548',
  '#8a5434',
  '#5e3826',
] as const;
export const HAIR_COLORS = [
  '#2b2220',
  '#5a3825',
  '#a8673a',
  '#e3b866',
  '#d9d4cc',
  '#c44a3d',
  '#4d6fe0',
  '#e46fa4',
] as const;
export const TOP_COLORS = [
  '#22b5a6',
  '#ff7a59',
  '#7b6cf6',
  '#ffc857',
  '#3a4466',
  '#f7f5f0',
  '#4fa35a',
  '#d4507a',
  '#4c78c9',
  '#2b2f3a',
] as const;
export const BOTTOM_COLORS = [
  '#2f3650',
  '#46597a',
  '#5b4636',
  '#2b2f3a',
  '#7a8294',
  '#9c6b43',
] as const;

export interface AvatarAppearance {
  body: number;
  skin: number;
  hair: number;
  hairColor: number;
  top: number;
  bottom: number;
  accessory: number;
  /** Barbe (index dans BEARDS). Absente des anciens profils : « aucune » par défaut. */
  beard: number;
}

export const AVATAR_PRESETS: Array<{ name: string; look: AvatarAppearance }> = [
  {
    name: 'Codeuse',
    look: { body: 1, skin: 1, hair: 1, hairColor: 1, top: 0, bottom: 0, accessory: 1, beard: 0 },
  },
  {
    name: 'Créatif',
    look: { body: 0, skin: 3, hair: 3, hairColor: 0, top: 1, bottom: 1, accessory: 0, beard: 0 },
  },
  {
    name: 'Entrepreneuse',
    look: { body: 1, skin: 4, hair: 2, hairColor: 0, top: 2, bottom: 3, accessory: 0, beard: 0 },
  },
  {
    name: 'Bricoleur',
    look: { body: 2, skin: 0, hair: 5, hairColor: 2, top: 3, bottom: 2, accessory: 0, beard: 0 },
  },
  {
    name: 'Curieux·se',
    look: { body: 0, skin: 2, hair: 6, hairColor: 7, top: 6, bottom: 0, accessory: 2, beard: 0 },
  },
  {
    name: 'Podcasteur',
    look: { body: 0, skin: 0, hair: 0, hairColor: 2, top: 9, bottom: 0, accessory: 3, beard: 1 },
  },
  {
    name: 'Sage',
    look: { body: 2, skin: 5, hair: 4, hairColor: 4, top: 4, bottom: 4, accessory: 1, beard: 2 },
  },
];

export const DEFAULT_APPEARANCE: AvatarAppearance = AVATAR_PRESETS[0]!.look;

const LIMITS: Record<keyof AvatarAppearance, number> = {
  body: BODY_SHAPES.length,
  skin: SKIN_TONES.length,
  hair: HAIR_STYLES.length,
  hairColor: HAIR_COLORS.length,
  top: TOP_COLORS.length,
  bottom: BOTTOM_COLORS.length,
  accessory: ACCESSORIES.length,
  beard: BEARDS.length,
};

/** Normalise une apparence de source non fiable (stockage, réseau). */
export function sanitizeAppearance(input: unknown): AvatarAppearance {
  const src = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_APPEARANCE };
  for (const key of Object.keys(LIMITS) as Array<keyof AvatarAppearance>) {
    const v = src[key];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < LIMITS[key]) out[key] = v;
  }
  return out;
}

export function randomAppearance(rnd: () => number = Math.random): AvatarAppearance {
  const r = (n: number) => Math.floor(rnd() * n);
  return {
    body: r(BODY_SHAPES.length),
    skin: r(SKIN_TONES.length),
    hair: r(HAIR_STYLES.length),
    hairColor: r(HAIR_COLORS.length),
    top: r(TOP_COLORS.length),
    bottom: r(BOTTOM_COLORS.length),
    accessory: r(ACCESSORIES.length),
    // Une barbe une fois sur trois environ.
    beard: rnd() < 0.66 ? 0 : 1 + r(BEARDS.length - 1),
  };
}

/** Clé stable d'une apparence (cache de textures). */
export function appearanceKey(a: AvatarAppearance): string {
  return [a.body, a.skin, a.hair, a.hairColor, a.top, a.bottom, a.accessory, a.beard].join('');
}
