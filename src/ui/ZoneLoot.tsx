import { useState } from 'react';
import { ACHIEVEMENTS, ENEMIES, ZONES } from '../game/content';
import { deriveStats, lootOdds } from '../game/engine';
import type { Profile, RunState } from '../game/types';
import { zoneAt } from '../game/world';
import { ItemIcon, RARITIES } from './icons';
import { MonsterPortrait, StatIcon } from './GameVisuals';
import './zone-loot.css';

const percent = (value: number) => `${(value * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

export function ZoneLoot({ run, profile, onClose }: { run: RunState; profile: Profile; onClose(): void }) {
  const current = zoneAt(run.position.x, run.position.y);
  const [selected, setSelected] = useState<string>(current.id);
  const [monster, setMonster] = useState<string>(current.enemies[0]);
  const [itemId, setItemId] = useState<string | null>(null);
  const zone = ZONES.find((entry) => entry.id === selected)!;
  const enemy = ENEMIES.find((entry) => entry.id === monster)!;
  const boss = enemy.id === zone.boss;
  const odds = lootOdds(run, enemy.id, profile);
  const rows = odds.entries.filter((entry, index, entries) => entries.findIndex((candidate) => candidate.itemId === entry.itemId) === index)
    .map((entry) => ({ ...entry, probability: odds.entries.filter((candidate) => candidate.itemId === entry.itemId).reduce((sum, candidate) => sum + candidate.probability, 0) }));
  const focused = rows.find((entry) => entry.itemId === itemId) ?? rows[0];
  const unlock = focused?.item.unlockAchievement ? ACHIEVEMENTS.find((entry) => entry.id === focused.item.unlockAchievement) : undefined;
  const guarded = zone.requires && !run.defeatedBosses.includes(zone.requires);
  const guardName = ENEMIES.find((entry) => entry.id === zone.requires)?.name;
  const vitals = [
    { stat: 'maxHp', label: 'PV', value: enemy.hp }, { stat: 'strength', label: 'Force', value: enemy.strength },
    { stat: 'defense', label: 'Défense', value: enemy.defense }, { stat: 'speed', label: 'Vitesse', value: enemy.speed },
    { stat: 'luck', label: 'XP', value: enemy.xp },
  ];
  return <section className="panel modal-panel zone-loot-panel loot-atlas" role="dialog" aria-modal="true" aria-labelledby="loot-title">
    <header className="loot-heading"><h2 id="loot-title">Butin</h2></header>
    <nav className="loot-zones" aria-label="Choisir une zone">{ZONES.map((entry) => <button key={entry.id} aria-pressed={selected === entry.id} onClick={() => { setSelected(entry.id); setMonster(entry.enemies[0]); setItemId(null); }}><strong>{entry.name}</strong><span>Niveau {entry.level}{entry.id === current.id ? ' · Ici' : ''}</span></button>)}</nav>
    <div className="loot-zone-facts"><span>{zone.maxGroup === 1 ? '1 ennemi par rencontre' : `1 à ${zone.maxGroup} ennemis par rencontre`}</span><span><StatIcon stat="luck" /> Chance <strong>{deriveStats(run).luck}</strong></span><span className={guarded ? 'is-guarded' : 'is-open'}>{guarded ? `Accès gardé : ${guardName}` : 'Zone accessible'}</span></div>
    <div className="loot-layout">
      <nav className="loot-monsters" aria-label="Monstres de la zone">{[...zone.enemies, zone.boss].map((id) => {
        const creature = ENEMIES.find((entry) => entry.id === id)!;
        return <button key={id} aria-pressed={monster === id} onClick={() => { setMonster(id); setItemId(null); }}><MonsterPortrait id={id} color={creature.color} /><span><strong>{creature.name}</strong><small>{id === zone.boss ? 'Boss · au contact' : `${percent(1 / zone.enemies.length)} par tirage`}</small></span></button>;
      })}</nav>
      <article className="loot-creature" aria-label={`Statistiques de ${enemy.name}`}><h3>{enemy.name}</h3><div className="loot-creature-art"><MonsterPortrait id={enemy.id} color={enemy.color} /></div>
        <div className="loot-vitals">{vitals.map((entry) => <div key={entry.stat}><StatIcon stat={entry.stat} /><strong>{entry.value}</strong><small>{entry.label}</small></div>)}</div>
        <p className="loot-encounter-note">{boss ? (run.defeatedBosses.includes(enemy.id) ? 'Boss déjà vaincu dans cette partie' : 'Boss fixe · combat au contact') : 'Chaque ennemi du groupe est tiré séparément. Doublons possibles.'}</p>
      </article>
      <article className="loot-table"><header><h3>Table de butin</h3><span>{percent(odds.chance)} d’obtenir un objet</span></header>
        <div className="loot-drop-list" aria-label="Objets possibles">{rows.map((entry) => {
          const owned = entry.owned && entry.item.slot !== 'consumable';
          return <button key={entry.itemId} className={!entry.unlocked && !owned ? 'is-locked' : ''} aria-pressed={focused?.itemId === entry.itemId} onClick={() => setItemId(entry.itemId)}><ItemIcon id={entry.itemId} rarity={entry.item.rarity} size={34} /><span className="loot-drop-name" style={{ color: RARITIES[entry.item.rarity].color }}>{entry.item.name}</span><strong className={owned ? 'loot-owned' : !entry.unlocked ? 'loot-locked-label' : ''}>{owned ? 'Déjà obtenu' : !entry.unlocked ? 'Verrouillé' : percent(entry.probability)}</strong></button>;
        })}</div>
        <div className="loot-item-detail" aria-live="polite" aria-label={focused ? `Détails de ${focused.item.name}` : 'Détails du butin'}>{focused && <><strong>{focused.item.name}</strong><p>{focused.item.description}</p>{focused.owned && focused.item.slot !== 'consumable' ? <small className="loot-owned">Déjà obtenu · exclu des prochains drops</small> : unlock ? <small>Succès requis : {unlock.name}</small> : focused.item.slot === 'consumable' && <small>Consommable · plusieurs exemplaires possibles</small>}</>}</div>
        <p className="loot-drop-note">Aucun objet : {percent(1 - odds.chance)} · Taux ajustés à votre Chance</p>
      </article>
    </div>
    <footer className="loot-return"><button onClick={onClose}>Retour</button></footer>
  </section>;
}
