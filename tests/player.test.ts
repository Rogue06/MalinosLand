import { describe, expect, it } from 'vitest';
import { loadWorld } from '../src/content/world';
import { PlayerController } from '../src/world/PlayerController';

function simulate(pc: PlayerController, seconds: number) {
  const arrived = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const r = pc.update(1 / 60, { x: 0, y: 0 });
    if (r.arrived) arrived.push(r.arrived);
  }
  return arrived;
}

describe('PlayerController', () => {
  it('se rend à un point cliqué en contournant les murs', () => {
    const world = loadWorld('hub');
    const pc = new PlayerController(world, 'me', world.map.spawn, 'ny');
    // Destination dans le coworking, derrière la cloison du hall.
    expect(pc.walkTo({ x: 4.5, y: 7.5 })).toBe(true);
    simulate(pc, 20);
    expect(pc.pos.x).toBeCloseTo(4.5, 1);
    expect(pc.pos.y).toBeCloseTo(7.5, 1);
  });

  it('marche jusqu’à Joshua puis déclenche l’interaction', () => {
    const world = loadWorld('hub');
    const pc = new PlayerController(world, 'me', world.map.spawn, 'ny');
    const joshua = world.getObject('joshua')!;
    expect(pc.requestUse(joshua)).toBe('walking');
    const arrived = simulate(pc, 15);
    expect(arrived).toEqual([{ kind: 'use', objectId: 'joshua' }]);
    expect(world.distanceToObject(pc.pos, joshua)).toBeLessThan(1);
  });

  it('s’assoit sur un banc puis se relève au clavier', () => {
    const world = loadWorld('hub');
    const pc = new PlayerController(world, 'me', world.map.spawn, 'ny');
    const bench = world.objects.find((o) => o.type === 'bench')!;
    const res = pc.requestUse(bench);
    expect(res).not.toBe('unreachable');
    const arrived = res === 'walking' ? simulate(pc, 20) : [res];
    expect(arrived[0]).toMatchObject({ kind: 'sit' });
    expect(pc.sitOn(bench)).toBe(true);
    expect(pc.seat).not.toBeNull();
    pc.update(1 / 60, { x: 0, y: 1 });
    expect(pc.seat).toBeNull();
    expect(world.grid.isWalkable(Math.floor(pc.pos.x), Math.floor(pc.pos.y))).toBe(true);
  });

  it('le clavier ne permet pas de traverser un mur', () => {
    const world = loadWorld('hub');
    const pc = new PlayerController(world, 'me', { x: 3.5, y: 7.5 }, 'ny');
    for (let i = 0; i < 300; i++) pc.update(1 / 60, { x: 0, y: 1 });
    expect(pc.pos.y).toBeLessThan(9);
  });
});
