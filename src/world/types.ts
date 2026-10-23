import type { Facing } from '../core/iso';
import type { Rotation } from '../core/rotation';

/**
 * Format des cartes de MalinosLand (fichiers JSON dans src/content/maps).
 * Toute évolution incompatible doit incrémenter MAP_FORMAT_VERSION et
 * fournir une migration (voir docs/WORLD_DESIGN.md).
 */
export const MAP_FORMAT_VERSION = 1;

export const FLOOR_TYPES = [
  'wood',
  'lounge',
  'hall',
  'carpet',
  'gallery',
  'grass',
  'path',
  'deck',
  'dirt',
] as const;
export type FloorType = (typeof FLOOR_TYPES)[number];

export const WALL_TYPES = ['tall', 'brick', 'low'] as const;
export type WallType = (typeof WALL_TYPES)[number];

export interface TileLegendEntry {
  floor?: FloorType;
  wall?: WallType;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ZoneStatus = 'open' | 'soon';

export interface ZoneDef {
  id: string;
  name: string;
  rect: Rect;
  status: ZoneStatus;
  description: string;
  /** Version prévue pour l'ouverture, si status = 'soon'. */
  plannedFor?: string;
}

/** Identifiants des panneaux d'interface ouvrables depuis le monde. */
export const PANEL_IDS = [
  'welcome',
  'roadmap',
  'elevator',
  'tips',
  'events',
  'avatar',
  'ideas',
  'bugs',
  'home',
  'carnet',
  'activities',
  'quiz',
] as const;
export type PanelId = (typeof PANEL_IDS)[number];

export type InteractionDef =
  | {
      kind: 'dialog';
      label: string;
      speaker?: string;
      lines: string[];
      quest?: string;
      /** Secret révélé par cette interaction (voir src/content/secrets.ts). */
      secret?: string;
    }
  | {
      kind: 'panel';
      label: string;
      panel: PanelId;
      quest?: string;
      /** Secret révélé par cette interaction (voir src/content/secrets.ts). */
      secret?: string;
    }
  | {
      kind: 'emote';
      label: string;
      emoji: string;
      text: string;
      quest?: string;
      /** Secret révélé par cette interaction (voir src/content/secrets.ts). */
      secret?: string;
    };

export interface PlacedObject {
  /** Identifiant stable, requis si l'objet est interactif. */
  id?: string;
  type: string;
  x: number;
  y: number;
  rot?: Rotation;
  variant?: number;
  /** Remplace l'interaction par défaut du catalogue. */
  interaction?: InteractionDef;
  /** Nom flottant affiché au-dessus de l'objet (personnage non joueur…). */
  label?: string;
}

export interface WallDecorDef {
  type: string;
  x: number;
  y: number;
  /** Face du mur sur laquelle est posé le décor (face visible : +y ou +x). */
  side: 'py' | 'px';
  variant?: number;
}

export interface MapFile {
  formatVersion: number;
  id: string;
  name: string;
  width: number;
  height: number;
  spawn: { x: number; y: number; facing: Facing };
  legend: Record<string, TileLegendEntry>;
  /** Une chaîne par ligne y ; un caractère par colonne x (voir legend). */
  tiles: string[];
  zones: ZoneDef[];
  objects: PlacedObject[];
  wallDecor: WallDecorDef[];
}

/** Place assise définie dans l'empreinte canonique (rot 0) d'un objet. */
export interface SeatDef {
  x: number;
  y: number;
  /** Hauteur de l'assise en unités z. */
  height: number;
}

export type CatalogCategory = 'furniture' | 'tech' | 'decor' | 'nature' | 'structure' | 'floor';

export interface CatalogEntry {
  name: string;
  category: CatalogCategory;
  /** Empreinte canonique [largeur x, profondeur y] en tuiles. */
  footprint: [number, number];
  blocking: boolean;
  /** Dessiné au niveau du sol (tapis, paillasson) : jamais devant un avatar. */
  flat?: boolean;
  seats?: SeatDef[];
  defaultInteraction?: InteractionDef;
  /** Halo lumineux décoratif (désactivé en qualité basse). */
  light?: { color: number; radius: number; z: number; dx?: number; dy?: number };
  /** Animation légère de flottement (robot). */
  hover?: boolean;
  /** Les murs voisins se raccordent visuellement à cet objet (ascenseur…). */
  connectsWalls?: boolean;
}
