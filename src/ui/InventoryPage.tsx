import { useState } from 'react';
import { ITEMS } from '../game/content';
import { deriveStats, equipItem, useConsumable } from '../game/engine';
import type { EquipmentSlot, RunState, Stats } from '../game/types';
import { HeroPortrait, MenuFooter, StatIcon } from './GameVisuals';
import { HERO_ACCENT, ItemIcon, RARITIES } from './icons';

const SLOT_NAMES: Record<EquipmentSlot, string> = { weapon: 'Arme', armor: 'Armure', charm: 'Accessoire I', charm2: 'Accessoire II' };
const STAT_NAMES: Record<keyof Stats, string> = { strength: 'Force', speed: 'Vitesse', luck: 'Chance', critChance: 'Critique', critDamage: 'Dégâts critiques', maxHp: 'PV maximum', defense: 'Défense' };
const valueLabel = (key: keyof Stats, value: number) => key === 'critChance' ? `${Math.round(value * 100)} %` : Number.isInteger(value) ? `${value}` : value.toFixed(2);

export function InventoryPage({ run, onChange, onClose }: { run: RunState; onChange(run: RunState): void; onClose(): void }) {
  const [selection, setSelection] = useState(run.inventory[0]?.instanceId ?? '');
  const [filter, setFilter] = useState('all');
  const [compareSlot, setCompareSlot] = useState<EquipmentSlot>('charm');
  const instance = run.inventory.find((entry) => entry.instanceId === selection) ?? run.inventory[0];
  const item = ITEMS.find((entry) => entry.id === instance?.itemId);
  const equipped = instance && Object.values(run.equipment).includes(instance.instanceId);
  const slot: EquipmentSlot = item?.slot === 'charm' ? compareSlot : item?.slot === 'armor' ? 'armor' : 'weapon';
  const stats = deriveStats(run);
  const compared = item && instance && item.slot !== 'consumable' ? deriveStats(equipItem(run, instance.instanceId, slot)) : stats;
  const worn = ITEMS.find((entry) => entry.id === run.inventory.find((entry) => entry.instanceId === run.equipment[slot])?.itemId);
  return <section className="panel modal-panel inventory-page" role="dialog" aria-modal="true" aria-label="Inventaire">
    <div className="panel-heading"><div><p className="eyebrow">ARSENAL</p><h2>Équipement</h2></div><button onClick={onClose}>Retour <kbd>Échap</kbd></button></div>
    <div className="arsenal-layout">
      <aside className="paperdoll" style={{ ['--accent' as string]: HERO_ACCENT[run.hero] }}>
        <div className="paperdoll-title"><span>NIVEAU {run.level}</span><strong>{run.hero === 'warrior' ? 'Guerrier' : 'Assassin'}</strong></div>
        <HeroPortrait hero={run.hero} />
        <div className="paperdoll-slots">{(Object.keys(SLOT_NAMES) as EquipmentSlot[]).map((entry) => {
          const wornInstance = run.inventory.find((instance) => instance.instanceId === run.equipment[entry]);
          const definition = ITEMS.find((item) => item.id === wornInstance?.itemId);
          return <button key={entry} className="gear-slot" title={definition?.name ?? SLOT_NAMES[entry]} onClick={() => { if (wornInstance) setSelection(wornInstance.instanceId); if (entry === 'charm' || entry === 'charm2') setCompareSlot(entry); }}>
            {definition ? <ItemIcon id={definition.id} rarity={definition.rarity} size={52} /> : <span className="empty-slot">{entry === 'weapon' ? '⚔' : entry === 'armor' ? '⬡' : '◇'}</span>}
            <small>{SLOT_NAMES[entry]}</small>
          </button>;
        })}</div>
        <div className="paperdoll-stats">{(['strength', 'defense', 'speed', 'maxHp'] as const).map((key) => <div key={key}><StatIcon stat={key} /><span>{STAT_NAMES[key]}</span><b>{valueLabel(key, stats[key])}</b></div>)}</div>
      </aside>
      <div className="bag-panel">
        <div className="bag-heading"><h3>Sacoche</h3><span>{run.inventory.length} objets</span></div>
        <nav className="item-filters" aria-label="Filtrer la sacoche">{[['all', 'Tout'], ['weapon', 'Armes'], ['armor', 'Armures'], ['charm', 'Reliques'], ['consumable', 'Soins']].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</nav>
        <div className="bag-grid">{run.inventory.filter((entry) => filter === 'all' || ITEMS.find((item) => item.id === entry.itemId)?.slot === filter).map((entry) => {
          const definition = ITEMS.find((item) => item.id === entry.itemId)!;
          const isWorn = Object.values(run.equipment).includes(entry.instanceId);
          return <button key={entry.instanceId} className={`bag-item ${selection === entry.instanceId ? 'is-selected' : ''}`} aria-pressed={selection === entry.instanceId} aria-label={`${definition.name}${isWorn ? ', équipé' : ''}`} onClick={() => setSelection(entry.instanceId)} onFocus={() => setSelection(entry.instanceId)} style={{ ['--rarity' as string]: RARITIES[definition.rarity].color }}>
            <ItemIcon id={definition.id} rarity={definition.rarity} size={60} />{isWorn && <span className="equipped-marker">◆</span>}<small>{definition.name}</small>
          </button>;
        })}</div>
        {run.inventory.every((entry) => filter !== 'all' && ITEMS.find((item) => item.id === entry.itemId)?.slot !== filter) && <p className="empty-bag">Aucun objet dans cette catégorie.</p>}
      </div>
      <aside className="item-inspector" style={{ ['--rarity' as string]: item ? RARITIES[item.rarity].color : '#2ee6c8' }}>
        {item && instance ? <>
          <div className="inspect-art"><ItemIcon id={item.id} rarity={item.rarity} size={112} /></div>
          <p className="eyebrow">{RARITIES[item.rarity].label} · {item.slot === 'consumable' ? 'Consommable' : SLOT_NAMES[slot]}</p>
          <h3>{item.name}</h3><p className="item-flavor">{item.description}</p>
          {item.slot === 'charm' && <div className="button-group">{(['charm', 'charm2'] as const).map((entry) => <button key={entry} aria-pressed={compareSlot === entry} onClick={() => setCompareSlot(entry)}>{SLOT_NAMES[entry]}</button>)}</div>}
          {item.slot !== 'consumable' && <><p className="comparison-title">{equipped ? 'Actuellement équipé' : `Remplace : ${worn?.name ?? 'emplacement vide'}`}</p>
            <div className="inspect-stats">{(Object.keys(stats) as (keyof Stats)[]).filter((key) => stats[key] !== compared[key] || item.stats?.[key] !== undefined).map((key) => <div key={key}><StatIcon stat={key} /><span>{STAT_NAMES[key]}</span><b>{valueLabel(key, stats[key])}</b><strong className={compared[key] >= stats[key] ? 'positive' : 'negative'}>→ {valueLabel(key, compared[key])}</strong></div>)}</div>
            {item.effects?.length ? <p className="effect-callout">✦ Effet : {item.description}</p> : null}
            {!equipped && worn?.effects?.length ? <p className="small-note">Effet remplacé : {worn.description}</p> : null}
          </>}
          <div className="inspect-actions">{item.slot === 'consumable' ? <button className="primary" disabled={run.hp >= stats.maxHp} onClick={() => onChange(useConsumable(run, instance.instanceId))}>Utiliser · {run.hp}/{stats.maxHp} PV</button> : equipped ? <button onClick={() => {
            const equipment = Object.fromEntries(Object.entries(run.equipment).filter(([, id]) => id !== instance.instanceId));
            const updated = { ...run, equipment };
            onChange({ ...updated, hp: Math.min(run.hp, deriveStats(updated).maxHp) });
          }}>Retirer l’objet</button> : <button className="primary" onClick={() => onChange(equipItem(run, instance.instanceId, slot))}>Équiper {item.slot === 'charm' ? SLOT_NAMES[slot] : ''}</button>}</div>
        </> : <p>Votre sacoche est vide.</p>}
      </aside>
    </div><MenuFooter />
  </section>;
}
