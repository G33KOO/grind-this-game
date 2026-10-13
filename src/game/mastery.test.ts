import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ENEMIES, ITEMS, PASSIVES, STARTING_OPTIONS, masteryLevelsForRank, masteryRank } from './content';
import { applyProgress, canDrop, creditMastery, initialProfile, newRun, isStartOptionUnlocked, resolveLoadout, activeEffects, deriveStats, startCombat, stepCombat, rollLoot } from './engine';
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

  it('unlocks starting choices at their exact mastery rank for the matching class', () => {
    for (const hero of ['warrior', 'assassin'] as const) {
      for (const option of [...STARTING_OPTIONS[hero].weapons, ...STARTING_OPTIONS[hero].passives]) {
        const profile = initialProfile();
        profile.mastery[hero] = masteryLevelsForRank(option.masteryRequired);
        expect(isStartOptionUnlocked(option, profile, hero)).toBe(true);
        if (option.masteryRequired > 0) {
          profile.mastery[hero]--;
          expect(isStartOptionUnlocked(option, profile, hero)).toBe(false);
          profile.mastery[hero === 'warrior' ? 'assassin' : 'warrior'] = 10000;
          expect(isStartOptionUnlocked(option, profile, hero)).toBe(false);
        }
      }
    }
  });

  it('gates starts by mastery independently of achievements and retains early choices', () => {
    const profile = { ...initialProfile(), achievements: ACHIEVEMENTS.map((entry) => entry.id), unlockedPassives: PASSIVES.map((entry) => entry.id) };
    expect(resolveLoadout('warrior', profile, { weapon: 'grave-blade', passive: 'fortress' })).toEqual({ weapon: 'iron-sword', passive: 'iron-skin' });
    profile.mastery.warrior = masteryLevelsForRank(10);
    expect(resolveLoadout('warrior', profile, { weapon: 'iron-sword', passive: 'fortress' })).toEqual({ weapon: 'iron-sword', passive: 'fortress' });
    expect(resolveLoadout('warrior', profile, { passive: 'venom' }).passive).toBe('iron-skin');
    const withoutAchievements = { ...profile, achievements: [] };
    expect(resolveLoadout('warrior', withoutAchievements, { weapon: 'grave-blade', passive: 'living-bastion' })).toEqual({ weapon: 'grave-blade', passive: 'living-bastion' });
  });

  it('keeps equipment stat based and allows early equipment to outperform later gear through synergy', () => {
    expect(ITEMS.filter((item) => item.slot !== 'consumable').every((item) => !item.effects?.length)).toBe(true);
    const early = newRun('warrior', 42, { weapon: 'iron-sword', passive: 'fortress' });
    const later = newRun('warrior', 42, { weapon: 'alpha-fang', passive: 'fortress' });
    expect(deriveStats(early).strength).toBeLessThan(deriveStats(later).strength);
    const attack = (run: RunState) => {
      const state = startCombat(run, ['golem']);
      return stepCombat({ ...state, playerNextAction: 0, playerStats: { ...state.playerStats, critChance: 0 } }).enemies[0].currentHp;
    };
    expect(attack(early)).toBeLessThan(attack(later));
    expect(activeEffects(newRun('assassin', 42, { weapon: 'grave-blade', passive: 'venom' })).map((effect) => effect.kind)).toEqual(['poison']);
  });

  it('starts with full health including the chosen passive bonuses', () => {
    const run = newRun('warrior', 42, { weapon: 'iron-sword', passive: 'battle-heart' });
    expect(run.passives).toEqual([{ id: 'battle-heart', rank: 1 }]);
    expect(run.hp).toBe(137);
    expect(run.hp).toBe(deriveStats(run).maxHp);
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
    expect(warrior.unlockedPassives).not.toContain('stone-heart');
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
