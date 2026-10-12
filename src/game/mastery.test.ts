import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ENEMIES, ITEMS, PASSIVES, masteryLevelsForRank, masteryRank } from './content';
import { applyProgress, canDrop, creditMastery, initialProfile, newRun, passiveChoices, rollLoot } from './engine';
import type { RunState } from './types';

const at = (hero: 'warrior' | 'assassin', level: number, extra: Partial<RunState> = {}): RunState => ({ ...newRun(hero), level, ...extra });

describe('class mastery', () => {
  it('derives rank from cumulative levels gained', () => {
    expect(masteryRank(0)).toBe(0);
    expect(masteryRank(masteryLevelsForRank(1) - 1)).toBe(0);
    expect(masteryRank(masteryLevelsForRank(3))).toBe(3);
    expect(masteryRank(10_000)).toBe(10);
  });

  it('credits levels once per run and per class', () => {
    const first = creditMastery(initialProfile(), at('warrior', 6));
    expect(first.profile.mastery.warrior).toBe(5);
    expect(first.profile.mastery.assassin).toBe(0);
    const again = creditMastery(first.profile, first.run);
    expect(again.profile.mastery.warrior).toBe(5);
    const later = creditMastery(again.profile, { ...again.run, level: 9 });
    expect(later.profile.mastery.warrior).toBe(8);
  });

  it('does not credit developer runs', () => {
    expect(creditMastery(initialProfile(), at('warrior', 8, { developerMode: true })).profile.mastery.warrior).toBe(0);
  });

  it('unlocks class passives only for the matching class at the right rank', () => {
    const base = initialProfile();
    const rich = { ...base, mastery: { warrior: masteryLevelsForRank(5), assassin: 0 } };
    const warrior = { ...at('warrior', 5), rngState: 12345 };
    const offered = new Set<string>();
    for (let seed = 1; seed < 80; seed++) for (const id of passiveChoices({ ...warrior, rngState: seed }, rich)) offered.add(id);
    expect(offered.has('war-cry')).toBe(true);
    expect(offered.has('living-bastion')).toBe(true);
    for (const id of offered) expect(['warrior', 'both']).toContain(PASSIVES.find((p) => p.id === id)!.hero);
    const poor = new Set<string>();
    for (let seed = 1; seed < 80; seed++) for (const id of passiveChoices({ ...warrior, rngState: seed }, base)) poor.add(id);
    expect(poor.has('war-cry')).toBe(false);
  });
});

describe('achievements', () => {
  it('has every achievement reachable and rewards defined', () => {
    for (const achievement of ACHIEVEMENTS) expect(achievement.unlocks?.length ?? 0).toBeGreaterThanOrEqual(0);
    for (const item of ITEMS.filter((entry) => entry.unlockAchievement)) {
      expect(ACHIEVEMENTS.some((a) => a.id === item.unlockAchievement && a.unlocks?.includes(item.id))).toBe(true);
    }
  });

  it('unlocks class-specific achievements only for that class', () => {
    expect(applyProgress(initialProfile(), at('assassin', 10)).profile.achievements).not.toContain('warrior-level-10');
    const warrior = applyProgress(initialProfile(), at('warrior', 10)).profile;
    expect(warrior.achievements).toEqual(expect.arrayContaining(['level-10', 'warrior-level-10']));
    expect(warrior.unlockedPassives).toContain('stone-heart');
  });

  it('gates new loot behind achievements and adds it to monster tables', () => {
    const profile = initialProfile();
    expect(canDrop('slime-core', profile)).toBe(false);
    expect(ENEMIES.find((e) => e.id === 'slime')!.loot.some((d) => d.itemId === 'slime-core')).toBe(true);
    const unlocked = applyProgress(profile, at('warrior', 1, { defeatedBosses: ['meadow-boss'] })).profile;
    expect(canDrop('slime-core', unlocked)).toBe(true);
    let found = false;
    for (let seed = 1; seed < 400 && !found; seed++) {
      const { drops } = rollLoot({ ...newRun('warrior', seed), rngState: seed }, 'meadow-boss', unlocked);
      found = drops.includes('slime-core');
    }
    expect(found).toBe(true);
    for (let seed = 1; seed < 300; seed++) {
      expect(rollLoot({ ...newRun('warrior', seed), rngState: seed }, 'meadow-boss', profile).drops).not.toContain('slime-core');
    }
  });

  it('chains mastery achievements to their rewards', () => {
    const profile = { ...initialProfile(), mastery: { warrior: masteryLevelsForRank(4), assassin: 0 } };
    const result = applyProgress(profile, at('warrior', 1)).profile;
    expect(result.achievements).toContain('warrior-mastery-4');
    expect(result.unlockedItems).toContain('war-banner');
  });
});
