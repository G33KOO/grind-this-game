import { useState } from 'react';
import { HEROES, ITEMS, PASSIVES, STARTING_OPTIONS, masteryRank, type StartOption } from '../game/content';
import { isStartOptionUnlocked, resolveLoadout, type Loadout } from '../game/engine';
import type { HeroId, Profile } from '../game/types';
import { HERO_ACCENT, ItemIcon, RARITIES, passiveRarity, type Rarity } from './icons';
import { HeroPortrait } from './GameVisuals';
import { SpaceBackdrop } from './SpaceBackdrop';
import './loadout-page.css';

interface OptionView { name: string; description: string; rarity: Rarity }
const describeWeapon = (id: string): OptionView => {
  const item = ITEMS.find((entry) => entry.id === id);
  return { name: item?.name ?? id, description: item?.description ?? '', rarity: (item?.rarity ?? 'common') as Rarity };
};
const describePassive = (id: string): OptionView => {
  const passive = PASSIVES.find((entry) => entry.id === id);
  return { name: passive?.name ?? id, description: passive?.description ?? '', rarity: passiveRarity(passive?.weight ?? 5) };
};
function OptionGroup({ title, options, describe, selected, onSelect, profile, hero }: {
  title: string; options: StartOption[]; describe(id: string): OptionView; selected: string; onSelect(id: string): void; profile: Profile; hero: HeroId;
}) {
  const [focused, setFocused] = useState(selected);
  const option = options.find((entry) => entry.id === focused)!;
  const view = describe(focused);
  const unlocked = isStartOptionUnlocked(option, profile, hero);
  return <section className="starting-group" aria-label={title}>
    <h2>{title}</h2>
    <div className={`starting-options${options.length > 4 ? " is-large" : ""}`}>{options.map((entry) => {
      const item = describe(entry.id);
      const available = isStartOptionUnlocked(entry, profile, hero);
      return <button key={entry.id} aria-pressed={selected === entry.id} aria-label={`${item.name}, ${available ? selected === entry.id ? 'sélectionné' : 'disponible' : 'verrouillé, voir le déblocage'}`} className={`starting-option${available ? '' : ' is-locked'}${focused === entry.id ? ' is-focused' : ''}`} style={{ ['--rarity' as string]: RARITIES[item.rarity].color }} onClick={() => { setFocused(entry.id); if (available) onSelect(entry.id); }}>
        <ItemIcon id={entry.id} rarity={item.rarity} size={56} /><span>{item.name}</span>
        {!available && <svg className="starting-lock" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>}
        {selected === entry.id && <span className="starting-check" aria-hidden="true">✓</span>}
      </button>;
    })}</div>
    <div className="starting-description" aria-live="polite" style={{ ['--rarity' as string]: RARITIES[view.rarity].color }}><strong>{view.name}</strong><small>{RARITIES[view.rarity].label}{` · maîtrise ${option.masteryRequired}`}</small><p>{view.description}</p><span>{unlocked ? focused === selected ? 'Sélectionné' : 'Disponible' : `Maîtrise ${option.masteryRequired} requise`}</span></div>
  </section>;
}
export function LoadoutPage({ hero, profile, onStart, onBack, onChange }: { hero: HeroId; profile: Profile; onStart(loadout: Required<Loadout>): void; onBack(): void; onChange(loadout: Required<Loadout>): void }) {
  const options = STARTING_OPTIONS[hero];
  const [weapon, setWeapon] = useState(() => resolveLoadout(hero, profile).weapon);
  const [passive, setPassive] = useState(() => resolveLoadout(hero, profile).passive);
  return <main className="shell title-screen classes-page starting-screen" style={{ ['--accent' as string]: HERO_ACCENT[hero] }}>
    <SpaceBackdrop /><h1>Équipement de départ</h1>
    <div className="starting-board">
      <OptionGroup title="Arme" options={options.weapons} describe={describeWeapon} selected={weapon} onSelect={(id) => { setWeapon(id); onChange({ weapon: id, passive }); }} profile={profile} hero={hero} />
      <section className="starting-hero" aria-label={HEROES[hero].name}><h2>{HEROES[hero].name}</h2><span className="starting-mastery">Maîtrise {masteryRank(profile.mastery[hero])}</span><div className="starting-portrait"><HeroPortrait hero={hero} /></div><div className="starting-equipped" aria-label="Équipement sélectionné"><ItemIcon id={weapon} rarity={describeWeapon(weapon).rarity} size={40} /><ItemIcon id={passive} rarity={describePassive(passive).rarity} size={40} /></div></section>
      <OptionGroup title="Passif" options={options.passives} describe={describePassive} selected={passive} onSelect={(id) => { setPassive(id); onChange({ weapon, passive: id }); }} profile={profile} hero={hero} />
    </div>
    <footer className="starting-actions"><button className="primary" onClick={() => onStart({ weapon, passive })}>Commencer la partie</button><button onClick={onBack}>Retour au choix de classe</button></footer>
  </main>;
}
