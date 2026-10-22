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
    status: 'done',
    items: [
      'Joueurs en ligne ✓',
      'Chat local et général ✓',
      'Mise en ligne gratuite ✓',
      'Comptes GitHub ou Google ✓',
      'Masquer, signaler, modération ✓',
      'Boîte à idées et borne à bugs ✓',
      'Sons, mentions, confort mobile ✓',
    ],
  },
  {
    version: '0.3',
    title: 'Espaces personnels',
    status: 'done',
    items: [
      'Mon logement (studio) ✓',
      'Accès : personne, invités, tout le monde ✓',
      'Invitations ✓',
      'Éditeur de décoration ✓',
      'Carnet de Joshua et secrets sur le compte ✓',
      'Jour et nuit à l’heure de Paris ✓',
      'Statut doré et modérateurs ✓',
    ],
  },
  {
    version: '0.35',
    title: 'Que faire ? S’amuser tout de suite',
    status: 'current',
    items: [
      'Panneau « Que faire maintenant ? » près de Joshua',
      'Quiz IA des Malinos sur une borne d’arcade',
      'Défi de la semaine, le même pour tous',
    ],
  },
  {
    version: '0.4',
    title: 'Le Musée des Malinos',
    status: 'planned',
    items: [
      'Exposer son projet (validé par les modérateurs)',
      'Stands et affiches dans la galerie',
      'Essayer un site sans quitter le jeu, quand il le permet',
      'Le chantier deviendra le Bâtiment des créations',
    ],
  },
  {
    version: '0.45',
    title: 'Des lieux plus vivants',
    status: 'planned',
    items: [
      'Ressources de la communauté au coworking',
      'Feu de camp : histoires de Joshua et guitare',
      'Secret de la semaine',
      'Studios ouverts mis en avant',
    ],
  },
  {
    version: '0.5',
    title: 'Vie communautaire',
    status: 'planned',
    items: ['Agenda des événements', 'Mini-jeux à plusieurs', 'Défis créatifs'],
  },
  {
    version: '0.6',
    title: 'Personnalisation',
    status: 'planned',
    items: [
      'Coins coins 🦆 (bonus cosmétiques)',
      'Nouvelles décorations',
      'Suite du mystère de Joshua',
    ],
  },
  {
    version: '1.0',
    title: 'Univers communautaire stable',
    status: 'planned',
    items: ['Modération robuste', 'Outils de contribution', 'Infrastructure gratuite maîtrisée'],
  },
];

export const REPO_URL = 'https://github.com/Rogue06/MalinosLand';
