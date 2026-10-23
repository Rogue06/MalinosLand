import { describe, expect, it } from 'vitest';
import { QUIZ_QUESTIONS, QUIZ_THEMES } from '../src/content/quiz';
import {
  ROUND_SIZE,
  choiceOrder,
  freeRound,
  isoWeek,
  seededRandom,
  verdict,
  weeklyChallenge,
} from '../src/core/quiz';
import { EMPTY_QUIZ_STATS, parseQuizStats, recordQuizRound } from '../src/services/quizStats';
import quizStatsSource from '../src/services/quizStats.ts?raw';
import quizPanelSource from '../src/ui/panels/Quiz.tsx?raw';

describe('Quiz IA : les questions', () => {
  it('au moins 30 questions bien formées', () => {
    expect(QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(30);
    const ids = new Set<string>();
    for (const q of QUIZ_QUESTIONS) {
      expect(ids.has(q.id), `identifiant en double : ${q.id}`).toBe(false);
      ids.add(q.id);
      expect(q.choices, q.id).toHaveLength(4);
      expect(new Set(q.choices.map((c) => c.toLowerCase())).size, `choix en double : ${q.id}`).toBe(
        4,
      );
      for (const c of q.choices) expect(c.trim().length, q.id).toBeGreaterThan(0);
      expect([0, 1, 2, 3]).toContain(q.answer);
      expect([1, 2, 3]).toContain(q.level);
      expect(q.question.length, q.id).toBeGreaterThan(10);
      expect(q.explain.length, `explication trop courte : ${q.id}`).toBeGreaterThan(30);
      expect(Object.keys(QUIZ_THEMES)).toContain(q.theme);
    }
    // Chaque thème est représenté.
    for (const theme of Object.keys(QUIZ_THEMES))
      expect(
        QUIZ_QUESTIONS.some((q) => q.theme === theme),
        theme,
      ).toBe(true);
  });
});

describe('Quiz IA : on ne devine pas la réponse à sa longueur', () => {
  it('la bonne réponse n’est presque jamais nettement la plus longue', () => {
    const giveaway = QUIZ_QUESTIONS.filter((q) => {
      const lengths = q.choices.map((c) => c.length);
      const others = lengths.filter((_, i) => i !== q.answer);
      return lengths[q.answer]! > Math.max(...others) + 5;
    });
    expect(giveaway.map((q) => q.id)).toEqual([]);
  });
});

describe('Quiz IA : le moteur', () => {
  it('semaine ISO : du lundi au dimanche, et la 53e semaine de 2026', () => {
    const lundi = isoWeek(new Date(2026, 9, 19));
    expect(isoWeek(new Date(2026, 9, 25, 23, 59))).toEqual(lundi);
    expect(isoWeek(new Date(2026, 9, 26)).week).toBe(lundi.week + 1);
    expect(lundi.key).toMatch(/^2026-W\d{2}$/);
    expect(isoWeek(new Date(2027, 0, 1)).key).toBe('2026-W53');
    expect(isoWeek(new Date(2027, 0, 4)).key).toBe('2027-W01');
  });

  it('défi de la semaine : le même pour tous toute la semaine, différent la suivante', () => {
    const w43 = weeklyChallenge(QUIZ_QUESTIONS, { year: 2026, week: 43 });
    const again = weeklyChallenge(QUIZ_QUESTIONS, { year: 2026, week: 43 });
    const w44 = weeklyChallenge(QUIZ_QUESTIONS, { year: 2026, week: 44 });
    expect(w43).toHaveLength(ROUND_SIZE);
    expect(again.map((q) => q.id)).toEqual(w43.map((q) => q.id));
    expect(w44.map((q) => q.id)).not.toEqual(w43.map((q) => q.id));
    // Du plus facile au plus difficile.
    const levels = w43.map((q) => q.level);
    expect([...levels].sort()).toEqual(levels);
  });

  it('partie libre : 5 questions différentes, sans reposer celles de la partie d’avant', () => {
    const rnd = seededRandom(7);
    const first = freeRound(QUIZ_QUESTIONS, rnd);
    expect(new Set(first.map((q) => q.id)).size).toBe(ROUND_SIZE);
    const next = freeRound(
      QUIZ_QUESTIONS,
      rnd,
      first.map((q) => q.id),
    );
    expect(next.some((q) => first.some((f) => f.id === q.id))).toBe(false);
  });

  it('ordre des choix : toujours une permutation des 4 réponses', () => {
    const rnd = seededRandom(1);
    for (let i = 0; i < 20; i++) expect([...choiceOrder(rnd)].sort()).toEqual([0, 1, 2, 3]);
  });

  it('un mot de fin pour chaque score', () => {
    for (let s = 0; s <= ROUND_SIZE; s++) expect(verdict(s).length).toBeGreaterThan(10);
  });
});

describe('Quiz IA : scores dans le navigateur uniquement', () => {
  it('enregistre parties, meilleur score et défis, et ignore les données abîmées', () => {
    let s = recordQuizRound(EMPTY_QUIZ_STATS, 3, ['a', 'b'], null);
    s = recordQuizRound(s, 4, ['c'], '2026-W43');
    s = recordQuizRound(s, 2, ['d'], '2026-W43');
    expect(s).toEqual({ played: 3, best: 3, weekly: { '2026-W43': 4 }, last: ['d'] });
    expect(parseQuizStats({ played: -1, best: 99, weekly: { truc: 3, '2026-W40': 9 } })).toEqual({
      played: 0,
      best: 5,
      weekly: { '2026-W40': 5 },
      last: [],
    });
    expect(parseQuizStats(null)).toEqual(EMPTY_QUIZ_STATS);
  });

  it('garde seulement les 8 dernières semaines', () => {
    const weekly = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`2026-W${String(i + 30).padStart(2, '0')}`, 3]),
    );
    expect(Object.keys(parseQuizStats({ weekly }).weekly)).toEqual(
      Array.from({ length: 8 }, (_, i) => `2026-W${i + 34}`),
    );
  });

  it('aucun appel à Supabase ni au réseau (décision v0.35)', () => {
    for (const src of [quizStatsSource, quizPanelSource]) {
      expect(src).not.toMatch(/supabase|services\/account|fetch\(|\.rpc\(/i);
    }
  });
});
