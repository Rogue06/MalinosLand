import { useState } from 'preact/hooks';
import {
  ACCESSORIES,
  AVATAR_PRESETS,
  BEARDS,
  BODY_SHAPES,
  BOTTOM_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  TOP_COLORS,
  randomAppearance,
  type AvatarAppearance,
} from '../content/avatars';
import type { Facing } from '../core/iso';
import { NAME_MAX_LENGTH } from '../core/text';
import { AvatarPreview } from './AvatarPreview';

const FACING_ORDER: Facing[] = ['py', 'px', 'ny', 'nx'];

function Swatches({
  label,
  colors,
  value,
  onPick,
}: {
  label: string;
  colors: readonly string[];
  value: number;
  onPick: (i: number) => void;
}) {
  return (
    <div class="field">
      <span class="field-label">{label}</span>
      <div class="swatches" role="radiogroup" aria-label={label}>
        {colors.map((c, i) => (
          <button
            type="button"
            key={c}
            class={`swatch ${i === value ? 'selected' : ''}`}
            style={{ background: c }}
            role="radio"
            aria-checked={i === value}
            aria-label={`${label} ${i + 1}`}
            onClick={() => onPick(i)}
          />
        ))}
      </div>
    </div>
  );
}

function Choices({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly string[];
  value: number;
  onPick: (i: number) => void;
}) {
  return (
    <div class="field">
      <span class="field-label">{label}</span>
      <div class="chips" role="radiogroup" aria-label={label}>
        {options.map((o, i) => (
          <button
            type="button"
            key={o}
            class={`chip ${i === value ? 'selected' : ''}`}
            role="radio"
            aria-checked={i === value}
            onClick={() => onPick(i)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface AvatarEditorProps {
  name: string;
  look: AvatarAppearance;
  onName: (name: string) => void;
  onLook: (look: AvatarAppearance) => void;
  nameError?: string | null;
}

/** Éditeur simple : préréglages + quelques choix. Volontairement léger (v0.1). */
export function AvatarEditor({ name, look, onName, onLook, nameError }: AvatarEditorProps) {
  const [facing, setFacing] = useState(0);
  const set = (key: keyof AvatarAppearance) => (v: number) => onLook({ ...look, [key]: v });
  return (
    <div class="avatar-editor">
      <div class="avatar-stage">
        <AvatarPreview look={look} facing={FACING_ORDER[facing]!} size={150} />
        <div class="stage-actions">
          <button
            type="button"
            class="btn ghost small"
            onClick={() => setFacing((facing + 1) % 4)}
            aria-label="Tourner l’avatar"
          >
            ⟳ Tourner
          </button>
          {look.model === 0 && (
            <button
              type="button"
              class="btn ghost small"
              onClick={() => onLook(randomAppearance())}
            >
              🎲 Au hasard
            </button>
          )}
        </div>
        <label class="field name-field">
          <span class="field-label">Ton pseudo</span>
          <input
            type="text"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            placeholder="ex. Léa, Max_IA…"
            autocomplete="nickname"
            onInput={(e) => onName((e.target as HTMLInputElement).value)}
            aria-invalid={!!nameError}
          />
          {nameError && <span class="error">{nameError}</span>}
        </label>
      </div>
      <div class="avatar-options">
        <Choices
          label="Modèle"
          options={['Classique personnalisable', 'Malino 3D']}
          value={look.model ?? 1}
          onPick={set('model')}
        />
        {look.model !== 0 ? (
          <p>
            Première tenue Malino 3D. D’autres coiffures, vêtements et accessoires viendront
            progressivement. Le modèle classique conserve tes réglages.
          </p>
        ) : (
          <>
            <div class="field">
              <span class="field-label">Styles prêts à porter</span>
              <div class="presets">
                {AVATAR_PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.name}
                    class="preset"
                    onClick={() => onLook({ ...p.look, model: 0 })}
                    title={p.name}
                  >
                    <AvatarPreview look={{ ...p.look, model: 0 }} size={52} />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <Choices
              label="Silhouette"
              options={BODY_SHAPES}
              value={look.body}
              onPick={set('body')}
            />
            <Swatches label="Peau" colors={SKIN_TONES} value={look.skin} onPick={set('skin')} />
            <Choices
              label="Coiffure"
              options={HAIR_STYLES}
              value={look.hair}
              onPick={set('hair')}
            />
            <Swatches
              label="Cheveux"
              colors={HAIR_COLORS}
              value={look.hairColor}
              onPick={set('hairColor')}
            />
            <Choices label="Barbe" options={BEARDS} value={look.beard} onPick={set('beard')} />
            <Swatches label="Haut" colors={TOP_COLORS} value={look.top} onPick={set('top')} />
            <Swatches
              label="Bas"
              colors={BOTTOM_COLORS}
              value={look.bottom}
              onPick={set('bottom')}
            />
            <Choices
              label="Accessoire"
              options={ACCESSORIES}
              value={look.accessory}
              onPick={set('accessory')}
            />
          </>
        )}
      </div>
    </div>
  );
}
