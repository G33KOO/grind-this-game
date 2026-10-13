import { useState } from 'react';
import { ITEMS, STARTING_OPTIONS, HEROES, PASSIVES, MASTERY_MAX_RANK, masteryRank, masteryLevelsForRank } from '../game/content';
import type { HeroId, Profile, Stats } from '../game/types';
import { HeroPortrait, StatIcon, formatStatValue } from './GameVisuals';
import { HERO_ACCENT, ItemIcon, RARITIES, passiveRarity } from './icons';
import { SpaceBackdrop } from './SpaceBackdrop';
import './class-details.css';

const STAT_INFO: Record<keyof Stats, { name: string; description: string }> = {
  strength: { name: 'Force', description: 'Augmente les dégâts de vos attaques.' },
  speed: { name: 'Vitesse', description: 'Augmente votre vitesse de déplacement de 5 unités par seconde pour chaque point. En combat, les plus rapides jouent d’abord. Chaque combattant agit une fois par tour. En cas d’égalité, vous jouez d’abord.' },
  luck: { name: 'Chance', description: 'Augmente les drops et favorise les objets rares et épiques.' },
  critChance: { name: 'Critique', description: 'Chance de critique sur une attaque principale. Maximum : 75 %.' },
  critDamage: { name: 'Dégâts critiques', description: '150 % : un critique inflige 50 % de dégâts supplémentaires. Les bonus ajoutent des points de pourcentage.' },
  maxHp: { name: 'Vie', description: 'PV maximum. La vie restante persiste entre les combats. À zéro, la partie se termine.' },
  defense: { name: 'Défense', description: 'Réduit les dégâts reçus, avec des gains décroissants. Réduction maximum : 72 %.' },
};
type Concept = { kind: 'stat'; id: keyof Stats } | { kind: 'passive'; id: string } | { kind: 'weapon'; id: string } | { kind: 'mastery' };

export function ClassDetailsPage({ hero, profile, onHero, onBack }: { hero: HeroId; profile: Profile; onHero(hero: HeroId): void; onBack(): void }) {
  const [concept, setConcept] = useState<Concept>({ kind: 'mastery' });
  const [unlockTab, setUnlockTab] = useState<'passives' | 'weapons'>('passives');
  const definition = HEROES[hero];
  const levels = profile.mastery[hero];
  const rank = masteryRank(levels);
  const floor = rank === 0 ? 0 : masteryLevelsForRank(rank);
  const next = masteryLevelsForRank(Math.min(rank + 1, MASTERY_MAX_RANK));
  const fraction = rank === MASTERY_MAX_RANK ? 0 : Math.max(0, Math.min(1, (levels - floor) / (next - floor)));
  const passives = PASSIVES.filter((passive) => passive.hero === hero);
  const passive = concept.kind === 'passive' ? passives.find((passive) => passive.id === concept.id) : undefined;
  const weaponOption = concept.kind === 'weapon' ? STARTING_OPTIONS[hero].weapons.find((entry) => entry.id === concept.id) : undefined;
  const weapon = weaponOption ? ITEMS.find((entry) => entry.id === weaponOption.id) : undefined;
  const availability = (id: string) => {
    const passive = passives.find((entry) => entry.id === id)!;
    const locked = rank < (passive.masteryRequired ?? 0);
    return { locked, text: locked ? `Maîtrise ${passive.masteryRequired} requise` : 'Disponible au départ' };
  };
  const upcoming = [...STARTING_OPTIONS[hero].weapons.map((entry) => ({ ...entry, name: ITEMS.find((item) => item.id === entry.id)?.name })), ...STARTING_OPTIONS[hero].passives.map((entry) => ({ ...entry, name: PASSIVES.find((passive) => passive.id === entry.id)?.name }))].filter((entry) => entry.masteryRequired > rank).sort((a,b) => a.masteryRequired - b.masteryRequired);
  const title = weapon?.name ?? passive?.name ?? (concept.kind === 'stat' ? STAT_INFO[concept.id].name : 'Maîtrise de classe');
  const description = weapon?.description ?? passive?.description ?? (concept.kind === 'stat' ? STAT_INFO[concept.id].description : 'Les niveaux gagnés avec cette classe débloquent des passifs et équipements de départ pour les prochaines parties.');
  const detail = weapon && weaponOption ? `${weaponOption.masteryRequired === 0 ? 'De base' : `Maîtrise ${weaponOption.masteryRequired}`} · Arme de départ · ${RARITIES[weapon.rarity].label} · ${rank >= weaponOption.masteryRequired ? 'Disponible au départ' : 'Verrouillée'}`
    : passive ? `${availability(passive.id).text} · Passif de départ · ${RARITIES[passiveRarity(passive.weight)].label}`
    : concept.kind === 'stat' ? ''
    : rank === MASTERY_MAX_RANK ? 'Maîtrise maximale atteinte.' : `${next - levels} niveaux avant le rang ${rank + 1}.${upcoming.length ? ` Prochain déblocage (maîtrise ${upcoming[0].masteryRequired}) : ${upcoming.filter((entry) => entry.masteryRequired === upcoming[0].masteryRequired).map((entry) => entry.name).join(" · ")}.` : ""}`;
  const format = formatStatValue;
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
      <section className="dossier-passives" aria-label="Déblocages de classe">
        <nav className="dossier-unlock-tabs" aria-label="Type de déblocage">
          <button aria-pressed={unlockTab === 'passives'} onClick={() => { setUnlockTab('passives'); setConcept({ kind: 'mastery' }); }}>Passifs</button>
          <button aria-pressed={unlockTab === 'weapons'} onClick={() => { setUnlockTab('weapons'); setConcept({ kind: 'mastery' }); }}>Armes</button>
        </nav>
        <div className={`dossier-passive-grid${unlockTab === 'weapons' ? ' dossier-weapons-grid' : ''}`}>{unlockTab === 'passives' ? passives.map((entry) => {
        const state = availability(entry.id);
        const selected = passive?.id === entry.id;
        return <button className={`${state.locked ? 'is-locked' : ''} ${selected ? 'is-active' : ''}`} key={entry.id} aria-pressed={selected} aria-label={`${entry.name}, ${state.locked ? 'verrouillé' : 'disponible'}`} onClick={() => setConcept({ kind: 'passive', id: entry.id })}>
          <ItemIcon id={entry.id} rarity={passiveRarity(entry.weight)} size={64} />{state.locked && <svg className="passive-lock" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>}
        </button>;
      }) : STARTING_OPTIONS[hero].weapons.map((option) => {
        const item = ITEMS.find((entry) => entry.id === option.id)!;
        const locked = rank < option.masteryRequired;
        return <div className="dossier-weapon-option" key={option.id}>
          <button className={`${locked ? 'is-locked' : ''} ${weapon?.id === item.id ? 'is-active' : ''}`} aria-pressed={weapon?.id === item.id} aria-label={`${item.name}, ${option.masteryRequired === 0 ? 'de base' : `maîtrise ${option.masteryRequired}`}, ${locked ? 'verrouillée' : 'disponible'}`} onClick={() => setConcept({ kind: 'weapon', id: item.id })}>
            <ItemIcon id={item.id} rarity={item.rarity} size={64} />
            {locked && <svg className="passive-lock" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>}
          </button>
          <small>{option.masteryRequired === 0 ? 'De base' : `Maîtrise ${option.masteryRequired}`}</small>
        </div>;
      })}</div>
      </section>
    <section className="dossier-explanation" aria-label="Explication du concept sélectionné" aria-live="polite">
      <div className="concept-icon" aria-hidden="true">{weapon ? <ItemIcon id={weapon.id} rarity={weapon.rarity} size={56} /> : passive ? <ItemIcon id={passive.id} rarity={passiveRarity(passive.weight)} size={56} /> : <StatIcon stat={concept.kind === 'stat' ? concept.id : 'luck'} />}</div>
      <div><h2>{title}</h2><p>{description}</p>{detail && <small>{detail}</small>}</div>
    </section>
    </div>
    <footer className="dossier-footer"><button onClick={onBack}>Retour au choix de classe</button></footer>
  </main>;
}
