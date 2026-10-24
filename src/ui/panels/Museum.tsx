import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { SUPABASE_KEY, SUPABASE_URL } from '../../config';
import { MUSEUM_CATEGORIES, museumCategory } from '../../content/museum';
import {
  PROJECT_SUMMARY_MAX,
  PROJECT_TITLE_MAX,
  PROJECT_URL_MAX,
  REJECT_REASON_MAX,
  checkProjectDraft,
  type DraftErrors,
  type ProjectInput,
} from '../../core/museum';
// Dessin en Canvas 2D seulement (aucun Phaser) : la même affiche que dans la salle du musée.
import { POSTER_H, POSTER_W, drawPoster, type PosterData } from '../../game/art/posters';
import { AccountError, accountStore } from '../../services/account';
import {
  MUSEUM_PAGE_SIZE,
  PROJECT_STATUS_LABEL,
  PROJECT_REPORT_REASONS,
  listApproved,
  listPending,
  checkProjectEmbed,
  demoViewerUrl,
  listProjectReports,
  setProjectEmbed,
  moderateProject,
  setProjectReportStatus,
  myProjects,
  submitProject,
  withdrawProject,
  type ModeratedProject,
  type ProjectReport,
  type ProjectStatus,
  type EmbedVerdict,
  type MuseumProject,
  type MyProject,
} from '../../services/museum';
import { profileStore } from '../../services/profile';
import { panelStore, pushToast } from '../../state';
import { useStore } from '../hooks';
import { Modal } from './Modal';
import { DemoFrame } from './MuseumDemo';

/** Affiche du projet, redessinée quand ses données changent. */
export function PosterCanvas({ data, width }: { data: PosterData; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Résolution adaptée à l'écran (par demi-pas, au plus ×3) pour un dessin net.
  const pixels = (width / POSTER_W) * (window.devicePixelRatio || 1);
  const scale = Math.min(3, Math.ceil(pixels * 2) / 2);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawPoster(ctx, data, scale);
  }, [data.id, data.title, data.author, data.category, scale]);
  return (
    <canvas
      ref={ref}
      class="poster-canvas"
      width={Math.round(POSTER_W * scale)}
      height={Math.round(POSTER_H * scale)}
      style={{ width: `${width}px`, height: `${Math.round((width * POSTER_H) / POSTER_W)}px` }}
      role="img"
      aria-label={`Affiche : ${data.title} (${museumCategory(data.category).label})`}
    />
  );
}

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const formatDate = (iso: string) => (iso ? DATE_FMT.format(new Date(iso)) : '');

/** Lien vers un site externe : nouvel onglet, sans transmettre d'où l'on vient. */
export function ExternalLink({
  url,
  label,
  className = 'external-link',
}: {
  url: string;
  label?: string;
  className?: string;
}) {
  return (
    <a class={className} href={url} target="_blank" rel="noopener noreferrer">
      {label ?? url} ↗
    </a>
  );
}

const EMPTY_INPUT: ProjectInput = {
  title: '',
  summary: '',
  url: '',
  category: 'site',
  tags: '',
};

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ComponentChildren;
}) {
  return (
    <label class={`museum-field${error ? ' invalid' : ''}`}>
      <span class="field-label">{label}</span>
      {children}
      {error ? <span class="error">{error}</span> : hint && <span class="muted small">{hint}</span>}
    </label>
  );
}

/** Formulaire « Exposer mon projet », avec l'aperçu de l'affiche. */
function SubmitForm({ onSent }: { onSent: () => void }) {
  const profile = useStore(profileStore);
  const [input, setInput] = useState<ProjectInput>(EMPTY_INPUT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (field: keyof ProjectInput) => (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setInput((i) => ({ ...i, [field]: value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const submit = async () => {
    const { draft, errors: found } = checkProjectDraft(input);
    setErrors(found);
    if (!draft) return;
    if (!mine) {
      setError('Coche la case pour confirmer que tu peux exposer ce projet.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitProject(draft);
      pushToast('Projet envoyé ! Un modérateur va le regarder.', '🖼️', 5000);
      setInput(EMPTY_INPUT);
      setMine(false);
      onSent();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Envoi impossible.');
    }
    setBusy(false);
  };

  const summaryLength = Array.from(input.summary).length;
  return (
    <div class="museum-submit">
      <div class="museum-form report-form">
        <Field label="Titre" error={errors.title}>
          <input
            type="text"
            maxLength={PROJECT_TITLE_MAX}
            value={input.title}
            placeholder="Ex. : Malino Notes"
            onInput={set('title')}
          />
        </Field>
        <Field label="Catégorie" hint={museumCategory(input.category).help} error={errors.category}>
          <select value={input.category} onChange={set('category')}>
            {MUSEUM_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Adresse"
          hint="Une adresse publique en https://, par exemple https://mon-projet.github.io"
          error={errors.url}
        >
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            spellcheck={false}
            maxLength={PROJECT_URL_MAX}
            value={input.url}
            placeholder="https://"
            onInput={set('url')}
          />
        </Field>
        <Field
          label={`Description (${summaryLength}/${PROJECT_SUMMARY_MAX})`}
          hint="Une ou deux phrases : ce que fait ton projet et pour qui."
          error={errors.summary}
        >
          <textarea
            rows={3}
            maxLength={PROJECT_SUMMARY_MAX}
            value={input.summary}
            onInput={set('summary')}
          />
        </Field>
        <Field
          label="Mots-clés (facultatif)"
          hint="3 au plus, séparés par des virgules. Ex. : IA, éducation, quiz"
          error={errors.tags}
        >
          <input type="text" value={input.tags} maxLength={70} onInput={set('tags')} />
        </Field>
        <label class="check small">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine((e.target as HTMLInputElement).checked)}
          />
          <span>
            C’est mon projet (ou j’y ai participé), il est accessible à tous et ne demande pas
            d’informations personnelles sans raison.
          </span>
        </label>
        {error && <p class="error">{error}</p>}
        <div class="row end">
          <button
            type="button"
            class="btn primary small"
            disabled={busy}
            onClick={() => void submit()}
          >
            Envoyer aux modérateurs
          </button>
        </div>
      </div>
      <aside class="museum-preview">
        <PosterCanvas
          data={{
            title: input.title.trim() || 'Ton projet',
            author: profile?.name,
            category: input.category,
          }}
          width={150}
        />
        <p class="muted small">
          Ton affiche, dessinée par le jeu. Elle sera exposée dans le musée une fois validée.
        </p>
      </aside>
    </div>
  );
}

/** Mes projets : statut, motif de refus, retrait. */
function MyProjectsList({ reload }: { reload: number }) {
  const [rows, setRows] = useState<MyProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const profile = useStore(profileStore);

  useEffect(() => {
    setRows(null);
    myProjects()
      .then(setRows)
      .catch((e) => setError(e instanceof AccountError ? e.message : 'Chargement impossible.'));
  }, [reload]);

  const withdraw = async (p: MyProject) => {
    try {
      await withdrawProject(p.id);
      setRows((list) =>
        (list ?? []).map((r) => (r.id === p.id ? { ...r, status: 'withdrawn' as const } : r)),
      );
      pushToast(`« ${p.title} » est retiré du musée.`, '🖼️', 4000);
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Retrait impossible.');
    }
    setConfirming(null);
  };

  if (error) return <p class="error">{error}</p>;
  if (!rows) return <p class="muted">Chargement…</p>;
  if (rows.length === 0)
    return <p class="muted">Tu n’as encore proposé aucun projet. Lance-toi !</p>;
  return (
    <ul class="reports museum-list">
      {rows.map((p) => (
        <li key={p.id} class={`museum-item status-${p.status}`}>
          <PosterCanvas
            data={{ id: p.id, title: p.title, author: profile?.name, category: p.category }}
            width={64}
          />
          <div class="museum-item-text">
            <div class="player-row">
              <span class="player-name">{p.title}</span>
              <span class={`badge museum-status ${p.status}`}>
                {PROJECT_STATUS_LABEL[p.status]}
              </span>
            </div>
            <p class="small">{p.summary}</p>
            <p class="small">
              <ExternalLink url={p.url} />
            </p>
            {p.rejectReason && (p.status === 'rejected' || p.status === 'withdrawn') && (
              <p class="small notice">Motif des modérateurs : {p.rejectReason}</p>
            )}
            <div class="row start">
              <span class="muted small">Proposé le {formatDate(p.createdAt)}</span>
              {(p.status === 'pending' || p.status === 'approved') &&
                (confirming === p.id ? (
                  <span class="small">
                    Retirer ce projet ?{' '}
                    <button type="button" class="btn small danger" onClick={() => void withdraw(p)}>
                      Oui, retirer
                    </button>{' '}
                    <button
                      type="button"
                      class="btn ghost small"
                      onClick={() => setConfirming(null)}
                    >
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button type="button" class="btn ghost small" onClick={() => setConfirming(p.id)}>
                    Retirer
                  </button>
                ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Panneau du Musée des Malinos (v0.4) : exposer un projet et suivre ses propositions. La salle
 * du musée (stands et affiches) arrive ensuite ; tout passe par la validation d'un modérateur.
 */
export function MuseumPanel() {
  const account = useStore(accountStore);
  const [tab, setTab] = useState<'submit' | 'mine'>('submit');
  const [reload, setReload] = useState(0);
  const online = !!(SUPABASE_URL && SUPABASE_KEY);
  const signedIn = account.status === 'signed-in';

  return (
    <Modal title="Musée des Malinos" icon="🖼️" wide>
      <p class="muted">
        Expose ton site, ton application, ton outil IA ou ta création. Chaque projet est relu par un
        modérateur avant d’être visible, puis exposé sur un stand du musée, à côté du hall.
      </p>
      {!online ? (
        <p class="notice">Le musée est disponible dans la version en ligne du jeu.</p>
      ) : !signedIn ? (
        <div class="notice">
          <p>Un compte est nécessaire pour exposer un projet (c’est gratuit).</p>
          <button
            type="button"
            class="btn primary small"
            onClick={() => panelStore.set('settings')}
          >
            Me connecter
          </button>
        </div>
      ) : (
        <>
          <div class="row start">
            <button
              type="button"
              class={`btn small ${tab === 'submit' ? 'primary' : 'ghost'}`}
              onClick={() => setTab('submit')}
            >
              ➕ Exposer un projet
            </button>
            <button
              type="button"
              class={`btn small ${tab === 'mine' ? 'primary' : 'ghost'}`}
              onClick={() => setTab('mine')}
            >
              🗂️ Mes projets
            </button>
          </div>
          {tab === 'submit' ? (
            <SubmitForm
              onSent={() => {
                setReload((n) => n + 1);
                setTab('mine');
              }}
            />
          ) : (
            <MyProjectsList reload={reload} />
          )}
        </>
      )}
    </Modal>
  );
}

const REJECT_PRESETS = [
  'Lien cassé ou site inaccessible',
  'Hors sujet pour le musée',
  'Contenu inapproprié',
  'Demande des informations personnelles',
  'Description à préciser',
];

/** Décision d'un modérateur sur un projet : valider, ou refuser / retirer avec un motif. */
function Decision({
  project,
  mode,
  onDone,
}: {
  project: ModeratedProject | MuseumProject;
  mode: 'pending' | 'approved';
  onDone: () => void;
}) {
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decide = async (status: 'approved' | 'rejected' | 'withdrawn') => {
    setBusy(true);
    setError(null);
    try {
      await moderateProject(project.id, status, reason);
      const what = { approved: 'exposé', rejected: 'refusé', withdrawn: 'retiré' }[status];
      pushToast(`« ${project.title} » : ${what}.`, '🛡️', 4000);
      onDone();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Décision impossible.');
      setBusy(false);
    }
  };
  const refuse = mode === 'pending' ? 'rejected' : 'withdrawn';
  return (
    <div class="report-form">
      {refusing ? (
        <>
          <div class="chips">
            {REJECT_PRESETS.map((r) => (
              <button key={r} type="button" class="btn ghost small" onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <input
            type="text"
            class="museum-reason"
            maxLength={REJECT_REASON_MAX}
            value={reason}
            placeholder="Motif montré à l’auteur (facultatif)"
            onInput={(e) => setReason((e.target as HTMLInputElement).value)}
          />
          <div class="row start">
            <button
              type="button"
              class="btn small danger"
              disabled={busy}
              onClick={() => void decide(refuse)}
            >
              {mode === 'pending' ? 'Refuser' : 'Retirer du musée'}
            </button>
            <button type="button" class="btn ghost small" onClick={() => setRefusing(false)}>
              Annuler
            </button>
          </div>
        </>
      ) : (
        <div class="row start">
          {mode === 'pending' && (
            <button
              type="button"
              class="btn primary small"
              disabled={busy}
              onClick={() => void decide('approved')}
            >
              ✓ Valider
            </button>
          )}
          <button type="button" class="btn ghost small" onClick={() => setRefusing(true)}>
            {mode === 'pending' ? 'Refuser…' : 'Retirer…'}
          </button>
        </div>
      )}
      {error && <p class="error">{error}</p>}
    </div>
  );
}

/** Onglet « Musée » du panneau 🛡️ Modération (la base vérifie le rôle de modérateur). */
export function MuseumModeration() {
  const [reports, setReports] = useState(false);
  const [list, setList] = useState<'pending' | 'approved'>('pending');
  const [rows, setRows] = useState<Array<ModeratedProject | MuseumProject> | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (page === 0) setRows(null);
    setError(null);
    const load =
      list === 'pending'
        ? listPending()
        : listApproved(null, page).then((r) => {
            setMore(r.length === MUSEUM_PAGE_SIZE);
            return r;
          });
    load
      .then((r) =>
        setRows((prev) => (list === 'approved' && page > 0 ? [...(prev ?? []), ...r] : r)),
      )
      .catch(() => setError('Chargement impossible.'));
  }, [list, page]);

  const remove = (id: number) => setRows((r) => (r ?? []).filter((p) => p.id !== id));
  const show = (l: 'pending' | 'approved') => {
    setReports(false);
    setPage(0);
    setList(l);
  };

  const tabs = (
    <div class="row start wrap">
      <button
        type="button"
        class={`btn small ${!reports && list === 'pending' ? 'primary' : 'ghost'}`}
        onClick={() => show('pending')}
      >
        En attente
      </button>
      <button
        type="button"
        class={`btn small ${!reports && list === 'approved' ? 'primary' : 'ghost'}`}
        onClick={() => show('approved')}
      >
        Exposés
      </button>
      <button
        type="button"
        class={`btn small ${reports ? 'primary' : 'ghost'}`}
        onClick={() => setReports(true)}
      >
        🚩 Signalés
      </button>
    </div>
  );
  if (reports)
    return (
      <>
        {tabs}
        <ProjectReportsList />
      </>
    );

  return (
    <>
      {tabs}
      <p class="muted small">
        Ouvre le site et vérifie-le avant de valider : il doit fonctionner, correspondre à la
        description et ne rien demander de suspect. Le motif de refus est montré à l’auteur.
      </p>
      {error && <p class="error">{error}</p>}
      {rows === null && !error && <p class="muted">Chargement…</p>}
      {rows?.length === 0 && (
        <p class="muted">
          {list === 'pending' ? 'Aucun projet en attente.' : 'Aucun projet exposé.'}
        </p>
      )}
      <ul class="reports museum-list">
        {rows?.map((p) => (
          <li key={p.id} class="museum-item">
            <PosterCanvas
              data={{ id: p.id, title: p.title, author: p.author, category: p.category }}
              width={64}
            />
            <div class="museum-item-text">
              <div class="player-row">
                <span class="player-name">{p.title}</span>
                <span class="muted small">
                  {museumCategory(p.category).icon} {museumCategory(p.category).label} · par{' '}
                  {p.author}
                  {'createdAt' in p && ` · ${formatDate(p.createdAt)}`}
                </span>
              </div>
              <p class="small">{p.summary}</p>
              {p.tags.length > 0 && (
                <p class="small museum-tags">
                  {p.tags.map((t) => (
                    <span key={t} class="badge">
                      #{t}
                    </span>
                  ))}
                </p>
              )}
              <p class="small">
                <ExternalLink url={p.url} />
              </p>
              {'embed' in p && <EmbedReview project={p} />}
              <Decision project={p} mode={list} onDone={() => remove(p.id)} />
            </div>
          </li>
        ))}
      </ul>
      {list === 'approved' && more && (
        <button type="button" class="btn ghost small" onClick={() => setPage((n) => n + 1)}>
          Voir plus
        </button>
      )}
    </>
  );
}

const PROJECT_REASON_LABEL: Record<string, string> = Object.fromEntries(
  PROJECT_REPORT_REASONS.map((r) => [r.id, r.label]),
);

/** Signalements de projets exposés : marquer comme traité, ou retirer le projet du musée. */
function ProjectReportsList() {
  const [status, setStatus] = useState<'ouvert' | 'traite'>('ouvert');
  const [rows, setRows] = useState<ProjectReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    listProjectReports(status)
      .then(setRows)
      .catch(() => setError('Chargement impossible.'));
  }, [status]);

  const done = (id: number) => setRows((list) => (list ?? []).filter((r) => r.id !== id));
  const toggle = async (r: ProjectReport) => {
    try {
      await setProjectReportStatus(r.id, r.status === 'ouvert' ? 'traite' : 'ouvert');
      done(r.id);
    } catch {
      setError('Modification impossible.');
    }
  };
  const withdraw = async (r: ProjectReport) => {
    try {
      await moderateProject(r.projectId, 'withdrawn', PROJECT_REASON_LABEL[r.reason] ?? '');
      await setProjectReportStatus(r.id, 'traite');
      pushToast(`« ${r.project?.title ?? 'Projet'} » est retiré du musée.`, '🛡️', 4000);
      done(r.id);
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Retrait impossible.');
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
      {error && <p class="error">{error}</p>}
      {rows === null && !error && <p class="muted">Chargement…</p>}
      {rows?.length === 0 && <p class="muted">Aucun signalement de projet.</p>}
      <ul class="reports">
        {rows?.map((r) => (
          <li key={r.id}>
            <div class="player-row">
              <span class="player-name">
                {r.project?.title ?? 'Projet supprimé'}
                {r.project && r.project.status !== 'approved' && (
                  <span class="muted">
                    {' '}
                    · {PROJECT_STATUS_LABEL[r.project.status as ProjectStatus]}
                  </span>
                )}
              </span>
              <span class="muted small">{new Date(r.createdAt).toLocaleString('fr-FR')}</span>
            </div>
            <p class="small">
              <b>{PROJECT_REASON_LABEL[r.reason] ?? r.reason}</b>
              {r.details && <> — {r.details}</>}
            </p>
            {r.project?.url && (
              <p class="small">
                <ExternalLink url={r.project.url} />
              </p>
            )}
            <div class="row start">
              <button type="button" class="btn ghost small" onClick={() => void toggle(r)}>
                {r.status === 'ouvert' ? 'Marquer comme traité' : 'Rouvrir'}
              </button>
              {r.status === 'ouvert' && r.project?.status === 'approved' && (
                <button type="button" class="btn small danger" onClick={() => void withdraw(r)}>
                  Retirer le projet
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

const EMBED_LABEL: Record<MuseumProject['embed'], string> = {
  unknown: 'Démo : à vérifier',
  ok: 'Démo intégrable',
  refused: 'Démo refusée',
};

/**
 * « Essayer ici » : validation en deux temps (DEC-038). 1. vérification technique par le
 * serveur (en-têtes du site) ; 2. essai réel dans la visionneuse. Le bouton « Intégrable »
 * n'apparaît qu'après les deux. La base vérifie le rôle de modérateur.
 */
function EmbedReview({ project }: { project: MuseumProject }) {
  const [embed, setEmbed] = useState(project.embed);
  const [check, setCheck] = useState<{ verdict: EmbedVerdict; reason: string } | null>(null);
  const [tried, setTried] = useState(false);
  const [trying, setTrying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trial = demoViewerUrl(project.id, true);
  if (!trial) return null; // version sans serveur : pas de démo intégrée

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Action impossible.');
    }
    setBusy(false);
  };
  const decide = (value: MuseumProject['embed']) =>
    run(async () => {
      await setProjectEmbed(project.id, value);
      setEmbed(value);
      setCheck(null);
      setTried(false);
      setTrying(false);
      pushToast(`« ${project.title} » : ${EMBED_LABEL[value].toLowerCase()}.`, '🛡️', 4000);
    });

  return (
    <div class="embed-review">
      <p class="small">
        <span class={`badge embed-${embed}`}>{EMBED_LABEL[embed]}</span>
        {check && (
          <span class={`small embed-verdict ${check.verdict}`}>
            {' '}
            {check.verdict === 'accepte' ? '✓ en-têtes compatibles' : `✗ ${check.verdict}`} :{' '}
            {check.reason}
          </span>
        )}
      </p>
      {embed === 'unknown' && (
        <div class="row start wrap">
          <button
            type="button"
            class="btn ghost small"
            disabled={busy}
            onClick={() => void run(async () => setCheck(await checkProjectEmbed(project.id)))}
          >
            1. Vérifier les en-têtes
          </button>
          <button
            type="button"
            class="btn ghost small"
            disabled={check?.verdict !== 'accepte'}
            onClick={() => {
              setTrying(true);
              setTried(true);
            }}
          >
            2. Essayer la démo
          </button>
          {check?.verdict === 'accepte' && tried && (
            <button
              type="button"
              class="btn primary small"
              disabled={busy}
              onClick={() => void decide('ok')}
            >
              ✓ Ça marche : intégrable
            </button>
          )}
          {check && (
            <button
              type="button"
              class="btn ghost small"
              disabled={busy}
              onClick={() => void decide('refused')}
            >
              Ne pas intégrer
            </button>
          )}
        </div>
      )}
      {embed !== 'unknown' && (
        <button
          type="button"
          class="btn ghost small"
          disabled={busy}
          onClick={() => void decide('unknown')}
        >
          {embed === 'ok' ? 'Retirer l’intégration (à revérifier)' : 'Revérifier la démo'}
        </button>
      )}
      {trying && embed === 'unknown' && (
        <DemoFrame viewer={trial} url={project.url} onClose={() => setTrying(false)} />
      )}
      {error && <p class="error">{error}</p>}
    </div>
  );
}
