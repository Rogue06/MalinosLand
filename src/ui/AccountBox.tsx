import { useState } from 'preact/hooks';
import {
  PROVIDERS,
  accountStore,
  deleteAccount,
  signIn,
  signOut,
  AccountError,
} from '../services/account';
import { panelStore } from '../state';
import { useStore } from './hooks';

const PROVIDER_LABEL: Record<string, string> = { github: 'GitHub', google: 'Google' };

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
    return (
      <div class="account">
        <p class="muted small">
          {compact
            ? 'Facultatif : connecte-toi pour retrouver ton personnage sur tous tes appareils.'
            : 'Tu joues en visiteur : ton personnage est enregistré dans ce navigateur. Connecte-toi pour le retrouver partout et afficher la marque ✓ à côté de ton pseudo.'}
        </p>
        <div class="row">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              class="btn ghost small"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void signIn(p.id).finally(() => setBusy(false));
              }}
            >
              Se connecter avec {p.label}
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
