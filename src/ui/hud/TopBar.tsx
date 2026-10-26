import { useEffect, useRef, useState } from 'preact/hooks';
import { REALTIME_URL } from '../../config';
import type { PanelId } from '../../world/types';
import { commands, panelStore, presenceStore, roomStore, skyStore, zoneStore } from '../../state';
import { useStore } from '../hooks';

const SKY_ICON = { nuit: '🌙', aube: '🌅', jour: '☀️', crepuscule: '🌇' } as const;
const SKY_LABEL = { nuit: 'la nuit', aube: 'l’aube', jour: 'le jour', crepuscule: 'le crépuscule' };

/**
 * Entrées secondaires du bandeau : boutons sur grand écran, regroupées dans le menu ☰ sur
 * téléphone (cahier des charges du village, §6 : pas six boutons permanents sur mobile).
 */
const MENU: ReadonlyArray<{ panel: PanelId | 'settings' | 'help'; icon: string; label: string }> = [
  { panel: 'avatar', icon: '🧑', label: 'Mon avatar' },
  { panel: 'roadmap', icon: '🗺️', label: 'Feuille de route' },
  { panel: 'ideas', icon: '💡', label: 'Boîte à idées et bugs' },
  { panel: 'help', icon: '❔', label: 'Aide et commandes' },
  { panel: 'settings', icon: '⚙️', label: 'Réglages' },
];

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Menu ☰ ouvert : un toucher ailleurs ou Échap le referme.
  useEffect(() => {
    if (!menuOpen) return;
    const away = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', key);
    };
  }, [menuOpen]);
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
              ? 'Version en ligne, en construction : v0.35 (panneau « Que faire ? » et quiz IA) terminée, v0.4 (Musée des Malinos) en cours'
              : 'Version locale : fonctionne sans serveur'
          }
        >
          v0.4 · en construction
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
          class="icon-btn"
          onClick={() => panelStore.set('activities')}
          title="Aujourd’hui : que faire maintenant ?"
          aria-label="Aujourd’hui"
        >
          🧭
        </button>
        <button
          class={`icon-btn ${objectivesOpen ? 'active' : ''}`}
          onClick={onToggleObjectives}
          title="Objectifs"
          aria-pressed={objectivesOpen}
        >
          🎯
        </button>
        {MENU.map((m) => (
          <button
            key={m.panel}
            class="icon-btn menu-wide"
            onClick={() => panelStore.set(m.panel)}
            title={m.label}
          >
            {m.icon}
          </button>
        ))}
        <div class="menu-narrow" ref={menuRef}>
          <button
            class={`icon-btn ${menuOpen ? 'active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            title="Menu"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            ☰
          </button>
          {menuOpen && (
            <ul class="menu-list panel-glass">
              {MENU.map((m) => (
                <li key={m.panel}>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      panelStore.set(m.panel);
                    }}
                  >
                    <span aria-hidden="true">{m.icon}</span> {m.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>
    </header>
  );
}
