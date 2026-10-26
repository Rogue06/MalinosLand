/**
 * Panneau « Que faire maintenant ? » (v0.35, PR 2 du plan d'évolution) : les lieux vers lesquels
 * les suggestions emmènent le joueur. Ce ne sont que des identifiants d'objets de la carte du Hub
 * (`hub.json`) ; un test vérifie qu'ils existent tous.
 */

/** Objet à rejoindre pour chaque objectif « Premiers pas » (`null` : rien à rejoindre). */
export const QUEST_TARGETS: Record<string, string | null> = {
  talk_guide: 'joshua',
  read_welcome: 'welcome-board',
  sit: 'canape',
  coffee: 'coffee',
  mirror: 'mirror',
  elevator: 'elevator',
  terrace: 'transat',
  chat: null,
};

/** Où retrouver les Malinos présents dans une zone, et comment le dire. */
export const ZONE_SPOTS: Record<string, { object: string; where: string }> = {
  forest: { object: 'feu-de-camp', where: 'au feu de camp' },
  games: { object: 'pingpong', where: 'dans la salle de jeux' },
  lounge: { object: 'coffee', where: 'au salon' },
  terrace: { object: 'transat', where: 'sur la terrasse' },
  park: { object: 'etang', where: 'au bord de l’étang' },
  hall: { object: 'joshua', where: 'dans le hall' },
  coworking: { object: 'desk-2-2', where: 'au coworking' },
  conference: { object: 'stage', where: 'dans la salle de conférence' },
  garden: { object: 'fountain', where: 'près de la fontaine' },
};

/** Idées de balade selon le moment de la journée (une par jour, à tour de rôle). */
export const AMBIENT_IDEAS: Record<
  'nuit' | 'aube' | 'jour' | 'crepuscule',
  Array<{ icon: string; title: string; detail: string; object: string }>
> = {
  nuit: [
    {
      icon: '✨',
      title: 'Les lucioles sont sorties',
      detail: 'Il fait nuit : va les voir danser autour du feu de camp, dans la forêt.',
      object: 'feu-de-camp',
    },
  ],
  aube: [
    {
      icon: '🌅',
      title: 'Le soleil se lève',
      detail: 'Un transat sur la terrasse, et le jour se lève sur MalinosLand.',
      object: 'transat',
    },
  ],
  crepuscule: [
    {
      icon: '🌇',
      title: 'Le coucher du soleil',
      detail: 'Le ciel devient orange : la terrasse est l’endroit idéal pour le regarder.',
      object: 'transat',
    },
  ],
  jour: [
    {
      icon: '🦆',
      title: 'Un tour au bord de l’étang',
      detail: 'Le Parc des Malinos, ses nénuphars et ses bancs : une pause au calme.',
      object: 'etang',
    },
    {
      icon: '🏓',
      title: 'Une partie de ping-pong ?',
      detail: 'La salle de jeux est au nord du parc : ping-pong, baby-foot et échecs.',
      object: 'pingpong',
    },
    {
      icon: '🗺️',
      title: 'Ce qui arrive bientôt',
      detail: 'Le tableau de la feuille de route, dans le hall, montre les prochaines nouveautés.',
      object: 'roadmap-board',
    },
  ],
};

/**
 * Stand du projet le plus récemment exposé (place 0 : la première cimaise du musée), et nombre
 * de stands. Un test vérifie qu'ils correspondent à la carte du Hub.
 */
export const MUSEUM_NEWEST_STAND = 'stand-1';
export const MUSEUM_STAND_COUNT = 7;
/** Un projet reste « nouveau au musée » pendant une semaine après sa validation. */
export const MUSEUM_NEW_DAYS = 7;

/** Envies proposées à l'arrivée (cahier des charges du village, §6). */
export type Intent = 'learn' | 'create' | 'meet';
export const INTENTS: ReadonlyArray<{ id: Intent; icon: string; label: string; hint: string }> = [
  { id: 'learn', icon: '💡', label: 'Comprendre l’IA', hint: 'Un quiz, des outils à essayer' },
  {
    id: 'create',
    icon: '🎨',
    label: 'Créer quelque chose',
    hint: 'Ton Malino, ton studio, tes projets',
  },
  {
    id: 'meet',
    icon: '👋',
    label: 'Rencontrer les Malinos',
    hint: 'Qui est là, les studios ouverts',
  },
];
