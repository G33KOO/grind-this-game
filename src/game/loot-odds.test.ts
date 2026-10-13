import { describe, expect, it } from 'vitest';
import { equipItem, initialProfile, lootOdds, newRun, rollLoot, useConsumable } from './engine';
import { ITEMS } from './content';

describe('displayed loot probabilities', () => {
  it('excludes locked rewards and normalizes probabilities per kill', () => {
    const odds = lootOdds(newRun('warrior', 7), 'slime', initialProfile());
    expect(odds.entries.find((entry) => entry.itemId === 'slime-core')?.probability).toBe(0);
    expect(odds.entries.reduce((sum, entry) => sum + entry.probability, 0)).toBeCloseTo(odds.chance);
    expect(odds.chance).toBeCloseTo(0.12);
  });

  it('matches actual seeded drop frequencies, including no drop', () => {
    const profile = { ...initialProfile(), achievements: ['meadow-slain'] };
    let run = newRun('warrior', 12345);
    run.invested = { luck: 10 };
    const owned = run.inventory;
    const odds = lootOdds(run, 'slime', profile);
    const counts = new Map<string, number>();
    for (let index = 0; index < 20000; index++) {
      const result = rollLoot(run, 'slime', profile);
      const id = result.drops[0] ?? 'none';
      counts.set(id, (counts.get(id) ?? 0) + 1);
      run = { ...result.run, inventory: owned };
    }
    for (const entry of odds.entries) expect(Math.abs((counts.get(entry.itemId) ?? 0) / 20000 - entry.probability)).toBeLessThan(0.01);
    expect(Math.abs((counts.get('none') ?? 0) / 20000 - (1 - odds.chance))).toBeLessThan(0.01);
  });

  it('excludes both starting equipment and bag items and redistributes their odds', () => {
    const run = newRun('warrior');
    const odds = lootOdds(run, 'bandit', initialProfile());
    for (const id of ['iron-sword']) {
      const entry = odds.entries.find((entry) => entry.itemId === id)!;
      expect(entry.owned).toBe(true);
      expect(entry.eligible).toBe(false);
      expect(entry.probability).toBe(0);
    }
    expect(odds.entries.find((entry) => entry.itemId === 'wolf-tooth')?.probability).toBeCloseTo(odds.chance / 3);
    const potion = odds.entries.find((entry) => entry.itemId === 'small-potion')!;
    expect(potion.owned).toBe(true);
    expect(potion.eligible).toBe(true);
    expect(potion.probability).toBeCloseTo(odds.chance * 2 / 3);
  });

  it('blocks an artifact while it is in the bag and while it is equipped', () => {
    const initial = newRun('warrior');
    const run = { ...initial, inventory: [...initial.inventory, { instanceId: 'tooth', itemId: 'wolf-tooth' }] };
    for (const state of [run, equipItem(run, 'tooth', 'charm2')]) {
      const odds = lootOdds(state, 'wolf', initialProfile());
      expect(odds.entries.filter((entry) => entry.itemId === 'wolf-tooth').every((entry) => entry.owned && entry.probability === 0)).toBe(true);
    }
  });

  it('keeps dropping potions when all non-consumable rewards are already owned', () => {
    const initial = newRun('warrior');
    const run = { ...initial, inventory: [...initial.inventory, { instanceId: 'tooth', itemId: 'wolf-tooth' }] };
    expect(lootOdds(run, 'bandit', initialProfile()).chance).toBeGreaterThan(0);
    let state = run;
    for (let kill = 0; kill < 1000; kill++) {
      const result = rollLoot(state, 'bandit', initialProfile());
      expect(result.drops.every((id) => id === 'small-potion')).toBe(true);
      state = result.run;
    }
    expect(state.inventory.filter((item) => item.itemId === 'small-potion').length).toBeGreaterThan(2);
    expect(new Set(state.inventory.map((item) => item.instanceId)).size).toBe(state.inventory.length);
  });

  it('prevents duplicate equipment while allowing repeated consumables', () => {
    let run = newRun('warrior', 42);
    for(let kill=0;kill<1000;kill++) {
      const owned = new Set(run.inventory.map((item) => item.itemId));
      const result = rollLoot(run, 'bandit', initialProfile());
      expect(result.drops.every((id) => !owned.has(id) || ITEMS.find((item) => item.id === id)?.slot === 'consumable')).toBe(true);
      run = result.run;
    }
    expect(run.inventory.some((item) => item.itemId === 'wolf-tooth')).toBe(true);
    const equipment = run.inventory.filter((entry) => ITEMS.find((item) => item.id === entry.itemId)?.slot !== 'consumable');
    expect(new Set(equipment.map((item) => item.itemId)).size).toBe(equipment.length);
  });

  it('allows a consumed potion to drop again after the player no longer owns it', () => {
    const run = { ...newRun('warrior'), hp: 30 };
    expect(lootOdds(run, 'slime', initialProfile()).entries.find((entry) => entry.itemId === 'small-potion')?.eligible).toBe(true);
    const consumed = useConsumable(run, 'starter-potion');
    const odds = lootOdds(consumed, 'slime', initialProfile());
    expect(odds.entries.find((entry) => entry.itemId === 'small-potion')?.probability).toBeGreaterThan(0);
    let dropped = false;
    for(let seed=1;seed<=1000&&!dropped;seed++)dropped=rollLoot({ ...consumed, rngState: seed }, 'slime', initialProfile()).drops.includes('small-potion');
    expect(dropped).toBe(true);
  });

  it('allows multiple large potions as well', () => {
    const initial = newRun('warrior', 42);
    const run = { ...initial, inventory: [...initial.inventory, { instanceId: 'large-potion', itemId: 'greater-potion' }] };
    const entry = lootOdds(run, 'drake', initialProfile()).entries.find((item) => item.itemId === 'greater-potion')!;
    expect(entry.owned).toBe(true);
    expect(entry.eligible).toBe(true);
    expect(entry.probability).toBeGreaterThan(0);
  });
});
