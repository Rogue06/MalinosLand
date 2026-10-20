import { describe, expect, it } from 'vitest';
import { HOME_EXIT, mapIdForRoom } from '../src/content/rooms';
import { loadWorld } from '../src/content/world';
import { accountUuid, homeOwner, homeRoom } from '../src/multiplayer/protocol';
import { parseAccess, parseGuests, parseHomes } from '../src/services/homes';

const UUID = '0b1c2d3e-0000-4000-8000-0000000000aa';
const HEX = '0b1c2d3e000040008000' + '0000000000aa';

describe('logements : salles et données', () => {
  it('salle d’un logement ↔ identifiant du compte', () => {
    expect(homeRoom(HEX)).toBe(`home-${HEX}`);
    expect(homeOwner(`home-${HEX}`)).toBe(HEX);
    expect(homeOwner('hub')).toBeNull();
    expect(homeOwner('home-pas-un-compte')).toBeNull();
    expect(accountUuid(HEX)).toBe(UUID);
    expect(accountUuid('court')).toBeNull();
  });

  it('chaque salle a sa carte ; la sortie d’un logement est praticable dans le Hub', () => {
    expect(mapIdForRoom('hub')).toBe('hub');
    expect(mapIdForRoom(`home-${HEX}`)).toBe('studio');
    expect(mapIdForRoom('ailleurs')).toBeNull();
    const hub = loadWorld('hub');
    expect(hub.grid.isWalkable(Math.floor(HOME_EXIT.x), Math.floor(HOME_EXIT.y))).toBe(true);
    const studio = loadWorld('studio');
    expect(
      studio.grid.isWalkable(Math.floor(studio.map.spawn.x), Math.floor(studio.map.spawn.y)),
    ).toBe(true);
  });

  it('lit prudemment les réponses de la base', () => {
    expect(parseAccess('public')).toBe('public');
    expect(parseAccess('nimporte')).toBe('private');
    expect(
      parseHomes([
        { owner_id: UUID, name: 'Odile', access: 'public' },
        { owner_id: 'pas-un-uuid', name: 'X', access: 'public' },
        { owner_id: UUID, name: '   ', access: 'bizarre' },
      ]),
    ).toEqual([
      { room: `home-${HEX}`, ownerName: 'Odile', access: 'public' },
      { room: `home-${HEX}`, ownerName: 'Malino', access: 'private' },
    ]);
    expect(parseHomes(null)).toEqual([]);
    expect(parseGuests([{ guest_id: UUID, name: 'Gaston' }, { guest_id: 3 }])).toEqual([
      { id: HEX, name: 'Gaston' },
    ]);
  });
});
