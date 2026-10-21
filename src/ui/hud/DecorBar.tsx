import { useEffect, useRef, useState } from 'preact/hooks';
import { CATALOG } from '../../content/catalog';
import { FURNITURE, FURNITURE_CATEGORIES, type FurnitureCategory } from '../../content/furniture';
import { IsoBuilder } from '../../game/art/iso3d';
import { OBJECT_ART } from '../../game/art/objects';
import { commands, decorEditorStore, type DecorAction } from '../../state';
import { useStore } from '../hooks';

/**
 * Barre de l'éditeur de décoration (chargée seulement quand on décore) : catalogue de meubles
 * par catégorie, outils du meuble choisi, enregistrer / annuler. Les règles et le dessin dans
 * le monde sont côté jeu (src/game/DecorEditor.ts) ; ici on ne fait qu'envoyer des commandes.
 */
const send = (action: DecorAction, type?: string) =>
  commands.emit('decor', { action, ...(type ? { type } : {}) });

const nameOf = (type: string) => CATALOG[type]?.name ?? type;

/** Dessins des meubles, générés une fois (même générateur que le jeu). */
const thumbs = new Map<string, HTMLCanvasElement>();
function thumb(type: string): HTMLCanvasElement | null {
  const cached = thumbs.get(type);
  if (cached) return cached;
  const art = OBJECT_ART[type];
  const entry = CATALOG[type];
  if (!art || !entry) return null;
  const b = new IsoBuilder(0, entry.footprint[0], entry.footprint[1]);
  art(b, 0);
  const canvas = b.render(2).canvas;
  thumbs.set(type, canvas);
  return canvas;
}

function FurnitureThumb({ type }: { type: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const src = thumb(type);
    if (!canvas || !src) return;
    const W = 128;
    const H = 104;
    canvas.width = W;
    canvas.height = H;
    const ratio = Math.min((W - 8) / src.width, (H - 8) / src.height, 1.6);
    const w = src.width * ratio;
    const h = src.height * ratio;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
  }, [type]);
  return <canvas ref={ref} class="decor-thumb" aria-hidden="true" />;
}

export function DecorBar() {
  const st = useStore(decorEditorStore);
  const [tab, setTab] = useState<FurnitureCategory>('assises');
  if (!st.active) return null;
  const full = st.count >= st.max;
  const items = FURNITURE.filter((f) => f.category === tab);

  return (
    <section class="decor-bar" aria-label="Décoration du logement">
      <header class="decor-head">
        <strong class="decor-title">🛋️ Décoration</strong>
        <span class={`decor-count${full ? ' full' : ''}`}>
          {st.count} / {st.max} objets
        </span>
        <span class="decor-actions">
          <button
            type="button"
            class="btn ghost small"
            disabled={st.saving}
            onClick={() => send('reset')}
            title="Remettre les meubles du studio d’origine (rien n’est enregistré avant « Enregistrer »)"
          >
            Studio d’origine
          </button>
          <button
            type="button"
            class="btn ghost small"
            disabled={st.saving}
            onClick={() => send('cancel')}
          >
            Annuler
          </button>
          <button
            type="button"
            class="btn primary small"
            disabled={st.saving || !st.dirty}
            onClick={() => send('save')}
          >
            {st.saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </span>
      </header>

      {st.message && (
        <p class="decor-msg" role="status" aria-live="polite">
          {st.message}
        </p>
      )}

      {(st.held || st.selected) && (
        <div class="decor-tools">
          <span class="decor-current">
            {st.held ? `En main : ${nameOf(st.held)}` : nameOf(st.selected!.type)}
          </span>
          <button type="button" class="btn ghost small" onClick={() => send('rotate')}>
            ↻ Tourner <kbd>R</kbd>
          </button>
          {(st.held ? true : st.selected!.colors > 1) && (
            <button type="button" class="btn ghost small" onClick={() => send('color')}>
              🎨 Couleur <kbd>C</kbd>
            </button>
          )}
          {st.selected && !st.held && (
            <>
              <button type="button" class="btn ghost small" onClick={() => send('move')}>
                ✥ Déplacer <kbd>M</kbd>
              </button>
              <button type="button" class="btn small danger" onClick={() => send('remove')}>
                🗑️ Ranger
              </button>
            </>
          )}
          <button type="button" class="btn ghost small" onClick={() => send('deselect')}>
            {st.held ? 'Lâcher' : 'Terminer'} <kbd>Échap</kbd>
          </button>
        </div>
      )}

      <nav class="decor-tabs" role="tablist" aria-label="Catégories de meubles">
        {FURNITURE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={tab === c.id}
            class={`decor-tab${tab === c.id ? ' active' : ''}`}
            onClick={() => setTab(c.id)}
          >
            <span aria-hidden="true">{c.icon}</span> {c.label}
          </button>
        ))}
      </nav>
      <div class="decor-items" role="tabpanel">
        {items.map((f) => (
          <button
            key={f.type}
            type="button"
            class={`decor-item${st.held === f.type ? ' active' : ''}`}
            aria-pressed={st.held === f.type}
            disabled={full || st.saving}
            onClick={() => send('pick', f.type)}
            title={full ? 'Logement plein : range un objet d’abord' : `Poser : ${nameOf(f.type)}`}
          >
            <FurnitureThumb type={f.type} />
            <span class="decor-name">{nameOf(f.type)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
