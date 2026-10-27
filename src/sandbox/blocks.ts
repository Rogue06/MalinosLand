/**
 * Cubes et objets du « Chantier des mondes » (prototype B0, cahier des charges du village §13).
 * Gameplay inspiré des jeux de construction en cubes (creuser, récolter, fabriquer, bâtir) ;
 * noms, couleurs et dessins propres à MalinosLand (textures procédurales, aucune image copiée).
 */

/** Motif de texture d'une face (dessiné par src/sandbox/textures.ts). */
export type Pattern =
  | 'grass_top'
  | 'grass_side'
  | 'dirt'
  | 'stone'
  | 'planks'
  | 'log_side'
  | 'log_top'
  | 'leaves'
  | 'glass'
  | 'sand'
  | 'brick'
  | 'turquoise'
  | 'coral'
  | 'bedrock'
  | 'pad'
  | 'coal_ore'
  | 'crystal_ore'
  | 'table_top'
  | 'table_side'
  | 'furnace_side'
  | 'furnace_front'
  | 'torch'
  | 'snow'
  | 'snow_side'
  | 'gravel'
  | 'portal_stone'
  | 'portal_trim'
  | 'portal_floor'
  | 'portal_light'
  | 'water'
  | 'fire'
  | 'iron_ore'
  | 'clay'
  | 'terracotta'
  | 'roof_tiles'
  | 'stone_bricks'
  | 'sandstone'
  | 'sandstone_top'
  | 'dark_planks'
  | 'lantern'
  | 'iron_block'
  | 'plaster'
  | 'borne'
  | 'lava';

export interface BlockDef {
  id: number;
  name: string;
  /** Motifs du dessus, des côtés et du dessous. */
  tex: { top: Pattern; side: Pattern; bottom: Pattern };
  /** Couleur moyenne (icônes, particules). */
  color: string;
  /** Secondes pour le casser à mains nues (Infinity : incassable). */
  hardness: number;
  /** Outil minimal pour obtenir quelque chose (0 : mains nues). */
  tier: number;
  /** Ce que l'on récupère (id d'objet), null : rien. */
  drop: number | null;
  /** Bloque le passage (la torche ne bloque pas). */
  solid: boolean;
  /** On voit à travers : les faces voisines restent dessinées. */
  seeThrough?: boolean;
  /** Dessin en découpe (trous dans la texture : feuillage). */
  cutout?: boolean;
  /** Verre : dessiné à part, en transparence. */
  translucent?: boolean;
  /** Petit objet (torche) dessiné à part, pas comme un cube plein. */
  small?: boolean;
  /** Atelier de fabrication (établi, four). */
  station?: 'workbench' | 'furnace';
  /** Émet de la lumière (torche, lanternes du portail). */
  light?: boolean;
  /** Fait partie du Portail des Malinos (protégé : on ne le casse pas). */
  portal?: boolean;
  /** Liquide (eau) : on le traverse en nageant, on le prend avec un seau, on ne le casse pas. */
  fluid?: boolean;
  /** Ne va jamais dans le sac (le feu : on l'allume avec un briquet). */
  noItem?: boolean;
  /** Brille par lui-même (la lave) : toujours bien éclairé, même au fond d'une grotte. */
  glow?: boolean;
  /** Brûle : le joueur qui y tombe retourne au départ (la lave). */
  burns?: boolean;
  /** Bruit des coups (voir src/sandbox/sfx.ts). */
  sound?: 'soft' | 'wood' | 'stone' | 'glass';
}

export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const PLANKS = 4;
export const LOG = 5;
export const LEAVES = 6;
export const GLASS = 7;
export const SAND = 8;
export const BRICK = 9;
export const TURQUOISE = 10;
export const CORAL = 11;
export const BEDROCK = 12;
export const PAD = 13;
export const COAL_ORE = 14;
export const CRYSTAL_ORE = 15;
export const WORKBENCH = 16;
export const FURNACE = 17;
export const TORCH = 18;
export const SNOW = 19;
export const GRAVEL = 20;
export const PORTAL_STONE = 21;
export const PORTAL_TRIM = 22;
export const PORTAL_GLASS = 23;
export const PORTAL_FLOOR = 24;
export const PORTAL_LIGHT = 25;
export const WATER = 26;
export const FIRE = 27;
export const IRON_ORE = 28;
export const CLAY = 29;
export const TERRACOTTA = 30;
export const ROOF_TILES = 31;
export const STONE_BRICKS = 32;
export const SANDSTONE = 33;
export const DARK_PLANKS = 34;
export const LANTERN = 35;
export const IRON_BLOCK = 36;
export const PLASTER = 37;
/** Borne de protection : protège une zone autour d'elle pour son propriétaire (DEC-048). */
export const BORNE = 38;
/** Lave : au fond des grottes profondes. Elle brille, on ne la prend pas, elle brûle. */
export const LAVA = 39;

/** Objets qui ne sont pas des cubes. */
export const STICK = 100;
export const WOOD_PICK = 101;
export const STONE_PICK = 102;
export const CRYSTAL_PICK = 103;
export const IRON_PICK = 104;
export const COAL = 110;
export const CRYSTAL = 111;
export const IRON_INGOT = 112;
export const FLINT = 113;
export const BUCKET = 114;
export const WATER_BUCKET = 115;
export const LIGHTER = 116;
/** Objets qui s'utilisent d'un clic droit (seaux, briquet) au lieu de se poser. */
export const USABLE: readonly number[] = [BUCKET, WATER_BUCKET, LIGHTER];

const cube = (
  id: number,
  name: string,
  pattern: Pattern,
  color: string,
  hardness: number,
  extra: Partial<BlockDef> = {},
): BlockDef => ({
  id,
  name,
  tex: { top: pattern, side: pattern, bottom: pattern },
  color,
  hardness,
  tier: 0,
  drop: id,
  solid: true,
  ...extra,
});

export const BLOCKS: readonly BlockDef[] = [
  cube(AIR, 'Air', 'dirt', '#000000', 0, { solid: false, drop: null, seeThrough: true }),
  cube(GRASS, 'Herbe', 'grass_top', '#6cbf5a', 0.6, {
    tex: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' },
    drop: DIRT,
  }),
  cube(DIRT, 'Terre', 'dirt', '#9b6a43', 0.5),
  cube(STONE, 'Pierre', 'stone', '#8b93a6', 3, { sound: 'stone' }),
  cube(PLANKS, 'Planches', 'planks', '#d9a46a', 1.5, { sound: 'wood' }),
  cube(LOG, 'Tronc', 'log_side', '#8a5a36', 2, {
    tex: { top: 'log_top', side: 'log_side', bottom: 'log_top' },
    sound: 'wood',
  }),
  cube(LEAVES, 'Feuillage', 'leaves', '#4fa35a', 0.25, { cutout: true, seeThrough: true }),
  cube(GLASS, 'Verre', 'glass', '#bfeaf5', 0.4, {
    translucent: true,
    seeThrough: true,
    sound: 'glass',
  }),
  cube(SAND, 'Sable', 'sand', '#ecd596', 0.5),
  cube(BRICK, 'Briques', 'brick', '#b5694a', 3, { sound: 'stone' }),
  cube(TURQUOISE, 'Bloc turquoise', 'turquoise', '#3fcab8', 1, { sound: 'stone' }),
  cube(CORAL, 'Bloc corail', 'coral', '#ff8a6a', 1, { sound: 'stone' }),
  cube(BEDROCK, 'Socle', 'bedrock', '#2b3352', Infinity, { drop: null }),
  cube(PAD, 'Dalle de départ', 'pad', '#ffc857', Infinity, { drop: null }),
  cube(COAL_ORE, 'Minerai de charbon', 'coal_ore', '#5b6478', 4, { drop: COAL, sound: 'stone' }),
  cube(CRYSTAL_ORE, 'Minerai de cristal', 'crystal_ore', '#5fe3d0', 6, {
    drop: CRYSTAL,
    tier: 2,
    sound: 'glass',
  }),
  cube(WORKBENCH, 'Établi', 'table_side', '#b07a48', 2, {
    tex: { top: 'table_top', side: 'table_side', bottom: 'planks' },
    station: 'workbench',
    sound: 'wood',
  }),
  cube(FURNACE, 'Four', 'furnace_side', '#7a8194', 3.5, {
    tex: { top: 'stone', side: 'furnace_front', bottom: 'stone' },
    station: 'furnace',
    sound: 'stone',
  }),
  cube(TORCH, 'Torche', 'torch', '#ffc857', 0.05, {
    solid: false,
    seeThrough: true,
    small: true,
    light: true,
  }),
  cube(SNOW, 'Neige', 'snow', '#f4f8fc', 0.4, {
    tex: { top: 'snow', side: 'snow_side', bottom: 'dirt' },
    drop: DIRT,
  }),
  cube(GRAVEL, 'Gravier', 'gravel', '#a59f97', 0.7, { sound: 'stone' }),
  // Le Portail des Malinos (vers MalinosLand) : protégé, on ne le casse pas.
  cube(PORTAL_STONE, 'Pierre du portail', 'portal_stone', '#2b3352', Infinity, {
    drop: null,
    portal: true,
  }),
  cube(PORTAL_TRIM, 'Bordure du portail', 'portal_trim', '#22b5a6', Infinity, {
    drop: null,
    portal: true,
  }),
  cube(PORTAL_GLASS, 'Vitre du portail', 'glass', '#bfeaf5', Infinity, {
    drop: null,
    portal: true,
    translucent: true,
    seeThrough: true,
  }),
  cube(PORTAL_FLOOR, 'Dallage du portail', 'portal_floor', '#e6dccb', Infinity, {
    drop: null,
    portal: true,
  }),
  cube(PORTAL_LIGHT, 'Lanterne du portail', 'portal_light', '#ffc857', Infinity, {
    drop: null,
    portal: true,
    light: true,
  }),
  // Eau : lacs et étangs ; on nage dedans, on la prend et on la verse avec un seau.
  cube(WATER, 'Eau', 'water', '#3f8fd8', Infinity, {
    drop: null,
    solid: false,
    seeThrough: true,
    translucent: true,
    fluid: true,
  }),
  // Feu : s'allume au briquet sur un cube, éclaire ; un coup l'éteint. Il ne se propage pas.
  cube(FIRE, 'Feu', 'fire', '#ff8a3c', 0, {
    drop: null,
    solid: false,
    seeThrough: true,
    small: true,
    light: true,
    noItem: true,
  }),
  cube(IRON_ORE, 'Minerai de fer', 'iron_ore', '#b08a6a', 4.5, { tier: 2, sound: 'stone' }),
  cube(CLAY, 'Argile', 'clay', '#9aa7b8', 0.6),
  cube(TERRACOTTA, 'Terre cuite', 'terracotta', '#c9744e', 1.25, { sound: 'stone' }),
  cube(ROOF_TILES, 'Tuiles', 'roof_tiles', '#b0503a', 1.5, { sound: 'stone' }),
  cube(STONE_BRICKS, 'Briques de pierre', 'stone_bricks', '#7f8799', 3, { sound: 'stone' }),
  cube(SANDSTONE, 'Grès', 'sandstone', '#e3c88a', 0.8, {
    tex: { top: 'sandstone_top', side: 'sandstone', bottom: 'sandstone_top' },
    sound: 'stone',
  }),
  cube(DARK_PLANKS, 'Planches foncées', 'dark_planks', '#7a5233', 1.5, { sound: 'wood' }),
  cube(LANTERN, 'Lanterne', 'lantern', '#ffd36e', 1, { light: true, sound: 'glass' }),
  cube(IRON_BLOCK, 'Bloc de fer', 'iron_block', '#d8dde6', 5, { tier: 2, sound: 'stone' }),
  cube(PLASTER, 'Enduit blanc', 'plaster', '#f1ece2', 1, { sound: 'stone' }),
  cube(BORNE, 'Borne de protection', 'borne', '#8b6cff', 3, { light: true, sound: 'stone' }),
  cube(LAVA, 'Lave', 'lava', '#ff6a2b', Infinity, {
    drop: null,
    solid: false,
    fluid: true,
    glow: true,
    burns: true,
  }),
];

export function blockDef(id: number): BlockDef {
  return BLOCKS[id] ?? BLOCKS[AIR]!;
}

/** Objet de l'inventaire : un cube (même id) ou un objet simple. */
export interface ItemDef {
  id: number;
  name: string;
  /** Petite image de l'inventaire : couleur et symbole. */
  color: string;
  glyph: string;
  /** Se pose comme un cube. */
  block: boolean;
  /** Pioche : niveau (1 bois, 2 pierre, 3 cristal) et vitesse de creusage. */
  tool?: { tier: number; speed: number };
}

const OTHER_ITEMS: readonly ItemDef[] = [
  { id: STICK, name: 'Bâton', color: '#c98f5a', glyph: '／', block: false },
  {
    id: WOOD_PICK,
    name: 'Pioche en bois',
    color: '#c98f5a',
    glyph: '⛏',
    block: false,
    tool: { tier: 1, speed: 2 },
  },
  {
    id: STONE_PICK,
    name: 'Pioche en pierre',
    color: '#8b93a6',
    glyph: '⛏',
    block: false,
    tool: { tier: 2, speed: 3.5 },
  },
  {
    id: CRYSTAL_PICK,
    name: 'Pioche de cristal',
    color: '#5fe3d0',
    glyph: '⛏',
    block: false,
    tool: { tier: 3, speed: 6 },
  },
  {
    id: IRON_PICK,
    name: 'Pioche en fer',
    color: '#d8dde6',
    glyph: '⛏',
    block: false,
    tool: { tier: 2, speed: 4.8 },
  },
  { id: COAL, name: 'Charbon', color: '#2f3442', glyph: '●', block: false },
  { id: CRYSTAL, name: 'Cristal', color: '#5fe3d0', glyph: '◆', block: false },
  { id: IRON_INGOT, name: 'Lingot de fer', color: '#c9ced8', glyph: '▬', block: false },
  { id: FLINT, name: 'Silex', color: '#4a4f5c', glyph: '◆', block: false },
  { id: BUCKET, name: 'Seau', color: '#aeb6c4', glyph: '◡', block: false },
  { id: WATER_BUCKET, name: 'Seau d’eau', color: '#3f8fd8', glyph: '◡', block: false },
  { id: LIGHTER, name: 'Briquet', color: '#ff8a3c', glyph: '✦', block: false },
];

export function itemDef(id: number): ItemDef | null {
  if (id > AIR && id < BLOCKS.length) {
    const b = BLOCKS[id]!;
    if (b.hardness === Infinity || b.noItem) return null;
    return { id, name: b.name, color: b.color, glyph: '', block: true };
  }
  return OTHER_ITEMS.find((i) => i.id === id) ?? null;
}

/** Tous les objets que l'on peut avoir (mode créatif, tests). */
export const ALL_ITEMS: readonly ItemDef[] = [
  ...BLOCKS.map((b) => itemDef(b.id)).filter((i): i is ItemDef => i !== null),
  ...OTHER_ITEMS,
];

/** Durée pour casser un cube avec l'objet tenu (secondes ; Infinity : impossible). */
export function breakTime(block: number, held: number | null): number {
  const b = blockDef(block);
  if (b.hardness === Infinity) return Infinity;
  const tool = held !== null ? itemDef(held)?.tool : undefined;
  return b.hardness / (tool?.speed ?? 1);
}

/** Chance qu'un gravier donne un silex (pour le briquet). */
export const FLINT_CHANCE = 0.15;

/**
 * Ce que rapporte un cube cassé avec l'objet tenu (null : rien, outil trop faible). `roll`
 * (0 à 1) : tirage au sort, pour le silex caché dans le gravier.
 */
export function dropOf(block: number, held: number | null, roll = Math.random()): number | null {
  const b = blockDef(block);
  const tier = held !== null ? (itemDef(held)?.tool?.tier ?? 0) : 0;
  if (tier < b.tier) return null;
  if (block === GRAVEL && roll < FLINT_CHANCE) return FLINT;
  return b.drop;
}

/** Ce qu'on peut trouver posé dans le monde : un cube du sac, l'eau (seau) ou le feu (briquet). */
export function placeable(block: number): boolean {
  return !!itemDef(block)?.block || block === WATER || block === FIRE || block === LAVA;
}

/** Cube fixe du terrain de départ (socle, dalle, portail) : il ne change jamais. L'eau, si. */
export function fixed(block: number): boolean {
  const b = blockDef(block);
  return b.hardness === Infinity && !b.fluid;
}
