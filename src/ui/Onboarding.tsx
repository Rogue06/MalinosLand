import { useState } from 'preact/hooks';
import { DEFAULT_APPEARANCE, randomAppearance } from '../content/avatars';
import { NAME_MIN_LENGTH, sanitizeName } from '../core/text';
import { profileStore } from '../services/profile';
import { typingStore } from '../state';
import { AvatarEditor } from './AvatarEditor';

/** Écran d'arrivée : création du personnage avant d'entrer dans le monde. */
export function Onboarding() {
  const [name, setName] = useState('');
  const [look, setLook] = useState(() =>
    Math.random() < 0.5 ? DEFAULT_APPEARANCE : randomAppearance(),
  );
  const [error, setError] = useState<string | null>(null);

  const submit = (e: Event) => {
    e.preventDefault();
    const clean = sanitizeName(name);
    if (!clean) {
      setError(
        `Choisis un pseudo de ${NAME_MIN_LENGTH} à 20 caractères (lettres, chiffres, espaces, - _ . ').`,
      );
      return;
    }
    typingStore.set(false);
    profileStore.set({ name: clean, look });
  };

  return (
    <div class="onboarding">
      <form class="onboarding-card" onSubmit={submit} onFocusIn={() => typingStore.set(true)}>
        <header class="onboarding-header">
          <div class="logo big">
            <span class="logo-mark">M</span>
            <span>
              Malinos<b>Land</b>
            </span>
          </div>
          <p class="tagline">Le monde virtuel gratuit, open source et communautaire des Malinos.</p>
        </header>
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
        <footer class="onboarding-footer">
          <p class="muted small">
            Version 0.1 · prototype local : ton personnage est enregistré uniquement dans ce
            navigateur. Aucun compte, aucune donnée envoyée.
          </p>
          <button type="submit" class="btn primary big">
            Entrer dans MalinosLand →
          </button>
        </footer>
      </form>
    </div>
  );
}
