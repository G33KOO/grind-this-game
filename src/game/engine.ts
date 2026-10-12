import { ACHIEVEMENTS, BALANCE, ENEMIES, HEROES, ITEMS, PASSIVES, ZONES } from './content';
import { WORLD_START } from './world';
import type { CombatState, Effect, HeroId, ItemDefinition, ItemInstance, Profile, RunState, Slot, Stats } from './types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function nextRandom(state: number): { value: number; state: number } {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { value: next / 0x1_0000_0000, state: next };
}

export function initialProfile(): Profile {
  return { version: 1, mastery: { warrior: 0, assassin: 0 }, achievements: [], unlockedItems: [], unlockedPassives: [], paths: [] };
}

export function newRun(hero: HeroId, seed = 0x71a9c3): RunState {
  const start = HEROES[hero];
  return {
    version: 2, developerMode: false, hero, level: 1, xp: 0, xpToNext: 60, unspentPoints: 0, invested: {},
    hp: start.stats.maxHp, position: { ...WORLD_START }, encounterMeter: 0, distanceSinceEncounterCheck: 0, rngState: seed >>> 0 || 1,
    inventory: [
      { instanceId: 'starter-weapon', itemId: start.startingItem },
      { instanceId: 'starter-potion', itemId: 'small-potion' },
    ],
    equipment: { weapon: 'starter-weapon' },
    passives: [], pendingPassivePicks: 0, pendingCombat: null, defeatedBosses: [], secrets: [], usedShrines: [],
    kills: 0, victories: 0, result: 'active',
  };
}

export function equippedItems(run: RunState): ItemDefinition[] {
  return Object.values(run.equipment).flatMap((instanceId) => {
    const instance = run.inventory.find((entry) => entry.instanceId === instanceId);
    const item = ITEMS.find((candidate) => candidate.id === instance?.itemId);
    return item ? [item] : [];
  });
}

export function deriveStats(run: RunState): Stats {
  const result = { ...HEROES[run.hero].stats };
  const addStats = (source: Partial<Stats> | undefined, factor = 1) => {
    if (!source) return;
    for (const key of Object.keys(result) as (keyof Stats)[]) result[key] += (source[key] ?? 0) * factor;
  };
  addStats(run.invested);
  for (const item of equippedItems(run)) addStats(item.stats);
  for (const rank of run.passives) {
    const passive = PASSIVES.find((candidate) => candidate.id === rank.id);
    if (passive && (passive.hero === run.hero || passive.hero === 'both')) addStats(passive.stats, rank.rank);
  }
  result.speed = Math.max(0.2, result.speed);
  result.critChance = clamp(result.critChance, 0, BALANCE.criticalChanceCap);
  result.critDamage = clamp(result.critDamage, 1, 4);
  result.maxHp = Math.max(1, Math.round(result.maxHp));
  result.defense = Math.max(0, result.defense);
  result.strength = Math.max(0, result.strength);
  result.luck = Math.max(0, result.luck);
  return result;
}

export function activeEffects(run: RunState): Effect[] {
  const effects = equippedItems(run).flatMap((item) => item.effects ?? []);
  for (const rank of run.passives) {
    const passive = PASSIVES.find((candidate) => candidate.id === rank.id);
    if (passive && (passive.hero === run.hero || passive.hero === 'both')) {
      for (let i = 0; i < rank.rank; i++) effects.push(...(passive.effects ?? []));
    }
  }
  return effects;
}

export function damageAfterDefense(raw: number, defense: number): number {
  const reduction = clamp(defense / (defense + 100), 0, BALANCE.defenseReductionCap);
  return Math.max(BALANCE.minDamage, Math.round(Math.max(0, raw) * (1 - reduction)));
}

export function gainExperience(run: RunState, amount: number): RunState {
  const updated = { ...run, xp: run.xp + Math.max(0, amount), pendingPassivePicks: run.pendingPassivePicks };
  while (updated.xp >= updated.xpToNext) {
    updated.xp -= updated.xpToNext;
    updated.level++;
    updated.unspentPoints += BALANCE.statPointsPerLevel;
    updated.xpToNext = Math.round(60 + (updated.level - 1) * 24);
    if (updated.level % 5 === 0) updated.pendingPassivePicks++;
  }
  return updated;
}

export function allocatePoints(run: RunState, stat: keyof Stats, amount: number): RunState {
  if (!BALANCE.respecAllowed || run.unspentPoints <= 0) return run;
  const spend = Math.min(run.unspentPoints, Math.max(1, Math.floor(amount)));
  return {
    ...run,
    unspentPoints: run.unspentPoints - spend,
    invested: { ...run.invested, [stat]: (run.invested[stat] ?? 0) + spend },
  };
}

export function respecStats(run: RunState): RunState {
  if (!BALANCE.respecAllowed) return run;
  const refunded = Object.values(run.invested).reduce((sum, value) => sum + (value ?? 0), 0);
  return { ...run, invested: {}, unspentPoints: run.unspentPoints + refunded };
}

export function passiveChoices(run: RunState, profile: Profile): string[] {
  const candidates = PASSIVES.filter((passive) => {
    if (passive.hero !== run.hero && passive.hero !== 'both') return false;
    if (passive.unlockAchievement && !profile.achievements.includes(passive.unlockAchievement)) return false;
    if (passive.masteryRequired && profile.mastery[run.hero] < passive.masteryRequired) return false;
    if (profile.unlockedPassives.includes(passive.id) || !passive.unlockAchievement) {
      return (run.passives.find((rank) => rank.id === passive.id)?.rank ?? 0) < passive.maxRank;
    }
    return false;
  });
  const choices: string[] = [];
  let rng = run.rngState;
  while (choices.length < Math.min(3, candidates.length)) {
    const total = candidates.reduce((sum, passive) => sum + passive.weight, 0);
    let roll = nextRandom(rng);
    rng = roll.state;
    let selected = candidates.find((passive) => {
      roll = { ...roll, value: roll.value - passive.weight / total };
      return roll.value < 0;
    });
    if (!selected) selected = candidates[candidates.length - 1];
    choices.push(selected.id);
    candidates.splice(candidates.indexOf(selected), 1);
  }
  return choices;
}

export function choosePassive(run: RunState, id: string): RunState {
  const passive = PASSIVES.find((candidate) => candidate.id === id);
  if (!passive || (passive.hero !== run.hero && passive.hero !== 'both') || run.pendingPassivePicks <= 0) return run;
  const currentRank = run.passives.find((rank) => rank.id === id)?.rank ?? 0;
  if (currentRank >= passive.maxRank) return run;
  const passives = run.passives.filter((rank) => rank.id !== id);
  passives.push({ id, rank: currentRank + 1 });
  return { ...run, passives, pendingPassivePicks: run.pendingPassivePicks - 1 };
}

export function advanceEncounter(run: RunState, distance: number, profile: Profile): { run: RunState; triggered: boolean } {
  let remaining = Math.max(0, distance);
  let meter = run.encounterMeter;
  let checkpointDistance = run.distanceSinceEncounterCheck;
  let rngState = run.rngState;
  let triggered = false;
  while (remaining > 0 && !triggered) {
    const segment = Math.min(remaining, BALANCE.encounterCheckDistance - checkpointDistance);
    meter = Math.min(BALANCE.maxEncounterMeter, meter + segment * BALANCE.encounterMeterChancePerUnit);
    checkpointDistance += segment;
    remaining -= segment;
    if (checkpointDistance >= BALANCE.encounterCheckDistance) {
      checkpointDistance = 0;
      const chance = meter >= BALANCE.maxEncounterMeter ? 1 :
        clamp(BALANCE.encounterChancePerCheck + meter * 0.35, 0, 1);
      const roll = nextRandom(rngState);
      rngState = roll.state;
      triggered = roll.value < chance;
    }
  }
  if (triggered) {
    meter = 0;
    checkpointDistance = 0;
  }
  if (remaining > 0 && !triggered) checkpointDistance += remaining;
  if (!triggered && checkpointDistance >= BALANCE.encounterCheckDistance) {
    const roll = nextRandom(rngState);
    rngState = roll.state;
    triggered = roll.value < BALANCE.encounterChancePerCheck;
    checkpointDistance %= BALANCE.encounterCheckDistance;
  }
  void profile;
  return { run: { ...run, encounterMeter: triggered ? 0 : meter, distanceSinceEncounterCheck: checkpointDistance, rngState }, triggered };
}

export function canDrop(itemId: string, profile: Profile): boolean {
  const item = ITEMS.find((candidate) => candidate.id === itemId);
  return !!item && (!item.unlockAchievement || profile.achievements.includes(item.unlockAchievement));
}

export function rollLoot(run: RunState, enemyId: string, profile: Profile): { run: RunState; drops: string[] } {
  const enemy = ENEMIES.find((candidate) => candidate.id === enemyId);
  if (!enemy) return { run, drops: [] };
  let rngState = run.rngState;
  const chance = clamp(0.12 * (1 + deriveStats(run).luck * 0.025), 0.03, 0.45);
  let roll = nextRandom(rngState);
  rngState = roll.state;
  if (roll.value >= chance) return { run: { ...run, rngState }, drops: [] };
  const eligible = enemy.loot.filter((entry) => canDrop(entry.itemId, profile)).map((entry) => {
    const rarity = ITEMS.find((item) => item.id === entry.itemId)?.rarity;
    const rarityBonus = rarity === 'epic' ? 0.055 : rarity === 'rare' ? 0.035 : 0;
    return { ...entry, effectiveWeight: entry.weight * (1 + deriveStats(run).luck * rarityBonus) };
  });
  const total = eligible.reduce((sum, entry) => sum + entry.effectiveWeight, 0);
  if (!total) return { run: { ...run, rngState }, drops: [] };
  roll = nextRandom(rngState);
  rngState = roll.state;
  let cursor = roll.value * total;
  const chosen = eligible.find((entry) => (cursor -= entry.effectiveWeight) < 0) ?? eligible[eligible.length - 1];
  const instanceId = `drop-${rngState.toString(16)}-${run.inventory.length}`;
  return {
    run: { ...run, rngState, inventory: [...run.inventory, { instanceId, itemId: chosen.itemId }] },
    drops: [chosen.itemId],
  };
}

export function addAchievements(profile: Profile, run: RunState): Profile {
  const earned = ACHIEVEMENTS.filter((achievement) => {
    if (achievement.id === 'first-kill') return run.kills >= 1;
    if (achievement.id === 'ten-kills') return run.kills >= 10;
    return run.defeatedBosses.includes('final-boss');
  }).map((achievement) => achievement.id);
  const achievements = [...new Set([...profile.achievements, ...earned])];
  const unlocks = ACHIEVEMENTS.flatMap((achievement) =>
    achievements.includes(achievement.id) && 'unlocks' in achievement ? achievement.unlocks : []);
  const paths = ACHIEVEMENTS.flatMap((achievement) =>
    achievements.includes(achievement.id) && 'path' in achievement ? [achievement.path] : []);
  const unlockedItems = [...new Set([...profile.unlockedItems, ...unlocks.filter((id) => ITEMS.some((item) => item.id === id))])];
  const mastery = { ...profile.mastery, [run.hero]: Math.max(profile.mastery[run.hero], run.kills + run.victories * 5) };
  const masteredPassives = PASSIVES.filter((passive) =>
    passive.hero === run.hero && passive.masteryRequired !== undefined &&
    mastery[run.hero] >= passive.masteryRequired).map((passive) => passive.id);
  const unlockedPassives = [...new Set([
    ...profile.unlockedPassives,
    ...unlocks.filter((id) => PASSIVES.some((passive) => passive.id === id)),
    ...masteredPassives,
  ])];
  return { ...profile, achievements, unlockedItems, unlockedPassives, paths: [...new Set([...profile.paths, ...paths])], mastery };
}

export function startCombat(run: RunState, enemyIds: string[]): CombatState {
  const stats = deriveStats(run);
  const enemies = enemyIds.flatMap((id, index) => {
    const enemy = ENEMIES.find((entry) => entry.id === id);
    return enemy ? [{ ...enemy, unitId: `${id}-${index}`, currentHp: enemy.hp, nextAction: BALANCE.baseActionTime / enemy.speed, poisonDamage: 0, poisonTurns: 0 }] : [];
  });
  const effects = activeEffects(run);
  const shield = effects.filter((effect) => effect.kind === 'shield').reduce((sum, effect) => sum + effect.amount, 0);
  return {
    playerHp: run.hp, playerMaxHp: stats.maxHp, playerStats: stats, playerEffects: effects, shield,
    enemies, time: 0, playerNextAction: BALANCE.baseActionTime / stats.speed,
    targetIndex: 0, log: ['Le combat commence.'], rngState: run.rngState, over: 'none',
  };
}

const pushLog = (log: string[], message: string) => [...log, message].slice(-8);

export function stepCombat(state: CombatState, preferredTarget?: number): CombatState {
  if (state.over !== 'none') return state;
  const enemies = state.enemies.map((enemy) => ({ ...enemy }));
  const living = enemies.map((enemy, index) => ({ enemy, index })).filter(({ enemy }) => enemy.currentHp > 0);
  if (!living.length) return { ...state, enemies, over: 'win' };
  let log = state.log;
  let playerHp = state.playerHp;
  let shield = state.shield;
  let rngState = state.rngState;
  let playerNextAction = state.playerNextAction;
  let time = state.time;
  const soonestEnemy = Math.min(...living.map(({ enemy }) => enemy.nextAction));

  if (playerNextAction <= soonestEnemy) {
    const candidates = preferredTarget === undefined ? living : living.filter(({ index }) => index === preferredTarget);
    const target = candidates[0] ?? living[0];
    time = playerNextAction;
    const lowHealth = playerHp / state.playerMaxHp < 0.35;
    const offenseBonus = state.playerEffects.reduce((sum, effect) =>
      effect.kind === 'defenseDamage' ? sum + state.playerStats.defense * effect.ratio : sum, 0);
    const lowBonus = lowHealth ? state.playerEffects.reduce((sum, effect) =>
      effect.kind === 'lowHealthDamage' ? sum + effect.ratio : sum, 0) : 0;
    let random = nextRandom(rngState);
    rngState = random.state;
    const critical = random.value < state.playerStats.critChance;
    const base = state.playerStats.strength + offenseBonus;
    const damage = Math.max(1, Math.round(base * (critical ? state.playerStats.critDamage : 1) * (1 + lowBonus)));
    target.enemy.currentHp = Math.max(0, target.enemy.currentHp - damage);
    log = pushLog(log, `Vous infligez ${damage}${critical ? ' critique' : ''} à ${target.enemy.name}.`);
    const chain = state.playerEffects.slice(0, BALANCE.extraEffectChainLimit);
    if (state.playerEffects.length > BALANCE.extraEffectChainLimit) {
      log = pushLog(log, 'Diagnostic : limite de sécurité des effets atteinte.');
    }
    const lifesteal = chain.filter((effect) => effect.kind === 'lifesteal')
      .reduce((sum, effect) => sum + effect.ratio, 0);
    if (lifesteal > 0) playerHp = Math.min(state.playerMaxHp, playerHp + Math.floor(damage * lifesteal));
    for (const effect of chain) {
      if (target.enemy.currentHp > 0 && effect.kind === 'poison') {
          target.enemy.poisonDamage = Math.min(50, target.enemy.poisonDamage + effect.damage);
          target.enemy.poisonTurns = Math.min(BALANCE.poisonMaxTurns, Math.max(target.enemy.poisonTurns, effect.turns));
      }
      if (effect.kind === 'extraStrike' && target.enemy.currentHp > 0) {
        target.enemy.currentHp = Math.max(0, target.enemy.currentHp - Math.max(1, Math.round(base * effect.ratio)));
        log = pushLog(log, `Frappe supplémentaire : ${target.enemy.name} subit des dégâts.`);
      }
      if (effect.kind === 'cleave') for (const other of living) {
        if (other.index !== target.index && other.enemy.currentHp > 0) {
          other.enemy.currentHp = Math.max(0, other.enemy.currentHp - Math.max(1, Math.round(damage * effect.ratio)));
          log = pushLog(log, `Dégâts de zone : ${other.enemy.name} est touché.`);
        }
      }
    }
    playerNextAction += BALANCE.baseActionTime / state.playerStats.speed;
  } else {
    const acting = living.sort((a, b) => a.enemy.nextAction - b.enemy.nextAction || a.index - b.index)[0].enemy;
    time = acting.nextAction;
    if (acting.poisonTurns > 0) {
      acting.currentHp = Math.max(0, acting.currentHp - acting.poisonDamage);
      acting.poisonTurns--;
      log = pushLog(log, `${acting.name} subit ${acting.poisonDamage} dégâts de poison.`);
      if (acting.currentHp <= 0) log = pushLog(log, `${acting.name} succombe au poison.`);
    }
    if (acting.currentHp > 0) {
      const hit = damageAfterDefense(acting.strength, state.playerStats.defense);
      const absorbed = Math.min(shield, hit);
      shield -= absorbed;
      playerHp = Math.max(0, playerHp - (hit - absorbed));
      log = pushLog(log, `${acting.name} vous inflige ${hit - absorbed} dégâts${absorbed ? ` (${absorbed} bloqués)` : ''}.`);
    }
    acting.nextAction += BALANCE.baseActionTime / acting.speed;
  }
  const allDead = enemies.every((enemy) => enemy.currentHp <= 0);
  const over = allDead ? 'win' : playerHp <= 0 ? 'loss' : 'none';
  if (over === 'win') log = pushLog(log, 'Victoire !');
  if (over === 'loss') log = pushLog(log, 'Vous êtes tombé au combat.');
  return {
    ...state, enemies, playerHp, shield, time, playerNextAction, log, rngState,
    targetIndex: living.some(({ index }) => index === (preferredTarget ?? state.targetIndex)) ? (preferredTarget ?? state.targetIndex) : living[0].index,
    over,
  };
}

export function rollEncounter(run: RunState, zoneId: string): { run: RunState; enemies: string[] } {
  const zone = ZONES.find((entry) => entry.id === zoneId);
  if (!zone) return { run, enemies: ['slime'] };
  let random = nextRandom(run.rngState);
  const count = 1 + Math.floor(random.value * 3);
  let state = random.state;
  const enemies = Array.from({ length: count }, () => {
    random = nextRandom(state);
    state = random.state;
    return zone.enemies[Math.floor(random.value * zone.enemies.length)];
  });
  return { run: { ...run, rngState: state }, enemies };
}

export function equipItem(run: RunState, instanceId: string, slot: Slot | 'charm2'): RunState {
  const instance = run.inventory.find((entry) => entry.instanceId === instanceId);
  const item = ITEMS.find((candidate) => candidate.id === instance?.itemId);
  if (!instance || !item || (slot === 'charm2' ? item.slot !== 'charm' : item.slot !== slot)) return run;
  if (Object.entries(run.equipment).some(([equippedSlot, equippedId]) => equippedId === instanceId && equippedSlot !== slot)) return run;
  const updated = { ...run, equipment: { ...run.equipment, [slot]: instanceId } };
  return { ...updated, hp: Math.min(deriveStats(updated).maxHp, run.hp) };
}

export function useConsumable(run: RunState, instanceId: string): RunState {
  const instance = run.inventory.find((entry) => entry.instanceId === instanceId);
  const item = ITEMS.find((candidate) => candidate.id === instance?.itemId && candidate.slot === 'consumable');
  if (!instance || !item?.heal) return run;
  const maxHp = deriveStats(run).maxHp;
  const heal = Math.min(Math.round(maxHp * BALANCE.healCap), item.heal, maxHp - run.hp);
  if (heal <= 0) return run;
  return { ...run, hp: run.hp + heal, inventory: run.inventory.filter((entry) => entry.instanceId !== instanceId) };
}

export function validateRun(value: unknown): RunState {
  if (!value || typeof value !== 'object') throw new Error('Sauvegarde de partie invalide.');
  const run = value as Partial<RunState>;
  if (run.version !== 2 || typeof run.developerMode !== 'boolean' || (run.hero !== 'warrior' && run.hero !== 'assassin') ||
      typeof run.level !== 'number' || typeof run.hp !== 'number' || !Number.isFinite(run.hp) ||
      !run.position || !Number.isFinite(run.position.x) || !Number.isFinite(run.position.y) ||
      !Array.isArray(run.inventory) || !Array.isArray(run.passives) ||
      !run.inventory.every((item) => item && typeof item.instanceId === 'string' && ITEMS.some((entry) => entry.id === item.itemId)) ||
      new Set(run.inventory.map((item) => item.instanceId)).size !== run.inventory.length ||
      (run.pendingCombat !== null && run.pendingCombat !== undefined && !Array.isArray(run.pendingCombat)) ||
      !['active', 'victory', 'death'].includes(run.result ?? '')) {
    throw new Error('La sauvegarde de partie est corrompue ou d’une version inconnue.');
  }
  const instanceIds = new Set(run.inventory.map((item) => item.instanceId));
  if (Object.values(run.equipment ?? {}).some((instanceId) => instanceId !== undefined && !instanceIds.has(instanceId))) {
    throw new Error('La sauvegarde référence un équipement absent de l’inventaire.');
  }
  if (typeof run.xp !== 'number' || typeof run.xpToNext !== 'number' ||
      run.level < 1 || !Number.isSafeInteger(run.level) || !Number.isSafeInteger(run.rngState) ||
      !Number.isFinite(run.xp) || !Number.isFinite(run.xpToNext) || run.xp < 0 || run.xpToNext <= 0) {
    throw new Error('La sauvegarde contient des statistiques de progression invalides.');
  }
  return run as RunState;
}

export function decodeRun(raw: string): RunState {
  const parsed: unknown = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === 0) {
    const old = parsed as { hero?: HeroId; hp?: number; position?: { x: number; y: number } };
    const migrated = newRun(old.hero === 'assassin' ? 'assassin' : 'warrior');
    return { ...migrated, hp: Math.max(1, old.hp ?? migrated.hp), position: old.position ?? migrated.position };
  }
  if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === 1) {
    const old = parsed as Partial<RunState> & { inventory?: (string | ItemInstance)[] };
    if (!Array.isArray(old.inventory)) throw new Error('La sauvegarde héritée ne contient pas d’inventaire valide.');
    const instances: ItemInstance[] = old.inventory.map((entry, index) => typeof entry === 'string'
      ? { instanceId: `legacy-${index}-${entry}`, itemId: entry }
      : entry);
    const oldEquipment = old.equipment as Partial<Record<Slot, string>> | undefined;
    const equipment: RunState['equipment'] = {};
    for (const [slot, itemId] of Object.entries(oldEquipment ?? {})) {
      const match = instances.find((instance) => instance.itemId === itemId);
      if (match && (slot === 'weapon' || slot === 'armor' || slot === 'charm' || slot === 'charm2')) equipment[slot] = match.instanceId;
    }
    return validateRun({
      ...old, version: 2, developerMode: false, inventory: instances, equipment,
      distanceSinceEncounterCheck: old.distanceSinceEncounterCheck ?? 0,
      pendingCombat: old.pendingCombat ?? null,
    });
  }
  return validateRun(parsed);
}

export function slotForItem(itemId: string): Slot | undefined {
  const slot = ITEMS.find((item) => item.id === itemId)?.slot;
  return slot === 'weapon' || slot === 'armor' || slot === 'charm' ? slot : undefined;
}

export function itemForInstance(run: RunState, instanceId: string | undefined): ItemDefinition | undefined {
  const instance = run.inventory.find((entry) => entry.instanceId === instanceId);
  return ITEMS.find((item) => item.id === instance?.itemId);
}
