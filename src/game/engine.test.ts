import { describe, expect, it } from 'vitest';
import { BALANCE, ENEMIES, validateContent } from './content';
import {
  addAchievements, advanceEncounter, allocatePoints, canDrop, decodeRun, deriveStats,
  damageAfterDefense, equipItem, gainExperience, initialProfile, newRun, respecStats, rollLoot,
  startCombat, stepCombat, validateRun,
} from './engine';
import type { CombatState, RunState } from './types';

describe('content and core rules', () => {
  it('validates all authored content references', () => {
    expect(validateContent()).toEqual([]);
  });

  it('uses speed only for initiative, with one action per fighter per round', () => {
    const run = newRun('assassin', 42);
    const combat = startCombat(run, ['slime']);
    expect(combat.playerNextAction).toBe(1);
    expect(combat.enemies[0].nextAction).toBe(2);
    const next = stepCombat(combat);
    expect(next.time).toBe(1);
    expect(next.playerNextAction).toBe(3);
    expect(next.enemies[0].nextAction).toBe(2);
  });

  it('resolves multiple enemies independently and keeps stable tie ordering', () => {
    const combat = startCombat(newRun('assassin', 8), ['rat', 'rat']);
    const enemyTime = combat.enemies[0].nextAction;
    const next = stepCombat(combat);
    expect(next.time).toBeLessThan(enemyTime);
    expect(next.enemies.map((enemy) => enemy.unitId)).toEqual(['rat-0', 'rat-1']);
    const enemyTurn = stepCombat({ ...combat, playerNextAction: 99 });
    expect(enemyTurn.log.at(-1)).toContain('Rat des ruines');
    expect(enemyTurn.enemies[0].nextAction).toBeGreaterThan(enemyTime);
    expect(enemyTurn.enemies[1].nextAction).toBe(combat.enemies[1].nextAction);
  });

  it('clamps defense reduction and never returns non-positive damage', () => {
    expect(damageAfterDefense(20, 0)).toBe(20);
    expect(damageAfterDefense(20, 100)).toBe(10);
    expect(damageAfterDefense(20, 10000)).toBeGreaterThanOrEqual(1);
    expect(damageAfterDefense(-3, 20)).toBe(1);
  });

  it('spends only available stat points and recomputes the total', () => {
    const run = { ...newRun('warrior'), unspentPoints: 3 };
    const updated = allocatePoints(run, 'strength', 5);
    expect(updated.unspentPoints).toBe(0);
    expect(updated.invested.strength).toBe(3);
    expect(deriveStats(updated).strength).toBe(14);
    const reset = respecStats(updated);
    expect(reset.unspentPoints).toBe(3);
    expect(reset.invested.strength).toBeUndefined();
    expect(deriveStats(reset).strength).toBe(11);
  });

  it('refunds fully spent statistics at any time, preserves gear, and clamps health', () => {
    const base = newRun('warrior');
    const invested = { ...base, unspentPoints: 0, invested: { strength: 4, maxHp: 15 } };
    const run = { ...invested, hp: deriveStats(invested).maxHp };
    const reset = respecStats(run);
    expect(reset.unspentPoints).toBe(19);
    expect(reset.invested).toEqual({});
    expect(reset.hp).toBe(deriveStats(base).maxHp);
    expect(reset.inventory).toEqual(run.inventory);
    expect(reset.equipment).toEqual(run.equipment);
    expect(reset.passives).toEqual(run.passives);
    expect(respecStats(reset).unspentPoints).toBe(19);
    expect(allocatePoints(reset, 'defense', 19).unspentPoints).toBe(0);
  });

  it('applies critical, shield, poison, lifesteal, cleave and additional strike without chaining', () => {
    const combat: CombatState = {
      ...startCombat(newRun('warrior', 13), ['slime', 'rat']),
      playerNextAction: 0.1,
      playerHp: 60,
      playerMaxHp: 125,
      shield: 30,
      playerStats: { ...startCombat(newRun('warrior', 13), ['slime']).playerStats, strength: 9, critChance: 100, critDamage: 200 },
      playerEffects: [
        { kind: 'lifesteal', ratio: 0.1 }, { kind: 'poison', damage: 4, turns: 2 },
        { kind: 'cleave', ratio: 0.5 }, { kind: 'extraStrike', ratio: 0.5 },
      ],
    };
    const next = stepCombat(combat);
    expect(next.playerHp).toBeGreaterThan(60);
    expect(next.enemies[0].currentHp).toBeLessThan(ENEMIES.find((enemy) => enemy.id === 'slime')!.hp);
    expect(next.enemies[0].poisonTurns).toBe(2);
    expect(next.enemies[1].currentHp).toBeLessThan(ENEMIES.find((enemy) => enemy.id === 'rat')!.hp);
    expect(next.log.join(' ')).toContain('critique');
    expect(next.log.join(' ')).toContain('supplémentaire');
    expect(next.log.join(' ')).toContain('zone');
  });

  it('ticks poison on the enemy timeline and consumes shields before health', () => {
    let combat = startCombat(newRun('warrior', 21), ['slime']);
    combat = {
      ...combat,
      playerHp: 80,
      shield: 40,
      playerStats: { ...combat.playerStats, strength: 1, critChance: 0 },
      playerEffects: [{ kind: 'poison', damage: 7, turns: 2 }, { kind: 'lifesteal', ratio: 1 }],
    };
    const playerTurn = stepCombat(combat);
    expect(playerTurn.playerHp).toBe(81);
    expect(playerTurn.enemies[0].poisonTurns).toBe(2);
    const enemyTurn = stepCombat(playerTurn);
    expect(enemyTurn.enemies[0].currentHp).toBeLessThan(playerTurn.enemies[0].currentHp);
    expect(enemyTurn.playerHp).toBe(81);
    expect(enemyTurn.shield).toBeLessThan(40);
    expect(enemyTurn.log.join(' ')).toContain('poison');
  });

  it('recomputes stats from currently equipped items rather than stacking stale bonuses', () => {
    let run = newRun('warrior');
    run = equipItem({
      ...run, inventory: [...run.inventory, { instanceId: 'test-charm', itemId: 'wolf-tooth' }],
    }, 'test-charm', 'charm');
    expect(deriveStats(run).strength).toBe(HEROES_STAT_STRENGTH + 2);
    const unequipped = { ...run, equipment: { ...run.equipment, charm: undefined } };
    expect(deriveStats(unequipped).strength).toBe(HEROES_STAT_STRENGTH);
  });

  it('never allows locked objects into loot rolls', () => {
    const profile = initialProfile();
    expect(canDrop('wraith-mail', profile)).toBe(false);
    expect(canDrop('iron-sword', profile)).toBe(true);
    let state = newRun('warrior', 27);
    for (let i = 0; i < 400; i++) {
      const result = rollLoot(state, 'final-boss', profile);
      state = result.run;
      expect(result.drops).not.toContain('wraith-mail');
      expect(result.drops).not.toContain('vampire-seal');
    }
  });

  it('levels up without random passive choices or changing the starting passive', () => {
    const initial = newRun('warrior');
    const run = gainExperience({ ...initial, pendingPassivePicks: 4 }, 1_000_000);
    expect(run.level).toBeGreaterThan(10);
    expect(run.unspentPoints).toBe((run.level - 1) * 2);
    expect(run.pendingPassivePicks).toBe(0);
    expect(run.passives).toEqual(initial.passives);
  });

  it('clears legacy pending choices when loading and preserves acquired passives', () => {
    const old = { ...newRun('warrior'), pendingPassivePicks: 3, passives: [{ id: 'fortress', rank: 2 }] };
    const migrated = decodeRun(JSON.stringify(old));
    expect(migrated.pendingPassivePicks).toBe(0);
    expect(migrated.passives).toEqual(old.passives);
  });

  it('makes encounters independent of movement update chunking', () => {
    const profile = initialProfile();
    const start = newRun('warrior', 5);
    let whole = advanceEncounter(start, 500, profile);
    let divided = { run: start, triggered: false };
    for (const distance of [13, 41, 42, 87, 103, 114, 100]) {
      if (divided.triggered) break;
      divided = advanceEncounter(divided.run, distance, profile);
    }
    expect(divided.triggered).toBe(whole.triggered);
    expect(divided.run.rngState).toBe(whole.run.rngState);
    expect(divided.run.encounterMeter).toBeCloseTo(whole.run.encounterMeter);
    expect(divided.run.distanceSinceEncounterCheck).toBeCloseTo(whole.run.distanceSinceEncounterCheck);
  });

  it('fills danger twice as fast and guarantees an encounter within the shorter walking distance', () => {
    const profile = initialProfile();
    const start = newRun('warrior', 42);
    const firstSteps = advanceEncounter(start, 32, profile);
    expect(firstSteps.triggered).toBe(false);
    expect(firstSteps.run.encounterMeter).toBeCloseTo(32 * .0013);
    expect(advanceEncounter(start, 0, profile).run.encounterMeter).toBe(0);
    for (let seed = 1; seed <= 100; seed++) {
      const result = advanceEncounter(newRun('warrior', seed), Math.ceil(1 / BALANCE.encounterMeterChancePerUnit / BALANCE.encounterCheckDistance) * BALANCE.encounterCheckDistance, profile);
      expect(result.triggered).toBe(true);
      expect(result.run.encounterMeter).toBe(0);
    }
  });

  it('is deterministic for identical seeds and migrates the supported old save shape', () => {
    const initial = startCombat(newRun('assassin', 912), ['wolf', 'slime']);
    const repeat = startCombat(newRun('assassin', 912), ['wolf', 'slime']);
    let left = initial;
    let right = repeat;
    for (let i = 0; i < 30 && left.over === 'none'; i++) {
      left = stepCombat(left);
      right = stepCombat(right);
      expect(right).toEqual(left);
    }
    const migrated = decodeRun(JSON.stringify({ version: 0, hero: 'assassin', hp: 32, position: { x: 9, y: 12 } }));
    expect(migrated.hero).toBe('assassin');
    expect(migrated.hp).toBe(32);
    expect(() => validateRun({ version: 8 })).toThrow(/corrompue/);
  });

  it('migrates legacy item IDs into distinct serialized item instances', () => {
    const old = newRun('warrior');
    const migrated = decodeRun(JSON.stringify({
      ...old, version: 1, inventory: ['iron-sword', 'iron-sword', 'small-potion'],
      equipment: { weapon: 'iron-sword' }, pendingCombat: undefined,
    }));
    expect(migrated.version).toBe(2);
    expect(new Set(migrated.inventory.map((entry) => entry.instanceId)).size).toBe(3);
    expect(migrated.equipment.weapon).toBe(migrated.inventory[0].instanceId);
  });

  it('updates permanent achievements after boss wins and keeps equipment unlock eligibility gated', () => {
    const won: RunState = { ...newRun('warrior'), kills: 10, defeatedBosses: ['final-boss'] };
    const profile = addAchievements(initialProfile(), won);
    expect(profile.achievements).toEqual(expect.arrayContaining(['first-kill', 'ten-kills', 'first-boss']));
    expect(profile.unlockedItems).toEqual(expect.arrayContaining(['glass-eye', 'wraith-mail']));
    expect(canDrop('wraith-mail', profile)).toBe(true);
  });
});

const HEROES_STAT_STRENGTH = 11;
