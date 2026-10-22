import type { Role } from '../multiplayer/protocol';

/**
 * Rôles visibles dans le jeu (lot B2, DEC-027). Ils sont donnés par le responsable du site et
 * enregistrés dans la base ; le jeu ne fait que les afficher.
 */

/** Titre affiché au-dessus du pseudo doré (statut réservé à Renaud). */
export const GOLD_TITLE = 'Le Décodeur en chef';

/** Badge à côté du pseudo d'un modérateur. */
export const MOD_BADGE = '🛡️';

/** Pseudo tel qu'affiché, avec le badge de modérateur s'il y a lieu. */
export function nameWithBadge(name: string, role: Role | null): string {
  return role === 'mod' ? `${MOD_BADGE} ${name}` : name;
}

/** Libellés de l'interface (liste des présents, boutons du responsable). */
export const ROLE_LABELS: Record<Role, { title: string; give: string; remove: string }> = {
  gold: {
    title: `✨ ${GOLD_TITLE}`,
    give: '✨ Donner le statut doré',
    remove: 'Retirer le statut doré',
  },
  mod: {
    title: `${MOD_BADGE} Modérateur`,
    give: `${MOD_BADGE} Nommer modérateur`,
    remove: 'Retirer le rôle de modérateur',
  },
};
