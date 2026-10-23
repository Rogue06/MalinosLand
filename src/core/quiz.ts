/**
 * Quiz IA des Malinos (v0.35, DEC-030) : tirage des questions, défi de la semaine et score.
 * Logique pure, sans réseau : le défi est le même pour tous parce qu'il est calculé à partir du
 * numéro de la semaine, pas parce qu'un serveur l'a choisi.
 */

/** Nombre de questions par partie. */
export const ROUND_SIZE = 5;

/** Générateur pseudo-aléatoire reproductible (mulberry32) : même graine, même suite. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface IsoWeek {
  year: number;
  week: number;
  /** Ex. « 2026-W43 ». */
  key: string;
  /** Numéro de semaine continu (semaines écoulées depuis le lundi 5 janvier 1970). */
  index: number;
}

/** Semaine ISO (elle commence le lundi) de la date, en heure locale. */
export function isoWeek(date: Date): IsoWeek {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  const monday = d.getTime() - (day - 1) * 86_400_000;
  d.setUTCDate(d.getUTCDate() + 4 - day); // le jeudi de la semaine donne l'année ISO
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  const index = Math.round((monday - Date.UTC(1970, 0, 5)) / (7 * 86_400_000));
  return { year, week, key: `${year}-W${String(week).padStart(2, '0')}`, index };
}

interface Leveled {
  id: string;
  level: number;
}

/** Les questions d'une partie, de la plus facile à la plus difficile. */
function pick<T extends Leveled>(questions: readonly T[], rnd: () => number): T[] {
  return shuffle(questions, rnd)
    .slice(0, ROUND_SIZE)
    .sort((a, b) => a.level - b.level);
}

/**
 * Défi de la semaine : les mêmes questions pour tout le monde du lundi au dimanche. Les
 * questions tournent **sans répétition** : avec N questions, N/5 semaines de suite sans revoir
 * une seule question (12 semaines pour 60), puis un nouveau cycle dans un autre ordre. Rien
 * n'est stocké ni demandé à un serveur.
 */
export function weeklyChallenge<T extends Leveled>(
  questions: readonly T[],
  week: { index: number },
): T[] {
  const perCycle = Math.max(1, Math.floor(questions.length / ROUND_SIZE));
  const cycle = Math.floor(week.index / perCycle);
  const slot = week.index - cycle * perCycle;
  // Ordre de base stable (par identifiant), mélangé différemment à chaque cycle.
  const base = [...questions].sort((a, b) => (a.id < b.id ? -1 : 1));
  const order = shuffle(base, seededRandom(cycle * 7919 + 17));
  return order
    .slice(slot * ROUND_SIZE, slot * ROUND_SIZE + ROUND_SIZE)
    .sort((a, b) => a.level - b.level);
}

/** Partie libre : au hasard, en évitant si possible les questions vues à la partie d'avant. */
export function freeRound<T extends Leveled>(
  questions: readonly T[],
  rnd: () => number,
  avoid: readonly string[] = [],
): T[] {
  const fresh = questions.filter((q) => !avoid.includes(q.id));
  return pick(fresh.length >= ROUND_SIZE ? fresh : questions, rnd);
}

/** Ordre d'affichage des 4 choix (mélangé pour qu'on ne retienne pas une position). */
export function choiceOrder(rnd: () => number): number[] {
  return shuffle([0, 1, 2, 3], rnd);
}

/** Petit mot de fin selon le score (sur ROUND_SIZE). */
export function verdict(score: number): string {
  if (score >= ROUND_SIZE) return 'Parfait ! Joshua fait semblant de ne pas être impressionné.';
  if (score >= ROUND_SIZE - 1) return 'Excellent ! Une seule erreur : Joshua prend des notes.';
  if (score >= 3) return 'Bien joué ! Tu en sais déjà beaucoup.';
  return 'Les erreurs sont toujours pardonnables (c’est dans la charte). Les explications sont là pour ça !';
}
