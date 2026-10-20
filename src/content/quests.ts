/**
 * Objectifs de découverte « Premiers pas ». Ils guident le nouveau venu,
 * sans monnaie ni récompense : seulement le plaisir de découvrir le Hub.
 */
export interface QuestDef {
  id: string;
  title: string;
  hint: string;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'talk_guide',
    title: 'Parle à Joshua, le robot d’accueil',
    hint: 'Il t’attend dans le hall : touche-le ou clique sur lui.',
  },
  { id: 'read_welcome', title: 'Lis le panneau de bienvenue', hint: 'Près de l’entrée du hall.' },
  {
    id: 'sit',
    title: 'Assieds-toi quelque part',
    hint: 'Touche ou clique sur une chaise, un canapé ou un banc.',
  },
  {
    id: 'coffee',
    title: 'Prends un café au salon',
    hint: 'Le comptoir à café est dans le salon détente.',
  },
  {
    id: 'mirror',
    title: 'Change de style au miroir',
    hint: 'Le miroir est dans le salon détente.',
  },
  { id: 'elevator', title: 'Appelle l’ascenseur', hint: 'Au fond du hall.' },
  {
    id: 'terrace',
    title: 'Détends-toi sur la terrasse',
    hint: 'Elle est à droite du bâtiment : suis le chemin du jardin.',
  },
  {
    id: 'chat',
    title: 'Dis bonjour dans le chat',
    hint: 'Écris un message en bas de l’écran (Entrée au clavier).',
  },
];
