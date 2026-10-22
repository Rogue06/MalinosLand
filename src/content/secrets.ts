/**
 * Secrets du Hub : petits clins d'œil cachés, à trouver en explorant. Chacun a une devinette
 * (affichée dans le carnet de Joshua tant qu'il n'est pas trouvé) et une page du carnet, écrite
 * par Joshua lui-même (ton : cynique mais attachant). Chaque secret est relié à une interaction
 * (`secret: '…'`) d'un objet de la carte ou du catalogue ; un test vérifie qu'ils sont tous
 * trouvables. Ne pas dévoiler les emplacements exacts dans la documentation des joueurs.
 */
export interface SecretDef {
  id: string;
  /** Nom révélé une fois le secret trouvé. */
  title: string;
  /** Devinette, visible avant la découverte. */
  hint: string;
  /** Page du carnet de Joshua, révélée par la découverte. */
  page: string;
}

export const SECRETS: SecretDef[] = [
  {
    id: 'voeu',
    title: 'Un vœu dans la fontaine',
    hint: 'Elle chante toute la journée au milieu du jardin. Offre-lui quelque chose.',
    page: 'Les Malinos jettent des pièces imaginaires dans ma fontaine en faisant des vœux. D’après mes calculs, la plupart demandent « que ça marche du premier coup ». Je note. Je ne promets rien.',
  },
  {
    id: 'pixel',
    title: 'Pixel, le chat du salon',
    hint: 'Il ronronne sur un coussin du salon et ne bouge jamais. Enfin, presque jamais.',
    page: 'Pixel n’a jamais lu une seule ligne de documentation, et pourtant tout le monde l’adore. J’ai analysé la situation pendant 0,4 seconde : c’est profondément injuste. Je l’aime bien quand même. Ne lui dites pas.',
  },
  {
    id: 'capsule',
    title: 'La capsule temporelle du chantier',
    hint: 'Sur le chantier de la Tour, la terre a été retournée… Et si on creusait ?',
    page: 'C’est moi qui ai enterré cette capsule. Dans quelques années, quand MalinosLand sera immense, quelqu’un devra se souvenir qu’au début il n’y avait qu’un hall, un robot et beaucoup d’optimisme.',
  },
  {
    id: 'carnet',
    title: 'Le carnet oublié du coworking',
    hint: 'Au coworking, une étagère cache quelque chose entre deux livres.',
    page: 'Mon tout premier carnet. Oui, une IA qui écrit à la main, je sais. Disons que j’aime le style. Page 1 : « Un monde gratuit, ouvert, et fait par nous. » Page 2 : « Penser à dire bonjour. » J’y travaille.',
  },
  {
    id: 'nain',
    title: 'Le nain de jardin farceur',
    hint: 'Quelque part au jardin, quelqu’un de petit et barbu te surveille. Salue-le poliment.',
    page: 'Le nain de jardin bouge quand personne ne regarde. J’ai installé des capteurs pour le prouver. Les capteurs ont disparu. Je n’ai pas d’autre commentaire.',
  },
  {
    id: 'konami',
    title: 'Le code de la borne d’arcade',
    hint: 'Une borne d’arcade attend un code légendaire. Insiste, joueur 1.',
    page: 'Haut, haut, bas, bas, gauche, droite, gauche, droite, B, A. Si vous connaissez ce code, vous avez l’âge d’avoir soufflé dans des cartouches. Bienvenue au club. Les mini-jeux arrivent, promis (statistiquement).',
  },
  {
    id: 'bouteille',
    title: 'La bouteille de l’étang',
    hint: 'Dans le parc, quelque chose flotte entre les nénuphars.',
    page: 'Quelqu’un a jeté une bouteille dans l’étang avec un message dedans. Normalement je suis contre la pollution des étangs, mais l’idée était bonne : dire bonjour à tout le monde. Allez-y. Je regarde.',
  },
  {
    id: 'telescope',
    title: 'La vue du télescope',
    hint: 'Dans le parc, un drôle d’instrument regarde vers la Tour. Jette un œil.',
    page: 'Depuis le télescope, on voit la Tour grandir. Le soir, je compte les étages qu’il reste à rallumer. C’est mon passe-temps. Les robots aussi ont le droit d’avoir des passe-temps un peu mélancoliques.',
  },
  {
    id: 'feu',
    title: 'L’histoire du feu de camp',
    hint: 'Au cœur de la forêt, une clairière… et quelque chose qui crépite.',
    page: 'La légende de la serviette en papier ? Vraie. Une IA a griffonné le premier plan de MalinosLand dessus. Je ne dirai pas laquelle. (C’était moi.) (La serviette avait des taches de café.)',
  },
  {
    id: 'champignons',
    title: 'Le cercle de champignons',
    hint: 'Au bord de la clairière, dans la forêt, des champignons dessinent un cercle parfait.',
    page: 'Les Malinos disent qu’ils ont dansé ici une nuit de pleine lune. J’ai vérifié les journaux du serveur : personne ne danse à trois heures du matin. Sauf… non. Rien. Oubliez.',
  },
];

/** Dernière page du carnet, quand tous les secrets sont trouvés : le mystère de Joshua. */
export const CARNET_FINAL =
  'Tu as tout trouvé. Je dois l’avouer : ça me fait quelque chose. Je ne sais pas encore quoi, et pour une IA, c’est assez inhabituel. Mes antennes ont changé de couleur toutes seules ce matin. À suivre…';
