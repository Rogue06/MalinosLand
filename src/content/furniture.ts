/**
 * Catalogue de meubles du logement (éditeur de décoration, v0.3). Chaque type doit exister dans
 * CATALOG et dans la liste de la base (fonction valid_home_decor, migration
 * 20261024090000_home_decor.sql) : un test vérifie que les deux listes sont identiques.
 */
export type FurnitureCategory = 'assises' | 'tables' | 'chambre' | 'deco' | 'loisirs';

export const FURNITURE_CATEGORIES: { id: FurnitureCategory; label: string; icon: string }[] = [
  { id: 'assises', label: 'Assises', icon: '🛋️' },
  { id: 'tables', label: 'Tables', icon: '🪑' },
  { id: 'chambre', label: 'Chambre', icon: '🛏️' },
  { id: 'deco', label: 'Déco', icon: '🪴' },
  { id: 'loisirs', label: 'Loisirs', icon: '🎮' },
];

export const FURNITURE: { type: string; category: FurnitureCategory }[] = [
  { type: 'sofa', category: 'assises' },
  { type: 'armchair', category: 'assises' },
  { type: 'chair', category: 'assises' },
  { type: 'beanbag', category: 'assises' },
  { type: 'bench', category: 'assises' },
  { type: 'desk_pc', category: 'tables' },
  { type: 'coffee_table', category: 'tables' },
  { type: 'round_table', category: 'tables' },
  { type: 'bed', category: 'chambre' },
  { type: 'bookshelf', category: 'chambre' },
  { type: 'mirror', category: 'chambre' },
  { type: 'lamp_floor', category: 'chambre' },
  { type: 'plant', category: 'deco' },
  { type: 'plant_big', category: 'deco' },
  { type: 'flowers', category: 'deco' },
  { type: 'rug', category: 'deco' },
  { type: 'cat', category: 'deco' },
  { type: 'arcade', category: 'loisirs' },
  { type: 'chess_table', category: 'loisirs' },
  { type: 'foosball', category: 'loisirs' },
  { type: 'telescope', category: 'loisirs' },
];

export const FURNITURE_TYPES: ReadonlySet<string> = new Set(FURNITURE.map((f) => f.type));

/** Nombre de couleurs proposées par type (variantes du dessin ; 1 si non précisé). */
export const FURNITURE_COLORS: Readonly<Record<string, number>> = {
  sofa: 3,
  armchair: 3,
  chair: 3,
  beanbag: 4,
  bed: 3,
  bookshelf: 3,
  desk_pc: 3,
  plant: 3,
};

/** Nombre maximal d'objets dans un logement (vérifié aussi par la base). */
export const MAX_DECOR_ITEMS = 40;
