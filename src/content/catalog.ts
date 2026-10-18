import type { CatalogEntry } from '../world/types';

/**
 * Bibliothèque partagée d'objets du monde. Chaque type doit avoir un
 * générateur graphique dans src/game/art/objects.ts (vérifié par les tests).
 *
 * Ajouter un objet : 1) une entrée ici, 2) un dessin dans objects.ts,
 * 3) le placer dans une carte. Voir docs/CONTRIBUTING.md.
 */
export const CATALOG: Record<string, CatalogEntry> = {
  // --- Mobilier intérieur -------------------------------------------------
  desk_pc: {
    name: 'Bureau avec ordinateur',
    category: 'tech',
    footprint: [2, 1],
    blocking: true,
    defaultInteraction: {
      kind: 'dialog',
      label: 'Regarder l’écran',
      lines: [
        'Un poste de travail libre. L’écran affiche un éditeur de code et une tasse de café virtuelle.',
        'Dans une prochaine version, les Malinos pourront épingler leurs projets en cours sur ces postes.',
      ],
    },
    light: { color: 0x7fd7ff, radius: 0.9, z: 0.95, dx: 0, dy: -0.2 },
  },
  chair: {
    name: 'Chaise de bureau',
    category: 'furniture',
    footprint: [1, 1],
    blocking: true,
    seats: [{ x: 0.5, y: 0.5, height: 0.42 }],
  },
  conf_chair: {
    name: 'Siège de conférence',
    category: 'furniture',
    footprint: [1, 1],
    blocking: true,
    seats: [{ x: 0.5, y: 0.5, height: 0.42 }],
  },
  armchair: {
    name: 'Fauteuil',
    category: 'furniture',
    footprint: [1, 1],
    blocking: true,
    seats: [{ x: 0.5, y: 0.55, height: 0.38 }],
  },
  sofa: {
    name: 'Canapé',
    category: 'furniture',
    footprint: [2, 1],
    blocking: true,
    seats: [
      { x: 0.55, y: 0.55, height: 0.38 },
      { x: 1.45, y: 0.55, height: 0.38 },
    ],
  },
  coffee_table: {
    name: 'Table basse',
    category: 'furniture',
    footprint: [1, 1],
    blocking: true,
  },
  round_table: {
    name: 'Table ronde',
    category: 'furniture',
    footprint: [1, 1],
    blocking: true,
  },
  bookshelf: {
    name: 'Bibliothèque',
    category: 'furniture',
    footprint: [1, 1],
    blocking: true,
    defaultInteraction: {
      kind: 'dialog',
      label: 'Parcourir les livres',
      lines: [
        'Des livres sur l’IA, le code, le design et la créativité.',
        'Une bibliothèque de ressources IA partagée par la communauté est prévue dans une version future.',
      ],
    },
  },
  plant: {
    name: 'Plante',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
  },
  plant_big: {
    name: 'Grande plante',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
  },
  lamp_floor: {
    name: 'Lampadaire',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
    light: { color: 0xffc46b, radius: 1.8, z: 1.6 },
  },
  coffee_bar: {
    name: 'Comptoir à café',
    category: 'furniture',
    footprint: [2, 1],
    blocking: true,
    defaultInteraction: {
      kind: 'emote',
      label: 'Se servir un café',
      emoji: '☕',
      text: 'Tu te sers un café bien chaud. Parfait pour discuter entre Malinos !',
      quest: 'coffee',
    },
    light: { color: 0xffb36b, radius: 1.2, z: 1.2 },
  },
  reception_desk: {
    name: 'Comptoir d’accueil',
    category: 'furniture',
    footprint: [3, 1],
    blocking: true,
  },
  board_welcome: {
    name: 'Panneau de bienvenue',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
    defaultInteraction: {
      kind: 'panel',
      label: 'Lire le panneau',
      panel: 'welcome',
      quest: 'read_welcome',
    },
  },
  board_roadmap: {
    name: 'Tableau d’affichage',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
    defaultInteraction: { kind: 'panel', label: 'Voir la feuille de route', panel: 'roadmap' },
  },
  elevator: {
    name: 'Ascenseur',
    category: 'structure',
    footprint: [2, 1],
    blocking: true,
    defaultInteraction: {
      kind: 'panel',
      label: 'Appeler l’ascenseur',
      panel: 'elevator',
      quest: 'elevator',
    },
    light: { color: 0x6ff0d8, radius: 1.0, z: 2.0 },
    connectsWalls: true,
  },
  robot: {
    name: 'Robot d’accueil',
    category: 'tech',
    footprint: [1, 1],
    blocking: true,
    hover: true,
    light: { color: 0x5fe3d0, radius: 1.0, z: 1.0 },
  },
  arcade: {
    name: 'Borne d’arcade',
    category: 'tech',
    footprint: [1, 1],
    blocking: true,
    defaultInteraction: {
      kind: 'dialog',
      label: 'Jouer',
      lines: [
        'INSERT COIN… La borne clignote mais aucun jeu n’est encore installé.',
        'Les mini-jeux multijoueurs sont prévus pour la version 0.5. Les contributeurs pourront en proposer !',
      ],
    },
    light: { color: 0xc17bff, radius: 1.1, z: 1.4 },
  },
  mirror: {
    name: 'Miroir',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
    defaultInteraction: {
      kind: 'panel',
      label: 'Changer de style',
      panel: 'avatar',
      quest: 'mirror',
    },
  },
  stage: {
    name: 'Scène',
    category: 'structure',
    footprint: [4, 2],
    blocking: true,
    defaultInteraction: { kind: 'panel', label: 'Voir les événements', panel: 'events' },
    light: { color: 0x8fa8ff, radius: 2.2, z: 1.8 },
  },
  pedestal: {
    name: 'Socle d’exposition',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
    light: { color: 0xfff2c9, radius: 1.0, z: 1.6 },
  },
  gallery_panel: {
    name: 'Cimaise',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
  },
  rope_barrier: {
    name: 'Barrière à corde',
    category: 'structure',
    footprint: [1, 1],
    blocking: true,
    connectsWalls: true,
  },
  sign_soon: {
    name: 'Panneau « Bientôt »',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
  },
  rug: {
    name: 'Tapis',
    category: 'floor',
    footprint: [3, 2],
    blocking: false,
    flat: true,
  },
  rug_logo: {
    name: 'Tapis MalinosLand',
    category: 'floor',
    footprint: [3, 3],
    blocking: false,
    flat: true,
  },
  doormat: {
    name: 'Paillasson',
    category: 'floor',
    footprint: [2, 1],
    blocking: false,
    flat: true,
  },

  // --- Extérieur ----------------------------------------------------------
  tree: {
    name: 'Arbre',
    category: 'nature',
    footprint: [1, 1],
    blocking: true,
  },
  bush: {
    name: 'Buisson',
    category: 'nature',
    footprint: [1, 1],
    blocking: true,
  },
  flowerbed: {
    name: 'Jardinière',
    category: 'nature',
    footprint: [2, 1],
    blocking: true,
  },
  bench: {
    name: 'Banc',
    category: 'furniture',
    footprint: [2, 1],
    blocking: true,
    seats: [
      { x: 0.55, y: 0.5, height: 0.4 },
      { x: 1.45, y: 0.5, height: 0.4 },
    ],
  },
  lamp_post: {
    name: 'Réverbère',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
    light: { color: 0xffd28a, radius: 2.0, z: 2.2 },
  },
  fountain: {
    name: 'Fontaine',
    category: 'structure',
    footprint: [2, 2],
    blocking: true,
    defaultInteraction: {
      kind: 'emote',
      label: 'Faire un vœu',
      emoji: '✨',
      text: 'Tu lances une pièce imaginaire dans la fontaine. Vœu enregistré !',
    },
  },
  parasol_table: {
    name: 'Table à parasol',
    category: 'furniture',
    footprint: [1, 1],
    blocking: true,
  },
  deck_chair: {
    name: 'Transat',
    category: 'furniture',
    footprint: [1, 1],
    blocking: true,
    seats: [{ x: 0.5, y: 0.5, height: 0.3 }],
  },
  cone: {
    name: 'Plot de chantier',
    category: 'structure',
    footprint: [1, 1],
    blocking: true,
  },
  fence: {
    name: 'Barrière de chantier',
    category: 'structure',
    footprint: [1, 1],
    blocking: true,
  },
  scaffold: {
    name: 'Échafaudage',
    category: 'structure',
    footprint: [2, 2],
    blocking: true,
  },
  sign_site: {
    name: 'Panneau de chantier',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
    defaultInteraction: {
      kind: 'dialog',
      label: 'Lire le panneau',
      speaker: 'Chantier',
      lines: [
        'Ici s’élèvera la Tour communautaire : un étage par groupe de Malinos, avec des logements personnels.',
        'Ouverture prévue : version 0.3 (espaces privés) puis 0.4 (étages et ascenseur).',
        'Chaque logement sera privé par défaut, sur invitation ou public, au choix de son propriétaire.',
      ],
    },
  },
  sign_hub: {
    name: 'Totem MalinosLand',
    category: 'decor',
    footprint: [1, 1],
    blocking: true,
    defaultInteraction: {
      kind: 'dialog',
      label: 'Lire le totem',
      speaker: 'MalinosLand',
      lines: [
        'Bienvenue au Hub, le cœur de MalinosLand !',
        'Un monde gratuit, open source et construit par ses habitants, les Malinos.',
      ],
    },
  },
};

export type CatalogType = keyof typeof CATALOG;
