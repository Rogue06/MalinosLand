import { useEffect, useState } from 'preact/hooks';
import { SUPABASE_KEY, SUPABASE_URL } from '../../config';
import {
  AccountError,
  accountStore,
  listFeedback,
  listReports,
  sendFeedback,
  sendReport,
  setFeedbackStatus,
  setReportStatus,
  type FeedbackKind,
  type FeedbackRow,
  type ReportRow,
} from '../../services/account';
import {
  FEEDBACK_MAX,
  FEEDBACK_MIN,
  GITHUB_NEW_ISSUE,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  buildReport,
  cleanFeedback,
  githubIssueUrl,
  hiddenStore,
  hidePlayer,
  unhidePlayer,
  type ReportReason,
} from '../../services/moderation';
import { profileStore } from '../../services/profile';
import {
  chatStore,
  panelStore,
  presenceStore,
  pushToast,
  zoneStore,
  type PresenceEntry,
} from '../../state';
import { useStore } from '../hooks';
import { Modal } from './Modal';

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.id, r.label]),
);

function ReportForm({ player, onDone }: { player: PresenceEntry; onDone: () => void }) {
  const account = useStore(accountStore);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (account.status !== 'signed-in') {
    return (
      <p class="notice">
        Connecte-toi à ton compte (⚙️ Réglages) pour signaler un joueur. Tu peux déjà le masquer.
      </p>
    );
  }
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendReport(buildReport(player, reason, details, chatStore.get()));
      pushToast(`Signalement envoyé. Merci, l’équipe va regarder.`, '🛡️', 5000);
      onDone();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Envoi impossible.');
      setBusy(false);
    }
  };
  return (
    <div class="report-form">
      <label>
        <span>Motif</span>
        <select
          value={reason}
          onChange={(e) => setReason((e.target as HTMLSelectElement).value as ReportReason)}
        >
          {REPORT_REASONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Précisions (facultatif)</span>
        <textarea
          rows={3}
          maxLength={REPORT_DETAILS_MAX}
          value={details}
          onInput={(e) => setDetails((e.target as HTMLTextAreaElement).value)}
        />
      </label>
      <p class="muted small">
        Ses derniers messages que tu as vus dans le chat seront joints pour aider les modérateurs.
      </p>
      {error && <p class="error small">{error}</p>}
      <div class="row">
        <button type="button" class="btn ghost small" onClick={onDone}>
          Annuler
        </button>
        <button
          type="button"
          class="btn primary small"
          disabled={busy}
          onClick={() => void submit()}
        >
          Envoyer le signalement
        </button>
      </div>
    </div>
  );
}

/** Joueurs connectés : masquer quelqu'un (pour soi) ou le signaler aux modérateurs. */
export function PlayersPanel() {
  const presence = useStore(presenceStore);
  const hidden = useStore(hiddenStore);
  const [reporting, setReporting] = useState<string | null>(null);
  const others = presence.filter((p) => !p.self);
  const offlineHidden = hidden.filter((h) => !others.some((p) => p.id === h.id));

  return (
    <Modal title="Joueurs connectés" icon="👥">
      {others.length === 0 ? (
        <p class="muted">Personne d’autre pour le moment.</p>
      ) : (
        <ul class="players">
          {others.map((p) => {
            const isHidden = hidden.some((h) => h.id === p.id);
            return (
              <li key={p.id}>
                <div class="player-row">
                  <span class="player-name">
                    {p.name}
                    {p.verified && <span title="Connecté à son compte"> ✓</span>}
                    {p.away && <span class="muted"> · absent 💤</span>}
                    {isHidden && <em class="muted"> · masqué</em>}
                  </span>
                  <span class="row-actions">
                    <button
                      type="button"
                      class="btn ghost small"
                      onClick={() => (isHidden ? unhidePlayer(p.id) : hidePlayer(p.id, p.name))}
                    >
                      {isHidden ? 'Afficher' : 'Masquer'}
                    </button>
                    <button
                      type="button"
                      class="btn ghost small"
                      onClick={() => setReporting(reporting === p.id ? null : p.id)}
                    >
                      Signaler
                    </button>
                  </span>
                </div>
                {reporting === p.id && <ReportForm player={p} onDone={() => setReporting(null)} />}
              </li>
            );
          })}
        </ul>
      )}
      <p class="muted small">
        Masquer un joueur cache son avatar, ses messages et ses bulles, pour toi seulement. Pour un
        visiteur sans compte, cela dure jusqu’à sa déconnexion.
      </p>
      {offlineHidden.length > 0 && (
        <>
          <h3>Joueurs masqués</h3>
          <ul class="players">
            {offlineHidden.map((h) => (
              <li key={h.id} class="player-row">
                <span class="player-name">{h.name}</span>
                <button type="button" class="btn ghost small" onClick={() => unhidePlayer(h.id)}>
                  Ne plus masquer
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

const FEEDBACK_TEXT: Record<
  FeedbackKind,
  { title: string; icon: string; intro: string; hint: string }
> = {
  idee: {
    title: 'Boîte à idées',
    icon: '💡',
    intro:
      'Une idée pour MalinosLand ? Une salle, un objet, une activité, une amélioration… Toutes les idées sont lues par l’équipe et les meilleures deviennent des tâches pour les contributeurs.',
    hint: 'Ex. : « Un coin jeux de société dans le salon, avec un plateau d’échecs. »',
  },
  bug: {
    title: 'Borne à bugs',
    icon: '🐞',
    intro:
      'Quelque chose ne marche pas ou s’affiche mal ? Décris ce que tu faisais et ce qui s’est passé. Le lieu où tu te trouves et la taille de ton écran sont joints automatiquement.',
    hint: 'Ex. : « Au salon, mon personnage traverse le canapé quand je clique dessus. »',
  },
};

/** Boîte à idées et borne à bugs : ouvertes à tous, même sans compte. */
export function FeedbackPanel({ kind }: { kind: FeedbackKind }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const text = FEEDBACK_TEXT[kind];
  const online = !!(SUPABASE_URL && SUPABASE_KEY);

  const submit = async () => {
    const clean = cleanFeedback(message);
    if (!clean) {
      setError(`Écris au moins ${FEEDBACK_MIN} caractères.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendFeedback({
        kind,
        message: clean,
        author_name: profileStore.get()?.name ?? null,
        context: {
          lieu: zoneStore.get()?.name ?? 'inconnu',
          version: '0.2',
          ecran: `${window.innerWidth}×${window.innerHeight}`,
        },
      });
      setSent(true);
      setMessage('');
      pushToast(kind === 'bug' ? 'Bug envoyé, merci !' : 'Idée envoyée, merci !', text.icon, 4000);
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Envoi impossible.');
    }
    setBusy(false);
  };

  return (
    <Modal title={text.title} icon={text.icon}>
      <div class="row start">
        <button
          type="button"
          class={`btn small ${kind === 'idee' ? 'primary' : 'ghost'}`}
          onClick={() => panelStore.set('ideas')}
        >
          💡 Une idée
        </button>
        <button
          type="button"
          class={`btn small ${kind === 'bug' ? 'primary' : 'ghost'}`}
          onClick={() => panelStore.set('bugs')}
        >
          🐞 Un bug
        </button>
      </div>
      <p>{text.intro}</p>
      {sent && (
        <p class="notice">Merci ! C’est bien arrivé. Tu peux en envoyer une autre si tu veux.</p>
      )}
      {online ? (
        <div class="report-form">
          <textarea
            rows={5}
            maxLength={FEEDBACK_MAX}
            placeholder={text.hint}
            value={message}
            onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
          />
          <p class="muted small">
            Envoyé avec ton pseudo. Lu uniquement par l’équipe de modération.
          </p>
          {error && <p class="error small">{error}</p>}
          <div class="row end">
            <button
              type="button"
              class="btn primary small"
              disabled={busy}
              onClick={() => void submit()}
            >
              Envoyer
            </button>
          </div>
        </div>
      ) : (
        <p class="notice">L’envoi depuis le jeu est disponible dans la version en ligne.</p>
      )}
      <p class="muted small">
        Tu as un compte GitHub ? Tu peux aussi{' '}
        <a href={GITHUB_NEW_ISSUE} target="_blank" rel="noopener noreferrer">
          ouvrir un ticket directement
        </a>{' '}
        et en discuter avec les contributeurs.
      </p>
    </Modal>
  );
}

function messagesOf(row: ReportRow): string[] {
  return Array.isArray(row.messages)
    ? row.messages.filter((m): m is string => typeof m === 'string').slice(0, 5)
    : [];
}

/** Modération : signalements reçus (accessible aux modérateurs, vérifié par la base). */
export function ModerationPanel() {
  const [section, setSection] = useState<'reports' | 'feedback'>('reports');
  return (
    <Modal title="Modération" icon="🛡️" wide>
      <div class="row start">
        <button
          type="button"
          class={`btn small ${section === 'reports' ? 'primary' : 'ghost'}`}
          onClick={() => setSection('reports')}
        >
          🚩 Signalements
        </button>
        <button
          type="button"
          class={`btn small ${section === 'feedback' ? 'primary' : 'ghost'}`}
          onClick={() => setSection('feedback')}
        >
          💡 Idées & bugs
        </button>
      </div>
      {section === 'reports' ? <ReportsList /> : <FeedbackList />}
    </Modal>
  );
}

function FeedbackList() {
  const [status, setStatus] = useState<'nouveau' | 'traite'>('nouveau');
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    listFeedback(status)
      .then(setRows)
      .catch(() => setError('Chargement impossible.'));
  }, [status]);

  const toggle = async (row: FeedbackRow) => {
    try {
      await setFeedbackStatus(row.id, row.status === 'nouveau' ? 'traite' : 'nouveau');
      setRows((list) => (list ?? []).filter((r) => r.id !== row.id));
    } catch {
      setError('Modification impossible.');
    }
  };

  return (
    <>
      <div class="row start">
        <button
          type="button"
          class={`btn small ${status === 'nouveau' ? 'primary' : 'ghost'}`}
          onClick={() => setStatus('nouveau')}
        >
          Nouveaux
        </button>
        <button
          type="button"
          class={`btn small ${status === 'traite' ? 'primary' : 'ghost'}`}
          onClick={() => setStatus('traite')}
        >
          Traités
        </button>
      </div>
      {error && <p class="error small">{error}</p>}
      {rows === null && !error && <p class="muted">Chargement…</p>}
      {rows?.length === 0 && <p class="muted">Rien pour le moment.</p>}
      <ul class="reports">
        {rows?.map((r) => (
          <li key={r.id}>
            <div class="player-row">
              <span class="player-name">
                {r.kind === 'bug' ? '🐞 Bug' : '💡 Idée'}
                {r.author_name && <span class="muted"> · {r.author_name}</span>}
              </span>
              <span class="muted small">{new Date(r.created_at).toLocaleString('fr-FR')}</span>
            </div>
            <p class="small feedback-message">{r.message}</p>
            <div class="row start">
              <a
                class="btn ghost small"
                href={githubIssueUrl(r)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Créer un ticket GitHub
              </a>
              <button type="button" class="btn ghost small" onClick={() => void toggle(r)}>
                {r.status === 'nouveau' ? 'Marquer comme traité' : 'Remettre en nouveau'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function ReportsList() {
  const [status, setStatus] = useState<'ouvert' | 'traite'>('ouvert');
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setRows(null);
    setError(null);
    listReports(status)
      .then(setRows)
      .catch(() => setError('Chargement impossible.'));
  };
  useEffect(load, [status]);

  const toggle = async (row: ReportRow) => {
    try {
      await setReportStatus(row.id, row.status === 'ouvert' ? 'traite' : 'ouvert');
      setRows((list) => (list ?? []).filter((r) => r.id !== row.id));
    } catch {
      setError('Modification impossible.');
    }
  };

  return (
    <>
      <div class="row start">
        <button
          type="button"
          class={`btn small ${status === 'ouvert' ? 'primary' : 'ghost'}`}
          onClick={() => setStatus('ouvert')}
        >
          À traiter
        </button>
        <button
          type="button"
          class={`btn small ${status === 'traite' ? 'primary' : 'ghost'}`}
          onClick={() => setStatus('traite')}
        >
          Traités
        </button>
      </div>
      {error && <p class="error small">{error}</p>}
      {rows === null && !error && <p class="muted">Chargement…</p>}
      {rows?.length === 0 && <p class="muted">Aucun signalement.</p>}
      <ul class="reports">
        {rows?.map((r) => (
          <li key={r.id}>
            <div class="player-row">
              <span class="player-name">
                {r.reported_name}
                {r.reported_account && <span title="Joueur connecté à son compte"> ✓</span>}
              </span>
              <span class="muted small">{new Date(r.created_at).toLocaleString('fr-FR')}</span>
            </div>
            <p class="small">
              <b>{REASON_LABEL[r.reason] ?? r.reason}</b>
              {r.details && <> — {r.details}</>}
            </p>
            {messagesOf(r).length > 0 && (
              <ul class="report-messages">
                {messagesOf(r).map((m, i) => (
                  <li key={i}>« {m} »</li>
                ))}
              </ul>
            )}
            <p class="muted small">
              Identifiant : {r.reported_player}
              {r.reported_account && <> · compte {r.reported_account}</>}
            </p>
            <button type="button" class="btn ghost small" onClick={() => void toggle(r)}>
              {r.status === 'ouvert' ? 'Marquer comme traité' : 'Rouvrir'}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
