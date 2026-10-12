export type HeroId = 'warrior' | 'assassin';
export type Slot = 'weapon' | 'armor' | 'charm';
export type EquipmentSlot = Slot | 'charm2';
export type Effect =
  | { kind: 'lifesteal'; ratio: number }
  | { kind: 'poison'; damage: number; turns: number }
  | { kind: 'cleave'; ratio: number }
  | { kind: 'extraStrike'; ratio: number }
  | { kind: 'shield'; amount: number }
  | { kind: 'shieldPower'; ratio: number }
  | { kind: 'lowHealthDamage'; ratio: number }
  | { kind: 'defenseDamage'; ratio: number };

export interface Stats {
  strength: number;
  speed: number;
  luck: number;
  critChance: number;
  critDamage: number;
  maxHp: number;
  defense: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  slot: Slot | 'consumable';
  description: string;
  stats?: Partial<Stats>;
  effects?: Effect[];
  heal?: number;
  rarity: 'common' | 'rare' | 'epic';
  unlockAchievement?: string;
}

export interface PassiveDefinition {
  id: string;
  name: string;
  description: string;
  hero: HeroId | 'both';
  maxRank: number;
  weight: number;
  unlockAchievement?: string;
  masteryRequired?: number;
  stats?: Partial<Stats>;
  effects?: Effect[];
}

export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  strength: number;
  speed: number;
  defense: number;
  color: number;
  xp: number;
  loot: { itemId: string; weight: number }[];
}

export interface EnemyUnit extends EnemyDefinition {
  unitId: string;
  currentHp: number;
  nextAction: number;
  poisonDamage: number;
  poisonTurns: number;
}

export interface PassiveRank {
  id: string;
  rank: number;
}

export interface ItemInstance {
  instanceId: string;
  itemId: string;
}

export interface RunState {
  version: 2;
  developerMode: boolean;
  hero: HeroId;
  level: number;
  xp: number;
  xpToNext: number;
  unspentPoints: number;
  invested: Partial<Stats>;
  hp: number;
  position: { x: number; y: number };
  encounterMeter: number;
  distanceSinceEncounterCheck: number;
  rngState: number;
  inventory: ItemInstance[];
  equipment: Partial<Record<EquipmentSlot, string>>;
  passives: PassiveRank[];
  pendingPassivePicks: number;
  pendingCombat: string[] | null;
  defeatedBosses: string[];
  secrets: string[];
  usedShrines: string[];
  explored?: string;
  kills: number;
  victories: number;
  result: 'active' | 'victory' | 'death';
}

export interface Profile {
  version: 1;
  mastery: Record<HeroId, number>;
  achievements: string[];
  unlockedItems: string[];
  unlockedPassives: string[];
  paths: string[];
}

export interface CombatState {
  playerHp: number;
  playerMaxHp: number;
  playerStats: Stats;
  playerEffects: Effect[];
  shield: number;
  enemies: EnemyUnit[];
  time: number;
  playerNextAction: number;
  targetIndex: number;
  log: string[];
  rngState: number;
  over: 'none' | 'win' | 'loss';
}
