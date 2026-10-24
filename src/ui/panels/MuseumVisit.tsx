import { useEffect, useState } from 'preact/hooks';
import { SUPABASE_KEY, SUPABASE_URL } from '../../config';
import { MUSEUM_CATEGORIES, museumCategory, type MuseumCategory } from '../../content/museum';
import { AccountError, accountStore } from '../../services/account';
import {
  MUSEUM_PAGE_SIZE,
  MUSEUM_WALL_TTL_MS,
  PROJECT_REPORT_DETAILS_MAX,
  PROJECT_REPORT_REASONS,
  demoViewerUrl,
  listApproved,
  previewUrl,
  museumWallStore,
  reportProject,
  type MuseumProject,
  type ProjectReportReason,
} from '../../services/museum';
import { panelStore, projectFocusStore, pushToast } from '../../state';
import { useStore } from '../hooks';
import { Modal } from './Modal';
import { ExternalLink, PosterCanvas } from './Museum';
import { DemoFrame } from './MuseumDemo';

/**
 * Visite du Musée des Malinos (v0.4) : la liste « Toutes les créations » (borne du musée) et la
 * fiche d'un projet (stand ou liste). Seuls les projets validés par un modérateur sont listés.
 */

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function openProject(p: MuseumProject): void {
  projectFocusStore.set(p);
  panelStore.set('project');
}

const online = () => !!(SUPABASE_URL && SUPABASE_KEY);

/** Borne « Toutes les créations » : liste filtrée par catégorie, par pages de 20. */
export function CreationsPanel() {
  const [category, setCategory] = useState<MuseumCategory | null>(null);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<MuseumProject[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!online()) return;
    let alive = true;
    if (page === 0) setRows(null);
    setError(null);
    // Première page sans filtre : la liste déjà lue pour les stands suffit (gardée 5 minutes).
    const wall = museumWallStore.get();
    const fresh =
      page === 0 &&
      category === null &&
      wall.status === 'ready' &&
      Date.now() - wall.at < MUSEUM_WALL_TTL_MS;
    (fresh ? Promise.resolve(wall.projects) : listApproved(category, page))
      .then((r) => {
        if (!alive) return;
        setMore(r.length === MUSEUM_PAGE_SIZE);
        setRows((prev) => (page > 0 ? [...(prev ?? []), ...r] : r));
      })
      .catch(() => alive && setError('Chargement impossible. Réessaie dans un instant.'));
    return () => {
      alive = false;
    };
  }, [category, page]);

  const choose = (c: MuseumCategory | null) => {
    setPage(0);
    setCategory(c);
  };

  return (
    <Modal title="Toutes les créations" icon="🖼️" wide>
      <div class="row start wrap">
        <p class="muted grow">
          Les projets des Malinos, validés par les modérateurs. Touche une affiche pour la voir de
          près.
        </p>
        <button type="button" class="btn primary small" onClick={() => panelStore.set('museum')}>
          ➕ Exposer mon projet
        </button>
      </div>
      {!online() ? (
        <p class="notice">Le musée est disponible dans la version en ligne du jeu.</p>
      ) : (
        <>
          <div class="chips museum-filters" role="group" aria-label="Catégories">
            <button
              type="button"
              class={`btn small ${category === null ? 'primary' : 'ghost'}`}
              aria-pressed={category === null}
              onClick={() => choose(null)}
            >
              Toutes
            </button>
            {MUSEUM_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                class={`btn small ${category === c.id ? 'primary' : 'ghost'}`}
                aria-pressed={category === c.id}
                onClick={() => choose(c.id)}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          {error && <p class="error">{error}</p>}
          {rows === null && !error && <p class="muted">Chargement…</p>}
          {rows?.length === 0 && (
            <p class="muted">
              {category
                ? 'Aucune création dans cette catégorie pour l’instant.'
                : 'Aucune création exposée pour l’instant : la tienne peut être la première !'}
            </p>
          )}
          <ul class="museum-grid">
            {rows?.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  class="museum-card"
                  onClick={() => openProject(p)}
                  aria-label={`${p.title}, par ${p.author}`}
                >
                  <PosterCanvas
                    data={{ id: p.id, title: p.title, author: p.author, category: p.category }}
                    width={104}
                    preview={previewUrl(p)}
                  />
                  <span class="museum-card-title">{p.title}</span>
                  <span class="muted small">par {p.author}</span>
                </button>
              </li>
            ))}
          </ul>
          {more && (
            <button type="button" class="btn ghost small" onClick={() => setPage((n) => n + 1)}>
              Voir plus
            </button>
          )}
        </>
      )}
    </Modal>
  );
}

/** Signaler un projet exposé (compte nécessaire, vérifié par la base). */
function ReportProject({ project, onDone }: { project: MuseumProject; onDone: () => void }) {
  const account = useStore(accountStore);
  const [reason, setReason] = useState<ProjectReportReason>('lien-casse');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (account.status !== 'signed-in')
    return <p class="notice">Connecte-toi à ton compte (⚙️ Réglages) pour signaler un projet.</p>;
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await reportProject(project.id, reason, details);
      pushToast('Signalement envoyé. Merci, les modérateurs vont regarder.', '🛡️', 5000);
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
          onChange={(e) => setReason((e.target as HTMLSelectElement).value as ProjectReportReason)}
        >
          {PROJECT_REPORT_REASONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Précisions (facultatif)</span>
        <textarea
          rows={2}
          maxLength={PROJECT_REPORT_DETAILS_MAX}
          value={details}
          onInput={(e) => setDetails((e.target as HTMLTextAreaElement).value)}
        />
      </label>
      {error && <p class="error">{error}</p>}
      <div class="row start">
        <button type="button" class="btn small danger" disabled={busy} onClick={() => void send()}>
          Envoyer le signalement
        </button>
        <button type="button" class="btn ghost small" onClick={onDone}>
          Annuler
        </button>
      </div>
    </div>
  );
}

/** Fiche d'un projet : affiche, auteur, catégorie, résumé, lien vers le site. */
export function ProjectPanel() {
  const project = useStore(projectFocusStore);
  const [reporting, setReporting] = useState(false);
  // La démo ne se charge qu'après un clic sur « Essayer ici », jamais toute seule.
  const [trying, setTrying] = useState(false);
  useEffect(() => {
    setReporting(false);
    setTrying(false);
  }, [project?.id]);
  if (!project) return null;
  const cat = museumCategory(project.category);
  const host = new URL(project.url).hostname;
  const viewer = project.embed === 'ok' ? demoViewerUrl(project.id) : null;
  const capture = previewUrl(project);
  if (trying && viewer)
    return (
      <Modal title={project.title} icon="▶️" wide>
        <DemoFrame viewer={viewer} url={project.url} onClose={() => setTrying(false)} />
      </Modal>
    );
  return (
    <Modal title="Musée des Malinos" icon="🖼️" wide>
      <div class="museum-sheet">
        <PosterCanvas
          data={{
            id: project.id,
            title: project.title,
            author: project.author,
            category: project.category,
          }}
          width={180}
          preview={capture}
        />
        <div class="museum-sheet-text">
          {capture && (
            <img
              class="museum-capture"
              src={capture}
              alt={`Aperçu du site ${host}`}
              width={640}
              height={400}
            />
          )}
          <h3>{project.title}</h3>
          <p class="muted small">
            par <b>{project.author}</b> · {cat.icon} {cat.label}
            {project.approvedAt && ` · exposé le ${DATE_FMT.format(new Date(project.approvedAt))}`}
          </p>
          {project.tags.length > 0 && (
            <p class="small museum-tags">
              {project.tags.map((t) => (
                <span key={t} class="badge">
                  #{t}
                </span>
              ))}
            </p>
          )}
          <p>{project.summary}</p>
          <p class="notice small">
            <b>Site externe</b> ({host}) :{' '}
            {viewer
              ? 'tu peux l’essayer ici, dans une fenêtre isolée, ou l’ouvrir dans un nouvel onglet.'
              : 'il s’ouvre dans un nouvel onglet.'}{' '}
            MalinosLand ne l’héberge pas et ne le vérifie pas en continu ; ne donne pas
            d’informations personnelles sans raison.
          </p>
          <div class="row start wrap">
            {viewer && (
              <button type="button" class="btn primary small" onClick={() => setTrying(true)}>
                ▶ Essayer ici
              </button>
            )}
            <ExternalLink
              url={project.url}
              label="Ouvrir le site"
              className={`btn ${viewer ? 'ghost' : 'primary'} small`}
            />
            <button type="button" class="btn ghost small" onClick={() => setReporting(!reporting)}>
              🚩 Signaler
            </button>
            <button
              type="button"
              class="btn ghost small"
              onClick={() => panelStore.set('creations')}
            >
              Toutes les créations
            </button>
          </div>
          {reporting && <ReportProject project={project} onDone={() => setReporting(false)} />}
        </div>
      </div>
    </Modal>
  );
}
