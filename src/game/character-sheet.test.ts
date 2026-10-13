import { describe, expect, it } from 'vitest';
import { characterTraits } from './character-sheet';
import { newRun, startCombat } from './engine';

describe('character sheet combat traits', () => {
  it('shows starting effects and never counts unequipped items', () => {
    const run = newRun('warrior');
    const traits = characterTraits(run);
    expect(traits.shield).toBe(startCombat(run, ['slime']).shield);
    expect(traits.shield).toBe(8);
    expect(traits.lifesteal).toBe(0);
    expect(characterTraits(newRun('assassin')).extraStrike).toBe(20);
  });

  it('combines active passive ranks and shows every supported combat bonus', () => {
    const run = { ...newRun('warrior'), passives: [
      { id: 'battle-heart', rank: 1 }, { id: 'stone-heart', rank: 1 },
      { id: 'shielded', rank: 1 }, { id: 'cleaving-blow', rank: 1 },
      { id: 'war-cry', rank: 1 }, { id: 'fortress', rank: 1 },
    ] };
    expect(characterTraits(run)).toMatchObject({ lifesteal: 20, shield: 24, cleave: 60, lowHealthDamage: 25, defenseDamage: 60, poisonDamage: 0, poisonTurns: 0 });
  });

  it('caps poison consistently with combat and reports integer percentages', () => {
    const run = { ...newRun('assassin'), passives: [{ id: 'venom', rank: 20 }] };
    // Combat's effect chain is limited to 12 applications: 12 × 4 = 48.
    expect(characterTraits(run)).toMatchObject({ poisonDamage: 48, poisonTurns: 3 });
    expect(Object.values(characterTraits(run)).every(Number.isInteger)).toBe(true);
  });
});
