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

/**
 * Projets d'exemple, pour les captures et les tests du musée sans réseau (outil de débogage
 * `museumSample()`). Jamais affichés aux joueurs : les vrais stands lisent la base.
 */
export interface MuseumSample {
  title: string;
  summary: string;
  url: string;
  category: MuseumCategory;
  tags: string[];
  author: string;
  embed: 'unknown' | 'ok' | 'refused';
  approvedAt: string;
}

const sample = (
  title: string,
  category: MuseumCategory,
  author: string,
  url: string,
  summary: string,
  tags: string[],
): MuseumSample => ({
  title,
  category,
  author,
  url,
  summary,
  tags,
  embed: 'unknown',
  approvedAt: '2026-10-24T10:00:00Z',
});

export const MUSEUM_SAMPLES: readonly MuseumSample[] = [
  sample(
    'Malino Notes',
    'outil-ia',
    'Rogue06',
    'https://exemple.org/notes',
    'Un carnet pour apprendre l’IA pas à pas, avec des fiches et des exemples.',
    ['IA', 'notes'],
  ),
  sample(
    'Le jeu du pixel perdu',
    'jeu',
    'Joshua',
    'https://exemple.org/pixel',
    'Un petit jeu de réflexion en pixel art, jouable dans le navigateur.',
    ['jeu'],
  ),
  sample(
    'Quiz Famille IA',
    'application',
    'Lina',
    'https://exemple.org/quiz',
    'Un générateur de quiz pour réviser en famille, sans compte.',
    ['éducation', 'quiz'],
  ),
  sample(
    'Portfolio lumineux',
    'creation',
    'Sacha',
    'https://exemple.org/portfolio',
    'Des illustrations générées puis retouchées à la main.',
    ['art'],
  ),
  sample(
    'Mon site de recettes',
    'site',
    'Nora',
    'https://exemple.org/recettes',
    'Des recettes simples, classées par saison.',
    ['cuisine'],
  ),
  sample(
    'Petit agent open source',
    'open-source',
    'Malo',
    'https://exemple.org/agent',
    'Un agent qui résume des pages web, à installer chez soi.',
    ['agent', 'python'],
  ),
  sample(
    'Atelier de prompts',
    'outil-ia',
    'Inès',
    'https://exemple.org/prompts',
    'Une boîte à outils pour écrire de meilleurs prompts.',
    ['prompts'],
  ),
];
