import { CARNET_FINAL, SECRETS } from '../../content/secrets';
import { secretsStore } from '../../services/progress';
import { useStore } from '../hooks';
import { Modal } from './Modal';

/**
 * Le carnet de Joshua : une devinette pour chaque secret pas encore trouvé, et la page écrite
 * par Joshua pour chaque secret découvert. Tout trouver révèle la dernière page (son mystère).
 */
export function CarnetPanel() {
  const found = useStore(secretsStore);
  const all = found.length === SECRETS.length;
  return (
    <Modal title="Le carnet de Joshua" icon="📓" wide>
      <p class="muted">
        Joshua note tout. Chaque secret trouvé révèle une page de son carnet ; pour les autres, il
        laisse un indice (il adore les devinettes, même s’il dit le contraire).
      </p>
      <p class="carnet-count">
        {found.length}/{SECRETS.length} pages découvertes
      </p>
      <ol class="carnet">
        {SECRETS.map((s, i) => {
          const ok = found.includes(s.id);
          return (
            <li key={s.id} class={ok ? 'found' : ''}>
              <span class="carnet-num" aria-hidden="true">
                {ok ? '✓' : i + 1}
              </span>
              <div>
                <h3>{ok ? s.title : '???'}</h3>
                <p>{ok ? s.page : `Indice : ${s.hint}`}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {all && (
        <div class="carnet-final">
          <strong>Dernière page</strong>
          <p>{CARNET_FINAL}</p>
        </div>
      )}
    </Modal>
  );
}
