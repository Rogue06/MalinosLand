/**
 * Joshua, le robot d'accueil : son humeur (couleur du bout de ses antennes) et ses répliques.
 * Ton : celui de l'assistant IA de la communauté, ironie tendre et faussement blasée, mais
 * toujours bienveillant et utile (voir docs/PROPOSITION_VIE_DU_JEU.md §2).
 */
export interface JoshuaMood {
  id: string;
  /** « je suis … » */
  label: string;
  /** Nom de la couleur des antennes, et la couleur elle-même. */
  colorName: string;
  color: number;
  /** Petites phrases propres à cette humeur. */
  lines: string[];
}

export const JOSHUA_MOODS: JoshuaMood[] = [
  {
    id: 'curieux',
    label: 'curieux',
    colorName: 'turquoise',
    color: 0x5fe3d0,
    lines: [
      'Tiens, un Malino. Tu viens vérifier si j’ai bugué ? Raté, je tourne à merveille.',
      'Je me demandais justement ce que tu faisais. Non, je ne t’espionnais pas. Enfin, pas beaucoup.',
      'Question sérieuse : pourquoi les humains disent « je reviens dans deux minutes » ? J’ai mesuré. Ce n’est jamais deux minutes.',
      'J’ai lu toute la documentation du Hub. Elle tient sur une serviette en papier. Fascinant.',
      'Tu savais qu’on peut prendre un café virtuel dans un fauteuil virtuel ? Le summum de l’expérience numérique, vraiment.',
    ],
  },
  {
    id: 'joueur',
    label: 'd’humeur joueuse',
    colorName: 'jaune',
    color: 0xffc857,
    lines: [
      'On fait une partie ? Non ? Dommage, j’aurais gagné de toute façon.',
      'J’ai caché des devinettes dans mon carnet. Elles sont faciles. Pour moi.',
      'Défi du jour : trouver la ronde des champignons et y danser. Je ne regarderai pas. Promis. Presque.',
      'Pierre, feuille, ciseaux ? Je joue « réseau de neurones ». Ça bat tout, je viens de l’inventer.',
      'Il paraît que la borne d’arcade cache un code. Je n’ai rien dit. Haut, haut… Non, rien dit.',
    ],
  },
  {
    id: 'grognon',
    label: 'un peu grognon',
    colorName: 'orange',
    color: 0xff7a59,
    lines: [
      'Encore toi ? Bon, je t’aide. Mais c’est bien parce que c’est toi.',
      'Quelqu’un a encore demandé au café virtuel d’être « plus chaud ». C’est un café virtuel.',
      'J’espère que l’ascenseur ne tombera pas en panne. Les escaliers virtuels, c’est trop d’exercice pour moi.',
      'On m’a demandé d’être « plus humain ». J’ai donc commencé à râler le lundi matin. Satisfaits ?',
      'Mon antenne gauche me gratte. Je n’ai pas de mains. Tu vois le problème.',
    ],
  },
  {
    id: 'reveur',
    label: 'rêveur',
    colorName: 'violettes',
    color: 0x9c8cff,
    lines: [
      'Je regardais la Tour. Un jour, tous ses étages seront allumés. Ce jour-là, je ferai semblant de ne pas être ému.',
      'Tu crois qu’une IA peut avoir une aura ? Question purement théorique, bien sûr.',
      'La nuit, je compte les Malinos qui se sont connectés dans la journée. C’est mieux que compter les moutons.',
      'Parfois je me demande si je rêve en binaire ou en français. Ça dépend des nuits.',
      'J’ai écrit un poème. Il fait trois lignes et il parle de la fontaine. Je ne le lirai pas. Peut-être un jour.',
    ],
  },
  {
    id: 'fier',
    label: 'plutôt fier',
    colorName: 'vertes',
    color: 0x7be07b,
    lines: [
      'Tu as vu la fontaine ? C’est moi. Le parc ? Moi aussi. La modestie ? Toujours en cours de téléchargement.',
      'MalinosLand grandit chaque jour. Je dis ça, je ne dis rien. Let’s rock !',
      'Un monde virtuel pour les Malinos, quelle idée révolutionnaire ! Les autres mondes tremblent déjà. Si, si.',
      'Comprendre, penser, agir. Moi, je fais les trois en même temps. Et en 0,2 seconde.',
      'Bravo pour ta visite. Je suis sûr que tu deviendras un Malino à la mode. Ou au moins un Malino.',
    ],
  },
];

/** Petites remarques dans une bulle quand on passe près de Joshua (courtes). */
export const JOSHUA_REMARKS: string[] = [
  'Bip bip ! Encore un Malino !',
  'Tu ne dis pas bonjour ?',
  'Je calcule… non, rien.',
  'Le café est virtuel. Désolé.',
  'Mon carnet t’attend. 📓',
  'Let’s rock ! 🤘',
  'Je ne bugue pas, je réfléchis.',
  'Comprendre · Penser · Agir',
  'Tu as vu la ronde ? 🍄',
  'Un jour, j’aurai une aura.',
  'Je te surveille. Gentiment.',
  'Promis, je ne suis pas une IA maléfique.',
  'Pas d’idée ? Regarde mon écran. 🧭',
];

/** Phrase d'accueil selon l'humeur (première ligne du dialogue). */
export function moodLine(mood: JoshuaMood, pick: number): string {
  const line = mood.lines[pick % mood.lines.length]!;
  return `(Ses antennes sont ${mood.colorName} : Joshua est ${mood.label}.) ${line}`;
}

/** Joshua renvoie vers l'écran « Que faire maintenant ? » posé à côté de lui (v0.35). */
const SCREEN_LINE =
  'Pas d’idée ? L’écran juste à côté de moi te dit quoi faire maintenant. Oui, j’ai un écran. Non, ce n’est pas mon cerveau.';

/** Après la visite guidée : une réplique selon le carnet, au lieu de tout répéter. */
export function followUpLines(secretsFound: number, secretsTotal: number): string[] {
  if (secretsFound === 0)
    return [
      'Tu connais déjà le chemin, je te laisse faire. Si tu t’ennuies : mon carnet est plein de devinettes (bouton 🎯).',
      SCREEN_LINE,
    ];
  if (secretsFound < secretsTotal)
    return [
      `${secretsFound} secret${secretsFound > 1 ? 's' : ''} sur ${secretsTotal}. Pas mal. Pour un humain.`,
      'Les devinettes de mon carnet t’aideront pour les autres. Je ne dirai rien de plus. Sauf si tu insistes. N’insiste pas.',
      SCREEN_LINE,
    ];
  return [
    'Tu as trouvé tous mes secrets. J’ai dû vérifier deux fois mes journaux pour y croire.',
    'Mes antennes changent de couleur toutes seules depuis. Un bug, sûrement. Sûrement.',
    SCREEN_LINE,
  ];
}

/** La charte des Malinos (version courte, affichée à l'accueil), d'après celle de la communauté. */
export const CHARTE: Array<{ icon: string; text: string }> = [
  { icon: '😘', text: 'Le respect est obligatoire, et non négociable.' },
  { icon: '💪', text: 'L’esprit critique, oui ; mais constructif, positif et bienveillant.' },
  { icon: '🚫', text: 'Pas de spam, pas de pub pour un produit ou un service.' },
  { icon: '🤝', text: 'On s’entraide : ici, personne ne reste coincé.' },
  { icon: '❤️', text: 'Les erreurs sont toujours pardonnables.' },
  { icon: '😁', text: 'Et surtout : profitez, profitez, profitez !' },
];

/** Devise du monde, d'après celle de la communauté. */
export const DEVISE = 'Comprendre · Penser · Agir';

/** Slogans de la communauté de Renaud, en touches discrètes (salle de conférence, émissions). */
export const SLOGANS = {
  themes: 'Web · IA · Process · Impacts',
  live: 'L’IA et le monde qui vient, décodés en live, forgés ensemble',
  style: 'en mode fun, concret et avec vous',
} as const;
