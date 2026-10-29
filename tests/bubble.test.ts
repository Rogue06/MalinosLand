import { describe, expect, it } from 'vitest';
import { BUBBLE_MAX_CHARS, bubbleDuration, bubbleText, isEmojiOnly } from '../src/core/bubble';

describe('bulles de chat', () => {
  it('texte resserré, coupé proprement s’il est trop long', () => {
    expect(bubbleText('  Salut   les\n Malinos ! ')).toBe('Salut les Malinos !');
    const long = 'a'.repeat(300);
    const cut = bubbleText(long);
    expect(Array.from(cut)).toHaveLength(BUBBLE_MAX_CHARS);
    expect(cut.endsWith('…')).toBe(true);
    // Les émojis ne sont pas coupés en deux.
    const emojis = bubbleText('😀'.repeat(200));
    expect(Array.from(emojis).every((c) => c === '😀' || c === '…')).toBe(true);
  });

  it('le temps de lire : entre 4 et 10 secondes', () => {
    expect(bubbleDuration('ok')).toBe(4120);
    expect(bubbleDuration('x'.repeat(50))).toBe(7000);
    expect(bubbleDuration('x'.repeat(500))).toBe(10000);
  });

  it('un ou deux émojis seuls : en grand', () => {
    expect(isEmojiOnly('👋')).toBe(true);
    expect(isEmojiOnly('☕️')).toBe(true);
    expect(isEmojiOnly('👍🎉')).toBe(true);
    expect(isEmojiOnly('👍🎉🔥')).toBe(false);
    expect(isEmojiOnly('ok 👍')).toBe(false);
    expect(isEmojiOnly('12')).toBe(false);
  });
});
