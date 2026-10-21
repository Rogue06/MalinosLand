import { useState } from 'preact/hooks';
import {
  PROVIDERS,
  type AccountProvider,
  accountStore,
  deleteAccount,
  signIn,
  signOut,
  AccountError,
} from '../services/account';
import { panelStore } from '../state';
import { useStore } from './hooks';

const PROVIDER_LABEL: Record<string, string> = { github: 'GitHub', google: 'Google' };

/** Logo officiel « G » de Google (bouton de connexion). */
function GoogleLogo() {
  return (
    <svg class="google-logo" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * Compte du joueur : boutons de connexion, ou état connecté (déconnexion, suppression).
 * `compact` : version de l'écran d'accueil (sans suppression de compte).
 */
export function AccountBox({ compact = false }: { compact?: boolean }) {
  const account = useStore(accountStore);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (account.status === 'disabled') return null;
  if (account.status === 'loading') return <p class="muted small">Connexion au compte…</p>;

  if (account.status === 'guest') {
    const start = (id: AccountProvider) => {
      setBusy(true);
      void signIn(id).finally(() => setBusy(false));
    };
    return (
      <div class="account">
        <p class="muted small">
          {compact
            ? 'Conseillé : connecte-toi avec Google pour retrouver ton personnage sur tous tes appareils et avoir ton propre logement.'
            : 'Tu joues en visiteur : ton personnage est enregistré dans ce navigateur. Connecte-toi pour le retrouver partout, avoir ton logement et afficher la marque ✓ à côté de ton pseudo.'}
        </p>
        <div class="row">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              class={p.id === 'google' ? 'btn google' : 'btn ghost small'}
              disabled={busy}
              onClick={() => start(p.id)}
            >
              {p.id === 'google' && <GoogleLogo />}
              {p.id === 'google' ? 'Continuer avec Google' : `Se connecter avec ${p.label}`}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const provider = PROVIDER_LABEL[account.user.provider] ?? 'ton compte';
  return (
    <div class="account">
      <p class="small">
        ✓ Connecté avec {provider}
        {account.savedName ? (
          <>
            {' '}
            · pseudo enregistré : <b>{account.savedName}</b>
          </>
        ) : (
          ' · profil pas encore enregistré'
        )}
      </p>
      {!compact && (
        <div class="row">
          {(account.moderator || account.owner) && (
            <button
              type="button"
              class="btn primary small"
              onClick={() => panelStore.set('moderation')}
            >
              🛡️ Modération
            </button>
          )}
          <button type="button" class="btn ghost small" onClick={() => void signOut()}>
            Se déconnecter
          </button>
          {!confirming ? (
            <button type="button" class="btn ghost small" onClick={() => setConfirming(true)}>
              Supprimer mon compte…
            </button>
          ) : (
            <span class="notice">
              Supprimer définitivement ton compte et ton profil enregistré ?{' '}
              <button
                type="button"
                class="btn small danger"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  deleteAccount().catch((e: unknown) => {
                    setBusy(false);
                    setError(e instanceof AccountError ? e.message : 'Suppression impossible.');
                  });
                }}
              >
                Oui, supprimer
              </button>{' '}
              <button type="button" class="btn ghost small" onClick={() => setConfirming(false)}>
                Annuler
              </button>
            </span>
          )}
        </div>
      )}
      {error && <p class="error small">{error}</p>}
    </div>
  );
}
