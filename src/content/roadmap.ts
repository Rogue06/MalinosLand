/** Feuille de route affichée dans le jeu (détails : docs/ROADMAP.md). */
export interface RoadmapStep {
  version: string;
  title: string;
  status: 'done' | 'current' | 'planned';
  items: string[];
}

export const ROADMAP: RoadmapStep[] = [
  {
    version: '0.1',
    title: 'Prototype jouable',
    status: 'done',
    items: [
      'Le Hub en isométrique',
      'Avatar personnalisable',
      'Déplacements et collisions',
      'Interactions',
      'Démo multi-onglets locale',
    ],
  },
  {
    version: '0.2',
    title: 'Première expérience multijoueur',
    status: 'current',
    items: [
      'Joueurs en ligne ✓',
      'Chat local et général ✓',
      'Mise en ligne gratuite ✓',
      'Comptes et profils (bientôt)',
    ],
  },
  {
    version: '0.3',
    title: 'Espaces personnels',
    status: 'planned',
    items: ['Logement privé', 'Invitations', 'Éditeur de décoration', 'Catalogue d’objets'],
  },
  {
    version: '0.4',
    title: 'Expansion communautaire',
    status: 'planned',
    items: ['Étages et ascenseur', 'Galerie des Malinos', 'Annuaire des membres'],
  },
  {
    version: '0.5',
    title: 'Vie communautaire',
    status: 'planned',
    items: ['Événements', 'Expositions temporaires', 'Défis créatifs', 'Mini-jeux'],
  },
  {
    version: '1.0',
    title: 'Univers communautaire stable',
    status: 'planned',
    items: ['Modération robuste', 'Outils de contribution', 'Infrastructure gratuite maîtrisée'],
  },
];

export const REPO_URL = 'https://github.com/Rogue06/MalinosLand';
