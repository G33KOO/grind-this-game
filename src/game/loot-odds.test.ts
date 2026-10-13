import { describe, expect, it } from 'vitest';
import { initialProfile, lootOdds, newRun, rollLoot } from './engine';

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
    const odds = lootOdds(run, 'slime', profile);
    const counts = new Map<string, number>();
    for (let index = 0; index < 20000; index++) {
      const result = rollLoot(run, 'slime', profile);
      const id = result.drops[0] ?? 'none';
      counts.set(id, (counts.get(id) ?? 0) + 1);
      run = { ...result.run, inventory: [] };
    }
    for (const entry of odds.entries) expect(Math.abs((counts.get(entry.itemId) ?? 0) / 20000 - entry.probability)).toBeLessThan(0.01);
    expect(Math.abs((counts.get('none') ?? 0) / 20000 - (1 - odds.chance))).toBeLessThan(0.01);
  });
});
