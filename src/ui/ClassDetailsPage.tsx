import { useState } from 'react';
import { ACHIEVEMENTS, HEROES, PASSIVES, MASTERY_MAX_RANK, masteryRank, masteryLevelsForRank } from '../game/content';
import type { HeroId, Profile, Stats } from '../game/types';
import { HeroPortrait, StatIcon } from './GameVisuals';
import { HERO_ACCENT, ItemIcon, RARITIES, passiveRarity } from './icons';
import { SpaceBackdrop } from './SpaceBackdrop';
import './class-details.css';

const STAT_INFO: Record<keyof Stats, { name: string; description: string }> = {
  strength: { name: 'Force', description: 'Augmente les dégâts de vos attaques.' },
  speed: { name: 'Vitesse', description: 'Deux fois plus de vitesse : deux fois plus d’attaques sur la durée.' },
  luck: { name: 'Chance', description: 'Augmente les drops et favorise les objets rares et épiques.' },
  critChance: { name: 'Critique', description: 'Chance de critique sur une attaque principale. Maximum : 75 %.' },
  critDamage: { name: 'Dégâts critiques', description: '×1,5 : un critique inflige 50 % de dégâts supplémentaires.' },
  maxHp: { name: 'Vie', description: 'PV maximum. La vie restante persiste entre les combats. À zéro, la partie se termine.' },
  defense: { name: 'Défense', description: 'Réduit les dégâts reçus, avec des gains décroissants. Réduction maximum : 72 %.' },
};
type Concept = { kind: 'stat'; id: keyof Stats } | { kind: 'passive'; id: string } | { kind: 'mastery' };

export function ClassDetailsPage({ hero, profile, onHero, onBack }: { hero: HeroId; profile: Profile; onHero(hero: HeroId): void; onBack(): void }) {
  const [concept, setConcept] = useState<Concept>({ kind: 'mastery' });
  const definition = HEROES[hero];
  const levels = profile.mastery[hero];
  const rank = masteryRank(levels);
  const floor = rank === 0 ? 0 : masteryLevelsForRank(rank);
  const next = masteryLevelsForRank(Math.min(rank + 1, MASTERY_MAX_RANK));
  const fraction = rank === MASTERY_MAX_RANK ? 0 : Math.max(0, Math.min(1, (levels - floor) / (next - floor)));
  const passives = PASSIVES.filter((passive) => passive.hero === hero);
  const passive = concept.kind === 'passive' ? passives.find((passive) => passive.id === concept.id) : undefined;
  const availability = (id: string) => {
    const passive = passives.find((passive) => passive.id === id)!;
    const achievement = ACHIEVEMENTS.find((achievement) => achievement.id === passive.unlockAchievement);
    const requirements = [
      ...(rank < (passive.masteryRequired ?? 0) ? [`Maîtrise ${passive.masteryRequired}`] : []),
      ...(achievement && !profile.achievements.includes(achievement.id) ? [`Succès « ${achievement.name} »`] : []),
    ];
    return { locked: requirements.length > 0, text: requirements.length ? `Requis : ${requirements.join(' · ')}` : 'Disponible' };
  };
  const title = passive?.name ?? (concept.kind === 'stat' ? STAT_INFO[concept.id].name : 'Maîtrise de classe');
  const description = passive?.description ?? (concept.kind === 'stat' ? STAT_INFO[concept.id].description : 'Les niveaux gagnés entre les parties débloquent de nouveaux passifs.');
  const detail = passive ? `${availability(passive.id).text} · Rang maximum ${passive.maxRank} · ${RARITIES[passiveRarity(passive.weight)].label}`
    : concept.kind === 'stat' ? ''
    : rank === MASTERY_MAX_RANK ? 'Maîtrise maximale atteinte.' : `${next - levels} niveaux avant le rang ${rank + 1}.`;
  const format = (key: keyof Stats, value: number) => key === 'critChance' ? `${Math.round(value * 100)} %` : key === 'critDamage' ? `×${value}` : String(value);
  return <main className="shell title-screen classes-page class-dossier" style={{ ['--accent' as string]: HERO_ACCENT[hero] }}>
    <SpaceBackdrop />
    <header className="dossier-header"><h1>Détail des classes</h1><nav aria-label="Classe">{(['warrior', 'assassin'] as const).map((entry) => <button key={entry} aria-pressed={hero === entry} onClick={() => { setConcept({ kind: 'mastery' }); onHero(entry); }}>{HEROES[entry].name}</button>)}</nav></header>
    <div className="dossier-main">
      <section className="dossier-attributes" aria-label="Statistiques de base">
        <h2>Statistiques</h2>
        <div className="dossier-stats">{(Object.keys(STAT_INFO) as (keyof Stats)[]).map((key) => <button key={key} className={concept.kind === 'stat' && concept.id === key ? 'is-active' : ''} aria-pressed={concept.kind === 'stat' && concept.id === key} aria-label={`${STAT_INFO[key].name} : ${format(key, definition.stats[key])}`} onClick={() => setConcept({ kind: 'stat', id: key })}>
          <StatIcon stat={key} /><small>{STAT_INFO[key].name}</small><strong>{format(key, definition.stats[key])}</strong>
        </button>)}</div>
      </section>
      <section className="dossier-character" aria-label="Personnage et maîtrise">
        <div className="dossier-portrait-slot"><HeroPortrait hero={hero} /></div>
        <button className="dossier-mastery" aria-pressed={concept.kind === 'mastery'} onClick={() => setConcept({ kind: 'mastery' })}>
          <span>Maîtrise <strong>{rank} / {MASTERY_MAX_RANK}</strong></span>
          <span className="mastery-segments" aria-label={`Maîtrise ${rank} sur ${MASTERY_MAX_RANK}`}>{Array.from({ length: MASTERY_MAX_RANK }, (_, index) => <span key={index} className={index < rank ? 'is-complete' : ''}><i style={{ width: `${index < rank ? 100 : index === rank ? fraction * 100 : 0}%` }} /></span>)}</span>
        </button>
      </section>
      <section className="dossier-passives" aria-label="Passifs de classe"><h2>Passifs</h2><div className="dossier-passive-grid">{passives.map((entry) => {
        const state = availability(entry.id);
        const selected = passive?.id === entry.id;
        return <button className={`${state.locked ? 'is-locked' : ''} ${selected ? 'is-active' : ''}`} key={entry.id} aria-pressed={selected} aria-label={`${entry.name}, ${state.locked ? 'verrouillé' : 'disponible'}`} onClick={() => setConcept({ kind: 'passive', id: entry.id })}>
          <ItemIcon id={entry.id} rarity={passiveRarity(entry.weight)} size={64} />{state.locked && <svg className="passive-lock" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>}
        </button>;
      })}</div>
    <section className="dossier-explanation" aria-label="Explication du concept sélectionné" aria-live="polite">
      <div className="concept-icon" aria-hidden="true">{passive ? <ItemIcon id={passive.id} rarity={passiveRarity(passive.weight)} size={56} /> : <StatIcon stat={concept.kind === 'stat' ? concept.id : 'luck'} />}</div>
      <div><h2>{title}</h2><p>{description}</p>{detail && <small>{detail}</small>}</div>
    </section>
      </section>
    </div>
    <footer className="dossier-footer"><button onClick={onBack}>Retour au choix de classe</button></footer>
  </main>;
}
