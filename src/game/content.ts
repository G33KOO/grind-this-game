import type { EnemyDefinition, HeroId, ItemDefinition, PassiveDefinition, Stats } from './types';

export const BALANCE = {
  encounterCheckDistance: 96,
  encounterChancePerCheck: 0.08,
  encounterMeterChancePerUnit: 0.00065,
  maxEncounterMeter: 1,
  defenseReductionCap: 0.72,
  minDamage: 1,
  baseActionTime: 1,
  passivePicksPerOffer: 3,
  statPointsPerLevel: 2,
  respecAllowed: true,
  extraEffectChainLimit: 12,
  poisonMaxTurns: 5,
  criticalChanceCap: 0.75,
  healCap: 0.35,
} as const;

export const HEROES: Record<HeroId, { name: string; stats: Stats; startingItem: string; color: number }> = {
  warrior: {
    name: 'Guerrier',
    stats: { strength: 8, speed: 0.82, luck: 0, critChance: 0.05, critDamage: 1.5, maxHp: 125, defense: 8 },
    startingItem: 'iron-sword',
    color: 0x65c6a2,
  },
  assassin: {
    name: 'Assassin',
    stats: { strength: 6, speed: 1.25, luck: 2, critChance: 0.15, critDamage: 1.75, maxHp: 90, defense: 2 },
    startingItem: 'duelist-blade',
    color: 0xf18f69,
  },
};

export const ITEMS: ItemDefinition[] = [
  { id: 'iron-sword', name: 'Épée de fer', slot: 'weapon', description: '+3 force', stats: { strength: 3 }, rarity: 'common' },
  { id: 'duelist-blade', name: 'Lame du duelliste', slot: 'weapon', description: '+2 force, +0,1 vitesse', stats: { strength: 2, speed: 0.1 }, rarity: 'common' },
  { id: 'ember-edge', name: 'Lame braise', slot: 'weapon', description: '+5 force, brûlure corrosive', stats: { strength: 5 }, effects: [{ kind: 'poison', damage: 3, turns: 2 }], rarity: 'rare' },
  { id: 'oak-buckler', name: 'Rondache de chêne', slot: 'armor', description: '+4 défense, bouclier au combat', stats: { defense: 4 }, effects: [{ kind: 'shield', amount: 8 }], rarity: 'common' },
  { id: 'trail-coat', name: 'Manteau de piste', slot: 'armor', description: '+3 défense, +5 PV', stats: { defense: 3, maxHp: 5 }, rarity: 'common' },
  { id: 'wraith-mail', name: 'Cotte spectrale', slot: 'armor', description: '+7 défense, -0,05 vitesse', stats: { defense: 7, speed: -0.05 }, rarity: 'epic', unlockAchievement: 'first-boss' },
  { id: 'lucky-coin', name: 'Pièce porte-bonheur', slot: 'charm', description: '+5 chance, +3 % critique', stats: { luck: 5, critChance: 0.03 }, rarity: 'rare' },
  { id: 'wolf-tooth', name: 'Croc de loup', slot: 'charm', description: '+2 force, +0,08 vitesse', stats: { strength: 2, speed: 0.08 }, rarity: 'common' },
  { id: 'heart-charm', name: 'Pendentif cœur', slot: 'charm', description: '+18 PV maximum', stats: { maxHp: 18 }, rarity: 'common' },
  { id: 'glass-eye', name: 'Œil de verre', slot: 'charm', description: '+12 % critique, dégâts critiques +0,2', stats: { critChance: 0.12, critDamage: 0.2 }, rarity: 'epic', unlockAchievement: 'ten-kills' },
  { id: 'thorn-ring', name: 'Anneau d’épines', slot: 'charm', description: '+3 défense', stats: { defense: 3 }, effects: [{ kind: 'cleave', ratio: 0.25 }], rarity: 'rare' },
  { id: 'vampire-seal', name: 'Sceau vampire', slot: 'charm', description: 'Vol de vie 12 %', effects: [{ kind: 'lifesteal', ratio: 0.12 }], rarity: 'epic', unlockAchievement: 'first-boss' },
  { id: 'small-potion', name: 'Potion mineure', slot: 'consumable', description: 'Rend 35 PV', heal: 35, rarity: 'common' },
  { id: 'greater-potion', name: 'Potion forte', slot: 'consumable', description: 'Rend 80 PV', heal: 80, rarity: 'rare' },
];

const commonLoot = [{ itemId: 'small-potion', weight: 4 }, { itemId: 'wolf-tooth', weight: 2 }];
export const ENEMIES: EnemyDefinition[] = [
  { id: 'slime', name: 'Gelée', hp: 28, strength: 5, speed: 0.7, defense: 1, color: 0x64d7bb, xp: 12, loot: commonLoot },
  { id: 'rat', name: 'Rat des ruines', hp: 24, strength: 6, speed: 1.2, defense: 0, color: 0xb88b68, xp: 13, loot: commonLoot },
  { id: 'bandit', name: 'Bandit', hp: 48, strength: 9, speed: 1, defense: 2, color: 0xc77e5b, xp: 22, loot: [...commonLoot, { itemId: 'iron-sword', weight: 1 }] },
  { id: 'wolf', name: 'Loup gris', hp: 54, strength: 11, speed: 1.35, defense: 2, color: 0x8292a6, xp: 26, loot: [...commonLoot, { itemId: 'wolf-tooth', weight: 3 }] },
  { id: 'skeleton', name: 'Squelette', hp: 72, strength: 12, speed: 0.9, defense: 5, color: 0xd4d1bd, xp: 32, loot: [...commonLoot, { itemId: 'oak-buckler', weight: 1 }] },
  { id: 'cultist', name: 'Adepte', hp: 88, strength: 15, speed: 1.1, defense: 4, color: 0xb783d0, xp: 40, loot: [...commonLoot, { itemId: 'ember-edge', weight: 1 }] },
  { id: 'golem', name: 'Golem fendu', hp: 155, strength: 21, speed: 0.62, defense: 12, color: 0x9d8f7d, xp: 65, loot: [...commonLoot, { itemId: 'trail-coat', weight: 2 }] },
  { id: 'wisp', name: 'Feu follet', hp: 92, strength: 20, speed: 1.5, defense: 3, color: 0x71b7ed, xp: 58, loot: [...commonLoot, { itemId: 'lucky-coin', weight: 1 }] },
  { id: 'knight', name: 'Chevalier déchu', hp: 205, strength: 25, speed: 0.85, defense: 14, color: 0xd28f69, xp: 90, loot: [...commonLoot, { itemId: 'thorn-ring', weight: 1 }] },
  { id: 'drake', name: 'Jeune drake', hp: 285, strength: 31, speed: 1.15, defense: 10, color: 0xe36e54, xp: 125, loot: [...commonLoot, { itemId: 'greater-potion', weight: 2 }] },
  { id: 'final-boss', name: 'Gardien du seuil', hp: 240, strength: 16, speed: 0.65, defense: 8, color: 0xe8b34e, xp: 300, loot: [{ itemId: 'wraith-mail', weight: 2 }, { itemId: 'vampire-seal', weight: 2 }] },
];

export const PASSIVES: PassiveDefinition[] = [
  { id: 'iron-skin', name: 'Peau de fer', description: '+2 défense par rang', hero: 'warrior', maxRank: 3, weight: 5, stats: { defense: 2 } },
  { id: 'battle-heart', name: 'Cœur de bataille', description: '+12 PV max par rang', hero: 'warrior', maxRank: 3, weight: 4, stats: { maxHp: 12 } },
  { id: 'shielded', name: 'Garde assurée', description: 'Bouclier initial +8 par rang', hero: 'warrior', maxRank: 3, weight: 3, effects: [{ kind: 'shield', amount: 8 }] },
  { id: 'cleaving-blow', name: 'Frappe circulaire', description: '25 % de dégâts aux autres ennemis', hero: 'warrior', maxRank: 2, weight: 2, effects: [{ kind: 'cleave', ratio: 0.25 }] },
  { id: 'unyielding', name: 'Inébranlable', description: '+15 % dégâts sous 35 % PV', hero: 'warrior', maxRank: 2, weight: 1, effects: [{ kind: 'lowHealthDamage', ratio: 0.15 }] },
  { id: 'fortress', name: 'Forteresse', description: 'Convertit 20 % défense en force', hero: 'warrior', maxRank: 2, weight: 0.7, masteryRequired: 3, effects: [{ kind: 'defenseDamage', ratio: 0.2 }] },
  { id: 'quick-step', name: 'Pas vif', description: '+0,12 vitesse par rang', hero: 'assassin', maxRank: 3, weight: 5, stats: { speed: 0.12 } },
  { id: 'keen-eye', name: 'Œil acéré', description: '+5 % critique par rang', hero: 'assassin', maxRank: 3, weight: 4, stats: { critChance: 0.05 } },
  { id: 'venom', name: 'Venin', description: 'Vos attaques empoisonnent', hero: 'assassin', maxRank: 3, weight: 3, effects: [{ kind: 'poison', damage: 4, turns: 2 }] },
  { id: 'bloodletting', name: 'Saignée', description: 'Vol de vie 8 %', hero: 'assassin', maxRank: 2, weight: 2, effects: [{ kind: 'lifesteal', ratio: 0.08 }] },
  { id: 'double-cut', name: 'Double entaille', description: '25 % dégâts en frappe supplémentaire', hero: 'assassin', maxRank: 2, weight: 1, effects: [{ kind: 'extraStrike', ratio: 0.25 }] },
  { id: 'phantom', name: 'Danse fantôme', description: '+0,2 vitesse et critique +8 %', hero: 'assassin', maxRank: 2, weight: 0.7, masteryRequired: 10, stats: { speed: 0.2, critChance: 0.08 } },
];

export const ZONES = [
  { id: 'meadow', name: 'Prairie oubliée', level: 1, enemies: ['slime', 'rat', 'bandit', 'wolf'], bounds: { x: 0, y: 0, w: 520, h: 360 }, color: 0x315d4a },
  { id: 'crypt', name: 'Crypte brisée', level: 4, enemies: ['skeleton', 'cultist', 'golem', 'wisp'], bounds: { x: 520, y: 0, w: 520, h: 360 }, color: 0x464b61 },
  { id: 'ashen', name: 'Terres cendrées', level: 8, enemies: ['knight', 'drake', 'wisp', 'golem'], bounds: { x: 0, y: 360, w: 1040, h: 360 }, color: 0x68483f },
] as const;

export const FINAL_BOSS_POSITION = { x: 915, y: 610 };

export const validateContent = (): string[] => {
  const errors: string[] = [];
  const ids = [...ITEMS, ...ENEMIES, ...PASSIVES, ...ACHIEVEMENTS, ...ZONES].map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) errors.push('Identifiants de contenu dupliqués.');
  const itemIds = new Set(ITEMS.map((item) => item.id));
  const enemyIds = new Set(ENEMIES.map((enemy) => enemy.id));
  const passiveIds = new Set(PASSIVES.map((passive) => passive.id));
  const achievementIds = new Set<string>(ACHIEVEMENTS.map((achievement) => achievement.id));
  const validNumbers = (value: object | undefined) =>
    !value || Object.values(value).every((number) => typeof number === 'number' && Number.isFinite(number));
  const validEffects = (effects: readonly { kind: string; [key: string]: unknown }[] | undefined) =>
    !effects || effects.every((effect) => Object.entries(effect).every(([key, value]) =>
      key === 'kind' || (typeof value === 'number' && Number.isFinite(value))));
  if (ids.some((id) => !id.trim())) errors.push('Un identifiant de contenu est vide.');
  for (const item of ITEMS) {
    if (!validNumbers(item.stats) || !validEffects(item.effects)) errors.push(`${item.id}: bonus invalide.`);
    if (item.slot === 'consumable' && (!item.heal || item.heal <= 0)) errors.push(`${item.id}: soin invalide.`);
    if (item.unlockAchievement && !achievementIds.has(item.unlockAchievement)) errors.push(`${item.id}: achievement inconnu.`);
  }
  for (const enemy of ENEMIES) {
    if (![enemy.hp, enemy.strength, enemy.speed, enemy.defense, enemy.xp].every(Number.isFinite) ||
        enemy.hp <= 0 || enemy.speed <= 0 || enemy.defense < 0 || enemy.xp < 0) errors.push(`${enemy.id}: statistiques invalides.`);
  }
  for (const passive of PASSIVES) {
    if (!Number.isInteger(passive.maxRank) || passive.maxRank <= 0 || passive.weight <= 0 ||
        !validNumbers(passive.stats) || !validEffects(passive.effects)) errors.push(`${passive.id}: définition invalide.`);
    if (passive.unlockAchievement && !achievementIds.has(passive.unlockAchievement)) errors.push(`${passive.id}: achievement inconnu.`);
    if (passive.masteryRequired !== undefined && passive.masteryRequired < 0) errors.push(`${passive.id}: seuil de maîtrise invalide.`);
  }
  for (const enemy of ENEMIES) for (const drop of enemy.loot) {
    if (!itemIds.has(drop.itemId)) errors.push(`${enemy.id}: objet de loot inconnu ${drop.itemId}.`);
    if (drop.weight <= 0 || !Number.isFinite(drop.weight)) errors.push(`${enemy.id}: poids de loot invalide.`);
  }
  for (const zone of ZONES) for (const enemyId of zone.enemies) {
    if (!enemyIds.has(enemyId)) errors.push(`${zone.id}: ennemi inconnu ${enemyId}.`);
  }
  for (const zone of ZONES) {
    const bounds = Object.values(zone.bounds);
    if (bounds.some((value) => !Number.isFinite(value)) || zone.bounds.w <= 0 || zone.bounds.h <= 0 || zone.level < 1) {
      errors.push(`${zone.id}: limites ou niveau de zone invalide.`);
    }
  }
  for (const achievement of ACHIEVEMENTS) {
    if ('unlocks' in achievement) for (const id of achievement.unlocks) {
      if (!itemIds.has(id) && !passiveIds.has(id)) errors.push(`${achievement.id}: déblocage inconnu ${id}.`);
    }
  }
  return errors;
};

export const ACHIEVEMENTS = [
  { id: 'first-kill', name: 'Premier sang', description: 'Vaincre un monstre.' },
  { id: 'ten-kills', name: 'Chasseur', description: 'Vaincre dix monstres.', unlocks: ['glass-eye', 'phantom'] },
  { id: 'first-boss', name: 'Briseur de sceau', description: 'Vaincre le Gardien.', unlocks: ['wraith-mail', 'vampire-seal', 'fortress'], path: 'ashen-path' },
] as const;
