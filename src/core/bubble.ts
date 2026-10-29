/**
 * Bulles de chat au-dessus des personnages (logique pure et testée) : texte affiché et durée.
 * Le dessin est dans src/game/entities/AvatarView.ts.
 */

/** Longueur maximale d'une bulle (au-delà, la suite est dans la fenêtre du chat). */
export const BUBBLE_MAX_CHARS = 140;

/** Texte de la bulle : espaces resserrés, coupé proprement s'il est trop long. */
export function bubbleText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(clean);
  if (chars.length <= BUBBLE_MAX_CHARS) return clean;
  return `${chars
    .slice(0, BUBBLE_MAX_CHARS - 1)
    .join('')
    .trimEnd()}…`;
}

/** Durée d'affichage (ms) : le temps de lire, entre 4 et 10 secondes. */
export function bubbleDuration(text: string): number {
  return Math.min(10000, 4000 + Array.from(text).length * 60);
}

/** Un message fait seulement d'un ou deux émojis s'affiche en grand. */
export function isEmojiOnly(text: string): boolean {
  const t = text.trim();
  const pictures = t.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
  return pictures > 0 && pictures <= 2 && /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D)+$/u.test(t);
}
