import { useEffect, useState } from 'react';
import { ITEMS } from '../game/content';
import { ItemIcon } from './icons';
import { StatIcon } from './GameVisuals';

export interface CombatRecapData {
  xpGained: number;
  kills: number;
  levelBefore: number;
  levelAfter: number;
  fillBefore: number;
  fillAfter: number;
  loot: string[];
  notes: string[];
}

interface Step { level: number; from: number; to: number }

const buildSteps = (recap: CombatRecapData): Step[] => {
  const steps: Step[] = [];
  for (let level = recap.levelBefore; level <= recap.levelAfter; level++) {
    steps.push({
      level,
      from: level === recap.levelBefore ? recap.fillBefore : 0,
      to: level === recap.levelAfter ? recap.fillAfter : 1,
    });
  }
  return steps;
};

const STEP_MS = 900;

export interface CombatRecapProps {
  recap: CombatRecapData;
  points: number;
  pendingPassives: number;
  stats: { key: string; label: string }[];
  onSpend(key: string, amount: number): void;
  onContinue(): void;
}

export function CombatRecap({ recap, points, pendingPassives, stats, onSpend, onContinue }: CombatRecapProps) {
  const [shown, setShown] = useState({ level: recap.levelBefore, width: recap.fillBefore, instant: true });
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    const play = async () => {
      await wait(350);
      for (const step of buildSteps(recap)) {
        if (cancelled) return;
        setShown({ level: step.level, width: step.from, instant: true });
        await wait(40);
        if (cancelled) return;
        setShown({ level: step.level, width: step.to, instant: false });
        await wait(STEP_MS);
        if (cancelled) return;
        if (step.level < recap.levelAfter) {
          setShown({ level: step.level + 1, width: 0, instant: true });
          await wait(450);
        }
      }
      if (!cancelled) setDone(true);
    };
    void play();
    return () => { cancelled = true; };
  }, [recap]);

  const gained = recap.levelAfter - recap.levelBefore;
  const showLevelUp = gained > 0 && shown.level > recap.levelBefore;

  return (
    <div className="recap-overlay" role="dialog" aria-label="Bilan du combat">
      <section className="recap-card">
        <p className="eyebrow">VICTOIRE</p>
        <div className="victory-emblem" aria-hidden="true">✦</div><h2>Combat remporté</h2>
        <p className="recap-line">{recap.kills} ennemi(s) vaincu(s) · <strong>+{recap.xpGained} XP</strong></p>
        <div className="recap-level">
          <span className={`recap-level-badge ${showLevelUp ? 'is-up' : ''}`} key={shown.level}>NIV. {shown.level}</span>
          <div className="meter xp recap-meter"><i style={{ width: `${Math.round(shown.width * 100)}%`, transition: shown.instant ? 'none' : `width ${STEP_MS}ms ease-out` }} /></div>
        </div>
        {showLevelUp && <p className="recap-levelup" aria-live="polite">Niveau supérieur ! {gained > 1 ? `+${gained} niveaux` : ''}</p>}
        {recap.loot.length > 0 && <div className="recap-loot"><p className="eyebrow">BUTIN OBTENU</p><div className="recap-loot-items">{recap.loot.map((name, index) => { const item = ITEMS.find((item) => item.name === name); return <div key={`${name}-${index}`}>{item && <ItemIcon id={item.id} rarity={item.rarity} size={64} />}<strong>{name}</strong></div>; })}</div></div>}
        {recap.notes.map((note) => <p className="recap-note" key={note}>{note}</p>)}
        {done && points > 0 && <div className="points-panel recap-points">
          <strong>{points} point(s) à répartir</strong>
          {stats.map((stat) => <div className="point-row" key={stat.key}>
            <StatIcon stat={stat.key} /><span>{stat.label}</span>
            {Array.from(new Set([1, 5, points])).filter((amount) => amount <= points).map((amount) => <button key={amount} onClick={() => onSpend(stat.key, amount)}>{amount === points ? 'Tout' : `+${amount}`}</button>)}
          </div>)}
        </div>}
        {done && pendingPassives > 0 && <p className="recap-note">{pendingPassives} passif(s) à choisir ensuite.</p>}
        <button className="primary" disabled={!done} onClick={onContinue}>{done ? 'Continuer' : '…'}</button>
      </section>
    </div>
  );
}
