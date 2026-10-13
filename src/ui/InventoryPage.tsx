import { useState } from 'react';
import { ITEMS } from '../game/content';
import { deriveStats, equipItem, useConsumable } from '../game/engine';
import type { EquipmentSlot, Profile, RunState, Stats } from '../game/types';
import { InventoryStats } from './InventoryStats';
import { HeroPortrait, MenuFooter, StatIcon, formatStatValue } from './GameVisuals';
import { HERO_ACCENT, ItemIcon, RARITIES } from './icons';

const SLOT_NAMES: Record<EquipmentSlot, string> = { weapon: 'Arme', armor: 'Armure', charm: 'Accessoire I', charm2: 'Accessoire II' };
const STAT_NAMES: Record<keyof Stats, string> = { strength: 'Force', speed: 'Vitesse', luck: 'Chance', critChance: 'Critique', critDamage: 'Dégâts critiques', maxHp: 'PV maximum', defense: 'Défense' };
const valueLabel = formatStatValue;

export function InventoryPage({ run, profile, initialTab = 'equipment', onChange, onClose }: { run: RunState; profile?: Profile; initialTab?: 'equipment' | 'stats'; onChange(run: RunState): void; onClose(): void }) {
  const [tab, setTab] = useState(initialTab);
  const wornIds = new Set(Object.values(run.equipment));
  const bag = run.inventory.filter((entry) => !wornIds.has(entry.instanceId));
  const [selection, setSelection] = useState(bag[0]?.instanceId ?? run.inventory[0]?.instanceId ?? '');
  const [filter, setFilter] = useState('all');
  const [compareSlot, setCompareSlot] = useState<EquipmentSlot>('charm');
  const instance = run.inventory.find((entry) => entry.instanceId === selection) ?? bag[0] ?? run.inventory[0];
  const visibleBag = bag.filter((entry) => filter === 'all' || ITEMS.find((item) => item.id === entry.itemId)?.slot === filter);
  const item = ITEMS.find((entry) => entry.id === instance?.itemId);
  const equipped = instance && Object.values(run.equipment).includes(instance.instanceId);
  const slot: EquipmentSlot = item?.slot === 'charm' ? compareSlot : item?.slot === 'armor' ? 'armor' : 'weapon';
  const stats = deriveStats(run);
  const compared = item && instance && item.slot !== 'consumable' ? deriveStats(equipItem(run, instance.instanceId, slot)) : stats;
  const worn = ITEMS.find((entry) => entry.id === run.inventory.find((entry) => entry.instanceId === run.equipment[slot])?.itemId);
  return <section className="panel modal-panel inventory-page" role="dialog" aria-modal="true" aria-label="Inventaire">
    <div className="panel-heading"><div><h2>Inventaire</h2></div><button onClick={onClose}>Retour <kbd>Échap</kbd></button></div>
    <nav className="inventory-tabs" aria-label="Pages de l’inventaire"><button aria-pressed={tab === 'equipment'} onClick={() => setTab('equipment')}>Équipement</button><button aria-pressed={tab === 'stats'} onClick={() => setTab('stats')}>Statistiques{run.unspentPoints > 0 ? ` · ${run.unspentPoints}` : ''}</button></nav>
    {tab === 'stats' ? <InventoryStats run={run} profile={profile} onChange={onChange} /> : <div className="arsenal-layout">
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
      </aside>
      <div className="bag-panel">
        <div className="bag-heading"><h3>Sacoche</h3><span>{bag.length} objet{bag.length !== 1 ? 's' : ''}</span></div>
        <nav className="item-filters" aria-label="Filtrer la sacoche">{[['all', 'Tout'], ['weapon', 'Armes'], ['armor', 'Armures'], ['charm', 'Reliques'], ['consumable', 'Soins']].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</nav>
        <div className="bag-grid">{visibleBag.map((entry) => {
          const definition = ITEMS.find((item) => item.id === entry.itemId)!;
          return <button key={entry.instanceId} className={`bag-item ${instance?.instanceId === entry.instanceId ? 'is-selected' : ''}`} aria-pressed={instance?.instanceId === entry.instanceId} aria-label={definition.name} onClick={() => setSelection(entry.instanceId)} onFocus={() => setSelection(entry.instanceId)} style={{ ['--rarity' as string]: RARITIES[definition.rarity].color }}>
            <ItemIcon id={definition.id} rarity={definition.rarity} size={60} /><small>{definition.name}</small>
          </button>;
        })}</div>
        {!visibleBag.length && <p className="empty-bag">{bag.length ? 'Aucun objet dans cette catégorie.' : 'Votre sacoche est vide.'}</p>}
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
    </div>}<MenuFooter />
  </section>;
}
