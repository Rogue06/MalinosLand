import { REALTIME_URL } from '../../config';
import { commands, panelStore, presenceStore, roomStore, skyStore, zoneStore } from '../../state';
import { useStore } from '../hooks';

const SKY_ICON = { nuit: '🌙', aube: '🌅', jour: '☀️', crepuscule: '🌇' } as const;
const SKY_LABEL = { nuit: 'la nuit', aube: 'l’aube', jour: 'le jour', crepuscule: 'le crépuscule' };

export function TopBar({
  onToggleObjectives,
  objectivesOpen,
}: {
  onToggleObjectives: () => void;
  objectivesOpen: boolean;
}) {
  const zone = useStore(zoneStore);
  const presence = useStore(presenceStore);
  const room = useStore(roomStore);
  const sky = useStore(skyStore);
  return (
    <header class="topbar">
      <div class="topbar-left">
        <div class="logo">
          <span class="logo-mark">M</span>
          <span>
            Malinos<b>Land</b>
          </span>
        </div>
        <span
          class="badge"
          title={
            REALTIME_URL
              ? 'Version en ligne, en construction : la v0.3 (logements) est en cours'
              : 'Version locale : fonctionne sans serveur'
          }
        >
          v0.3 · en construction
        </span>
        {zone && (
          <span class={`zone-chip ${zone.status}`} title={zone.description}>
            📍 {zone.name}
            {zone.status === 'soon' && <em> · bientôt ({zone.plannedFor})</em>}
          </span>
        )}
        {sky && (
          <span
            class="zone-chip sky-chip"
            title={`Heure de Paris : c’est ${SKY_LABEL[sky.phase]}. Le jour et la nuit suivent l’heure réelle (réglage « Toujours de jour » dans ⚙️).`}
          >
            {SKY_ICON[sky.phase]} {sky.time}
          </span>
        )}
      </div>
      <nav class="topbar-right" aria-label="Menu principal">
        <button
          type="button"
          class="presence-chip"
          onClick={() => panelStore.set('players')}
          title={
            REALTIME_URL
              ? 'Malinos connectés en ce moment (masquer, signaler)'
              : 'Joueurs visibles : hors ligne, uniquement les onglets ouverts dans ce navigateur'
          }
        >
          <span class="dot" /> {presence.length} {presence.length > 1 ? 'Malinos' : 'Malino'}
        </button>
        {room.mine && (
          <button
            class="icon-btn decor-btn"
            onClick={() => commands.emit('decor', { action: 'start' })}
            title="Décorer mon logement"
          >
            🛋️
          </button>
        )}
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
        <button
          class="icon-btn"
          onClick={() => panelStore.set('ideas')}
          title="Boîte à idées et bugs"
        >
          💡
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
