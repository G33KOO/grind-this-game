import { afterEach, describe, expect, it } from 'vitest';
import { newRun } from './engine';
import { loadProfile, loadRun, saveRun } from './save';

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
});
