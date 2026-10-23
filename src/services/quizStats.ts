import { Store } from '../core/store';
import { storage } from './storage';

/**
 * Scores du Quiz IA, gardés **uniquement dans le navigateur** (décision du responsable pour la
 * v0.35) : aucune lecture ni écriture dans la base, aucun classement. Le format reste simple
 * pour permettre plus tard une synchronisation ou un tableau amical, sans le développer ici.
 */
export interface QuizStats {
  /** Parties terminées. */
  played: number;
  /** Meilleur score en partie libre. */
  best: number;
  /** Meilleur score au défi, par semaine (« 2026-W43 »), pour les dernières semaines. */
  weekly: Record<string, number>;
  /** Questions de la dernière partie (pour ne pas les reposer tout de suite). */
  last: string[];
}

const KEY = 'quiz';
const VERSION = 1;
const MAX_WEEKS = 8;
const WEEK_RE = /^\d{4}-W\d{2}$/;

export const EMPTY_QUIZ_STATS: QuizStats = { played: 0, best: 0, weekly: {}, last: [] };

const count = (v: unknown, max: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0;

export function parseQuizStats(raw: unknown): QuizStats {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const weekly: Record<string, number> = {};
  if (typeof r.weekly === 'object' && r.weekly !== null) {
    const valid = Object.entries(r.weekly as Record<string, unknown>)
      .filter(([k]) => WEEK_RE.test(k))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-MAX_WEEKS);
    for (const [k, v] of valid) weekly[k] = count(v, 5);
  }
  const last = Array.isArray(r.last)
    ? r.last.filter((id): id is string => typeof id === 'string' && id.length <= 40).slice(0, 5)
    : [];
  return { played: count(r.played, 1_000_000), best: count(r.best, 5), weekly, last };
}

export const quizStatsStore = new Store<QuizStats>(
  storage.read(KEY, VERSION, parseQuizStats) ?? EMPTY_QUIZ_STATS,
);
quizStatsStore.subscribe((s) => storage.write(KEY, VERSION, s));

/** Enregistre une partie terminée (score sur 5, et la semaine si c'était le défi). */
export function recordQuizRound(
  stats: QuizStats,
  score: number,
  questionIds: string[],
  weekKey: string | null,
): QuizStats {
  const weekly = { ...stats.weekly };
  if (weekKey) weekly[weekKey] = Math.max(weekly[weekKey] ?? 0, score);
  return parseQuizStats({
    played: stats.played + 1,
    best: weekKey ? stats.best : Math.max(stats.best, score),
    weekly,
    last: questionIds,
  });
}
