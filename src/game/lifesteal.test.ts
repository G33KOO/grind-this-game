import { describe, expect, it } from 'vitest';
import { newRun, startCombat, stepCombat } from './engine';
import type { CombatState } from './types';

function wounded(): CombatState {
  const combat = startCombat(newRun('warrior', 42, { weapon: 'iron-sword', passive: 'battle-heart' }), ['golem']);
  return { ...combat, playerHp: 50, playerNextAction: 0, enemies: combat.enemies.map(enemy => ({ ...enemy, defense: 0, nextAction: 99 })), playerStats: { ...combat.playerStats, strength: 5, critChance: 0, speed: 10 } };
}

describe('lifesteal', () => {
  it('preserves sub-HP healing across attacks instead of rounding every hit to zero', () => {
    let combat = wounded();
    combat = stepCombat(combat);
    expect(combat.playerHp).toBe(50);
    expect(combat.lifestealRemainder).toBeCloseTo(.4);
    combat = stepCombat(combat);
    expect(combat.playerHp).toBe(50);
    combat = stepCombat(combat);
    expect(combat.playerHp).toBe(51);
    expect(combat.log.join(' ')).toContain('Vol de vie : +1 PV.');
    combat = stepCombat(stepCombat(combat));
    expect(combat.playerHp).toBe(52);
    expect(combat.lifestealRemainder).toBeCloseTo(0);
  });

  it('keeps the fractional credit while enemies act', () => {
    const first = stepCombat(wounded());
    const enemyTurn = stepCombat({ ...first, playerNextAction: 100 });
    expect(enemyTurn.playerHp).toBeLessThan(first.playerHp);
    expect(enemyTurn.lifestealRemainder).toBeCloseTo(.4);
  });

  it('preserves fractional healing through consecutive short fights and a saved run', () => {
    let run = { ...newRun('warrior', 42, { weapon: 'iron-sword', passive: 'battle-heart' }), hp: 50, lifestealRemainder: 0 };
    for (let fight = 0; fight < 7; fight++) {
      const combat = startCombat(run, ['rat']);
      const victory = stepCombat({ ...combat, playerNextAction: 0, enemies: [{ ...combat.enemies[0], currentHp: 2 }] });
      expect(victory.over).toBe('win');
      run = JSON.parse(JSON.stringify({ ...run, hp: victory.playerHp, lifestealRemainder: victory.lifestealRemainder }));
    }
    expect(run.hp).toBe(51);
    expect(run.lifestealRemainder).toBeCloseTo(.12);
  });

  it('includes direct extra strikes and area damage, without healing from poison ticks', () => {
    let combat = wounded();
    combat = { ...combat, playerStats: { ...combat.playerStats, strength: 10 }, enemies: [...combat.enemies, { ...combat.enemies[0], unitId: 'golem-1' }], playerEffects: [{ kind: 'lifesteal', ratio: .1 }, { kind: 'extraStrike', ratio: .4 }, { kind: 'cleave', ratio: .5 }, { kind: 'poison', damage: 10, turns: 2 }] };
    const attack = stepCombat(combat);
    expect(attack.playerHp).toBe(51);
    expect(attack.lifestealRemainder).toBeCloseTo(.9); // (10 + 4 + 5) × 10 %
    const poisonTurn = stepCombat({ ...attack, playerNextAction: 100, shield: 100 });
    expect(poisonTurn.playerHp).toBe(51);
    expect(poisonTurn.lifestealRemainder).toBeCloseTo(.9);
  });

  it('heals from actual damage including critical hits and the killing blow, excluding overkill', () => {
    const combat = wounded();
    const critical = stepCombat({ ...combat, playerStats: { ...combat.playerStats, critChance: 100, critDamage: 200 }, playerEffects: [{ kind: 'lifesteal', ratio: .2 }] });
    expect(critical.playerHp).toBe(52); // 10 dégâts réels
    const kill = stepCombat({ ...combat, enemies: [{ ...combat.enemies[0], currentHp: 2 }], playerEffects: [{ kind: 'lifesteal', ratio: 1 }] });
    expect(kill.playerHp).toBe(52);
    expect(kill.over).toBe('win');
  });

  it('caps health and never banks healing while already at full health', () => {
    const combat = wounded();
    const full = stepCombat({ ...combat, playerHp: combat.playerMaxHp, lifestealRemainder: .9 });
    expect(full.playerHp).toBe(combat.playerMaxHp);
    expect(full.lifestealRemainder).toBe(0);
    const later = stepCombat({ ...full, playerHp: 50 });
    expect(later.playerHp).toBe(50);
    expect(later.lifestealRemainder).toBeCloseTo(.4);
    const capped = stepCombat({ ...combat, playerHp: combat.playerMaxHp - 1, playerEffects: [{ kind: 'lifesteal', ratio: 1 }] });
    expect(capped.playerHp).toBe(combat.playerMaxHp);
    expect(capped.lifestealRemainder).toBe(0);
  });
});
