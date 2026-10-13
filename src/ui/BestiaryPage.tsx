import { useState } from 'react';
import { ACHIEVEMENTS, ENEMIES, ZONES } from '../game/content';
import { lootOddsForLuck } from '../game/engine';
import type { Profile } from '../game/types';
import { MonsterPortrait, StatIcon } from './GameVisuals';
import { ItemIcon, RARITIES } from './icons';
import { SpaceBackdrop } from './SpaceBackdrop';
import './bestiary-page.css';

const pct = (value: number) => `${(value * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
const ZONE_NAMES = ['Prairie', 'Forêt', 'Marais', 'Crypte', 'Terres cendrées'];

export function BestiaryPage({ profile, onBack }: { profile: Profile; onBack(): void }) {
  const [zoneId, setZoneId] = useState<string>(ZONES[0].id);
  const [enemyId, setEnemyId] = useState<string>(ZONES[0].enemies[0]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [allUnlocked, setAllUnlocked] = useState(false);
  const zone = ZONES.find((zone) => zone.id === zoneId)!;
  const enemy = ENEMIES.find((enemy) => enemy.id === enemyId)!;
  const boss = enemy.id === zone.boss;
  const odds = lootOddsForLuck(0, enemy.id, allUnlocked ? { ...profile, achievements: ACHIEVEMENTS.map((entry) => entry.id) } : profile);
  const lootRows = odds.entries.filter((entry, index, entries) => entries.findIndex((candidate) => candidate.itemId === entry.itemId) === index)
    .map((entry) => ({ ...entry, probability: odds.entries.filter((candidate) => candidate.itemId === entry.itemId).reduce((total, candidate) => total + candidate.probability, 0) }));
  const selectedLoot = lootRows.find((entry) => entry.itemId === itemId) ?? lootRows[0];
  const zones = ZONES.filter((entry) => entry.boss === enemyId || (entry.enemies as readonly string[]).includes(enemyId));
  const monsterChance = 1 / zone.enemies.length;
  const unlock = selectedLoot?.item.unlockAchievement ? ACHIEVEMENTS.find((entry) => entry.id === selectedLoot.item.unlockAchievement) : undefined;
  return <section className="shell title-screen classes-page bestiary-page" aria-label="Bestiaire">
    <SpaceBackdrop />
    <header className="bestiary-heading"><h1>Bestiaire</h1><nav aria-label="Zones">{ZONES.map((entry, index) => <button key={entry.id} aria-pressed={zoneId === entry.id} onClick={() => { setZoneId(entry.id); setEnemyId(entry.enemies[0]); setItemId(null); }}><span>{ZONE_NAMES[index]}</span><small>Niveau {entry.level}</small></button>)}</nav></header>
    <div className="bestiary-sheet">
      <nav className="bestiary-creatures" aria-label="Monstres de la zone">{[...zone.enemies, zone.boss].map((id) => {
        const creature = ENEMIES.find((entry) => entry.id === id)!;
        return <button key={id} aria-pressed={enemyId === id} onClick={() => { setEnemyId(id); setItemId(null); }}><MonsterPortrait id={id} color={creature.color} /><span>{creature.name}{id === zone.boss && <small>Boss</small>}</span></button>;
      })}</nav>
      <article className="bestiary-character"><h2>{enemy.name}</h2><div className="bestiary-portrait-slot"><MonsterPortrait id={enemy.id} color={enemy.color} /></div>
        <div className="bestiary-stats">{[{ id: 'maxHp', label: 'Vie', value: enemy.hp }, { id: 'strength', label: 'Force', value: enemy.strength }, { id: 'defense', label: 'Défense', value: enemy.defense }, { id: 'speed', label: 'Vitesse', value: enemy.speed }, { id: 'luck', label: 'XP', value: enemy.xp }].map((stat) => <span key={stat.label}><StatIcon stat={stat.id} /><strong>{stat.value}</strong><small>{stat.label}</small></span>)}</div>
        <div className="bestiary-encounters"><p>{boss ? 'Boss fixe · combat au contact' : `${pct(monsterChance)} de chance pour chaque monstre tiré`}</p>{!boss && <small>{zone.maxGroup === 1 ? 'Un monstre par combat' : `Groupes de 1 à ${zone.maxGroup} · chaque monstre est tiré séparément`}</small>}<small>{zones.map((zone) => zone.name).join(' · ')}</small></div>
      </article>
      <article className="bestiary-loot"><header><h2>Table de butin</h2><button className="bestiary-unlock-toggle" aria-pressed={allUnlocked} onClick={() => setAllUnlocked(!allUnlocked)}>{allUnlocked ? 'Tous débloqués' : 'Mon profil'}</button></header>
        <p className="bestiary-loot-basis">Taux de drop de base · {pct(odds.chance)} d’obtenir un objet</p>
        <div className="bestiary-loot-list">{lootRows.map((entry) => <button key={`${enemy.id}:${entry.itemId}`} aria-pressed={selectedLoot?.itemId === entry.itemId} className={entry.unlocked ? '' : 'is-locked'} onClick={() => setItemId(entry.itemId)}>
          <ItemIcon id={entry.itemId} rarity={entry.item.rarity} size={32} /><span style={{ color: RARITIES[entry.item.rarity].color }}>{entry.item.name}{!entry.unlocked && <small>Verrouillé</small>}</span><strong>{pct(entry.probability)}</strong>
        </button>)}</div>
        {selectedLoot && <div className="bestiary-loot-detail" aria-label={`Détails de ${selectedLoot.item.name}`} aria-live="polite"><p>{selectedLoot.item.description}</p>{unlock && <small>Succès requis : {unlock.name}</small>}</div>}
        <p className="bestiary-loot-rule">Aucun objet : {pct(1 - odds.chance)}</p>
      </article>
    </div>
    <footer className="bestiary-return"><button onClick={onBack}>Accueil</button></footer>
  </section>;
}
