import { ACHIEVEMENTS, BALANCE, ENEMIES, HEROES, ITEMS, PASSIVES, STARTING_OPTIONS, ZONES, masteryRank, type StartOption } from './content';
import { WORLD_START, WORLD_VERSION, ZONE_ENTRIES } from './world';
import type { AchievementDefinition, CombatState, Effect, HeroId, ItemDefinition, ItemInstance, Profile, RunState, Slot, Stats } from './types';

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

export interface Loadout { weapon?: string; passive?: string }

export function isStartOptionUnlocked(option: StartOption, profile: Profile, hero: HeroId): boolean {
  return masteryRank(profile.mastery[hero]) >= option.masteryRequired;
}

/** Retourne le choix demandé s'il est proposé et débloqué, sinon le choix de base de la classe. */
export function resolveLoadout(hero: HeroId, profile: Profile, loadout: Loadout = profile.startingLoadouts?.[hero] ?? {}): Required<Loadout> {
  const pick = (options: StartOption[], wanted?: string) => {
    const found = options.find((option) => option.id === wanted);
    return found && isStartOptionUnlocked(found, profile, hero) ? found.id : options[0].id;
  };
  return { weapon: pick(STARTING_OPTIONS[hero].weapons, loadout.weapon), passive: pick(STARTING_OPTIONS[hero].passives, loadout.passive) };
}

export function rememberLoadout(profile: Profile, hero: HeroId, loadout: Loadout): Profile {
  return { ...profile, startingLoadouts: { ...profile.startingLoadouts, [hero]: resolveLoadout(hero, profile, loadout) } };
}

export function newRun(hero: HeroId, seed = 0x71a9c3, loadout?: Required<Loadout>): RunState {
  const start = HEROES[hero];
  const run: RunState = {
    version: 2, worldVersion: WORLD_VERSION, developerMode: false, hero, level: 1, xp: 0, xpToNext: 60, unspentPoints: 0, invested: {},
    hp: start.stats.maxHp, position: { ...WORLD_START }, encounterMeter: 0, distanceSinceEncounterCheck: 0, rngState: seed >>> 0 || 1,
    inventory: [
      { instanceId: 'starter-weapon', itemId: loadout?.weapon ?? start.startingItem },
      { instanceId: 'starter-potion', itemId: 'small-potion' },
    ],
    equipment: { weapon: 'starter-weapon' },
    passives: [{ id: loadout?.passive ?? STARTING_OPTIONS[hero].passives[0].id, rank: 1 }], pendingPassivePicks: 0, pendingCombat: null, defeatedBosses: [], secrets: [], usedShrines: [],
    kills: 0, victories: 0, result: 'active',
  };
  return { ...run, hp: deriveStats(run).maxHp };
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
  const updated = { ...run, xp: run.xp + Math.max(0, amount), pendingPassivePicks: 0 };
  while (updated.xp >= updated.xpToNext) {
    updated.xp -= updated.xpToNext;
    updated.level++;
    updated.unspentPoints += BALANCE.statPointsPerLevel;
    updated.xpToNext = Math.round(60 + (updated.level - 1) * 24);
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
      const chance = encounterChance(meter);
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

export function encounterChance(meter: number): number {
  return meter >= BALANCE.maxEncounterMeter ? 1 : clamp(0.005 + 0.995 * meter ** 6, 0, 1);
}

/** Exact probabilities per defeated monster, shared by the loot roll and UI. */
export function lootOdds(run: RunState, enemyId: string, profile: Profile) {
  return lootOddsForLuck(deriveStats(run).luck, enemyId, profile);
}

export function lootOddsForLuck(luck: number, enemyId: string, profile: Profile) {
  const chance = clamp(0.12 * (1 + luck * 0.025), 0.03, 0.45);
  const entries = (ENEMIES.find((enemy) => enemy.id === enemyId)?.loot ?? []).map((entry) => {
    const item = ITEMS.find((item) => item.id === entry.itemId)!;
    const unlocked = canDrop(entry.itemId, profile);
    const bonus = item.rarity === 'epic' ? 0.055 : item.rarity === 'rare' ? 0.035 : 0;
    return { ...entry, item, unlocked, effectiveWeight: unlocked ? entry.weight * (1 + luck * bonus) : 0 };
  });
  const total = entries.reduce((sum, entry) => sum + entry.effectiveWeight, 0);
  return { chance: total > 0 ? chance : 0, entries: entries.map((entry) => ({ ...entry,
    probability: total > 0 ? chance * entry.effectiveWeight / total : 0 })) };
}

export function rollLoot(run: RunState, enemyId: string, profile: Profile): { run: RunState; drops: string[] } {
  const enemy = ENEMIES.find((candidate) => candidate.id === enemyId);
  if (!enemy) return { run, drops: [] };
  let rngState = run.rngState;
  const odds = lootOdds(run, enemyId, profile);
  const chance = odds.chance;
  let roll = nextRandom(rngState);
  rngState = roll.state;
  if (roll.value >= chance) return { run: { ...run, rngState }, drops: [] };
  const eligible = odds.entries.filter((entry) => entry.unlocked);
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

export function creditMastery(profile: Profile, run: RunState): { profile: Profile; run: RunState } {
  if (run.developerMode) return { profile, run };
  const earned = Math.max(0, run.level - 1);
  const gained = Math.max(0, earned - (run.masteryBanked ?? 0));
  if (gained === 0) return { profile, run };
  return {
    profile: { ...profile, mastery: { ...profile.mastery, [run.hero]: profile.mastery[run.hero] + gained } },
    run: { ...run, masteryBanked: earned },
  };
}

export function achievementMet(achievement: AchievementDefinition, run: RunState, profile: Profile): boolean {
  if (achievement.hero && achievement.hero !== run.hero) return false;
  const { condition } = achievement;
  switch (condition.kind) {
    case 'kills': return run.kills >= condition.value;
    case 'level': return run.level >= condition.value;
    case 'boss': return run.defeatedBosses.includes(condition.value);
    case 'secrets': return run.secrets.length >= condition.value;
    case 'masteryRank': return masteryRank(profile.mastery[run.hero]) >= condition.value;
  }
}

export function applyProgress(profile: Profile, run: RunState): { profile: Profile; run: RunState } {
  const credited = creditMastery(profile, run);
  return { profile: addAchievements(credited.profile, credited.run), run: credited.run };
}

export function addAchievements(profile: Profile, run: RunState): Profile {
  let achievements = [...profile.achievements];
  // Une récompense de maîtrise peut en débloquer une autre : on itère jusqu'à stabilité.
  for (let pass = 0; pass < ACHIEVEMENTS.length; pass++) {
    const earned = ACHIEVEMENTS.filter((achievement) => achievementMet(achievement, run, profile)).map((achievement) => achievement.id);
    const merged = [...new Set([...achievements, ...earned])];
    if (merged.length === achievements.length) break;
    achievements = merged;
  }
  const unlocks = ACHIEVEMENTS.flatMap((achievement) => achievements.includes(achievement.id) ? achievement.unlocks ?? [] : []);
  const paths = ACHIEVEMENTS.flatMap((achievement) => achievements.includes(achievement.id) && achievement.path ? [achievement.path] : []);
  const unlockedItems = [...new Set([...profile.unlockedItems, ...unlocks.filter((id) => ITEMS.some((item) => item.id === id))])];
  const unlockedPassives = [...new Set([
    ...profile.unlockedPassives,
    ...unlocks.filter((id) => PASSIVES.some((passive) => passive.id === id)),
  ])];
  return { ...profile, achievements, unlockedItems, unlockedPassives, paths: [...new Set([...profile.paths, ...paths])] };
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
    playerHp: run.hp, playerMaxHp: stats.maxHp, playerStats: stats, playerEffects: effects, lifestealRemainder: clamp(run.lifestealRemainder ?? 0, 0, 1 - Number.EPSILON), shield,
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
  let lifestealRemainder = clamp(state.lifestealRemainder ?? 0, 0, 1 - Number.EPSILON);
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
    let dealtDamage = Math.min(target.enemy.currentHp, damage);
    target.enemy.currentHp = Math.max(0, target.enemy.currentHp - damage);
    log = pushLog(log, `Vous infligez ${damage}${critical ? ' critique' : ''} à ${target.enemy.name}.`);
    const chain = state.playerEffects.slice(0, BALANCE.extraEffectChainLimit);
    if (state.playerEffects.length > BALANCE.extraEffectChainLimit) {
      log = pushLog(log, 'Diagnostic : limite de sécurité des effets atteinte.');
    }
    const lifesteal = chain.filter((effect) => effect.kind === 'lifesteal')
      .reduce((sum, effect) => sum + effect.ratio, 0);
    for (const effect of chain) {
      if (target.enemy.currentHp > 0 && effect.kind === 'poison') {
          target.enemy.poisonDamage = Math.min(50, target.enemy.poisonDamage + effect.damage);
          target.enemy.poisonTurns = Math.min(BALANCE.poisonMaxTurns, Math.max(target.enemy.poisonTurns, effect.turns));
      }
      if (effect.kind === 'extraStrike' && target.enemy.currentHp > 0) {
        const extraDamage = Math.max(1, Math.round(base * effect.ratio));
        dealtDamage += Math.min(target.enemy.currentHp, extraDamage);
        target.enemy.currentHp = Math.max(0, target.enemy.currentHp - extraDamage);
        log = pushLog(log, `Frappe supplémentaire : ${target.enemy.name} subit des dégâts.`);
      }
      if (effect.kind === 'cleave') for (const other of living) {
        if (other.index !== target.index && other.enemy.currentHp > 0) {
          const cleaveDamage = Math.max(1, Math.round(damage * effect.ratio));
          dealtDamage += Math.min(other.enemy.currentHp, cleaveDamage);
          other.enemy.currentHp = Math.max(0, other.enemy.currentHp - cleaveDamage);
          log = pushLog(log, `Dégâts de zone : ${other.enemy.name} est touché.`);
        }
      }
    }
    if (lifesteal > 0 && playerHp < state.playerMaxHp) {
      const healing = dealtDamage * lifesteal + lifestealRemainder;
      const whole = Math.floor(healing + 1e-9);
      const restored = Math.min(state.playerMaxHp - playerHp, whole);
      playerHp += restored;
      lifestealRemainder = playerHp >= state.playerMaxHp ? 0 : Math.max(0, healing - whole);
      if (restored > 0) log = pushLog(log, `Vol de vie : +${restored} PV.`);
    } else {
      lifestealRemainder = 0;
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
    ...state, enemies, playerHp, lifestealRemainder, shield, time, playerNextAction, log, rngState,
    targetIndex: living.some(({ index }) => index === (preferredTarget ?? state.targetIndex)) ? (preferredTarget ?? state.targetIndex) : living[0].index,
    over,
  };
}

export function rollEncounter(run: RunState, zoneId: string): { run: RunState; enemies: string[] } {
  const zone = ZONES.find((entry) => entry.id === zoneId);
  if (!zone) return { run, enemies: ['slime'] };
  let random = nextRandom(run.rngState);
  const count = 1 + Math.floor(random.value * zone.maxGroup);
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
  const currentZone = ZONES.find((zone) => !run.defeatedBosses?.includes(zone.boss)) ?? ZONES[ZONES.length - 1];
  return { ...run, pendingPassivePicks: 0, worldVersion: WORLD_VERSION, position: run.worldVersion === WORLD_VERSION ? run.position : { ...ZONE_ENTRIES[currentZone.id] } } as RunState;
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
