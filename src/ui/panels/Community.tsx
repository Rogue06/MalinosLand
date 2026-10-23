import { useEffect, useRef, useState } from 'preact/hooks';
import { SUPABASE_KEY, SUPABASE_URL, TURNSTILE_SITEKEY } from '../../config';
import {
  AccountError,
  accountStore,
  listFeedback,
  listReports,
  sendFeedback,
  sendReport,
  setFeedbackStatus,
  setPlayerRole,
  setReportStatus,
  type FeedbackKind,
  type FeedbackRow,
  type ReportRow,
} from '../../services/account';
import {
  FEEDBACK_MAX,
  FEEDBACK_MIN,
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
import { inviteGuest, myHomeAccess, setMyHomeAccess } from '../../services/homes';
import {
  attendance,
  listVisits,
  summarize,
  type Attendance,
  type Visit,
} from '../../services/visits';
import { profileStore } from '../../services/profile';
import { loadTurnstile, type TurnstileApi } from '../../services/turnstile';
import { accountUuid, type Role } from '../../multiplayer/protocol';
import { GOLD_TITLE, MOD_BADGE, ROLE_LABELS } from '../../content/roles';
import {
  chatStore,
  commands,
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
/**
 * Inviter chez soi un joueur connecté à son compte (la base vérifie les droits). Un logement
 * fermé passe « sur invitation » (sinon l'invité ne pourrait pas entrer), et l'invité reçoit
 * aussitôt une petite carte « Y aller ».
 */
async function invite(p: PresenceEntry): Promise<boolean> {
  const uuid = accountUuid(p.id);
  if (!uuid) return false;
  try {
    await inviteGuest(uuid);
    if ((await myHomeAccess()) === 'private') {
      await setMyHomeAccess('invite');
      pushToast(
        'Ton logement passe en « Sur invitation » pour que tes invités puissent entrer.',
        '🏠',
        6000,
      );
    }
    commands.emit('invite-notify', { target: p.id });
    pushToast(
      `Invitation envoyée à ${p.name} : une carte lui propose de te rejoindre.`,
      '✉️',
      5000,
    );
    return true;
  } catch (e) {
    pushToast(e instanceof AccountError ? e.message : 'Invitation impossible.', '⚠️', 5000);
    return false;
  }
}

/**
 * Le responsable donne ou retire un rôle (la base vérifie que c'est bien lui), puis le serveur
 * relit ce rôle et l'annonce à tous : le pseudo change aussitôt, sans reconnexion.
 */
async function changeRole(p: PresenceEntry, role: Role, on: boolean): Promise<void> {
  try {
    await setPlayerRole(p.id, role, on);
    commands.emit('role-changed', { target: p.id });
    const what = role === 'gold' ? `le statut doré (« ${GOLD_TITLE} »)` : 'le rôle de modérateur';
    pushToast(on ? `${p.name} a maintenant ${what}.` : `${p.name} n’a plus ${what}.`, '✨', 5000);
  } catch (e) {
    pushToast(e instanceof AccountError ? e.message : 'Changement impossible.', '⚠️', 5000);
  }
}

/** Boutons du responsable pour un joueur connecté à son compte. */
function RoleActions({ player }: { player: PresenceEntry }) {
  const [busy, setBusy] = useState(false);
  const run = (role: Role, on: boolean) => {
    setBusy(true);
    void changeRole(player, role, on).finally(() => setBusy(false));
  };
  const gold = player.role === 'gold';
  const mod = player.role === 'mod';
  return (
    <div class="role-actions">
      <button
        type="button"
        class="btn ghost small"
        disabled={busy}
        onClick={() => run('gold', !gold)}
      >
        {gold ? ROLE_LABELS.gold.remove : ROLE_LABELS.gold.give}
      </button>
      {!gold && (
        <button
          type="button"
          class="btn ghost small"
          disabled={busy}
          onClick={() => run('mod', !mod)}
        >
          {mod ? ROLE_LABELS.mod.remove : ROLE_LABELS.mod.give}
        </button>
      )}
    </div>
  );
}

export function PlayersPanel() {
  const presence = useStore(presenceStore);
  const hidden = useStore(hiddenStore);
  const account = useStore(accountStore);
  const canInvite = account.status === 'signed-in';
  const isOwner = account.status === 'signed-in' && account.owner;
  const [reporting, setReporting] = useState<string | null>(null);
  const [invited, setInvited] = useState<string[]>([]);
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
                    {p.role === 'mod' && <span title="Modérateur">{MOD_BADGE} </span>}
                    <span class={p.role === 'gold' ? 'gold-name' : undefined}>{p.name}</span>
                    {p.verified && <span title="Connecté à son compte"> ✓</span>}
                    {p.away && <span class="muted"> · absent 💤</span>}
                    {isHidden && <em class="muted"> · masqué</em>}
                    {p.role === 'gold' && <span class="role-title">{GOLD_TITLE}</span>}
                  </span>
                  <span class="row-actions">
                    {canInvite && p.verified && (
                      <button
                        type="button"
                        class="btn ghost small"
                        title="Lui permettre d’entrer dans ton logement (il est prévenu aussitôt)"
                        disabled={invited.includes(p.id)}
                        onClick={() =>
                          void invite(p).then((ok) => ok && setInvited((list) => [...list, p.id]))
                        }
                      >
                        {invited.includes(p.id) ? 'Invité ✓' : 'Inviter'}
                      </button>
                    )}
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
                {isOwner && p.verified && <RoleActions player={p} />}
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
  const account = useStore(accountStore);
  // Visiteur (sans compte) : vérification anti-robots avant l'envoi.
  const needsCaptcha = online && !!TURNSTILE_SITEKEY && account.status !== 'signed-in';
  const [captcha, setCaptcha] = useState<string | null>(null);
  // Un jeton ne sert qu'une fois : on redemande une vérification après chaque envoi.
  const [captchaRound, setCaptchaRound] = useState(0);

  const submit = async () => {
    const clean = cleanFeedback(message);
    if (!clean) {
      setError(`Écris au moins ${FEEDBACK_MIN} caractères.`);
      return;
    }
    if (needsCaptcha && !captcha) {
      setError('Patiente le temps de la vérification anti-robots.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendFeedback(
        {
          kind,
          message: clean,
          author_name: profileStore.get()?.name ?? null,
          context: {
            lieu: zoneStore.get()?.name ?? 'inconnu',
            version: '0.2',
            ecran: `${window.innerWidth}×${window.innerHeight}`,
          },
        },
        needsCaptcha ? (captcha ?? undefined) : undefined,
      );
      setSent(true);
      setMessage('');
      pushToast(kind === 'bug' ? 'Bug envoyé, merci !' : 'Idée envoyée, merci !', text.icon, 4000);
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Envoi impossible.');
    }
    if (needsCaptcha) setCaptchaRound((n) => n + 1);
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
          {needsCaptcha && <CaptchaBox key={captchaRound} onToken={setCaptcha} />}
          {error && <p class="error small">{error}</p>}
          <div class="row end">
            <button
              type="button"
              class="btn primary small"
              disabled={busy || (needsCaptcha && !captcha)}
              onClick={() => void submit()}
            >
              Envoyer
            </button>
          </div>
        </div>
      ) : (
        <p class="notice">L’envoi depuis le jeu est disponible dans la version en ligne.</p>
      )}
    </Modal>
  );
}

/**
 * Vérification Cloudflare Turnstile (visiteurs) : le plus souvent invisible ou une simple case.
 * Le script n'est chargé qu'à l'ouverture de la boîte, par un visiteur.
 */
function CaptchaBox({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let api: TurnstileApi | null = null;
    let id: string | undefined;
    onToken(null);
    loadTurnstile()
      .then((t) => {
        if (!alive || !box.current || !TURNSTILE_SITEKEY) return;
        api = t;
        id = t.render(box.current, {
          sitekey: TURNSTILE_SITEKEY,
          theme: 'dark',
          language: 'fr',
          size: 'flexible',
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (api && id) api.remove(id);
    };
  }, [onToken]);
  if (failed)
    return (
      <p class="error small">
        La vérification anti-robots ne se charge pas (bloqueur de contenu ?). Connecte-toi avec
        GitHub ou Google pour envoyer sans vérification.
      </p>
    );
  return <div ref={box} class="captcha" aria-label="Vérification anti-robots" />;
}

function messagesOf(row: ReportRow): string[] {
  return Array.isArray(row.messages)
    ? row.messages.filter((m): m is string => typeof m === 'string').slice(0, 5)
    : [];
}

/** Modération : signalements reçus (accessible aux modérateurs, vérifié par la base). */
export function ModerationPanel() {
  const account = useStore(accountStore);
  const owner = account.status === 'signed-in' && account.owner;
  const [section, setSection] = useState<'reports' | 'feedback' | 'visits'>('reports');
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
        {owner && (
          <button
            type="button"
            class={`btn small ${section === 'visits' ? 'primary' : 'ghost'}`}
            onClick={() => setSection('visits')}
          >
            📋 Connexions
          </button>
        )}
      </div>
      {section === 'reports' ? (
        <ReportsList />
      ) : section === 'feedback' ? (
        <FeedbackList />
      ) : (
        <VisitsList />
      )}
    </Modal>
  );
}

const DAY_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const TIME_FMT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

const SHORT_DAY_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' });

const percent = (r: { returned: number; total: number }) =>
  r.total === 0 ? '—' : `${r.returned}/${r.total} (${Math.round((100 * r.returned) / r.total)} %)`;

/**
 * Mesures de fréquentation (v0.35), calculées depuis le journal existant : rien de plus n'est
 * collecté. Les limites sont écrites à côté des chiffres.
 */
function AttendanceSummary({ a }: { a: Attendance }) {
  return (
    <section class="attendance">
      <h3>Fréquentation</h3>
      <ul class="attendance-figures">
        <li>
          <strong>{a.accounts7}</strong> compte(s) différent(s) sur 7 jours ·{' '}
          <strong>{a.accounts90}</strong> sur 90 jours
        </li>
        <li>
          Revenus <strong>un autre jour</strong> : {percent(a.anotherDay)}
        </li>
        <li>
          Revenus <strong>7 jours ou plus</strong> après leur première visite : {percent(a.after7)}
          <span class="muted small"> (parmi les comptes arrivés il y a au moins 7 jours)</span>
        </li>
        <li>
          Durée médiane de connexion :{' '}
          <strong>{a.medianMinutes === null ? '—' : `${a.medianMinutes} min`}</strong>
        </li>
        <li>
          Visiteurs sans compte : <strong>{a.guestVisits7}</strong> visite(s) sur 7 jours
        </li>
      </ul>
      <table class="attendance-days">
        <caption class="muted small">Les 7 derniers jours</caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            <th scope="col">Comptes</th>
            <th scope="col">Visites sans compte</th>
          </tr>
        </thead>
        <tbody>
          {a.days.map((d) => (
            <tr key={d.day}>
              <td>{SHORT_DAY_FMT.format(new Date(`${d.day}T12:00:00`))}</td>
              <td>{d.accounts}</td>
              <td>{d.guestVisits}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="muted small">
        Limites : seuls les <strong>comptes</strong> peuvent être suivis d’une visite à l’autre (un
        visiteur change d’identifiant à chaque chargement de page, c’est voulu). La durée est une{' '}
        <strong>durée de connexion</strong> : un onglet oublié compte comme présent. On ne sait rien
        des activités faites pendant la visite.
        {a.truncated && ' Le journal a atteint 3 000 visites : les plus anciennes manquent.'}
      </p>
    </section>
  );
}

/** Historique des connexions (responsable du site seulement, 90 derniers jours). */
function VisitsList() {
  const [rows, setRows] = useState<Visit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listVisits()
      .then(setRows)
      .catch((e) => setError(e instanceof AccountError ? e.message : 'Historique indisponible.'));
  }, []);
  if (error) return <p class="error small">{error}</p>;
  if (!rows) return <p class="muted small">Chargement…</p>;
  const now = Date.now();
  const week = summarize(rows, now - 7 * 24 * 3600 * 1000);
  const all = summarize(rows, 0);
  const days = new Map<string, Visit[]>();
  for (const v of rows) {
    const key = DAY_FMT.format(v.arrived);
    days.set(key, [...(days.get(key) ?? []), v]);
  }
  return (
    <div class="visits">
      <AttendanceSummary a={attendance(rows, now)} />
      <h3>Historique</h3>
      <p>
        <strong>7 derniers jours :</strong> {week.visits} visite(s), {week.people} Malino(s)
        différent(s). <strong>90 jours :</strong> {all.visits} visite(s), {all.people} Malino(s).
      </p>
      <p class="muted small">
        Visible par toi seul. Pseudo, compte (✓) ou visiteur, heures d’arrivée et de départ ; effacé
        au bout de 90 jours. Rien n’était noté avant le 22/10/2026.
      </p>
      {rows.length === 0 && <p class="muted">Aucune connexion pour l’instant.</p>}
      {[...days].map(([day, list]) => (
        <section key={day}>
          <h3 class="elevator-section">
            {day} · {list.length}
          </h3>
          <ul class="players">
            {list.map((v, i) => (
              <li key={i} class="player-row">
                <span class="player-name">
                  {v.name}
                  {v.account && <span title="Connecté à son compte"> ✓</span>}
                </span>
                <span class="muted small">
                  {TIME_FMT.format(v.arrived)} → {v.left ? TIME_FMT.format(v.left) : 'en ligne'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
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
