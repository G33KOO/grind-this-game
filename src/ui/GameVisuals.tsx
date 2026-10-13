import { HEROES } from '../game/content';
import type { HeroId } from '../game/types';
import { EnemyArt, HeroArt } from './BattleScene';
import { HERO_ACCENT } from './icons';
import type { Stats } from '../game/types';

export function formatStatValue(stat: keyof Stats, value: number): string {
  return stat === 'critChance' || stat === 'critDamage' ? `${Math.round(value)} %` : String(Math.round(value));
}

export function HeroPortrait({ hero, className = '' }: { hero: HeroId; className?: string }) {
  return <div className={`hero-portrait ${className}`} style={{ ['--accent' as string]: HERO_ACCENT[hero] }} aria-hidden="true">
    <div className="portrait-orbit" /><div className="portrait-plinth" />
    <svg viewBox="0 0 200 200"><HeroArt hero={hero} color={parseInt(HERO_ACCENT[hero].slice(1), 16)} /></svg>
  </div>;
}

export function MonsterPortrait({ id, color, className = '' }: { id: string; color: number; className?: string }) {
  return <div className={`monster-portrait ${className}`} style={{ ['--accent' as string]: `#${color.toString(16).padStart(6, '0')}` }} aria-hidden="true">
    <svg viewBox="0 0 200 200"><EnemyArt id={id} color={color} /></svg>
  </div>;
}

export function HeroIdentity({ hero, level, subtitle }: { hero: HeroId; level?: number; subtitle: string }) {
  return <div className="hero-identity-banner" style={{ ['--accent' as string]: HERO_ACCENT[hero] }}>
    <HeroPortrait hero={hero} /><div><p className="eyebrow">{subtitle}</p><h2>{HEROES[hero].name}</h2>
      <span className="hero-role">{hero === 'warrior' ? 'LE REMPART · DÉFENSE / BOUCLIER' : 'L’OMBRE · VITESSE / POISON'}</span></div>
    {level !== undefined && <div className="level-seal"><small>NIVEAU</small><strong>{level}</strong></div>}
  </div>;
}

export type MenuIconId = 'inventory' | 'character' | 'loot' | 'achievements' | 'settings' | 'sound' | 'controls' | 'display' | 'accessibility' | 'continue' | 'newGame' | 'abandon' | 'quit';
export function MenuIcon({ id, size = 24 }: { id: MenuIconId; size?: number }) {
  const paths: Record<MenuIconId, React.ReactNode> = {
    continue: <><circle cx="12" cy="12" r="9" /><path d="m10 7 7 5-7 5Z" /></>,
    newGame: <><path d="m14 3 7 0 0 7-10 10-7-7Z" /><path d="m4 13 7 7M7 16l-4 5M2 20l2 2M4 3v6M1 6h6" /></>,
    abandon: <><path d="M5 3v18M5 4h13l-3 5 3 5H5M11 18l7 0M14 15l-3 3 3 3" /></>,
    quit: <><path d="M12 2v10M6 5a9 9 0 1 0 12 0" /></>,
    inventory: <><path d="m6 5 6-3 6 3v16H6Z" /><path d="M6 9h12M9 13h6M9 17h6" /></>,
    character: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-3a8 8 0 0 1 16 0v3M9 15l3 3 3-3" /></>,
    loot: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16" /><circle cx="12" cy="11" r="2" /></>,
    achievements: <><path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 14v6M7 21h10" /></>,
    settings: <><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z" /><circle cx="12" cy="12" r="3" /></>,
    sound: <><path d="M3 9h4l5-5v16l-5-5H3ZM16 8a6 6 0 0 1 0 8M19 4a11 11 0 0 1 0 16" /></>,
    controls: <><path d="M7 6h10c5 0 7 14 3 14l-5-4H9l-5 4C0 20 2 6 7 6ZM5 10v5M3 12.5h5M16 10h.1M19 13h.1" /></>,
    display: <><rect x="2" y="3" width="20" height="14" rx="1" /><path d="M12 17v4M7 21h10M5 6h3M16 14h3" /></>,
    accessibility: <><circle cx="12" cy="4" r="2" /><path d="M3 9h18M12 7v8M12 15l-5 7M12 15l5 7" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[id]}</svg>;
}

export function StatIcon({ stat }: { stat: string }) {
  const glyphs: Record<string, string> = { strength: '⚔', speed: '➤', luck: '✦', critChance: '◎', critDamage: '✧', maxHp: '♥', defense: '⬡', lifesteal: '♥', shield: '⬡', damageReduction: '⬡', extraStrike: '⚔', cleave: '✺', poisonDamage: '◈', poisonTurns: '◷', lowHealthDamage: '✹', defenseDamage: '⚔' };
  return <span className={`stat-glyph stat-${stat}`} aria-hidden="true">{glyphs[stat] ?? '◇'}</span>;
}

export function MenuFooter() {
  return null;
}
