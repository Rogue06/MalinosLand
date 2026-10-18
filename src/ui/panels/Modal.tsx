import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { panelStore } from '../../state';

/** Fenêtre modale accessible : Échap ou clic à l'extérieur pour fermer. */
export function Modal({
  title,
  icon,
  children,
  wide,
}: {
  title: string;
  icon?: string;
  children: ComponentChildren;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && panelStore.set(null);
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div
      class="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && panelStore.set(null)}
    >
      <div
        class={`modal panel-glass ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header class="modal-head">
          <h2>
            {icon && <span class="modal-icon">{icon}</span>}
            {title}
          </h2>
          <button class="icon-btn" onClick={() => panelStore.set(null)} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div class="modal-body">{children}</div>
      </div>
    </div>
  );
}
