import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_APPEARANCE } from '../content/avatars';
import { PRIVACY_NOTE } from '../config';
import { NAME_MIN_LENGTH, sanitizeName } from '../core/text';
import { AccountError, accountStore, saveRemoteProfile } from '../services/account';
import { profileStore } from '../services/profile';
import { typingStore } from '../state';
import { AccountBox } from './AccountBox';
import { AvatarEditor } from './AvatarEditor';
import { useStore } from './hooks';

/** Écran d'arrivée : création du personnage avant d'entrer dans le monde. */
export function Onboarding() {
  const account = useStore(accountStore);
  const signedIn = account.status === 'signed-in';
  const suggested = signedIn ? account.user.suggestedName : null;
  const [name, setName] = useState(suggested ?? '');
  const [busy, setBusy] = useState(false);
  // Compte reconnu après l'affichage : on propose son pseudo GitHub / Google.
  useEffect(() => {
    if (suggested) setName((n) => n || suggested);
  }, [suggested]);
  const [look, setLook] = useState(() => ({ ...DEFAULT_APPEARANCE }));
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: Event) => {
    e.preventDefault();
    const clean = sanitizeName(name || (suggested ?? ''));
    if (!clean) {
      setError(
        `Choisis un pseudo de ${NAME_MIN_LENGTH} à 20 caractères (lettres, chiffres, espaces, - _ . ').`,
      );
      return;
    }
    // Connecté : le profil est d'abord enregistré en base (le pseudo doit y être libre).
    if (signedIn) {
      setBusy(true);
      try {
        await saveRemoteProfile({ name: clean, look });
      } catch (err) {
        setBusy(false);
        setError(err instanceof AccountError ? err.message : 'Enregistrement impossible.');
        return;
      }
    }
    typingStore.set(false);
    profileStore.set({ name: clean, look });
  };

  return (
    <div class="onboarding">
      <form
        class="onboarding-card"
        onSubmit={(e) => void submit(e)}
        onFocusIn={() => typingStore.set(true)}
      >
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
        <AccountBox compact />
        <footer class="onboarding-footer">
          <p class="muted small">
            {PRIVACY_NOTE}{' '}
            <a href="../confidentialite.html" target="_blank" rel="noopener noreferrer">
              Politique de confidentialité
            </a>{' '}
            · Open source (licence AGPL-3.0)
          </p>
          <button type="submit" class="btn primary big" disabled={busy}>
            Entrer dans MalinosLand →
          </button>
        </footer>
      </form>
    </div>
  );
}
