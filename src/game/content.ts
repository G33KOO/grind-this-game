import type { AchievementDefinition, EnemyDefinition, HeroId, ItemDefinition, PassiveDefinition, Stats } from './types';

export const BALANCE = {
  encounterCheckDistance: 96,
  encounterChancePerCheck: 0.08,
  encounterMeterChancePerUnit: 0.00065,
  maxEncounterMeter: 1,
  defenseReductionCap: 0.72,
  minDamage: 1,
  baseActionTime: 1,
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

export interface StartOption { id: string; masteryRequired: number }
/** La maîtrise ouvre des choix de départ, sans remplacer les anciens. */
export const STARTING_OPTIONS: Record<HeroId, { weapons: StartOption[]; passives: StartOption[] }> = {
  warrior: {
    weapons: [{ id: 'iron-sword', masteryRequired: 0 }, { id: 'duelist-blade', masteryRequired: 2 }, { id: 'ember-edge', masteryRequired: 4 }, { id: 'alpha-fang', masteryRequired: 6 }, { id: 'grave-blade', masteryRequired: 8 }],
    passives: [{ id: 'iron-skin', masteryRequired: 0 }, { id: 'battle-heart', masteryRequired: 1 }, { id: 'shielded', masteryRequired: 2 }, { id: 'cleaving-blow', masteryRequired: 3 }, { id: 'unyielding', masteryRequired: 4 }, { id: 'fortress', masteryRequired: 5 }, { id: 'war-cry', masteryRequired: 6 }, { id: 'stone-heart', masteryRequired: 8 }, { id: 'living-bastion', masteryRequired: 10 }],
  },
  assassin: {
    weapons: [{ id: 'duelist-blade', masteryRequired: 0 }, { id: 'iron-sword', masteryRequired: 2 }, { id: 'ember-edge', masteryRequired: 4 }, { id: 'alpha-fang', masteryRequired: 6 }, { id: 'grave-blade', masteryRequired: 8 }],
    passives: [{ id: 'quick-step', masteryRequired: 0 }, { id: 'keen-eye', masteryRequired: 1 }, { id: 'venom', masteryRequired: 2 }, { id: 'bloodletting', masteryRequired: 3 }, { id: 'double-cut', masteryRequired: 4 }, { id: 'phantom', masteryRequired: 5 }, { id: 'deadly-aim', masteryRequired: 6 }, { id: 'lucky-dagger', masteryRequired: 8 }, { id: 'reaper', masteryRequired: 10 }],
  },
};

export const ITEMS: ItemDefinition[] = [
  { id: 'iron-sword', name: 'Épée de fer', slot: 'weapon', description: '+3 force, +4 défense', stats: { strength: 3, defense: 4 }, rarity: 'common' },
  { id: 'duelist-blade', name: 'Lame du duelliste', slot: 'weapon', description: '+2 force, +0,1 vitesse, +8 % critique', stats: { strength: 2, speed: 0.1, critChance: 0.08 }, rarity: 'common' },
  { id: 'ember-edge', name: 'Lame braise', slot: 'weapon', description: '+5 force, +0,3 dégâts critiques', stats: { strength: 5, critDamage: 0.3 }, rarity: 'rare' },
  { id: 'oak-buckler', name: 'Rondache de chêne', slot: 'armor', description: '+4 défense, +12 PV maximum', stats: { defense: 4, maxHp: 12 }, rarity: 'common' },
  { id: 'trail-coat', name: 'Manteau de piste', slot: 'armor', description: '+3 défense, +5 PV', stats: { defense: 3, maxHp: 5 }, rarity: 'common' },
  { id: 'wraith-mail', name: 'Cotte spectrale', slot: 'armor', description: '+7 défense, -0,05 vitesse', stats: { defense: 7, speed: -0.05 }, rarity: 'epic', unlockAchievement: 'first-boss' },
  { id: 'lucky-coin', name: 'Pièce porte-bonheur', slot: 'charm', description: '+5 chance, +3 % critique', stats: { luck: 5, critChance: 0.03 }, rarity: 'rare' },
  { id: 'wolf-tooth', name: 'Croc de loup', slot: 'charm', description: '+2 force, +0,08 vitesse', stats: { strength: 2, speed: 0.08 }, rarity: 'common' },
  { id: 'heart-charm', name: 'Pendentif cœur', slot: 'charm', description: '+18 PV maximum', stats: { maxHp: 18 }, rarity: 'common' },
  { id: 'glass-eye', name: 'Œil de verre', slot: 'charm', description: '+12 % critique, dégâts critiques +0,2', stats: { critChance: 0.12, critDamage: 0.2 }, rarity: 'epic', unlockAchievement: 'ten-kills' },
  { id: 'thorn-ring', name: 'Anneau d’épines', slot: 'charm', description: '+3 défense, +3 force', stats: { defense: 3, strength: 3 }, rarity: 'rare' },
  { id: 'vampire-seal', name: 'Sceau vampire', slot: 'charm', description: '+25 PV maximum, +0,12 vitesse', stats: { maxHp: 25, speed: 0.12 }, rarity: 'epic', unlockAchievement: 'first-boss' },
  { id: 'small-potion', name: 'Potion mineure', slot: 'consumable', description: 'Rend 35 PV', heal: 35, rarity: 'common' },
  { id: 'greater-potion', name: 'Potion forte', slot: 'consumable', description: 'Rend 80 PV', heal: 80, rarity: 'rare' },
  { id: 'slime-core', name: 'Noyau gélatineux', slot: 'charm', description: '+25 PV maximum, +1 défense', stats: { maxHp: 25, defense: 1 }, rarity: 'uncommon', unlockAchievement: 'meadow-slain' },
  { id: 'hunter-totem', name: 'Totem du chasseur', slot: 'charm', description: '+3 force, +6 chance', stats: { strength: 3, luck: 6 }, rarity: 'rare', unlockAchievement: 'twenty-five-kills' },
  { id: 'alpha-fang', name: 'Croc de l’alpha', slot: 'weapon', description: '+4 force, +0,15 vitesse', stats: { strength: 4, speed: 0.15 }, rarity: 'rare', unlockAchievement: 'forest-slain' },
  { id: 'mist-cloak', name: 'Voile de brume', slot: 'armor', description: '+5 défense, +0,08 vitesse', stats: { defense: 5, speed: 0.08 }, rarity: 'rare', unlockAchievement: 'marsh-slain' },
  { id: 'grave-blade', name: 'Lame du tombeau', slot: 'weapon', description: '+8 force, +0,4 dégâts critiques', stats: { strength: 8, critDamage: 0.4 }, rarity: 'epic', unlockAchievement: 'crypt-slain' },
  { id: 'star-shard', name: 'Éclat d’étoile', slot: 'charm', description: '+8 chance, +5 % critique', stats: { luck: 8, critChance: 0.05 }, rarity: 'epic', unlockAchievement: 'explorer' },
  { id: 'veteran-plate', name: 'Plastron du vétéran', slot: 'armor', description: '+6 défense, +20 PV maximum', stats: { defense: 6, maxHp: 20 }, rarity: 'epic', unlockAchievement: 'level-10' },
  { id: 'war-banner', name: 'Étendard de guerre', slot: 'charm', description: '+6 force, +4 défense', stats: { strength: 6, defense: 4 }, rarity: 'legendary', unlockAchievement: 'warrior-mastery-4' },
  { id: 'night-mantle', name: 'Manteau de nuit', slot: 'armor', description: '+4 défense, +0,2 vitesse, +6 % critique', stats: { defense: 4, speed: 0.2, critChance: 0.06 }, rarity: 'legendary', unlockAchievement: 'assassin-mastery-4' },
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
  { id: 'meadow-boss', name: 'Reine gélatineuse', hp: 70, strength: 7, speed: 0.7, defense: 2, color: 0x64d7bb, xp: 60, loot: [{ itemId: 'iron-sword', weight: 2 }, { itemId: 'oak-buckler', weight: 2 }, { itemId: 'small-potion', weight: 2 }] },
  { id: 'forest-boss', name: 'Alpha des bois', hp: 120, strength: 10, speed: 1.1, defense: 3, color: 0x8292a6, xp: 90, loot: [{ itemId: 'duelist-blade', weight: 2 }, { itemId: 'wolf-tooth', weight: 3 }, { itemId: 'trail-coat', weight: 2 }] },
  { id: 'marsh-boss', name: 'Spectre du marais', hp: 170, strength: 13, speed: 1.2, defense: 4, color: 0x71b7ed, xp: 120, loot: [{ itemId: 'lucky-coin', weight: 2 }, { itemId: 'glass-eye', weight: 2 }, { itemId: 'heart-charm', weight: 2 }] },
  { id: 'crypt-boss', name: 'Seigneur de la crypte', hp: 230, strength: 17, speed: 0.8, defense: 7, color: 0xd4d1bd, xp: 180, loot: [{ itemId: 'ember-edge', weight: 2 }, { itemId: 'thorn-ring', weight: 2 }, { itemId: 'greater-potion', weight: 2 }] },
  { id: 'final-boss', name: 'Gardien du seuil', hp: 240, strength: 16, speed: 0.65, defense: 8, color: 0xe8b34e, xp: 300, loot: [{ itemId: 'wraith-mail', weight: 2 }, { itemId: 'vampire-seal', weight: 2 }] },
];

// Objets débloqués par achievements : ils n'entrent dans la table de butin qu'une fois le succès obtenu (voir canDrop).
const BONUS_LOOT: Record<string, { itemId: string; weight: number }[]> = {
  slime: [{ itemId: 'slime-core', weight: 1 }],
  rat: [{ itemId: 'hunter-totem', weight: 1 }],
  bandit: [{ itemId: 'hunter-totem', weight: 1 }],
  wolf: [{ itemId: 'alpha-fang', weight: 1 }],
  wisp: [{ itemId: 'mist-cloak', weight: 1 }, { itemId: 'star-shard', weight: 0.5 }],
  skeleton: [{ itemId: 'grave-blade', weight: 0.6 }],
  cultist: [{ itemId: 'grave-blade', weight: 0.6 }, { itemId: 'night-mantle', weight: 0.4 }],
  golem: [{ itemId: 'veteran-plate', weight: 1 }],
  knight: [{ itemId: 'veteran-plate', weight: 1 }, { itemId: 'war-banner', weight: 0.5 }],
  drake: [{ itemId: 'star-shard', weight: 1 }, { itemId: 'war-banner', weight: 0.7 }, { itemId: 'night-mantle', weight: 0.7 }],
  'meadow-boss': [{ itemId: 'slime-core', weight: 2 }],
  'forest-boss': [{ itemId: 'alpha-fang', weight: 2 }],
  'marsh-boss': [{ itemId: 'mist-cloak', weight: 2 }],
  'crypt-boss': [{ itemId: 'grave-blade', weight: 2 }, { itemId: 'veteran-plate', weight: 1 }],
};
for (const enemy of ENEMIES) enemy.loot = [...enemy.loot, ...(BONUS_LOOT[enemy.id] ?? [])];

export const PASSIVES: PassiveDefinition[] = [
  { id: 'iron-skin', name: 'Peau de fer', description: 'Rempart : +2 défense et un bouclier de 8 PV à chaque combat.', hero: 'warrior', maxRank: 1, weight: 5, masteryRequired: 0, stats: { defense: 2 }, effects: [{ kind: 'shield', amount: 8 }] },
  { id: 'battle-heart', name: 'Cœur de bataille', description: 'Endurance : +12 PV maximum et vol de vie de 8 %.', hero: 'warrior', maxRank: 1, weight: 4, masteryRequired: 1, stats: { maxHp: 12 }, effects: [{ kind: 'lifesteal', ratio: 0.08 }] },
  { id: 'shielded', name: 'Garde assurée', description: 'Protecteur : un bouclier de 24 PV à chaque combat.', hero: 'warrior', maxRank: 1, weight: 3, masteryRequired: 2, effects: [{ kind: 'shield', amount: 24 }] },
  { id: 'cleaving-blow', name: 'Frappe circulaire', description: 'Briseur de groupes : 35 % des dégâts infligés aux autres ennemis.', hero: 'warrior', maxRank: 1, weight: 2, masteryRequired: 3, effects: [{ kind: 'cleave', ratio: 0.35 }] },
  { id: 'unyielding', name: 'Inébranlable', description: 'Berserker : +40 % de dégâts sous 35 % des PV maximum.', hero: 'warrior', maxRank: 1, weight: 1, masteryRequired: 4, effects: [{ kind: 'lowHealthDamage', ratio: 0.4 }] },
  { id: 'fortress', name: 'Forteresse', description: 'Forteresse : 60 % de la défense ajoutée aux dégâts de chaque attaque.', hero: 'warrior', maxRank: 1, weight: 0.7, masteryRequired: 5, effects: [{ kind: 'defenseDamage', ratio: 0.6 }] },
  { id: 'war-cry', name: 'Cri de guerre', description: 'Sous 35 % PV : +25 % dégâts. 25 % dégâts aux autres ennemis.', hero: 'warrior', maxRank: 1, weight: 2.5, masteryRequired: 6, effects: [{ kind: 'lowHealthDamage', ratio: 0.25 }, { kind: 'cleave', ratio: 0.25 }] },
  { id: 'stone-heart', name: 'Cœur de pierre', description: 'Colosse : +25 PV maximum, vol de vie de 12 %, -0,1 vitesse.', hero: 'warrior', maxRank: 1, weight: 1.5, masteryRequired: 8, stats: { maxHp: 25, speed: -0.1 }, effects: [{ kind: 'lifesteal', ratio: 0.12 }] },
  { id: 'living-bastion', name: 'Bastion vivant', description: 'Bastion : 40 % de la défense ajoutée aux dégâts, bouclier de 16 PV à chaque combat.', hero: 'warrior', maxRank: 1, weight: 0.6, masteryRequired: 10, effects: [{ kind: 'defenseDamage', ratio: 0.4 }, { kind: 'shield', amount: 16 }] },
  { id: 'quick-step', name: 'Pas vif', description: 'Duelliste : +0,12 vitesse et une frappe supplémentaire à 20 % des dégâts.', hero: 'assassin', maxRank: 1, weight: 5, masteryRequired: 0, stats: { speed: 0.12 }, effects: [{ kind: 'extraStrike', ratio: 0.2 }] },
  { id: 'keen-eye', name: 'Œil acéré', description: 'Critiques : +15 % de chance de critique et +0,3 dégâts critiques.', hero: 'assassin', maxRank: 1, weight: 4, masteryRequired: 1, stats: { critChance: 0.15, critDamage: 0.3 } },
  { id: 'venom', name: 'Venin', description: 'Empoisonneur : chaque attaque applique un poison de 4 dégâts pendant 3 tours.', hero: 'assassin', maxRank: 1, weight: 3, masteryRequired: 2, effects: [{ kind: 'poison', damage: 4, turns: 3 }] },
  { id: 'bloodletting', name: 'Saignée', description: 'Vampire : vol de vie de 16 %.', hero: 'assassin', maxRank: 1, weight: 2, masteryRequired: 3, effects: [{ kind: 'lifesteal', ratio: 0.16 }] },
  { id: 'double-cut', name: 'Double entaille', description: 'Double frappe : une frappe supplémentaire à 40 % des dégâts.', hero: 'assassin', maxRank: 1, weight: 1, masteryRequired: 4, effects: [{ kind: 'extraStrike', ratio: 0.4 }] },
  { id: 'phantom', name: 'Danse fantôme', description: 'Danseur : +0,2 vitesse, vol de vie de 8 %.', hero: 'assassin', maxRank: 1, weight: 0.7, masteryRequired: 5, stats: { speed: 0.2 }, effects: [{ kind: 'lifesteal', ratio: 0.08 }] },
  { id: 'deadly-aim', name: 'Visée mortelle', description: 'Exécuteur : +0,8 dégâts critiques, -5 % de chance de critique.', hero: 'assassin', maxRank: 1, weight: 2.5, masteryRequired: 6, stats: { critDamage: 0.8, critChance: -0.05 } },
  { id: 'lucky-dagger', name: 'Lame chanceuse', description: 'Chasseur de butin : +4 chance et une frappe supplémentaire à 15 % des dégâts.', hero: 'assassin', maxRank: 1, weight: 1.5, masteryRequired: 8, stats: { luck: 4 }, effects: [{ kind: 'extraStrike', ratio: 0.15 }] },
  { id: 'reaper', name: 'Faucheur', description: 'Faucheur : une frappe supplémentaire à 25 % des dégâts, vol de vie de 8 %.', hero: 'assassin', maxRank: 1, weight: 0.6, masteryRequired: 10, effects: [{ kind: 'extraStrike', ratio: 0.25 }, { kind: 'lifesteal', ratio: 0.08 }] },
];

export const ZONES = [
  { id: 'meadow', name: 'Prairie oubliée', level: 1, enemies: ['slime', 'rat'], maxGroup: 1, boss: 'meadow-boss', requires: null, color: 0x4f8f4a },
  { id: 'forest', name: 'Forêt sombre', level: 2, enemies: ['wolf', 'bandit', 'rat', 'slime'], maxGroup: 2, boss: 'forest-boss', requires: 'meadow-boss', color: 0x25603a },
  { id: 'marsh', name: 'Marais brumeux', level: 3, enemies: ['slime', 'rat', 'wisp', 'cultist'], maxGroup: 2, boss: 'marsh-boss', requires: 'forest-boss', color: 0x4a6b55 },
  { id: 'crypt', name: 'Crypte brisée', level: 4, enemies: ['skeleton', 'cultist', 'golem', 'wisp'], maxGroup: 3, boss: 'crypt-boss', requires: 'marsh-boss', color: 0x5a5d78 },
  { id: 'ashen', name: 'Terres cendrées', level: 8, enemies: ['knight', 'drake', 'wisp', 'golem'], maxGroup: 3, boss: 'final-boss', requires: 'crypt-boss', color: 0x7a4a3a },
] as const;

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
  for (const hero of ['warrior', 'assassin'] as const) {
    const options = STARTING_OPTIONS[hero];
    for (const option of [...options.weapons, ...options.passives]) {
      if (!Number.isInteger(option.masteryRequired) || option.masteryRequired < 0 || option.masteryRequired > MASTERY_MAX_RANK) errors.push(`${option.id}: maîtrise de départ invalide.`);
    }
    if (options.weapons[0]?.masteryRequired !== 0 || options.passives[0]?.masteryRequired !== 0) errors.push(`${hero}: choix de base manquant.`);
    for (const option of options.weapons) {
      if (!ITEMS.some((item) => item.id === option.id && item.slot === 'weapon')) errors.push(`${hero}: équipement de départ inconnu ${option.id}.`);
    }
    for (const option of options.passives) {
      if (!PASSIVES.some((passive) => passive.id === option.id && passive.hero === hero && passive.masteryRequired === option.masteryRequired)) errors.push(`${hero}: passif de départ incohérent ${option.id}.`);
    }
  }
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
    if (!Number.isFinite(zone.color) || zone.level < 1) errors.push(`${zone.id}: couleur ou niveau de zone invalide.`);
    if (zone.maxGroup < 1 || zone.maxGroup > 3) errors.push(`${zone.id}: taille de groupe invalide.`);
    if (!enemyIds.has(zone.boss)) errors.push(`${zone.id}: boss inconnu ${zone.boss}.`);
    if (zone.requires && !ZONES.some((entry) => entry.boss === zone.requires)) errors.push(`${zone.id}: boss requis inconnu ${zone.requires}.`);
  }
  for (const achievement of ACHIEVEMENTS) {
    for (const id of achievement.unlocks ?? []) {
      if (!itemIds.has(id) && !passiveIds.has(id)) errors.push(`${achievement.id}: déblocage inconnu ${id}.`);
    }
    const { condition } = achievement;
    if (condition.kind === 'boss' && !enemyIds.has(condition.value)) errors.push(`${achievement.id}: boss inconnu ${condition.value}.`);
    if (condition.kind !== 'boss' && (!Number.isFinite(condition.value) || condition.value <= 0)) errors.push(`${achievement.id}: seuil invalide.`);
  }
  for (const item of ITEMS) {
    if (item.unlockAchievement && !ENEMIES.some((enemy) => enemy.loot.some((drop) => drop.itemId === item.id))) errors.push(`${item.id}: absent de toute table de butin.`);
  }
  return errors;
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'first-kill', name: 'Premier sang', description: 'Vaincre un monstre.', condition: { kind: 'kills', value: 1 } },
  { id: 'ten-kills', name: 'Chasseur', description: 'Vaincre dix monstres en une partie.', condition: { kind: 'kills', value: 10 }, unlocks: ['glass-eye'] },
  { id: 'twenty-five-kills', name: 'Tueur', description: 'Vaincre 25 monstres en une partie.', condition: { kind: 'kills', value: 25 }, unlocks: ['hunter-totem'] },
  { id: 'meadow-slain', name: 'Reine détrônée', description: 'Vaincre la Reine gélatineuse.', condition: { kind: 'boss', value: 'meadow-boss' }, unlocks: ['slime-core'] },
  { id: 'forest-slain', name: 'Maître de la meute', description: 'Vaincre l’Alpha des bois.', condition: { kind: 'boss', value: 'forest-boss' }, unlocks: ['alpha-fang'] },
  { id: 'marsh-slain', name: 'Chasseur de spectres', description: 'Vaincre le Spectre du marais.', condition: { kind: 'boss', value: 'marsh-boss' }, unlocks: ['mist-cloak'] },
  { id: 'crypt-slain', name: 'Profanateur', description: 'Vaincre le Seigneur de la crypte.', condition: { kind: 'boss', value: 'crypt-boss' }, unlocks: ['grave-blade'] },
  { id: 'first-boss', name: 'Briseur de sceau', description: 'Vaincre le Gardien.', condition: { kind: 'boss', value: 'final-boss' }, unlocks: ['wraith-mail', 'vampire-seal'], path: 'ashen-path' },
  { id: 'explorer', name: 'Curieux', description: 'Découvrir les deux secrets.', condition: { kind: 'secrets', value: 2 }, unlocks: ['star-shard'] },
  { id: 'level-10', name: 'Vétéran', description: 'Atteindre le niveau 10.', condition: { kind: 'level', value: 10 }, unlocks: ['veteran-plate'] },
  { id: 'warrior-level-10', name: 'Rempart vivant', description: 'Atteindre le niveau 10 avec le Guerrier.', hero: 'warrior', condition: { kind: 'level', value: 10 } },
  { id: 'assassin-level-10', name: 'Lame chanceuse', description: 'Atteindre le niveau 10 avec l’Assassin.', hero: 'assassin', condition: { kind: 'level', value: 10 } },
  { id: 'warrior-mastery-4', name: 'Maître d’armes', description: 'Atteindre la maîtrise 4 du Guerrier.', hero: 'warrior', condition: { kind: 'masteryRank', value: 4 }, unlocks: ['war-banner'] },
  { id: 'assassin-mastery-4', name: 'Maître de l’ombre', description: 'Atteindre la maîtrise 4 de l’Assassin.', hero: 'assassin', condition: { kind: 'masteryRank', value: 4 }, unlocks: ['night-mantle'] },
];

/** Maîtrise : niveaux gagnés cumulés sur une classe. Le rang n demande 2·n·(n+1) niveaux. */
export const MASTERY_MAX_RANK = 10;
export const masteryLevelsForRank = (rank: number): number => 2 * rank * (rank + 1);
export function masteryRank(levels: number): number {
  let rank = 0;
  while (rank < MASTERY_MAX_RANK && levels >= masteryLevelsForRank(rank + 1)) rank++;
  return rank;
}
