import { afterEach, describe, expect, it } from 'vitest';
import { initialProfile, newRun, rememberLoadout, resolveLoadout } from './engine';
import { masteryLevelsForRank } from './content';
import { loadProfile, loadRun, saveProfile, saveRun } from './save';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const storage = new MemoryStorage();
const installBrowserStubs = () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { gamePlatform: undefined } });
};
const clearStorage = () => {
  storage.removeItem('grind-this-game.run');
  storage.removeItem('grind-this-game.run.backup');
  storage.removeItem('grind-this-game.profile');
};

describe('versioned local run saves', () => {
  afterEach(clearStorage);

  it('round-trips an active run through local storage', async () => {
    installBrowserStubs();
    const run = newRun('assassin', 42);
    await saveRun(run);
    expect(await loadRun()).toEqual(run);
  });

  it('recovers a corrupt current save from the last valid backup', async () => {
    installBrowserStubs();
    const original = newRun('warrior', 17);
    await saveRun(original);
    await saveRun({ ...original, level: 2 });
    storage.setItem('grind-this-game.run', '{bad json');
    expect(await loadRun()).toEqual(original);
  });

  it('reports corruption when both the save and its backup are invalid', async () => {
    installBrowserStubs();
    storage.setItem('grind-this-game.run', '{bad json');
    storage.setItem('grind-this-game.run.backup', 'also bad');
    await expect(loadRun()).rejects.toThrow(/corrompue/);
  });

  it('does not revive the previous run after a death clears its active slot', async () => {
    installBrowserStubs();
    await saveRun(newRun('warrior', 9));
    await saveRun(null);
    expect(await loadRun()).toBeNull();
  });

  it('does not retain a pre-death backup after a new run starts', async () => {
    installBrowserStubs();
    await saveRun(newRun('warrior', 10));
    await saveRun(null);
    await saveRun(newRun('assassin', 11));
    storage.setItem('grind-this-game.run', 'corrupt');
    await expect(loadRun()).rejects.toThrow(/corrompue/);
  });

  it('reports a malformed permanent profile instead of silently resetting unlocks', () => {
    installBrowserStubs();
    storage.setItem('grind-this-game.profile', '{"version":1,"achievements":[]}');
    expect(() => loadProfile()).toThrow(/profil permanent/);
  });

  it('remembers independent loadouts across reloads and clearing a run', async () => {
    installBrowserStubs();
    const profile = { ...initialProfile(), mastery: { warrior: masteryLevelsForRank(4), assassin: masteryLevelsForRank(4) } };
    const warrior = { weapon: 'ember-edge', passive: 'battle-heart' };
    const assassin = { weapon: 'duelist-blade', passive: 'bloodletting' };
    saveProfile(rememberLoadout(rememberLoadout(profile, 'warrior', warrior), 'assassin', assassin));
    await saveRun(newRun('warrior', 42, warrior));
    await saveRun(null);
    expect(resolveLoadout('warrior', loadProfile())).toEqual(warrior);
    expect(resolveLoadout('assassin', loadProfile())).toEqual(assassin);
    const restarted = newRun('assassin', 43, resolveLoadout('assassin', loadProfile()));
    expect(restarted.inventory[0].itemId).toBe(assassin.weapon);
    expect(restarted.passives[0].id).toBe(assassin.passive);
  });

  it('updates a saved choice without changing the other class or profile progress', () => {
    installBrowserStubs();
    const profile = { ...initialProfile(), mastery: { warrior: 0, assassin: masteryLevelsForRank(4) }, achievements: ['meadow-slain'] };
    const first = rememberLoadout(profile, 'assassin', { weapon: 'duelist-blade', passive: 'bloodletting' });
    saveProfile(rememberLoadout(first, 'assassin', { weapon: 'duelist-blade', passive: 'venom' }));
    const loaded = loadProfile();
    expect(resolveLoadout('assassin', loaded)).toEqual({ weapon: 'duelist-blade', passive: 'venom' });
    expect(loaded.mastery).toEqual(profile.mastery);
    expect(loaded.achievements).toEqual(profile.achievements);
    expect(resolveLoadout('warrior', loaded)).toEqual(resolveLoadout('warrior', profile));
  });

  it('loads old profiles with the class defaults', () => {
    installBrowserStubs();
    saveProfile(initialProfile());
    const loaded = loadProfile();
    for (const hero of ['warrior', 'assassin'] as const) {
      expect(resolveLoadout(hero, loaded)).toEqual(resolveLoadout(hero, initialProfile(), {}));
    }
  });

  it('discards invalid or locked selections without losing a valid selection', () => {
    installBrowserStubs();
    const profile = { ...initialProfile(), mastery: { warrior: 0, assassin: masteryLevelsForRank(4) } };
    storage.setItem('grind-this-game.profile', JSON.stringify({ ...profile, startingLoadouts: {
      warrior: { weapon: 'grave-blade', passive: 'unknown' },
      assassin: { weapon: 123, passive: 'bloodletting' },
    } }));
    const loaded = loadProfile();
    expect(resolveLoadout('warrior', loaded)).toEqual(resolveLoadout('warrior', profile, {}));
    expect(resolveLoadout('assassin', loaded)).toEqual({ weapon: 'duelist-blade', passive: 'bloodletting' });
  });
});
