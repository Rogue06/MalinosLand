/**
 * Type d'appareil, pour adapter les textes et les commandes : au doigt (téléphone, tablette),
 * on parle de « toucher » plutôt que de touches du clavier.
 */
function matches(query: string): boolean {
  return typeof matchMedia === 'function' && matchMedia(query).matches;
}

/** Écran tactile comme moyen principal de pointer (pas d'une souris). */
export function isTouchDevice(): boolean {
  return matches('(pointer: coarse)');
}

/** Petit écran (téléphone en portrait ou en paysage) : interface compacte par défaut. */
export function isSmallScreen(): boolean {
  return matches('(max-width: 760px), (max-height: 500px)');
}
