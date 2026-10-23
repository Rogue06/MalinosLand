import { useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { QUIZ_QUESTIONS, QUIZ_THEMES, type QuizQuestion } from '../../content/quiz';
import {
  ROUND_SIZE,
  choiceOrder,
  freeRound,
  isoWeek,
  verdict,
  weeklyChallenge,
} from '../../core/quiz';
import { quizStatsStore, recordQuizRound } from '../../services/quizStats';
import { settingsStore } from '../../services/settings';
import { useStore } from '../hooks';
import { Modal } from './Modal';

/** Une partie en cours : les questions, l'ordre d'affichage des choix et les réponses données. */
interface Round {
  weekly: boolean;
  questions: QuizQuestion[];
  orders: number[][];
  answers: number[];
}

function newRound(weekly: boolean, avoid: string[]): Round {
  const questions = weekly
    ? weeklyChallenge(QUIZ_QUESTIONS, isoWeek(new Date()))
    : freeRound(QUIZ_QUESTIONS, Math.random, avoid);
  return { weekly, questions, orders: questions.map(() => choiceOrder(Math.random)), answers: [] };
}

const LETTERS = ['1', '2', '3', '4'];

/**
 * Quiz IA des Malinos (v0.35) : 5 questions, une explication après chaque réponse, partie libre
 * ou défi de la semaine. Tout se passe dans le navigateur (scores compris).
 */
export function QuizPanel() {
  const stats = useStore(quizStatsStore);
  const still = useStore(settingsStore).reducedMotion;
  const week = useMemo(() => isoWeek(new Date()), []);
  const [round, setRound] = useState<Round | null>(null);
  const [index, setIndex] = useState(0);
  const [showEnd, setShowEnd] = useState(false);
  const weeklyScore = stats.weekly[week.key];

  const q = round?.questions[index];
  const answered = round ? round.answers.length > index : false;
  const score = round ? round.answers.filter((a, i) => a === round.questions[i]!.answer).length : 0;

  const start = (weekly: boolean) => {
    setShowEnd(false);
    setIndex(0);
    setRound(newRound(weekly, stats.last));
  };

  const answer = (choice: number) => {
    if (!round || answered || showEnd) return;
    setRound({ ...round, answers: [...round.answers, choice] });
  };

  const next = () => {
    if (!round || !answered) return;
    if (index >= ROUND_SIZE - 1) {
      quizStatsStore.set(
        recordQuizRound(
          quizStatsStore.get(),
          score,
          round.questions.map((x) => x.id),
          round.weekly ? week.key : null,
        ),
      );
      setShowEnd(true);
      return;
    }
    setIndex(index + 1);
  };

  // Clavier : 1 à 4 pour répondre, Entrée pour continuer. useLayoutEffect : l'écoute suit
  // l'affichage sans attendre l'image suivante (sur une machine lente, une touche pressée juste
  // après l'apparition d'une question était sinon perdue, comme pour Modal).
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!round || showEnd || e.repeat) return;
      const n = LETTERS.indexOf(e.key);
      if (n >= 0 && !answered && q) {
        e.preventDefault();
        answer(round.orders[index]![n]!);
      } else if (e.key === 'Enter' && answered) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Modal title="Quiz IA des Malinos" icon="🕹️">
      <div class={`quiz${still ? ' still' : ''}`}>
        {!round && <QuizMenu onStart={start} weeklyScore={weeklyScore} best={stats.best} />}
        {round && !showEnd && q && (
          <QuestionView
            q={q}
            number={index + 1}
            order={round.orders[index]!}
            chosen={answered ? round.answers[index]! : null}
            onAnswer={answer}
            onNext={next}
            last={index === ROUND_SIZE - 1}
            weekly={round.weekly}
          />
        )}
        {round && showEnd && (
          <div class="quiz-end" role="status">
            <p class="quiz-score">
              {score}/{ROUND_SIZE}
            </p>
            <p>{verdict(score)}</p>
            <p class="muted small">
              {round.weekly
                ? `Défi de la semaine : ton meilleur score est ${Math.max(weeklyScore ?? 0, score)}/${ROUND_SIZE}. Nouveau défi lundi.`
                : `Meilleur score en partie libre : ${Math.max(stats.best, score)}/${ROUND_SIZE}.`}{' '}
              Tes scores restent dans ce navigateur.
            </p>
            <div class="row end">
              <button type="button" class="btn ghost" onClick={() => setRound(null)}>
                Menu du quiz
              </button>
              <button type="button" class="btn primary" onClick={() => start(false)}>
                Nouvelle partie
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function QuizMenu({
  onStart,
  weeklyScore,
  best,
}: {
  onStart: (weekly: boolean) => void;
  weeklyScore: number | undefined;
  best: number;
}) {
  return (
    <div class="quiz-menu">
      <p class="lead">
        5 questions sur l’IA et le numérique, avec une explication après chaque réponse. Juste ou
        faux, tu apprends quelque chose.
      </p>
      <button type="button" class="quiz-mode" onClick={() => onStart(true)}>
        <strong>🏆 Défi de la semaine</strong>
        <span>
          Les mêmes questions pour tous les Malinos jusqu’à dimanche.
          {weeklyScore !== undefined
            ? ` Ton score : ${weeklyScore}/${ROUND_SIZE}.`
            : ' Pas encore joué.'}
        </span>
      </button>
      <button type="button" class="quiz-mode" onClick={() => onStart(false)}>
        <strong>🎲 Partie libre</strong>
        <span>
          Des questions au hasard.{best > 0 ? ` Meilleur score : ${best}/${ROUND_SIZE}.` : ''}
        </span>
      </button>
      <p class="muted small">Au clavier : touches 1 à 4 pour répondre, Entrée pour continuer.</p>
    </div>
  );
}

function QuestionView({
  q,
  number,
  order,
  chosen,
  onAnswer,
  onNext,
  last,
  weekly,
}: {
  q: QuizQuestion;
  number: number;
  order: number[];
  chosen: number | null;
  onAnswer: (choice: number) => void;
  onNext: () => void;
  last: boolean;
  weekly: boolean;
}) {
  const done = chosen !== null;
  const right = chosen === q.answer;
  return (
    <div class="quiz-question">
      <p class="quiz-progress">
        <span>
          {weekly ? '🏆 Défi de la semaine' : '🎲 Partie libre'} · {QUIZ_THEMES[q.theme]}
        </span>
        <span>
          Question {number}/{ROUND_SIZE}
        </span>
      </p>
      <h3 id="quiz-q">{q.question}</h3>
      <div class="quiz-choices" role="group" aria-labelledby="quiz-q">
        {order.map((c, i) => {
          const state = !done ? '' : c === q.answer ? ' right' : c === chosen ? ' wrong' : ' dim';
          return (
            <button
              type="button"
              key={c}
              class={`quiz-choice${state}`}
              disabled={done}
              onClick={() => onAnswer(c)}
            >
              <span class="quiz-key" aria-hidden="true">
                {i + 1}
              </span>
              {q.choices[c]}
            </button>
          );
        })}
      </div>
      <div class="quiz-feedback" aria-live="polite">
        {done && (
          <>
            <p class={`quiz-verdict ${right ? 'right' : 'wrong'}`}>
              {right ? '✅ Bonne réponse !' : `❌ La bonne réponse : ${q.choices[q.answer]}`}
            </p>
            <p>{q.explain}</p>
            {q.source && <p class="muted small">Source : {q.source}</p>}
          </>
        )}
      </div>
      {done && (
        <div class="row end">
          <button type="button" class="btn primary" onClick={onNext} autoFocus>
            {last ? 'Voir mon score' : 'Question suivante →'}
          </button>
        </div>
      )}
    </div>
  );
}
