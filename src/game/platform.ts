import type { Profile } from './types';

export interface PlatformAchievements {
  synchronize(profile: Profile): Promise<void>;
}

export class LocalAchievements implements PlatformAchievements {
  async synchronize(_profile: Profile): Promise<void> {
    return Promise.resolve();
  }
}
