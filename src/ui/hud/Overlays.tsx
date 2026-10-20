import { useLayoutEffect } from 'preact/hooks';
import { settingsStore } from '../../services/settings';
import { isTouchDevice } from '../../services/device';
import { commands, dialogStore, hintStore, statsStore, toastStore } from '../../state';
import { useStore } from '../hooks';

export function Hint() {
  const hint = useStore(hintStore);
  const dialog = useStore(dialogStore);
  if (!hint || dialog) return null;
  // Bouton : au doigt, c'est le seul moyen d'utiliser l'objet proche (pas de touche E).
  return (
    <button
      type="button"
      class="hint"
      // Pas de focus : la touche Espace utiliserait sinon l'objet deux fois.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => commands.emit('use', {})}
    >
      {isTouchDevice() ? '👆' : <kbd>E</kbd>} {hint}
    </button>
  );
}

export function Toasts() {
  const toasts = useStore(toastStore);
  return (
    <div class="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} class="toast">
          {t.icon && <span class="toast-icon">{t.icon}</span>}
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Stats() {
  const settings = useStore(settingsStore);
  const stats = useStore(statsStore);
  if (!settings.showStats) return null;
  return (
    <div class="stats">
      {stats.fps} FPS · {stats.peers} pair(s) · {stats.kbSent} Ko envoyés
    </div>
  );
}

/** Boîte de dialogue des personnages et panneaux (E, Espace ou Entrée pour avancer). */
export function DialogBox() {
  const dialog = useStore(dialogStore);
  // useLayoutEffect : touches actives dès l'affichage (voir Modal).
  useLayoutEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') dialogStore.set(null);
      else if (['e', 'E', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);
  if (!dialog) return null;
  const last = dialog.index >= dialog.lines.length - 1;
  function advance() {
    const d = dialogStore.get();
    if (!d) return;
    dialogStore.set(d.index >= d.lines.length - 1 ? null : { ...d, index: d.index + 1 });
  }
  return (
    <div class="dialog panel-glass" role="dialog" aria-label={dialog.speaker}>
      <div class="dialog-speaker">{dialog.speaker}</div>
      <p>{dialog.lines[dialog.index]}</p>
      <div class="dialog-footer">
        <span class="muted small">
          {dialog.index + 1}/{dialog.lines.length}
        </span>
        <button class="btn primary small" onClick={advance} autoFocus>
          {last ? 'Fermer' : 'Suivant'} <kbd>E</kbd>
        </button>
      </div>
    </div>
  );
}
