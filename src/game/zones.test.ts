import { describe, expect, it } from 'vitest';
import { ENEMIES, ZONES } from './content';
import { newRun, rollEncounter } from './engine';
import { BOSS_POSITIONS, zoneAt } from './world';

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

  it('places every zone boss inside its own zone and defines it as an enemy', () => {
    for (const zone of ZONES) {
      const position = BOSS_POSITIONS[zone.boss];
      expect(position).toBeDefined();
      expect(zoneAt(position.x, position.y).id).toBe(zone.id);
      expect(ENEMIES.some((enemy) => enemy.id === zone.boss)).toBe(true);
    }
  });

  it('forms a progression chain where each zone needs the previous boss', () => {
    expect(ZONES[0].requires).toBeNull();
    for (let index = 1; index < ZONES.length; index++) expect(ZONES[index].requires).toBe(ZONES[index - 1].boss);
  });
});
