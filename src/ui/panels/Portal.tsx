import { useEffect, useMemo, useState } from 'preact/hooks';
import { MONDES_INSTALLED } from '../../config';
import { hash2 } from '../../core/random';
import { playRift } from '../../services/audio';
import { panelStore } from '../../state';
import { CHANTIER_URL, WORLD_SHIFT_MS } from '../../world/portal';
import { Modal } from './Modal';

/** Couleurs des cubes du monde où l'on arrive : herbe, terre, pierre, bois, eau, portail. */
const CUBE_COLORS = ['#6cbf5a', '#9b6a43', '#8b93a6', '#d9a46a', '#3f8fd8', '#5fe3d0'];
const COLS = 14;
const ROWS = 9;

/**
 * Changement de monde : l'écran se défait en cubes qui apparaissent un à un, au cœur d'un
 * tourbillon turquoise et violet, puis on part pour le Chantier des mondes.
 */
function WorldShift() {
  const cubes = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => {
        const h = hash2(i % COLS, Math.floor(i / COLS));
        // Les cubes du centre d'abord, puis vers les bords : on est aspiré dans la faille.
        const dx = (i % COLS) / (COLS - 1) - 0.5;
        const dy = Math.floor(i / COLS) / (ROWS - 1) - 0.5;
        const delay = Math.hypot(dx, dy) * 1100 + (h % 260);
        return { color: CUBE_COLORS[h % CUBE_COLORS.length]!, delay };
      }),
    [],
  );
  return (
    <div class="world-shift" role="status" aria-live="assertive">
      <div class="world-shift-swirl" />
      <div class="world-shift-grid">
        {cubes.map((c, i) => (
          <span
            key={i}
            class="world-shift-cube"
            style={{ background: c.color, animationDelay: `${Math.round(c.delay)}ms` }}
          />
        ))}
      </div>
      <p class="world-shift-text">🌀 Traversée de la faille… direction le Chantier des mondes</p>
    </div>
  );
}

/**
 * La borne du Chantier des mondes (DEC-051) : elle propose de franchir une faille vers le monde
 * en cubes. Rien ne se passe sans l'accord du joueur.
 */
export function PortalPanel() {
  const [leaving, setLeaving] = useState(false);
  // La faille s'ouvre : un chœur cristallin ; on la franchit : un grand souffle.
  useEffect(() => playRift('open'), []);
  useEffect(() => {
    if (!leaving) return;
    playRift('go');
    const timer = window.setTimeout(() => location.assign(CHANTIER_URL), WORLD_SHIFT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  if (leaving) return <WorldShift />;
  return (
    <Modal title="Une faille entre les mondes" icon="🌀">
      <p class="lead">
        L’écran de la borne se met à onduler, les ampoules s’emballent… Une{' '}
        <b>faille spatio-temporelle</b> s’ouvre vers le <b>Chantier des mondes</b>, un monde en
        cubes que les Malinos bâtissent ensemble.
      </p>
      <p>
        Là-bas : coupe des arbres, creuse, fabrique tes outils, bâtis ta maison et protège-la. Pour
        revenir à MalinosLand, passe le <b>Portail des Malinos</b>, au bout du chemin de gravier.
      </p>
      <p class="muted small">
        Sans compte, tu peux essayer (60 cubes, rien n’est gardé) ; connecté, tout ce que tu
        construis reste.
      </p>
      {MONDES_INSTALLED ? (
        <div class="row">
          <button class="btn primary" onClick={() => setLeaving(true)}>
            🌀 Je suis prêt, je franchis la faille !
          </button>
          <button class="btn ghost" onClick={() => panelStore.set(null)}>
            Pas maintenant
          </button>
        </div>
      ) : (
        <p class="muted small">
          Bientôt : le Chantier des mondes n’est pas installé sur cette version du site.
        </p>
      )}
    </Modal>
  );
}
