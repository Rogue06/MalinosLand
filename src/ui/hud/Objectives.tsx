import { QUESTS } from '../../content/quests';
import { progressStore, resetProgress } from '../../services/progress';
import { useStore } from '../hooks';

export function Objectives({ onClose }: { onClose: () => void }) {
  const done = useStore(progressStore);
  const next = QUESTS.find((q) => !done.includes(q.id));
  const all = done.length === QUESTS.length;
  return (
    <aside class="objectives panel-glass" aria-label="Objectifs">
      <div class="objectives-head">
        <h2>Premiers pas</h2>
        <span class="muted small">
          {done.length}/{QUESTS.length}
        </span>
        <button class="icon-btn tiny" onClick={onClose} aria-label="Masquer les objectifs">
          ✕
        </button>
      </div>
      <div class="progress-bar">
        <div style={{ width: `${(done.length / QUESTS.length) * 100}%` }} />
      </div>
      <ul>
        {QUESTS.map((q) => {
          const ok = done.includes(q.id);
          return (
            <li key={q.id} class={ok ? 'done' : q === next ? 'next' : ''}>
              <span class="check" aria-hidden="true">
                {ok ? '✓' : ''}
              </span>
              <div>
                <span>{q.title}</span>
                {q === next && <small>{q.hint}</small>}
              </div>
            </li>
          );
        })}
      </ul>
      {all && (
        <div class="all-done">
          🎉 Tu es un vrai Malino !{' '}
          <button class="link" onClick={resetProgress}>
            Recommencer
          </button>
        </div>
      )}
    </aside>
  );
}
