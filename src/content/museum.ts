/**
 * Musée des Malinos (v0.4, DEC-035) : catégories des projets exposés. Les identifiants sont ceux
 * de la base (contrainte `projects.category`) ; libellés, icônes et couleurs servent à
 * l'interface et aux affiches dessinées par le jeu (src/game/art/posters.ts).
 */

export const MUSEUM_CATEGORY_IDS = [
  'site',
  'application',
  'outil-ia',
  'jeu',
  'creation',
  'open-source',
] as const;
export type MuseumCategory = (typeof MUSEUM_CATEGORY_IDS)[number];

export interface MuseumCategoryDef {
  id: MuseumCategory;
  label: string;
  /** Icône de l'interface (les affiches dessinent leur propre pictogramme). */
  icon: string;
  help: string;
  /** Couleurs de l'affiche : fond haut, fond bas, accent (motifs et étiquette). */
  poster: { top: string; bottom: string; accent: string };
}

export const MUSEUM_CATEGORIES: readonly MuseumCategoryDef[] = [
  {
    id: 'site',
    label: 'Site web',
    icon: '🌐',
    help: 'Un site, un blog, un portfolio…',
    poster: { top: '#2f6fd6', bottom: '#162a63', accent: '#8fd3ff' },
  },
  {
    id: 'application',
    label: 'Application',
    icon: '📱',
    help: 'Une application web ou mobile.',
    poster: { top: '#7b6cf6', bottom: '#2c2370', accent: '#c9c1ff' },
  },
  {
    id: 'outil-ia',
    label: 'Outil IA',
    icon: '🤖',
    help: 'Un assistant, un agent, un générateur…',
    poster: { top: '#22b5a6', bottom: '#0d3b45', accent: '#9ff5e6' },
  },
  {
    id: 'jeu',
    label: 'Jeu',
    icon: '🎮',
    help: 'Un jeu jouable dans le navigateur.',
    poster: { top: '#ff7a59', bottom: '#6a1f3a', accent: '#ffd29a' },
  },
  {
    id: 'creation',
    label: 'Création',
    icon: '🎨',
    help: 'Images, musique, vidéo, écriture…',
    poster: { top: '#e85d9c', bottom: '#3d1c5c', accent: '#ffc857' },
  },
  {
    id: 'open-source',
    label: 'Open source',
    icon: '🧩',
    help: 'Un dépôt de code à découvrir ou à rejoindre.',
    poster: { top: '#4fa35a', bottom: '#173a2a', accent: '#c6f08a' },
  },
];

export function museumCategory(id: string): MuseumCategoryDef {
  return MUSEUM_CATEGORIES.find((c) => c.id === id) ?? MUSEUM_CATEGORIES[0]!;
}
