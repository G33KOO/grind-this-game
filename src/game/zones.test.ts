import { describe, expect, it } from 'vitest';
import { ENEMIES, ZONES } from './content';
import { newRun, rollEncounter } from './engine';
import { BOSS_POSITIONS, PATHS, SECRET_POSITIONS, WORLD_START, ZONE_SHAPES, isWalkable, zoneAt } from './world';

describe('contained tunnel layout', () => {
  it('keeps key points inside walkable space', () => {
    const points = [WORLD_START, ...Object.values(BOSS_POSITIONS), ...Object.values(SECRET_POSITIONS), ...Object.values(ZONE_SHAPES)];
    for (const point of points) expect(isWalkable(point.x, point.y, 30)).toBe(true);
  });

  it('keeps every corridor continuously walkable', () => {
    for (const { from, to } of PATHS) {
      for (let step = 0; step <= 100; step++) {
        const t = step / 100;
        expect(isWalkable(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 40)).toBe(true);
      }
    }
  });

  it('has solid walls outside the rooms', () => {
    expect(isWalkable(5, 5)).toBe(false);
    expect(isWalkable(1200, 900)).toBe(false);
  });
});

describe('zones, groups and bosses', () => {
  it('never rolls more enemies than the zone allows and only zone enemies', () => {
    for (const zone of ZONES) {
      let run = newRun('warrior', 7);
      for (let index = 0; index < 300; index++) {
        const result = rollEncounter(run, zone.id);
        run = result.run;
        expect(result.enemies.length).toBeGreaterThanOrEqual(1);
        expect(result.enemies.length).toBeLessThanOrEqual(zone.maxGroup);
        for (const id of result.enemies) expect(zone.enemies).toContain(id);
      }
    }
  });

  it('keeps the first zone to single-enemy encounters', () => {
    expect(ZONES[0].maxGroup).toBe(1);
  });

  it('places each gate boss in the middle of the corridor leading to the next zone', () => {
    PATHS.forEach(({ from, to }, index) => {
      const position = BOSS_POSITIONS[ZONES[index].boss];
      expect(position).toEqual({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
      expect(isWalkable(position.x, position.y, 30)).toBe(true);
    });
    const last = ZONES[ZONES.length - 1];
    expect(zoneAt(BOSS_POSITIONS[last.boss].x, BOSS_POSITIONS[last.boss].y).id).toBe(last.id);
  });

  it('defines every zone boss as an enemy', () => {
    for (const zone of ZONES) expect(ENEMIES.some((enemy) => enemy.id === zone.boss)).toBe(true);
  });

  it('forms a progression chain where each zone needs the previous boss', () => {
    expect(ZONES[0].requires).toBeNull();
    for (let index = 1; index < ZONES.length; index++) expect(ZONES[index].requires).toBe(ZONES[index - 1].boss);
  });
});
