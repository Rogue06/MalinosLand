import { useEffect, useState } from 'preact/hooks';
import { accountPlayerId, homeRoom } from '../../multiplayer/protocol';
import { accountStore } from '../../services/account';
import { visitableHomes, type HomeEntry } from '../../services/homes';
import { loadMuseumWall, museumWallStore, type MuseumProject } from '../../services/museum';
import { progressStore, secretsStore } from '../../services/progress';
import { quizStatsStore } from '../../services/quizStats';
import { isoWeek } from '../../core/quiz';
import { commands, crowdStore, panelStore, skyStore } from '../../state';
import { dayNumber, suggestActivities, type Activity } from '../../world/activities';
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

function run(a: Activity): void {
  const action = a.action;
  panelStore.set(null);
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
  }
}

/**
 * Panneau « Que faire maintenant ? » (v0.35) : quelques idées du moment, calculées dans le
 * navigateur (voir src/world/activities.ts), chacune avec un bouton pour y aller.
 */
export function ActivitiesPanel() {
  const quests = useStore(progressStore);
  const secrets = useStore(secretsStore);
  const crowd = useStore(crowdStore);
  const sky = useStore(skyStore);
  const account = useStore(accountStore);
  const quizStats = useStore(quizStatsStore);
  const wall = useStore(museumWallStore);
  const [homes, setHomes] = useState<HomeEntry[] | null>(homesCache?.homes ?? null);

  useEffect(() => {
    // Liste des stands : déjà lue en passant au musée, sinon une lecture (gardée 5 minutes).
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
  const list = suggestActivities({
    questsDone: quests,
    secretsFound: secrets,
    crowd,
    phase: sky?.phase ?? null,
    openHomes: homes ? homes.filter((h) => h.room !== myRoom) : null,
    signedIn,
    quizWeeklyDone: isoWeek(new Date()).key in quizStats.weekly,
    day: dayNumber(new Date()),
    museum: wall.status === 'ready' ? museumNews(wall.projects) : null,
  });

  return (
    <Modal title="Que faire maintenant ?" icon="🧭">
      <p class="muted">
        Quelques idées du moment. Elles changent selon ce que tu as déjà fait, l’heure et qui est
        là.
      </p>
      <ul class="activities">
        {list.map((a) => (
          <li key={a.id} class="activity">
            <span class="activity-icon" aria-hidden="true">
              {a.icon}
            </span>
            <div class="activity-text">
              <strong>{a.title}</strong>
              <span>{a.detail}</span>
            </div>
            <button type="button" class="btn primary small" onClick={() => run(a)}>
              {a.cta}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
