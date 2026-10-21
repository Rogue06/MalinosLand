import { useEffect, useState } from 'preact/hooks';
import { ACCOUNTS_ENABLED } from '../../config';
import { FLOORS } from '../../content/floors';
import { HUB_ROOM } from '../../content/rooms';
import { accountPlayerId, accountUuid, homeRoom } from '../../multiplayer/protocol';
import { AccountError, accountStore } from '../../services/account';
import {
  HOME_ACCESS,
  myGuests,
  myHomeAccess,
  removeGuest,
  setMyHomeAccess,
  visitableHomes,
  type Guest,
  type HomeAccess,
  type HomeEntry,
} from '../../services/homes';
import { commands, panelStore, pushToast, roomStore } from '../../state';
import { useStore } from '../hooks';
import { Modal } from './Modal';

function go(room: string, ownerName?: string): void {
  panelStore.set(null);
  commands.emit('travel', { room, ...(ownerName ? { ownerName } : {}) });
}

/** Ascenseur : le Hub, mon logement, les logements à visiter, les étages à venir. */
export function ElevatorPanel() {
  const here = useStore(roomStore);
  const account = useStore(accountStore);
  const myId = account.status === 'signed-in' ? accountPlayerId(account.user.id) : null;
  const [homes, setHomes] = useState<HomeEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ACCOUNTS_ENABLED) return;
    visitableHomes()
      .then(setHomes)
      .catch(() => setError(true));
  }, []);

  const myHomeHint = !ACCOUNTS_ENABLED
    ? 'Disponible dans la version en ligne du jeu.'
    : !myId
      ? 'Connecte-toi avec GitHub ou Google (⚙️ Réglages → Compte) pour avoir ton logement.'
      : 'Ton studio, à toi de choisir qui peut entrer.';

  return (
    <Modal title="Ascenseur" icon="🛗">
      <div class="elevator">
        <button
          type="button"
          class="elevator-floor open"
          disabled={here.room === HUB_ROOM}
          onClick={() => go(HUB_ROOM)}
        >
          <span class="floor-label">RDC — Le Hub</span>
          <span class="floor-desc">Hall, coworking, conférence, salon, jardin.</span>
          {here.room === HUB_ROOM && <span class="badge">vous êtes ici</span>}
        </button>
        <button
          type="button"
          class="elevator-floor open"
          disabled={!myId || here.mine}
          onClick={() => myId && go(homeRoom(myId))}
        >
          <span class="floor-label">🏠 Mon logement</span>
          <span class="floor-desc">{myHomeHint}</span>
          {here.mine && <span class="badge">vous êtes ici</span>}
        </button>
      </div>

      {ACCOUNTS_ENABLED && (
        <>
          <h3 class="elevator-section">Visiter un logement</h3>
          {error ? (
            <p class="muted small">La liste ne se charge pas pour le moment.</p>
          ) : homes === null ? (
            <p class="muted small">Chargement…</p>
          ) : homes.length === 0 ? (
            <p class="muted small">
              Aucun logement ouvert pour l’instant. Les logements « tout le monde » et ceux où tu es
              invité apparaîtront ici.
            </p>
          ) : (
            <div class="elevator">
              {homes.map((h) => (
                <button
                  key={h.room}
                  type="button"
                  class="elevator-floor"
                  disabled={here.room === h.room}
                  onClick={() => go(h.room, h.ownerName)}
                >
                  <span class="floor-label">Chez {h.ownerName}</span>
                  <span class="floor-desc">
                    {h.access === 'public' ? '🚪 Ouvert à tous' : '✉️ Tu es invité'}
                  </span>
                  {here.room === h.room && <span class="badge">vous êtes ici</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <h3 class="elevator-section">Bientôt</h3>
      <div class="elevator">
        {FLOORS.filter((f) => f.status === 'soon').map((f) => (
          <button key={f.id} type="button" class="elevator-floor soon" disabled>
            <span class="floor-label">{f.label}</span>
            <span class="floor-desc">{f.description}</span>
            <span class="badge soon">bientôt · {f.plannedFor}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Table basse du studio : accès et invitations (propriétaire), ou informations (invité). */
export function HomePanel() {
  const here = useStore(roomStore);
  if (!here.mine)
    return (
      <Modal title="Logement" icon="🏠">
        <p>
          Tu es chez <strong>{here.ownerName ?? 'un Malino'}</strong>. Seul le propriétaire choisit
          qui peut entrer.
        </p>
        <p class="muted small">
          🔒 Ce qui s’écrit ici n’est lu que par les personnes présentes dans ce logement.
        </p>
      </Modal>
    );
  return <MyHomeSettings />;
}

function MyHomeSettings() {
  const [access, setAccess] = useState<HomeAccess | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([myHomeAccess(), myGuests()])
      .then(([a, g]) => {
        setAccess(a);
        setGuests(g);
      })
      .catch((e) => setError(e instanceof AccountError ? e.message : 'Chargement impossible.'));
  }, []);

  /** Fait sortir les personnes présentes qui n'ont plus le droit d'être là. */
  const enforce = (a: HomeAccess, g: Guest[]) =>
    commands.emit('home-access', { access: a, guests: g.map((x) => x.id) });

  const choose = async (a: HomeAccess) => {
    if (busy || a === access) return;
    setBusy(true);
    setError(null);
    try {
      await setMyHomeAccess(a);
      setAccess(a);
      enforce(a, guests);
      pushToast(`Accès à ton logement : ${HOME_ACCESS.find((x) => x.id === a)!.label}`, '🏠');
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Modification impossible.');
    }
    setBusy(false);
  };

  const remove = async (g: Guest) => {
    const uuid = accountUuid(g.id);
    if (!uuid || busy) return;
    setBusy(true);
    try {
      await removeGuest(uuid);
      const next = guests.filter((x) => x.id !== g.id);
      setGuests(next);
      if (access) enforce(access, next);
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Modification impossible.');
    }
    setBusy(false);
  };

  return (
    <Modal title="Mon logement" icon="🏠">
      <button
        type="button"
        class="btn primary decor-start"
        onClick={() => {
          panelStore.set(null);
          commands.emit('decor', { action: 'start' });
        }}
      >
        🛋️ Décorer mon logement
      </button>
      <p>Qui peut entrer chez toi ?</p>
      {access === null && !error && <p class="muted small">Chargement…</p>}
      {access !== null && (
        <div class="home-access" role="radiogroup" aria-label="Accès au logement">
          {HOME_ACCESS.map((m) => (
            <button
              key={m.id}
              type="button"
              class="elevator-floor"
              role="radio"
              aria-checked={access === m.id}
              aria-pressed={access === m.id}
              disabled={busy}
              onClick={() => void choose(m.id)}
            >
              <span class="floor-label">{m.label}</span>
              <span class="floor-desc">{m.help}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p class="error small">{error}</p>}
      <h3 class="elevator-section">Mes invités ({guests.length})</h3>
      {guests.length === 0 ? (
        <p class="muted small">
          Personne pour l’instant. Pour inviter quelqu’un : bouton « N Malinos » en haut de l’écran,
          puis « Inviter » à côté d’un joueur connecté à son compte (✓).
        </p>
      ) : (
        <ul class="players">
          {guests.map((g) => (
            <li key={g.id}>
              <div class="player-row">
                <span class="player-name">{g.name}</span>
                <span class="row-actions">
                  <button
                    type="button"
                    class="btn ghost small"
                    disabled={busy}
                    onClick={() => void remove(g)}
                  >
                    Retirer
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p class="muted small">
        Les invitations comptent quand l’accès est « Sur invitation ». Retirer quelqu’un, ou fermer
        ton logement, le raccompagne aussitôt à l’ascenseur s’il est chez toi. 🔒 Ce qui s’écrit ici
        n’est lu que par les personnes présentes.
      </p>
    </Modal>
  );
}
