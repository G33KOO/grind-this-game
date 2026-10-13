import { HEROES, ITEMS, masteryRank } from '../game/content';
import type { Profile, RunState } from '../game/types';
import { HeroPortrait, MenuIcon, type MenuIconId } from './GameVisuals';
import { ItemIcon } from './icons';
import { SpaceBackdrop } from './SpaceBackdrop';
import './combat-results.css';

export function RunSummary({ run, profile, onNewGame, onTitle }: { run: RunState; profile: Profile; onNewGame(): void; onTitle(): void }) {
  const victory = run.result === 'victory';
  const items = run.inventory.map((instance) => ITEMS.find((item) => item.id === instance.itemId)).filter((item) => item !== undefined);
  const counters: { icon: MenuIconId; value: number; label: string }[] = [
    { icon: 'character', value: run.kills, label: 'Éliminations' }, { icon: 'achievements', value: run.victories, label: 'Victoires' },
    { icon: 'loot', value: run.defeatedBosses.length, label: 'Boss vaincus' }, { icon: 'newGame', value: run.secrets.length, label: 'Secrets' },
  ];
  return <div className={`combat-result-screen ${victory ? 'is-victory' : 'is-defeat'}`} role="dialog" aria-modal="true" aria-labelledby="run-result-title">
    <SpaceBackdrop />
    <section className="result-content run-result" aria-labelledby="run-result-title">
      <header className="result-heading"><span className="result-emblem" aria-hidden="true"><MenuIcon id={victory ? 'achievements' : 'abandon'} size={38} /></span><h2 id="run-result-title">{victory ? 'Seuil franchi' : 'Défaite'}</h2><p>{victory ? 'Votre voyage est accompli.' : 'Votre maîtrise reste acquise.'}</p></header>
      <div className="result-board">
        <div className="result-hero"><HeroPortrait hero={run.hero} /><span className="result-level">{HEROES[run.hero].name} <strong>Niv. {run.level}</strong></span></div>
        <div className="result-rewards">
          <div className="result-run-stats">{counters.map((entry) => <div key={entry.label}><MenuIcon id={entry.icon} size={22} /><strong>{entry.value}</strong><span>{entry.label}</span></div>)}</div>
          <div className="result-permanent"><MenuIcon id="character" size={24} /><div><strong>Maîtrise de classe · rang {masteryRank(profile.mastery[run.hero])}</strong><span>Passifs et équipements débloqués conservés</span></div></div>
          <section className="result-loot"><div className="result-section-heading"><h3>Équipement collecté</h3><span>{items.length}</span></div><div className="result-item-list">{items.length ? items.map((item, index) => <div className="result-item" key={`${item.id}-${index}`}><ItemIcon id={item.id} rarity={item.rarity} size={40} /><strong>{item.name}</strong></div>) : <p className="result-empty">Aucun objet collecté</p>}</div></section>
        </div>
      </div>
      <footer className="result-actions"><button className="result-secondary" onClick={onTitle}>Accueil</button><button className="result-primary" onClick={onNewGame}>Nouvelle partie</button></footer>
    </section>
  </div>;
}
