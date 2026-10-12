import { decodeRun, initialProfile, validateRun } from './engine';
import type { Profile, RunState } from './types';

const RUN_KEY = 'grind-this-game.run';
const PROFILE_KEY = 'grind-this-game.profile';
const BACKUP_KEY = `${RUN_KEY}.backup`;
const SETTINGS_KEY = 'grind-this-game.settings';
let desktopSaveQueue: Promise<void> = Promise.resolve();

export type BindingAction = 'up' | 'down' | 'left' | 'right' | 'inventory' | 'character';
export type Bindings = Record<BindingAction, string>;
export type GlowLevel = 'full' | 'low' | 'off';

export interface Settings {
  volume: number;
  combatSpeed: 1 | 2 | 4;
  fullscreen: boolean;
  bindings: Bindings;
  glow: GlowLevel;
  uiScale: 0.9 | 1 | 1.15 | 1.3;
  reduceMotion: boolean;
  highContrast: boolean;
}

export const DEFAULT_BINDINGS: Bindings = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', inventory: 'KeyI', character: 'KeyC' };
export const DEFAULT_SETTINGS: Settings = {
  volume: 0.7, combatSpeed: 1, fullscreen: false, bindings: DEFAULT_BINDINGS,
  glow: 'full', uiScale: 1, reduceMotion: false, highContrast: false,
};
const UI_SCALES = [0.9, 1, 1.15, 1.3] as const;

export async function loadRun(): Promise<RunState | null> {
  if (window.gamePlatform) {
    const candidates = await window.gamePlatform.loadSave();
    for (const raw of [candidates.primary, candidates.backup]) {
      if (!raw) continue;
      try {
        if (JSON.parse(raw) === null) return null;
        return decodeRun(raw);
      } catch {
        continue;
      }
    }
    if (candidates.primary || candidates.backup) throw new Error('La sauvegarde et sa copie de secours sont corrompues.');
    return null;
  }
  const raw = localStorage.getItem(RUN_KEY);
  if (!raw) return null;
  try {
    if (JSON.parse(raw) === null) return null;
    return decodeRun(raw);
  } catch (primaryError) {
    if (window.gamePlatform) throw new Error(`Sauvegarde invalide : ${primaryError instanceof Error ? primaryError.message : 'erreur inconnue'}`);
    const backup = localStorage.getItem(BACKUP_KEY);
    if (!backup) throw new Error('La sauvegarde est corrompue et aucune copie de secours ne peut être récupérée.');
    try {
      return decodeRun(backup);
    } catch {
      throw new Error('La sauvegarde et sa copie de secours sont corrompues.');
    }
  }
}

export async function saveRun(run: RunState | null): Promise<void> {
  const serialized = run ? JSON.stringify(validateRun(run)) : 'null';
  if (window.gamePlatform) {
    const write = async () => { await window.gamePlatform!.writeSave(serialized); };
    desktopSaveQueue = desktopSaveQueue.then(write, write);
    await desktopSaveQueue;
    return;
  }
  const existing = localStorage.getItem(RUN_KEY);
  if (run) {
    if (existing) localStorage.setItem(BACKUP_KEY, existing);
    localStorage.setItem(RUN_KEY, serialized);
  } else {
    localStorage.removeItem(RUN_KEY);
    localStorage.removeItem(BACKUP_KEY);
  }
}

export function loadProfile(): Profile {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return initialProfile();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1 ||
        !('achievements' in parsed) || !Array.isArray(parsed.achievements) || !parsed.achievements.every((id) => typeof id === 'string') ||
        !('unlockedItems' in parsed) || !Array.isArray(parsed.unlockedItems) || !parsed.unlockedItems.every((id) => typeof id === 'string') ||
        !('unlockedPassives' in parsed) || !Array.isArray(parsed.unlockedPassives) || !parsed.unlockedPassives.every((id) => typeof id === 'string') ||
        !('paths' in parsed) || !Array.isArray(parsed.paths) || !parsed.paths.every((id) => typeof id === 'string') ||
        !('mastery' in parsed) || !parsed.mastery || typeof parsed.mastery !== 'object' ||
        !('warrior' in parsed.mastery) || typeof parsed.mastery.warrior !== 'number' || !Number.isFinite(parsed.mastery.warrior) || parsed.mastery.warrior < 0 ||
        !('assassin' in parsed.mastery) || typeof parsed.mastery.assassin !== 'number' || !Number.isFinite(parsed.mastery.assassin) || parsed.mastery.assassin < 0) {
      throw new Error('Profil invalide.');
    }
    return parsed as Profile;
  } catch (error) {
    throw new Error(`Impossible de charger le profil permanent : ${error instanceof Error ? error.message : 'format invalide'}`);
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadSettings(): Settings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const speed = parsed.combatSpeed === 2 || parsed.combatSpeed === 4 ? parsed.combatSpeed : 1;
    const bindings = { ...DEFAULT_BINDINGS };
    for (const action of Object.keys(bindings) as BindingAction[]) {
      const code = (parsed.bindings as Partial<Bindings> | undefined)?.[action];
      if (typeof code === 'string' && /^[A-Za-z0-9]{1,20}$/.test(code)) bindings[action] = code;
    }
    return {
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : DEFAULT_SETTINGS.volume,
      combatSpeed: speed,
      fullscreen: parsed.fullscreen === true,
      bindings,
      glow: parsed.glow === 'low' || parsed.glow === 'off' ? parsed.glow : 'full',
      uiScale: UI_SCALES.find((scale) => scale === parsed.uiScale) ?? 1,
      reduceMotion: parsed.reduceMotion === true,
      highContrast: parsed.highContrast === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
