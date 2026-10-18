/**
 * Nettoyage des textes saisis ou reçus (chat, pseudos). Les textes ne sont
 * jamais interprétés comme du HTML, mais on retire tout de même les caractères
 * de contrôle et les inversions bidirectionnelles (usurpation visuelle).
 */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;

export const CHAT_MAX_LENGTH = 140;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 20;

export function sanitizeText(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return Array.from(input.replace(/\s+/g, ' ').replace(CONTROL, '').trim())
    .slice(0, maxLength)
    .join('');
}

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u;

/** Renvoie un pseudo valide ou null. */
export function sanitizeName(input: unknown): string | null {
  const name = sanitizeText(input, NAME_MAX_LENGTH);
  if (Array.from(name).length < NAME_MIN_LENGTH) return null;
  return NAME_RE.test(name) ? name : null;
}
