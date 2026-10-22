import { useState } from 'preact/hooks';
import { PRIVACY_NOTE, REALTIME_URL } from '../../config';
import { ROADMAP } from '../../content/roadmap';
import { AI_TIPS, tipOfTheDay } from '../../content/tips';
import { sanitizeName } from '../../core/text';
import { profileStore } from '../../services/profile';
import { resetProgress } from '../../services/progress';
import { settingsStore, type Settings } from '../../services/settings';
import { isTouchDevice } from '../../services/device';
import { panelStore, pushToast } from '../../state';
import { AccountBox } from '../AccountBox';
import { AvatarEditor } from '../AvatarEditor';
import { useStore } from '../hooks';
import { Modal } from './Modal';
import { CHARTE, DEVISE, SLOGANS } from '../../content/joshua';

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
          <p>Pas d’abonnement, rien à acheter. Juste la convivialité.</p>
        </div>
      </div>
      <h3>La charte des Malinos</h3>
      <ul class="charte">
        {CHARTE.map((c) => (
          <li key={c.text}>
            <span aria-hidden="true">{c.icon}</span> {c.text}
          </li>
        ))}
      </ul>
      <p class="devise">{DEVISE}</p>
      <h3>Participer au développement</h3>
      <p>
        MalinosLand est open source. Développeurs, graphistes ou simples curieux : envie d’aider ?
        Fais signe à Rogue06 dans la communauté, ou passe par la Boîte à idées (💡 en haut).
      </p>
      <p class="muted small">
        {PRIVACY_NOTE}{' '}
        <ExternalLink href="../confidentialite.html">Politique de confidentialité</ExternalLink> ·
        Open source (licence AGPL-3.0)
      </p>
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
        Tu as une astuce à partager ? Envoie-la par la Boîte à idées (💡 en haut) !
      </p>
    </Modal>
  );
}

export function EventsPanel() {
  return (
    <Modal title="Événements" icon="🎤">
      <p class="devise">
        {SLOGANS.live}, {SLOGANS.style}.
      </p>
      <p class="muted small">{SLOGANS.themes}</p>
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
        <label class="check">
          <input
            type="checkbox"
            checked={s.sounds}
            onChange={(e) => set({ sounds: (e.target as HTMLInputElement).checked })}
          />
          <span>Son à l’arrivée d’un message et quand on te mentionne (@{'pseudo'})</span>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={s.ambience}
            onChange={(e) => set({ ambience: (e.target as HTMLInputElement).checked })}
          />
          <span>Ambiance sonore (oiseaux dehors, clavier au coworking…)</span>
        </label>
        <label>
          <span>Volume des sons</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            onInput={(e) => set({ volume: Number((e.target as HTMLInputElement).value) })}
          />
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
      {isTouchDevice() ? (
        <TouchControls />
      ) : (
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
              <td>Molette de la souris · deux doigts sur un écran tactile</td>
            </tr>
            <tr>
              <td>Fermer une fenêtre</td>
              <td>
                <kbd>Échap</kbd>
              </td>
            </tr>
          </tbody>
        </table>
      )}
      <h3>Ce qui fonctionne aujourd’hui</h3>
      <p>
        Exploration du Hub, avatar personnalisable, interactions, objectifs de découverte, chat et
        émotes.{' '}
        {REALTIME_URL
          ? 'Tu croises en direct les autres Malinos connectés. Avec un compte (GitHub ou Google), tu retrouves ton personnage partout.'
          : 'La démo multijoueur relie uniquement les onglets ouverts dans ce navigateur.'}
      </p>
    </Modal>
  );
}

/** Commandes au doigt (téléphone, tablette) : pas de touches à expliquer. */
function TouchControls() {
  return (
    <table class="controls">
      <tbody>
        <tr>
          <td>Se déplacer</td>
          <td>Touche le sol</td>
        </tr>
        <tr>
          <td>Interagir, s’asseoir</td>
          <td>Touche l’objet, ou le bouton 👆 en bas de l’écran quand tu es tout près</td>
        </tr>
        <tr>
          <td>Discuter</td>
          <td>Touche la ligne du chat pour le déplier, ▾ pour le replier</td>
        </tr>
        <tr>
          <td>Zoomer</td>
          <td>Écarte ou rapproche deux doigts</td>
        </tr>
        <tr>
          <td>Fermer une fenêtre</td>
          <td>Bouton ✕</td>
        </tr>
      </tbody>
    </table>
  );
}
