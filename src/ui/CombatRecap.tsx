import { useEffect, useState } from 'react';
import { ITEMS } from '../game/content';
import type { HeroId } from '../game/types';
import { ItemIcon } from './icons';
import { HeroPortrait, MenuIcon } from './GameVisuals';
import { SpaceBackdrop } from './SpaceBackdrop';
import './combat-results.css';

export interface CombatRecapData {
  xpGained: number; kills: number; levelBefore: number; levelAfter: number;
  fillBefore: number; fillAfter: number; loot: string[]; notes: string[];
}
export interface CombatRecapProps {
  recap: CombatRecapData; hero: HeroId; points: number;
  onInventory(): void; onContinue(): void;
}
export function CombatRecap({ recap, hero, points, onInventory, onContinue }: CombatRecapProps) {
  const [shown, setShown] = useState({ level: recap.levelBefore, fill: recap.fillBefore, instant: true });
  const gained = recap.levelAfter - recap.levelBefore;
  useEffect(() => {
    const finalState = { level: recap.levelAfter, fill: recap.fillAfter, instant: true };
    if (document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(finalState); return;
    }
    setShown({ level: recap.levelBefore, fill: recap.fillBefore, instant: true });
    const begin = window.setTimeout(() => setShown({ level: recap.levelBefore, fill: gained > 0 ? 1 : recap.fillAfter, instant: false }), 80);
    // All levels settle together, even for a large reward.
    const finish = window.setTimeout(() => setShown(finalState), 400);
    return () => { window.clearTimeout(begin); window.clearTimeout(finish); };
  }, [recap, gained]);
  return <div className="combat-result-screen is-victory" role="dialog" aria-modal="true" aria-labelledby="combat-result-title">
    <SpaceBackdrop />
    <section className="recap-card result-content">
      <header className="result-heading"><span className="result-emblem" aria-hidden="true"><MenuIcon id="achievements" size={38} /></span><h2 id="combat-result-title">Victoire</h2><p>{recap.kills} {recap.kills === 1 ? 'ennemi vaincu' : 'ennemis vaincus'}</p></header>
      <div className="result-board">
        <div className="result-hero"><HeroPortrait hero={hero} /><span className="result-level">Niveau <strong>{shown.level}</strong></span></div>
        <div className="result-rewards">
          <section className="result-experience" aria-label="Expérience gagnée"><div className="result-section-heading"><h3>Expérience</h3><strong>+{recap.xpGained} XP</strong></div>
            <div className="result-xp-track" role="progressbar" aria-label="Progression du niveau" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown.fill * 100)}><i style={{ width: `${Math.round(shown.fill * 100)}%`, transition: shown.instant ? 'none' : 'width 280ms ease-out' }} /></div>
            <div className="result-level-gain" aria-live="polite">{gained > 0 ? <><strong>+{gained} {gained === 1 ? 'niveau' : 'niveaux'}</strong><span>Niveau {recap.levelBefore} → {recap.levelAfter}</span></> : <span>Niveau {recap.levelAfter}</span>}</div>
          </section>
          <section className="result-loot"><div className="result-section-heading"><h3>Butin obtenu</h3><span>{recap.loot.length}</span></div><div className="result-item-list">{recap.loot.length ? recap.loot.map((name, index) => { const item = ITEMS.find((entry) => entry.name === name); return <div className="result-item" key={`${name}-${index}`}>{item && <ItemIcon id={item.id} rarity={item.rarity} size={44} />}<strong>{name}</strong></div>; }) : <p className="result-empty">Aucun objet obtenu</p>}</div></section>
          {recap.notes.length > 0 && <div className="result-unlocks">{recap.notes.map((note) => <p key={note}><MenuIcon id="achievements" size={18} />{note}</p>)}</div>}
        </div>
      </div>
      <footer className="result-actions">{points > 0 && <button className="result-secondary" onClick={onInventory}>{points} {points === 1 ? 'point à répartir' : 'points à répartir'}</button>}<button className="result-primary" onClick={onContinue}>Continuer</button></footer>
    </section>
  </div>;
}
