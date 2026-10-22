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
    ],
  },
];

/** Phrase d'accueil selon l'humeur (première ligne du dialogue). */
export function moodLine(mood: JoshuaMood, pick: number): string {
  const line = mood.lines[pick % mood.lines.length]!;
  return `(Ses antennes sont ${mood.colorName} : Joshua est ${mood.label}.) ${line}`;
}

/** Après la visite guidée : une réplique selon le carnet, au lieu de tout répéter. */
export function followUpLines(secretsFound: number, secretsTotal: number): string[] {
  if (secretsFound === 0)
    return [
      'Tu connais déjà le chemin, je te laisse faire. Si tu t’ennuies : mon carnet est plein de devinettes (bouton 🎯).',
    ];
  if (secretsFound < secretsTotal)
    return [
      `${secretsFound} secret${secretsFound > 1 ? 's' : ''} sur ${secretsTotal}. Pas mal. Pour un humain.`,
      'Les devinettes de mon carnet t’aideront pour les autres. Je ne dirai rien de plus. Sauf si tu insistes. N’insiste pas.',
    ];
  return [
    'Tu as trouvé tous mes secrets. J’ai dû vérifier deux fois mes journaux pour y croire.',
    'Mes antennes changent de couleur toutes seules depuis. Un bug, sûrement. Sûrement.',
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
