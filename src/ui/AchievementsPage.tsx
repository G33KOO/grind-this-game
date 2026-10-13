import { useState } from 'react';
import { ACHIEVEMENTS, ENEMIES, HEROES, ITEMS, PASSIVES, STARTING_OPTIONS } from '../game/content';
import type { AchievementDefinition, Profile } from '../game/types';
import { HeroPortrait, MenuIcon, MonsterPortrait } from './GameVisuals';
import { ItemIcon, RARITIES, passiveRarity, type Rarity } from './icons';
import { SpaceBackdrop } from './SpaceBackdrop';
import './achievements-page.css';

function rewardsFor(achievement: AchievementDefinition) {
  return (achievement.unlocks ?? []).flatMap((id) => {
    const item = ITEMS.find((item) => item.id === id);
    if (item) return [{ id, name: item.name, description: item.description, rarity: item.rarity as Rarity, kind: 'Objet' }];
    const passive = PASSIVES.find((passive) => passive.id === id);
    return passive ? [{ id, name: passive.name, description: passive.description, rarity: passiveRarity(passive.weight), kind: 'Passif' }] : [];
  });
}

function AchievementArt({ achievement, large = false }: { achievement: AchievementDefinition; large?: boolean }) {
  if (achievement.condition.kind === 'boss') {
    const id = achievement.condition.value;
    return <MonsterPortrait id={id} color={ENEMIES.find((enemy) => enemy.id === id)?.color ?? 0x2ee6c8} />;
  }
  if (achievement.hero) return <HeroPortrait hero={achievement.hero} />;
  const reward = rewardsFor(achievement)[0];
  return reward ? <ItemIcon id={reward.id} rarity={reward.rarity} size={large ? 110 : 56} /> : <MenuIcon id="achievements" size={large ? 84 : 40} />;
}

function RewardSource({ id }: { id: string }) {
  const item = ITEMS.find((item) => item.id === id);
  const passive = PASSIVES.find((passive) => passive.id === id);
  const enemies = ENEMIES.filter((enemy) => enemy.loot.some((entry) => entry.itemId === id));
  const starts = (Object.keys(STARTING_OPTIONS) as (keyof typeof STARTING_OPTIONS)[])
    .filter((hero) => [...STARTING_OPTIONS[hero].weapons, ...STARTING_OPTIONS[hero].passives].some((option) => option.id === id))
    .map((hero) => HEROES[hero].name);
  return <div className="achievement-reward-source">
    {item && <p><strong>{enemies.length === ENEMIES.length ? 'Butin global' : 'Butin ciblé'}</strong><span>{enemies.length === ENEMIES.length ? 'Tous les monstres et boss' : enemies.length ? enemies.map((enemy) => enemy.name).join(' · ') : 'Aucune table de butin'}</span></p>}
    {passive && <p><strong>{passive.hero === 'both' ? 'Passif global' : `Passif ${HEROES[passive.hero].name}`}</strong><span>Choix tous les 5 niveaux{passive.masteryRequired ? ` · maîtrise ${passive.masteryRequired} requise` : ''}</span></p>}
    {starts.length > 0 && <p><strong>Choix de départ</strong><span>{starts.join(' · ')}</span></p>}
  </div>;
}

export function AchievementsPage({ profile, onBack, inGame = false }: { profile: Profile; onBack(): void; inGame?: boolean }) {
  const [selectedId, setSelectedId] = useState(ACHIEVEMENTS[0].id);
  const [rewardId, setRewardId] = useState<string | null>(null);
  const achievement = ACHIEVEMENTS.find((entry) => entry.id === selectedId)!;
  const done = profile.achievements.includes(selectedId);
  const completed = ACHIEVEMENTS.filter((entry) => profile.achievements.includes(entry.id)).length;
  const rewards = rewardsFor(achievement);
  const reward = rewards.find((entry) => entry.id === rewardId) ?? rewards[0];
  return <section className={`shell title-screen classes-page achievements-screen${inGame ? ' in-game modal-panel' : ''}`} role={inGame ? 'dialog' : undefined} aria-modal={inGame ? true : undefined} aria-label="Succès">
    {!inGame && <SpaceBackdrop />}
    <header className="achievements-heading"><h1>Succès</h1><div className="achievements-completion"><strong>{completed} / {ACHIEVEMENTS.length}</strong><div className="achievement-segments" role="progressbar" aria-label="Succès obtenus" aria-valuemin={0} aria-valuemax={ACHIEVEMENTS.length} aria-valuenow={completed}>{ACHIEVEMENTS.map((entry, index) => <i key={entry.id} className={index < completed ? 'is-earned' : ''} aria-hidden="true" />)}</div></div></header>
    <div className="achievements-board">
      <nav className="achievement-collection" aria-label="Collection de succès">{ACHIEVEMENTS.map((entry) => {
        const earned = profile.achievements.includes(entry.id);
        return <button key={entry.id} className={`achievement-medallion${earned ? ' is-earned' : ''}`} aria-pressed={selectedId === entry.id} aria-label={`${entry.name}, ${earned ? 'obtenu' : 'à débloquer'}`} onClick={() => { setSelectedId(entry.id); setRewardId(null); }}>
          <span className="achievement-art"><AchievementArt achievement={entry} /></span><span className="achievement-name">{entry.name}</span><span className="achievement-status" aria-hidden="true">{earned ? '◆' : '◇'}</span>
        </button>;
      })}</nav>
      <article className="achievement-focus" aria-label="Détails du succès sélectionné" aria-live="polite">
        <div className="achievement-focus-art"><AchievementArt achievement={achievement} large /></div>
        <div className="achievement-focus-title"><h2>{achievement.name}</h2><span className={done ? 'earned-label' : ''}>{done ? 'Obtenu' : 'À débloquer'}</span></div>
        <p className="achievement-condition">{achievement.description}</p>
        {rewards.length ? <div className="achievement-unlocks"><h3>Déblocages</h3><div className="achievement-reward-strip">{rewards.map((entry) => <button key={entry.id} aria-pressed={reward?.id === entry.id} aria-label={`${entry.kind} : ${entry.name}`} onClick={() => setRewardId(entry.id)} style={{ ['--rarity' as string]: RARITIES[entry.rarity].color }}>
          <ItemIcon id={entry.id} rarity={entry.rarity} size={44} /><span>{entry.name}</span>
        </button>)}</div><div className="achievement-reward-description"><span style={{ color: reward ? RARITIES[reward.rarity].color : undefined }}>{reward?.kind} · {reward && RARITIES[reward.rarity].label}</span><p>{reward?.description}</p></div>{reward && <RewardSource id={reward.id} />}</div> : <p className="achievement-honor">Succès honorifique</p>}
      </article>
    </div>
    <footer className="achievements-return"><button onClick={onBack}>{inGame ? 'Retour au jeu' : 'Accueil'}</button></footer>
  </section>;
}
