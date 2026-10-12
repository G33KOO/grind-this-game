import { useState } from 'react';
import { ACHIEVEMENTS, HEROES, ITEMS, PASSIVES, STARTING_OPTIONS, type StartOption } from '../game/content';
import { isStartOptionUnlocked, type Loadout } from '../game/engine';
import type { HeroId, Profile } from '../game/types';
import { ItemIcon, RARITIES, passiveRarity, type Rarity } from './icons';

interface OptionView { id: string; name: string; description: string; rarity: Rarity }

function OptionGroup({ title, options, describe, selected, onSelect, profile }: {
  title: string; options: StartOption[]; describe: (id: string) => OptionView; selected: string; onSelect: (id: string) => void; profile: Profile;
}) {
  return <section className="loadout-group">
    <h3>{title}</h3>
    <div className="passive-grid">
      {options.map((option) => {
        const view = describe(option.id);
        const unlocked = isStartOptionUnlocked(option, profile);
        const achievement = ACHIEVEMENTS.find((entry) => entry.id === option.unlockAchievement);
        return <button key={option.id} type="button" disabled={!unlocked} aria-pressed={selected === option.id}
          className={`reward-tile loadout-option rarity-${view.rarity}${unlocked ? '' : ' locked'}${selected === option.id ? ' is-selected' : ''}`}
          style={{ borderColor: RARITIES[view.rarity].color }} onClick={() => onSelect(option.id)}>
          <ItemIcon id={option.id} rarity={view.rarity} size={48} />
          <div>
            <small style={{ color: RARITIES[view.rarity].color }}>{RARITIES[view.rarity].label}{option.id === options[0].id ? ' · de base' : ''}</small>
            <strong>{view.name}</strong><span>{view.description}</span>
            <em>{unlocked ? (selected === option.id ? '✔ Sélectionné' : 'Disponible') : `🔒 Succès « ${achievement?.name ?? '?'} »`}</em>
          </div>
        </button>;
      })}
    </div>
  </section>;
}

const describeWeapon = (id: string): OptionView => {
  const item = ITEMS.find((entry) => entry.id === id);
  return { id, name: item?.name ?? id, description: item?.description ?? '', rarity: (item?.rarity ?? 'common') as Rarity };
};
const describePassive = (id: string): OptionView => {
  const passive = PASSIVES.find((entry) => entry.id === id);
  return { id, name: passive?.name ?? id, description: passive?.description ?? '', rarity: passiveRarity(passive?.weight ?? 5) };
};

export function LoadoutPage({ hero, profile, onStart, onBack }: { hero: HeroId; profile: Profile; onStart: (loadout: Required<Loadout>) => void; onBack: () => void }) {
  const options = STARTING_OPTIONS[hero];
  const [weapon, setWeapon] = useState(options.weapons[0].id);
  const [passive, setPassive] = useState(options.passives[0].id);
  return <main className="shell title-screen classes-page" style={{ ['--accent' as string]: hero === 'warrior' ? '#2ee6c8' : '#ff8a4d' }}>
    <div className="title-grid" aria-hidden="true" />
    <header className="classes-head">
      <button onClick={onBack}>← Retour</button>
      <h2>{HEROES[hero].name} · équipement de départ</h2>
    </header>
    <section className="panel page-panel loadout-panel">
      <OptionGroup title="Arme de départ" options={options.weapons} describe={describeWeapon} selected={weapon} onSelect={setWeapon} profile={profile} />
      <OptionGroup title="Passif de départ" options={options.passives} describe={describePassive} selected={passive} onSelect={setPassive} profile={profile} />
      <p className="small-note">De nouvelles armes et de nouveaux passifs de départ se débloquent avec les succès.</p>
      <div className="loadout-actions"><button className="primary" onClick={() => onStart({ weapon, passive })}>Commencer la partie</button></div>
    </section>
  </main>;
}
