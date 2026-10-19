import { useState } from 'preact/hooks';
import { PRIVACY_NOTE, REALTIME_URL } from '../../config';
import { FLOORS } from '../../content/floors';
import { REPO_URL, ROADMAP } from '../../content/roadmap';
import { AI_TIPS, tipOfTheDay } from '../../content/tips';
import { sanitizeName } from '../../core/text';
import { profileStore } from '../../services/profile';
import { resetProgress } from '../../services/progress';
import { settingsStore, type Settings } from '../../services/settings';
import { panelStore, pushToast } from '../../state';
import { AccountBox } from '../AccountBox';
import { AvatarEditor } from '../AvatarEditor';
import { useStore } from '../hooks';
import { Modal } from './Modal';

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function WelcomePanel() {
  return (
    <Modal title="Bienvenue à MalinosLand" icon="👋">
      <p class="lead">
        MalinosLand est un monde virtuel <b>gratuit</b>, <b>open source</b> et <b>communautaire</b>,
        construit petit à petit par et pour les Malinos, une communauté de passionnés d’intelligence
        artificielle.
      </p>
      <div class="cards">
        <div class="card">
          <h3>🤝 Partager</h3>
          <p>
            Rencontre d’autres Malinos, discute, montre tes projets et découvre ceux des autres.
          </p>
        </div>
        <div class="card">
          <h3>🏗️ Construire</h3>
          <p>
            Le monde évolue avec ses habitants : nouvelles salles, logements, galerie, événements…
          </p>
        </div>
        <div class="card">
          <h3>🌱 Pour toujours gratuit</h3>
          <p>Pas d’abonnement, pas de monnaie à acheter. Juste la convivialité.</p>
        </div>
      </div>
      <h3>Participer au développement</h3>
      <p>
        Le code est ouvert à tous sur <ExternalLink href={REPO_URL}>GitHub</ExternalLink>.
        Développeurs, graphistes ou simples curieux : chaque contribution passe par une proposition
        (pull request) relue par l’équipe.
      </p>
      <p class="muted small">{PRIVACY_NOTE}</p>
    </Modal>
  );
}

export function RoadmapPanel() {
  return (
    <Modal title="Feuille de route" icon="🗺️" wide>
      <p class="muted">
        Ce qui existe déjà et ce qui arrive. Les versions évolueront selon les retours des Malinos.
      </p>
      <ol class="roadmap">
        {ROADMAP.map((step) => (
          <li key={step.version} class={step.status}>
            <div class="roadmap-version">v{step.version}</div>
            <div>
              <h3>
                {step.title} {step.status === 'current' && <span class="badge">en cours</span>}
                {step.status === 'done' && <span class="badge done">terminé</span>}
              </h3>
              <ul>
                {step.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}

export function ElevatorPanel() {
  return (
    <Modal title="Ascenseur" icon="🛗">
      <p class="muted">Choisis un étage.</p>
      <div class="elevator">
        {FLOORS.map((f) => (
          <button
            key={f.id}
            class={`elevator-floor ${f.status}`}
            disabled={f.status === 'soon'}
            onClick={() => {
              panelStore.set(null);
              pushToast('Tu es déjà au rez-de-chaussée, au cœur du Hub.', '🛗');
            }}
          >
            <span class="floor-label">{f.label}</span>
            <span class="floor-desc">{f.description}</span>
            {f.status === 'soon' ? (
              <span class="badge soon">bientôt · {f.plannedFor}</span>
            ) : (
              <span class="badge">vous êtes ici</span>
            )}
          </button>
        ))}
      </div>
      <p class="muted small">
        Les étages seront chargés à la demande : la tour pourra accueillir des centaines de
        logements sans ralentir le jeu.
      </p>
    </Modal>
  );
}

export function TipsPanel() {
  const [i, setI] = useState(tipOfTheDay());
  return (
    <Modal title="Astuce IA du jour" icon="💡">
      <blockquote class="tip">{AI_TIPS[i]}</blockquote>
      <div class="row">
        <span class="muted small">
          Astuce {i + 1}/{AI_TIPS.length}
        </span>
        <button class="btn ghost small" onClick={() => setI((i + 1) % AI_TIPS.length)}>
          Astuce suivante →
        </button>
      </div>
      <p class="muted small">
        Tu as une astuce à partager ? Propose-la sur GitHub dans src/content/tips.ts !
      </p>
    </Modal>
  );
}

export function EventsPanel() {
  return (
    <Modal title="Événements" icon="🎤">
      <p class="lead">Aucun événement n’est programmé pour l’instant.</p>
      <p>
        La salle de conférence accueillera des présentations, des démos de projets et des
        discussions à partir de la <b>version 0.5</b>. Les sessions vidéo passeront par un lien vers
        un outil de visioconférence externe gratuit : MalinosLand n’hébergera pas de flux audio ou
        vidéo, pour rester gratuit et léger.
      </p>
      <p class="muted small">
        En attendant, installe-toi dans un fauteuil et discute avec les Malinos présents !
      </p>
    </Modal>
  );
}

export function AvatarPanel() {
  const profile = useStore(profileStore);
  const [name, setName] = useState(profile?.name ?? '');
  const [look, setLook] = useState(profile?.look);
  const [error, setError] = useState<string | null>(null);
  if (!profile || !look) return null;
  const save = () => {
    const clean = sanitizeName(name);
    if (!clean) {
      setError('Pseudo invalide (2 à 20 caractères).');
      return;
    }
    profileStore.set({ name: clean, look });
    panelStore.set(null);
    pushToast('Nouveau style enregistré !', '✨');
  };
  return (
    <Modal title="Mon avatar" icon="🪞" wide>
      <AvatarEditor
        name={name}
        look={look}
        onName={(n) => {
          setName(n);
          setError(null);
        }}
        onLook={setLook}
        nameError={error}
      />
      <div class="row end">
        <button class="btn ghost" onClick={() => panelStore.set(null)}>
          Annuler
        </button>
        <button class="btn primary" onClick={save}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

export function SettingsPanel() {
  const s = useStore(settingsStore);
  const [initialQuality] = useState(s.quality);
  const set = (patch: Partial<Settings>) => settingsStore.set({ ...s, ...patch });
  return (
    <Modal title="Réglages" icon="⚙️">
      <div class="settings">
        <AccountBox />
        <label>
          <span>Qualité graphique</span>
          <select
            value={s.quality}
            onChange={(e) =>
              set({ quality: (e.target as HTMLSelectElement).value as Settings['quality'] })
            }
          >
            <option value="low">Basse — machines modestes, sans effets</option>
            <option value="normal">Normale — recommandée</option>
            <option value="high">Haute — écrans haute densité</option>
          </select>
        </label>
        {s.quality !== initialQuality && (
          <div class="notice">
            La qualité s’applique au rechargement.{' '}
            <button class="btn primary small" onClick={() => location.reload()}>
              Recharger
            </button>
          </div>
        )}
        <label>
          <span>Images par seconde max.</span>
          <select
            value={s.fpsLimit}
            onChange={(e) =>
              set({
                fpsLimit: Number((e.target as HTMLSelectElement).value) as Settings['fpsLimit'],
              })
            }
          >
            <option value={30}>30 (économie d’énergie)</option>
            <option value={60}>60</option>
            <option value={0}>Illimité (synchronisé sur l’écran)</option>
          </select>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={s.reducedMotion}
            onChange={(e) => set({ reducedMotion: (e.target as HTMLInputElement).checked })}
          />
          <span>Réduire les animations (au rechargement)</span>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={s.showNames}
            onChange={(e) => set({ showNames: (e.target as HTMLInputElement).checked })}
          />
          <span>Afficher les noms</span>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={s.showStats}
            onChange={(e) => set({ showStats: (e.target as HTMLInputElement).checked })}
          />
          <span>Afficher les performances (FPS, trafic)</span>
        </label>
        {REALTIME_URL ? (
          <p class="muted small">
            🌐 Multijoueur en ligne : tu retrouves les autres Malinos connectés en même temps que
            toi.
          </p>
        ) : (
          <label class="check">
            <input
              type="checkbox"
              checked={s.multiTab}
              onChange={(e) => set({ multiTab: (e.target as HTMLInputElement).checked })}
            />
            <span>
              Démo multijoueur locale : ouvre MalinosLand dans plusieurs onglets de ce navigateur
              pour voir les avatars se croiser
            </span>
          </label>
        )}
        <div class="row">
          <button
            class="btn ghost small"
            onClick={() => {
              resetProgress();
              pushToast('Objectifs réinitialisés.', '🔄');
            }}
          >
            Réinitialiser les objectifs
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function HelpPanel() {
  return (
    <Modal title="Aide" icon="❔">
      <table class="controls">
        <tbody>
          <tr>
            <td>Se déplacer</td>
            <td>
              Clic sur le sol · <kbd>Z</kbd>
              <kbd>Q</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> · <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> · flèches
            </td>
          </tr>
          <tr>
            <td>Interagir, s’asseoir</td>
            <td>
              Clic sur l’objet · <kbd>E</kbd> ou <kbd>Espace</kbd>
            </td>
          </tr>
          <tr>
            <td>Discuter</td>
            <td>
              <kbd>Entrée</kbd> puis <kbd>Entrée</kbd> pour envoyer
            </td>
          </tr>
          <tr>
            <td>Zoomer</td>
            <td>Molette de la souris</td>
          </tr>
          <tr>
            <td>Fermer une fenêtre</td>
            <td>
              <kbd>Échap</kbd>
            </td>
          </tr>
        </tbody>
      </table>
      <h3>Ce qui fonctionne aujourd’hui</h3>
      <p>
        Exploration du Hub, avatar personnalisable, interactions, objectifs de découverte, chat et
        émotes.{' '}
        {REALTIME_URL
          ? 'Tu croises en direct les autres Malinos connectés. Les comptes arrivent bientôt.'
          : 'La démo multijoueur relie uniquement les onglets ouverts dans ce navigateur.'}
      </p>
    </Modal>
  );
}
