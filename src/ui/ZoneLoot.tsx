import { useState } from 'react';
import { ACHIEVEMENTS, BALANCE, ENEMIES, ZONES } from '../game/content';
import { deriveStats, encounterChance, lootOdds } from '../game/engine';
import type { Profile, RunState } from '../game/types';
import { zoneAt } from '../game/world';
import { ItemIcon, RARITIES } from './icons';
import { MenuFooter, MonsterPortrait, StatIcon } from './GameVisuals';
import './zone-loot.css';

const percent = (value: number) => `${(value * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
const ZONE_SYMBOLS = ['✿', '♠', '≋', '✝', '♨'];

export function ZoneLoot({ run, profile, onClose }: { run: RunState; profile: Profile; onClose(): void }) {
  const current = zoneAt(run.position.x, run.position.y);
  const [selected, setSelected] = useState<string>(current.id);
  const [monster, setMonster] = useState<string>(current.enemies[0]);
  const zone = ZONES.find((zone) => zone.id === selected)!;
  const enemy = ENEMIES.find((enemy) => enemy.id === monster)!;
  const boss = enemy.id === zone.boss;
  const odds = lootOdds(run, enemy.id, profile);
  const remaining = Math.max(0, BALANCE.encounterCheckDistance - run.distanceSinceEncounterCheck);
  const nextMeter = Math.min(BALANCE.maxEncounterMeter, run.encounterMeter + remaining * BALANCE.encounterMeterChancePerUnit);
  const presence = Array.from({ length: zone.maxGroup }, (_, index) => 1 - (1 - 1 / zone.enemies.length) ** (index + 1)).reduce((sum, value) => sum + value, 0) / zone.maxGroup;
  return <section className="panel modal-panel zone-loot-panel" role="dialog" aria-modal="true" aria-label="Zones et butins">
    <div className="panel-heading"><div><p className="eyebrow">ATLAS / BESTIAIRE</p><h2>Terres du seuil</h2></div><button onClick={onClose}>Retour <kbd>Échap</kbd></button></div>
    <div className="atlas-layout">
      <nav className="atlas-zones" aria-label="Choisir une zone">{ZONES.map((entry, index) => <button key={entry.id} aria-pressed={selected === entry.id} onClick={() => { setSelected(entry.id); setMonster(entry.enemies[0]); }} style={{ ['--biome' as string]: ['#2ee6c8', '#58ff6e', '#35a7ff', '#b36bff', '#ff6a2e'][index] }}>
        <span className="zone-sigil" aria-hidden="true">{ZONE_SYMBOLS[index]}</span><span><small>ZONE 0{index + 1} · NIV. {entry.level}</small><strong>{entry.name}</strong><em>{entry.id === current.id ? '◆ Position actuelle' : entry.requires && !run.defeatedBosses.includes(entry.requires) ? 'Passage gardé' : 'Passage ouvert'}</em></span>
      </button>)}</nav>
      <div className="bestiary-content">
        <header className="biome-heading"><div><p className="eyebrow">NIVEAU DE ZONE {zone.level}</p><h3>{zone.name}</h3></div><div className="biome-level">{zone.level}</div></header>
        <div className="farm-facts"><div><strong>{zone.maxGroup === 1 ? '1 monstre' : `1 à ${zone.maxGroup} monstres`}</strong><span>{percent(1 / zone.maxGroup)} par taille de groupe · doublons possibles</span></div><div><strong><StatIcon stat="luck" /> {deriveStats(run).luck} Chance</strong><span>Taux ajustés à votre build</span></div><div><strong>{percent(encounterChance(nextMeter))} rencontre</strong><span>Prochain contrôle dans ~{Math.ceil(remaining)} px · toutes les zones</span></div></div>
        <nav className="monster-roster" aria-label="Monstres de la zone">{[...zone.enemies, zone.boss].map((id) => {
          const entry = ENEMIES.find((enemy) => enemy.id === id)!;
          return <button key={id} aria-pressed={monster === id} onClick={() => setMonster(id)}><MonsterPortrait id={id} color={entry.color} /><strong>{entry.name}</strong><small>{id === zone.boss ? 'BOSS' : `${percent(presence)} / rencontre`}</small></button>;
        })}</nav>
        <article className="bestiary-inspector">
          <aside className="bestiary-art"><MonsterPortrait id={enemy.id} color={enemy.color} /><p className="eyebrow">{boss ? 'GARDIEN DE ZONE' : 'ENNEMI'}</p><h3>{enemy.name}</h3><div className="monster-vitals"><span>♥ {enemy.hp} PV</span><span>✦ {enemy.xp} XP</span><span>⚔ {enemy.strength}</span><span>➤ {enemy.speed}</span></div></aside>
          <div className="bestiary-drops"><div className="bag-heading"><h3>Butins possibles</h3><span>{percent(odds.chance)} / monstre</span></div>
            <p className="small-note">{boss ? (run.defeatedBosses.includes(enemy.id) ? 'Déjà vaincu dans cette partie.' : 'Combat au contact · position fixe.') : `Présence dans un groupe : ${percent(presence)}. Par emplacement : ${percent(1 / zone.enemies.length)}.`}</p>
            <ul className="farm-drops">{odds.entries.map((entry) => <li key={entry.itemId} className={entry.unlocked ? '' : 'drop-locked'}>
              <ItemIcon id={entry.itemId} rarity={entry.item.rarity} size={48} /><div><strong style={{ color: RARITIES[entry.item.rarity].color }}>{entry.item.name}</strong><span>{entry.item.description}</span>{!entry.unlocked && <small>🔒 {ACHIEVEMENTS.find((achievement) => achievement.id === entry.item.unlockAchievement)?.name}</small>}</div><b>{percent(entry.probability)}</b>
            </li>)}</ul><p className="small-note">Aucun objet : {percent(1 - odds.chance)} · Un objet maximum par monstre après victoire. Les tirages d’objets sont exclusifs.</p>
          </div>
        </article>
        <p className="small-note atlas-rules">Contrôle tous les {BALANCE.encounterCheckDistance} pixels parcourus, garanti à jauge pleine. {zone.requires && !run.defeatedBosses.includes(zone.requires) ? `Accès gardé par ${ENEMIES.find((enemy) => enemy.id === zone.requires)?.name}. ` : ''}Les déblocages s’appliquent aux combats suivants.</p>
      </div>
    </div><MenuFooter />
  </section>;
}
