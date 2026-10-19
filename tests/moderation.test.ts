import { describe, expect, it } from 'vitest';
import {
  accountFromPlayerId,
  cleanFeedback,
  githubIssueUrl,
  buildReport,
  hiddenStore,
  hidePlayer,
  isHidden,
  parseHidden,
  unhidePlayer,
} from '../src/services/moderation';

describe('modération côté joueur', () => {
  it('masquer puis afficher un joueur', () => {
    hidePlayer('bbbbbbbb22', 'Bob');
    hidePlayer('bbbbbbbb22', 'Bob');
    expect(isHidden('bbbbbbbb22')).toBe(true);
    expect(hiddenStore.get()).toHaveLength(1);
    unhidePlayer('bbbbbbbb22');
    expect(isHidden('bbbbbbbb22')).toBe(false);
  });

  it('la liste enregistrée est validée à la lecture', () => {
    expect(
      parseHidden([
        { id: 'bbbbbbbb22', name: 'Bob' },
        { id: 'bbbbbbbb22', name: 'Doublon' },
        { id: '<script>', name: 'X' },
        { id: 'cccccccc33', name: '' },
        'n’importe quoi',
      ]),
    ).toEqual([{ id: 'bbbbbbbb22', name: 'Bob' }]);
    expect(parseHidden(null)).toEqual([]);
  });

  it('un signalement joint les derniers messages du joueur, nettoyés', () => {
    const chat = [
      { peerId: 'bbbbbbbb22', text: 'msg 1' },
      { peerId: 'cccccccc33', text: 'autre joueur' },
      ...Array.from({ length: 6 }, (_, i) => ({ peerId: 'bbbbbbbb22', text: `spam ${i}` })),
      { text: 'message système' },
    ];
    const r = buildReport(
      { id: 'bbbbbbbb22', name: 'Bob', verified: false },
      'spam',
      '  pub\u0000 en boucle  ',
      chat,
    );
    expect(r.messages).toEqual(['spam 1', 'spam 2', 'spam 3', 'spam 4', 'spam 5']);
    expect(r.details).toBe('pub en boucle');
    expect(r.reported_account).toBeNull();
  });

  it('compte du joueur signalé seulement s’il est vérifié', () => {
    const id = '0b1c2d3e000040008000000000000001';
    expect(accountFromPlayerId(id)).toBe('0b1c2d3e-0000-4000-8000-000000000001');
    expect(accountFromPlayerId('bbbbbbbb22')).toBeNull();
    const r = buildReport({ id, name: 'Élodie', verified: true }, 'harcelement', '', []);
    expect(r.reported_account).toBe('0b1c2d3e-0000-4000-8000-000000000001');
  });
});

describe('boîte à idées et bugs', () => {
  it('message nettoyé, assez long', () => {
    expect(cleanFeedback('  ok ')).toBeNull();
    expect(cleanFeedback('  Une piscine\u0000 !  ')).toBe('Une piscine !');
  });

  it('ticket GitHub prérempli, texte encodé dans l’adresse', () => {
    const url = new URL(
      githubIssueUrl({
        kind: 'bug',
        message: 'Le banc flotte & disparaît\nau salon',
        author_name: 'Eve',
        created_at: '2026-10-20T10:00:00Z',
        context: { lieu: 'Salon', ecran: '390×780' },
      }),
    );
    expect(url.origin + url.pathname).toBe('https://github.com/Rogue06/MalinosLand/issues/new');
    expect(url.searchParams.get('title')).toBe('[bug] Le banc flotte & disparaît');
    expect(url.searchParams.get('labels')).toBe('bug');
    expect(url.searchParams.get('body')).toContain('(borne à bugs) le 2026-10-20 de Eve');
    expect(url.searchParams.get('body')).toContain('- lieu : Salon');
  });
});
