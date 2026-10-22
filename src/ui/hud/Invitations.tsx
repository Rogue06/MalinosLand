import { dismissInvitation } from '../../services/invitations';
import { commands, invitationsStore, roomStore } from '../../state';
import { useStore } from '../hooks';

/**
 * Invitation reçue : petite carte « X t'invite dans son logement » avec « Y aller » et « Plus
 * tard ». L'entrée reste vérifiée par le serveur et la base (logement fermé : refus poli).
 */
export function InvitationCard() {
  const list = useStore(invitationsStore);
  const here = useStore(roomStore);
  const inv = list.find((i) => i.room !== here.room);
  if (!inv) return null;
  return (
    <div class="invitation panel-glass" role="alertdialog" aria-label="Invitation">
      <p class="invitation-text">
        <span aria-hidden="true">✉️</span> <strong>{inv.ownerName}</strong> t’invite dans son
        logement !
      </p>
      <div class="invitation-actions">
        <button
          type="button"
          class="btn primary small"
          onClick={() => {
            dismissInvitation(inv);
            commands.emit('travel', { room: inv.room, ownerName: inv.ownerName });
          }}
        >
          Y aller
        </button>
        <button type="button" class="btn ghost small" onClick={() => dismissInvitation(inv)}>
          Plus tard
        </button>
      </div>
      <p class="muted small invitation-hint">
        Tu pourras aussi y aller plus tard par l’ascenseur du hall.
      </p>
    </div>
  );
}
