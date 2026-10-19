import { REALTIME_URL } from '../../config';
import { panelStore, presenceStore, zoneStore } from '../../state';
import { useStore } from '../hooks';

export function TopBar({
  onToggleObjectives,
  objectivesOpen,
}: {
  onToggleObjectives: () => void;
  objectivesOpen: boolean;
}) {
  const zone = useStore(zoneStore);
  const presence = useStore(presenceStore);
  return (
    <header class="topbar">
      <div class="topbar-left">
        <div class="logo">
          <span class="logo-mark">M</span>
          <span>
            Malinos<b>Land</b>
          </span>
        </div>
        <span class="badge" title="Version prototype : fonctionne en local, sans serveur">
          v0.1 · prototype
        </span>
        {zone && (
          <span class={`zone-chip ${zone.status}`} title={zone.description}>
            📍 {zone.name}
            {zone.status === 'soon' && <em> · bientôt ({zone.plannedFor})</em>}
          </span>
        )}
      </div>
      <nav class="topbar-right" aria-label="Menu principal">
        <span
          class="presence-chip"
          title={
            REALTIME_URL
              ? 'Malinos connectés en ce moment'
              : 'Joueurs visibles : hors ligne, uniquement les onglets ouverts dans ce navigateur'
          }
        >
          <span class="dot" /> {presence.length} {presence.length > 1 ? 'Malinos' : 'Malino'}
        </span>
        <button
          class={`icon-btn ${objectivesOpen ? 'active' : ''}`}
          onClick={onToggleObjectives}
          title="Objectifs"
          aria-pressed={objectivesOpen}
        >
          🎯
        </button>
        <button class="icon-btn" onClick={() => panelStore.set('avatar')} title="Mon avatar">
          🧑
        </button>
        <button class="icon-btn" onClick={() => panelStore.set('roadmap')} title="Feuille de route">
          🗺️
        </button>
        <button class="icon-btn" onClick={() => panelStore.set('help')} title="Aide et commandes">
          ❔
        </button>
        <button class="icon-btn" onClick={() => panelStore.set('settings')} title="Réglages">
          ⚙️
        </button>
      </nav>
    </header>
  );
}
