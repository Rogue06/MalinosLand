import { DIRT, LOG, PLANKS, STONE, WOOD_PICK, WORKBENCH } from './blocks';

/**
 * Tutoriel du « Chantier des mondes » (logique pure et testée) : quelques étapes guidées au
 * début de la survie douce, validées par ce que fait vraiment le joueur. On peut le passer, et le
 * revoir depuis le menu. Rien n'est obligatoire.
 */
export interface TutorialState {
  /** Total des mouvements de regard (radians) et distance parcourue (cubes). */
  looked: number;
  walked: number;
  count(item: number): number;
  /** Un cube de ce type a été posé par le joueur. */
  placed(block: number): boolean;
}

export interface TutorialStep {
  id: string;
  title: string;
  /** Consigne au clavier et à la souris, puis au doigt. */
  text: string;
  touch: string;
  done(s: TutorialState): boolean;
}

export const TUTORIAL: readonly TutorialStep[] = [
  {
    id: 'regarder',
    title: 'Regarde autour de toi',
    text: 'Clique dans le monde, puis bouge la souris. (Échap met en pause et ouvre le menu.)',
    touch: 'Fais glisser ton doigt sur l’écran pour regarder autour de toi.',
    done: (s) => s.looked > 1.2,
  },
  {
    id: 'marcher',
    title: 'Marche jusqu’à un arbre',
    text: 'Z Q S D (ou W A S D, ou les flèches) pour marcher. Pour monter sur un cube, saute avec Espace. (Touches réglables dans le menu.)',
    touch: 'La manette à gauche pour marcher. Pour monter sur un cube, saute avec ⤒.',
    done: (s) => s.walked > 5,
  },
  {
    id: 'couper',
    title: 'Coupe un tronc',
    text: 'Vise le tronc et garde le clic gauche appuyé jusqu’à ce qu’il casse.',
    touch: 'Vise le tronc avec le centre de l’écran et garde ⛏ appuyé.',
    done: (s) => s.count(LOG) > 0,
  },
  {
    id: 'planches',
    title: 'Fabrique des planches',
    text: 'Ouvre ton sac avec E, puis « Fabriquer » à côté de Planches.',
    touch: 'Ouvre 🎒 Sac, puis « Fabriquer » à côté de Planches.',
    done: (s) => s.count(PLANKS) > 0 || s.placed(PLANKS),
  },
  {
    id: 'etabli',
    title: 'Fabrique un établi et pose-le',
    text: 'Dans le sac : Établi (4 planches). Choisis-le dans ta barre (1 à 9), puis clic droit sur le sol.',
    touch: 'Dans le sac : Établi. Touche sa case dans la barre, vise le sol et appuie sur 🧱.',
    done: (s) => s.placed(WORKBENCH),
  },
  {
    id: 'pioche',
    title: 'Fabrique une pioche en bois',
    text: 'Fais un clic droit sur ton établi : la pioche se fabrique à côté de lui (planches + bâtons).',
    touch: 'Vise ton établi et appuie sur 🧱 : la pioche se fabrique à côté de lui.',
    done: (s) => s.count(WOOD_PICK) > 0,
  },
  {
    id: 'pierre',
    title: 'Creuse de la pierre',
    text: 'Choisis ta pioche dans la barre et creuse : sous la terre, il y a de la pierre.',
    touch: 'Touche la case de ta pioche, puis creuse : sous la terre, il y a de la pierre.',
    done: (s) => s.count(STONE) > 0,
  },
  {
    id: 'poser',
    title: 'Construis quelque chose',
    text: 'Choisis un cube récolté (terre, pierre, planches…) et pose-le d’un clic droit, où tu veux.',
    touch: 'Touche la case d’un cube récolté, vise un endroit et appuie sur 🧱.',
    done: (s) => s.placed(STONE) || s.placed(PLANKS) || s.placed(DIRT) || s.placed(LOG),
  },
];

/** Première étape pas encore faite, à partir de `from` (null : tutoriel terminé). */
export function currentStep(state: TutorialState, from = 0): number | null {
  for (let i = Math.max(0, from); i < TUTORIAL.length; i++) if (!TUTORIAL[i]!.done(state)) return i;
  return null;
}

/**
 * Suivi de l'étape affichée : signale un changement **une seule fois** (son de réussite, carte
 * redessinée). Tutoriel fini : l'étape vaut TUTORIAL.length, et ne « change » plus ensuite.
 */
export class TutorialTracker {
  /** Étape affichée (-1 : rien encore ; TUTORIAL.length : terminé). */
  shown = -1;

  constructor(public reached = 0) {}

  /** Étape actuelle, et si elle vient de changer (`progressed` : une étape a été réussie). */
  update(state: TutorialState): { step: number | null; changed: boolean; progressed: boolean } {
    const step = currentStep(state, this.reached);
    const key = step ?? TUTORIAL.length;
    if (key === this.shown) return { step, changed: false, progressed: false };
    const progressed = this.shown >= 0 && key > this.shown;
    this.shown = key;
    this.reached = key;
    return { step, changed: true, progressed };
  }
}
