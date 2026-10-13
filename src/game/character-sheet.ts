import { BALANCE } from './content';
import { activeEffects, deriveStats } from './engine';
import type { RunState } from './types';

export function characterTraits(run: RunState) {
  const stats = deriveStats(run);
  const effects = activeEffects(run);
  const chain = effects.slice(0, BALANCE.extraEffectChainLimit);
  let lifesteal = 0, cleave = 0, extraStrike = 0, poisonDamage = 0, poisonTurns = 0;
  let shield = 0, lowHealthDamage = 0, defenseDamage = 0;
  for (const effect of effects) {
    if (effect.kind === 'shield') shield += effect.amount;
    if (effect.kind === 'lowHealthDamage') lowHealthDamage += effect.ratio;
    if (effect.kind === 'defenseDamage') defenseDamage += effect.ratio;
  }
  for (const effect of chain) {
    if (effect.kind === 'lifesteal') lifesteal += effect.ratio;
    if (effect.kind === 'cleave') cleave += effect.ratio;
    if (effect.kind === 'extraStrike') extraStrike += effect.ratio;
    if (effect.kind === 'poison') {
      poisonDamage += effect.damage;
      poisonTurns = Math.max(poisonTurns, effect.turns);
    }
  }
  return {
    lifesteal: Math.round(lifesteal * 100), cleave: Math.round(cleave * 100),
    extraStrike: Math.round(extraStrike * 100), shield: Math.round(shield),
    poisonDamage: Math.min(50, Math.round(poisonDamage)), poisonTurns: Math.min(BALANCE.poisonMaxTurns, poisonTurns),
    lowHealthDamage: Math.round(lowHealthDamage * 100), defenseDamage: Math.round(defenseDamage * 100),
    damageReduction: Math.round(Math.min(BALANCE.defenseReductionCap, stats.defense / (stats.defense + 100)) * 100),
  };
}
