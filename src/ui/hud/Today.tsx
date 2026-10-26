import { useEffect, useState } from 'preact/hooks';
import { accountStore } from '../../services/account';
import { chooseIntent, intentStore, markCardShown } from '../../services/intent';
import { myProjects } from '../../services/museum';
import { profileStore } from '../../services/profile';
import { decorEditorStore, panelStore } from '../../state';
import { dayNumber, recapActivities } from '../../world/activities';
import { useStore } from '../hooks';
import { ActivityItem, IntentChoice, useActivityContext } from '../panels/Activities';

/**
 * Carte d'arrivée et de retour (PR 12, DEC-042), jamais bloquante : on peut jouer pendant
 * qu'elle est affichée.
 * - Première visite : « Qu'est-ce qui te ferait plaisir ? » et les trois envies, ou « Passer ».
 * - Retour (au plus une fois par jour) : « Reprends ici », 3 suites au plus ; rien s'il n'y a
 *   rien à reprendre.
 */
export function TodayCard() {
  const state = useStore(intentStore);
  const editing = useStore(decorEditorStore).active;
  const today = dayNumber(new Date());
  // Décidé à l'arrivée seulement : la carte reste jusqu'à ce qu'on la ferme ou qu'on agisse.
  const [mode, setMode] = useState<'welcome' | 'recap' | null>(() =>
    !state.answered ? 'welcome' : state.shownDay !== today ? 'recap' : null,
  );
  if (!mode || editing) return null;
  return mode === 'welcome' ? (
    <WelcomeCard today={today} onDone={() => setMode(null)} />
  ) : (
    <RecapCard today={today} onDone={() => setMode(null)} />
  );
}

function WelcomeCard({ today, onDone }: { today: number; onDone: () => void }) {
  useEffect(() => markCardShown(today), [today]);
  return (
    <section class="today-card panel-glass" aria-label="Bienvenue">
      <header class="today-head">
        <strong>Bienvenue ! Qu’est-ce qui te ferait plaisir ?</strong>
      </header>
      <IntentChoice
        current={null}
        onChoose={() => {
          onDone();
          panelStore.set('activities');
        }}
      />
      <button
        type="button"
        class="btn ghost small today-skip"
        onClick={() => {
          chooseIntent(null);
          onDone();
        }}
      >
        Passer, je vais me promener
      </button>
    </section>
  );
}

function RecapCard({ today, onDone }: { today: number; onDone: () => void }) {
  const ctx = useActivityContext();
  const account = useStore(accountStore);
  const profile = useStore(profileStore);
  const signedIn = account.status === 'signed-in';
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    // Une seule lecture, et seulement au retour : mes projets encore en attente.
    void myProjects()
      .then((list) => {
        if (alive) setPending(list.filter((p) => p.status === 'pending').map((p) => p.title));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [signedIn]);

  const list = recapActivities({ ...ctx, pendingProjects: pending, myName: profile?.name });
  const visible = list.length > 0;
  useEffect(() => {
    if (visible) markCardShown(today);
  }, [visible, today]);
  if (list.length === 0) return null;
  return (
    <section class="today-card panel-glass" aria-label="Reprends ici">
      <header class="today-head">
        <strong>Reprends ici</strong>
        <button type="button" class="icon-btn tiny" onClick={onDone} aria-label="Fermer">
          ✕
        </button>
      </header>
      {/* Une suite choisie : la carte a servi, elle disparaît. */}
      <ul
        class="activities"
        onClick={(e) => (e.target as HTMLElement).closest('button') && onDone()}
      >
        {list.map((a) => (
          <ActivityItem key={a.id} a={a} compact />
        ))}
      </ul>
    </section>
  );
}
