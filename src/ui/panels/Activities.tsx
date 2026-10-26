import { useEffect, useState } from 'preact/hooks';
import { INTENTS, type Intent } from '../../content/activities';
import { accountPlayerId, homeRoom } from '../../multiplayer/protocol';
import { accountStore } from '../../services/account';
import { visitableHomes, type HomeEntry } from '../../services/homes';
import { chooseIntent, intentStore } from '../../services/intent';
import { loadMuseumWall, museumWallStore, type MuseumProject } from '../../services/museum';
import { progressStore, secretsStore } from '../../services/progress';
import { quizStatsStore } from '../../services/quizStats';
import { isoWeek } from '../../core/quiz';
import { commands, crowdStore, panelStore, projectFocusStore, skyStore } from '../../state';
import {
  dayNumber,
  suggestActivities,
  type Activity,
  type ActivityContext,
} from '../../world/activities';
import { useStore } from '../hooks';
import { Modal } from './Modal';

/** Studios ouverts : lus à l'ouverture du panneau seulement, et gardés 5 minutes. */
const HOMES_TTL_MS = 5 * 60_000;
let homesCache: { at: number; homes: HomeEntry[] } | null = null;

async function openHomes(): Promise<HomeEntry[]> {
  if (homesCache && Date.now() - homesCache.at < HOMES_TTL_MS) return homesCache.homes;
  const homes = await visitableHomes().catch(() => []);
  homesCache = { at: Date.now(), homes };
  return homes;
}

/** Ce que le panneau dit du musée : nombre de projets et le plus récent (liste déjà triée). */
function museumNews(projects: readonly MuseumProject[]) {
  const p = projects[0];
  const at = p ? Date.parse(p.approvedAt) : NaN;
  return {
    count: projects.length,
    latest:
      p && Number.isFinite(at)
        ? { id: p.id, title: p.title, author: p.author, days: (Date.now() - at) / 86_400_000 }
        : null,
  };
}

/**
 * Lance une suggestion. `walk` : on y va à pied (bouton « 🚶 ») au lieu d'ouvrir directement
 * le panneau.
 */
export function runActivity(a: Activity, walk = false): void {
  const action = a.action;
  panelStore.set(null);
  if (walk && a.place) {
    commands.emit('go-to-object', { object: a.place });
    return;
  }
  switch (action.kind) {
    case 'go':
      commands.emit('go-to-object', { object: action.object });
      break;
    case 'panel':
      panelStore.set(action.panel);
      break;
    case 'chat':
      commands.emit('chat-focus', {});
      break;
    case 'visit':
      commands.emit('travel', { room: action.room, ownerName: action.ownerName });
      break;
    case 'project': {
      const project = museumWallStore.get().projects.find((p) => p.id === action.id);
      if (project) {
        projectFocusStore.set(project);
        panelStore.set('project');
      } else panelStore.set('creations');
      break;
    }
  }
}

/**
 * Tout ce que le jeu sait déjà pour proposer des idées (aucune nouvelle donnée envoyée). Les
 * studios ouverts et la liste du musée sont lus une fois, puis gardés 5 minutes.
 */
export function useActivityContext(): ActivityContext {
  const quests = useStore(progressStore);
  const secrets = useStore(secretsStore);
  const crowd = useStore(crowdStore);
  const sky = useStore(skyStore);
  const account = useStore(accountStore);
  const quizStats = useStore(quizStatsStore);
  const wall = useStore(museumWallStore);
  const { intent } = useStore(intentStore);
  const [homes, setHomes] = useState<HomeEntry[] | null>(homesCache?.homes ?? null);

  useEffect(() => {
    void loadMuseumWall();
    let alive = true;
    void openHomes().then((h) => alive && setHomes(h));
    return () => {
      alive = false;
    };
  }, []);

  const signedIn = account.status === 'signed-in';
  const myId = signedIn ? accountPlayerId(account.user.id) : null;
  const myRoom = myId ? homeRoom(myId) : null;
  return {
    questsDone: quests,
    secretsFound: secrets,
    crowd,
    phase: sky?.phase ?? null,
    openHomes: homes ? homes.filter((h) => h.room !== myRoom) : null,
    signedIn,
    quizWeeklyDone: isoWeek(new Date()).key in quizStats.weekly,
    day: dayNumber(new Date()),
    museum: wall.status === 'ready' ? museumNews(wall.projects) : null,
    intent,
  };
}

/** Une idée : bouton direct, et « 🚶 » pour y aller à pied quand il y a un lieu. */
export function ActivityItem({ a, compact }: { a: Activity; compact?: boolean }) {
  return (
    <li class={`activity${compact ? ' compact' : ''}`}>
      <span class="activity-icon" aria-hidden="true">
        {a.icon}
      </span>
      <div class="activity-text">
        <strong>{a.title}</strong>
        {!compact && <span>{a.detail}</span>}
      </div>
      <div class="activity-actions">
        <button type="button" class="btn primary small" onClick={() => runActivity(a)}>
          {a.cta}
        </button>
        {a.place && a.action.kind !== 'go' && (
          <button
            type="button"
            class="btn ghost small walk-btn"
            onClick={() => runActivity(a, true)}
            title="Y aller à pied"
            aria-label={`${a.title} : y aller à pied`}
          >
            🚶
          </button>
        )}
      </div>
    </li>
  );
}

/** Les trois envies (cahier des charges du village, §6), avec l'envie actuelle en évidence. */
export function IntentChoice({
  current,
  onChoose,
}: {
  current: Intent | null;
  onChoose?: (intent: Intent) => void;
}) {
  return (
    <div class="intent-choice" role="group" aria-label="Ton envie du moment">
      {INTENTS.map((i) => (
        <button
          key={i.id}
          type="button"
          class={`intent-btn${current === i.id ? ' active' : ''}`}
          aria-pressed={current === i.id}
          onClick={() => {
            chooseIntent(i.id);
            onChoose?.(i.id);
          }}
        >
          <span class="intent-icon" aria-hidden="true">
            {i.icon}
          </span>
          <span class="intent-label">{i.label}</span>
          <span class="intent-hint">{i.hint}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Panneau « Aujourd'hui » (ex « Que faire maintenant ? ») : l'envie du moment, puis quelques
 * idées calculées dans le navigateur (voir src/world/activities.ts). Chaque idée s'ouvre
 * directement ; « 🚶 » y mène à pied.
 */
export function ActivitiesPanel() {
  const ctx = useActivityContext();
  const list = suggestActivities(ctx);

  return (
    <Modal title="Aujourd’hui" icon="🧭">
      <p class="muted">
        Qu’est-ce qui te ferait plaisir ? Les idées changent selon ton envie, ce que tu as déjà
        fait, l’heure et qui est là.
      </p>
      <IntentChoice current={ctx.intent ?? null} />
      <ul class="activities">
        {list.map((a) => (
          <ActivityItem key={a.id} a={a} />
        ))}
      </ul>
    </Modal>
  );
}
