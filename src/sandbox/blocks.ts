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
  | 'torch';

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

/** Objets qui ne sont pas des cubes. */
export const STICK = 100;
export const WOOD_PICK = 101;
export const STONE_PICK = 102;
export const CRYSTAL_PICK = 103;
export const COAL = 110;
export const CRYSTAL = 111;

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
  { id: COAL, name: 'Charbon', color: '#2f3442', glyph: '●', block: false },
  { id: CRYSTAL, name: 'Cristal', color: '#5fe3d0', glyph: '◆', block: false },
];

export function itemDef(id: number): ItemDef | null {
  if (id > AIR && id < BLOCKS.length) {
    const b = BLOCKS[id]!;
    if (b.hardness === Infinity) return null;
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

/** Ce que rapporte un cube cassé avec l'objet tenu (null : rien, outil trop faible). */
export function dropOf(block: number, held: number | null): number | null {
  const b = blockDef(block);
  const tier = held !== null ? (itemDef(held)?.tool?.tier ?? 0) : 0;
  return tier >= b.tier ? b.drop : null;
}
