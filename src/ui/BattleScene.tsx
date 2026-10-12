import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CombatState, HeroId } from '../game/types';

const INK = '#12161c';
const line = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const neonFor = (color: number) => {
  const channels = [16, 8, 0].map((shift) => (color >> shift) & 255);
  const peak = Math.max(...channels, 1);
  return `#${channels.map((value) => Math.min(255, Math.round((value / peak) * 255)).toString(16).padStart(2, '0')).join('')}`;
};
const shade = (color: number, factor: number) => {
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((color >> shift) & 255) * factor)));
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
};

const Eyes = ({ x, y, gap, size = 7, color = '#fff', pupil = INK }: { x: number; y: number; gap: number; size?: number; color?: string; pupil?: string }) => (
  <>
    <circle cx={x - gap} cy={y} r={size} fill={color} {...line} strokeWidth={2} />
    <circle cx={x + gap} cy={y} r={size} fill={color} {...line} strokeWidth={2} />
    <circle cx={x - gap} cy={y + 1} r={size * 0.45} fill={pupil} />
    <circle cx={x + gap} cy={y + 1} r={size * 0.45} fill={pupil} />
  </>
);

const ART_ALIAS: Record<string, string> = { 'meadow-boss': 'slime', 'forest-boss': 'wolf', 'marsh-boss': 'wisp', 'crypt-boss': 'skeleton' };

function EnemyArt({ id: rawId, color }: { id: string; color: number }) {
  const id = ART_ALIAS[rawId] ?? rawId;
  const base = hex(color);
  const dark = shade(color, 0.65);
  const light = shade(color, 1.25);
  switch (id) {
    case 'slime':
      return <>
        <path d="M28 172 C22 118 58 66 100 66 C142 66 178 118 172 172 Q100 188 28 172Z" fill={base} {...line} />
        <path d="M48 120 C52 92 70 80 88 78" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="7" strokeLinecap="round" />
        <circle cx="140" cy="150" r="6" fill={light} /><circle cx="60" cy="152" r="4" fill={light} />
        <Eyes x={100} y={118} gap={22} size={11} />
        <path d="M84 148 Q100 160 116 148" fill="none" {...line} />
      </>;
    case 'rat':
      return <>
        <path d="M160 150 C196 150 190 108 170 100" fill="none" stroke="#d89aa0" strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="100" cy="140" rx="62" ry="38" fill={base} {...line} />
        <circle cx="60" cy="86" r="20" fill="#e3a6ae" {...line} /><circle cx="140" cy="86" r="20" fill="#e3a6ae" {...line} />
        <ellipse cx="100" cy="112" rx="50" ry="42" fill={light} {...line} />
        <ellipse cx="100" cy="136" rx="22" ry="17" fill="#e8c9b2" {...line} strokeWidth={2} />
        <ellipse cx="100" cy="128" rx="7" ry="5" fill="#e37b8a" {...line} strokeWidth={2} />
        <Eyes x={100} y={104} gap={20} size={8} color="#ffe27a" pupil="#a01616" />
        <rect x="94" y="140" width="6" height="12" fill="#fff" {...line} strokeWidth={2} /><rect x="101" y="140" width="6" height="12" fill="#fff" {...line} strokeWidth={2} />
        <path d="M70 130 L30 122 M70 138 L30 142 M130 130 L170 122 M130 138 L170 142" stroke={INK} strokeWidth="2" />
      </>;
    case 'bandit':
      return <>
        <path d="M52 176 L60 108 Q100 90 140 108 L148 176Z" fill={base} {...line} />
        <rect x="52" y="130" width="96" height="12" fill="#3b2b22" {...line} strokeWidth={2} /><rect x="92" y="127" width="16" height="18" fill="#d9b25b" {...line} strokeWidth={2} />
        <circle cx="100" cy="76" r="30" fill="#e5b891" {...line} />
        <path d="M70 70 Q100 30 130 70 L130 62 Q100 22 70 62Z" fill="#7c2d2d" {...line} />
        <path d="M70 78 L130 78 L126 98 Q100 108 74 98Z" fill="#2b2b36" {...line} />
        <Eyes x={100} y={70} gap={14} size={6} />
        <path d="M80 62 L92 66 M120 62 L108 66" stroke={INK} strokeWidth="3" />
        <path d="M160 110 L184 150" stroke="#cfd6dd" strokeWidth="9" strokeLinecap="round" /><path d="M160 110 L184 150" stroke={INK} strokeWidth="2" opacity=".5" />
        <rect x="152" y="104" width="18" height="8" rx="3" fill="#5b3d2a" {...line} strokeWidth={2} transform="rotate(30 160 108)" />
      </>;
    case 'wolf':
      return <>
        <path d="M44 80 L58 24 L90 62Z" fill={dark} {...line} /><path d="M156 80 L142 24 L110 62Z" fill={dark} {...line} />
        <path d="M54 70 L60 42 L78 62Z" fill="#c98f97" />
        <path d="M30 130 Q36 66 100 62 Q164 66 170 130 Q150 176 100 180 Q50 176 30 130Z" fill={base} {...line} />
        <path d="M70 132 Q100 100 130 132 Q132 172 100 178 Q68 172 70 132Z" fill="#dfe5ea" {...line} />
        <path d="M70 80 L82 100 M130 80 L118 100" stroke={dark} strokeWidth="6" strokeLinecap="round" />
        <path d="M70 100 L92 108 L88 116 L66 110Z M130 100 L108 108 L112 116 L134 110Z" fill="#ffd84d" {...line} strokeWidth={2} />
        <ellipse cx="100" cy="132" rx="12" ry="9" fill={INK} />
        <path d="M82 150 Q100 162 118 150" fill="#8c1f2b" {...line} strokeWidth={2} />
        <path d="M86 150 L90 164 L95 152Z M114 150 L110 164 L105 152Z" fill="#fff" {...line} strokeWidth={2} />
      </>;
    case 'skeleton':
      return <>
        <path d="M78 170 L82 124 M122 170 L118 124" stroke="#ebe6d3" strokeWidth="9" strokeLinecap="round" />
        <path d="M70 104 Q100 92 130 104 L124 128 Q100 136 76 128Z" fill="#ebe6d3" {...line} />
        <path d="M80 108 L120 108 M82 116 L118 116 M86 124 L114 124" stroke={INK} strokeWidth="2.5" />
        <path d="M70 108 L46 134 M130 108 L154 134" stroke="#ebe6d3" strokeWidth="8" strokeLinecap="round" />
        <ellipse cx="100" cy="66" rx="30" ry="28" fill="#f3efdf" {...line} />
        <rect x="82" y="86" width="36" height="16" rx="5" fill="#f3efdf" {...line} />
        <ellipse cx="88" cy="64" rx="9" ry="11" fill={INK} /><ellipse cx="112" cy="64" rx="9" ry="11" fill={INK} />
        <circle cx="88" cy="66" r="3" fill="#ff5f4a" /><circle cx="112" cy="66" r="3" fill="#ff5f4a" />
        <path d="M96 78 L100 86 L104 78Z" fill={INK} /><path d="M90 92 L90 100 M100 92 L100 100 M110 92 L110 100" stroke={INK} strokeWidth="2" />
        <path d="M160 70 L160 150" stroke="#9aa3ad" strokeWidth="8" strokeLinecap="round" /><rect x="148" y="146" width="24" height="7" rx="3" fill="#5b3d2a" {...line} strokeWidth={2} />
      </>;
    case 'cultist':
      return <>
        <path d="M44 178 L66 84 Q100 52 134 84 L156 178Z" fill={base} {...line} />
        <path d="M100 100 L100 176" stroke={dark} strokeWidth="4" />
        <path d="M70 90 Q100 40 130 90 Q100 120 70 90Z" fill={dark} {...line} />
        <ellipse cx="100" cy="92" rx="20" ry="22" fill="#1a1022" />
        <ellipse cx="91" cy="90" rx="5" ry="4" fill="#ffb347" /><ellipse cx="109" cy="90" rx="5" ry="4" fill="#ffb347" />
        <path d="M42 120 L62 150" stroke="#5b3d2a" strokeWidth="6" strokeLinecap="round" /><path d="M172 60 L172 176" stroke="#5b3d2a" strokeWidth="6" strokeLinecap="round" />
        <circle cx="172" cy="52" r="13" fill="#ff7bd0" {...line} /><circle cx="172" cy="52" r="22" fill="#ff7bd0" opacity=".25" />
        <circle cx="62" cy="152" r="8" fill="#e5b891" {...line} strokeWidth={2} />
      </>;
    case 'golem':
      return <>
        <rect x="36" y="100" width="40" height="62" rx="10" fill={dark} {...line} /><rect x="124" y="100" width="40" height="62" rx="10" fill={dark} {...line} />
        <rect x="26" y="150" width="50" height="30" rx="8" fill={base} {...line} /><rect x="124" y="150" width="50" height="30" rx="8" fill={base} {...line} />
        <path d="M56 176 L60 134 L140 134 L144 176Z" fill={dark} {...line} />
        <path d="M52 134 L58 74 L142 74 L148 134Z" fill={base} {...line} />
        <rect x="72" y="36" width="56" height="44" rx="10" fill={light} {...line} />
        <rect x="78" y="52" width="44" height="10" rx="3" fill={INK} /><rect x="82" y="54" width="14" height="6" fill="#ffb347" /><rect x="104" y="54" width="14" height="6" fill="#ffb347" />
        <circle cx="100" cy="104" r="12" fill="#ffb347" {...line} /><circle cx="100" cy="104" r="20" fill="#ffb347" opacity=".25" />
        <path d="M60 90 L72 106 L64 120 M138 84 L128 100 L140 114 M90 36 L96 52" fill="none" stroke={INK} strokeWidth="2.5" />
      </>;
    case 'wisp':
      return <>
        <circle cx="100" cy="110" r="70" fill={base} opacity=".18" /><circle cx="100" cy="110" r="52" fill={base} opacity=".25" />
        <path d="M100 22 C130 62 156 84 152 124 C148 160 122 176 100 176 C78 176 52 160 48 124 C44 84 70 62 100 22Z" fill={base} {...line} />
        <path d="M100 66 C118 92 132 104 128 128 C125 148 112 156 100 156 C88 156 75 148 72 128 C68 104 82 92 100 66Z" fill="#e5f6ff" opacity=".85" />
        <ellipse cx="86" cy="124" rx="6" ry="9" fill={INK} /><ellipse cx="114" cy="124" rx="6" ry="9" fill={INK} />
        <path d="M90 144 Q100 152 110 144" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy="70" r="5" fill="#e5f6ff" /><circle cx="164" cy="56" r="4" fill="#e5f6ff" /><circle cx="156" cy="150" r="3" fill="#e5f6ff" />
      </>;
    case 'knight':
      return <>
        <path d="M46 176 L54 100 Q100 78 146 100 L154 176Z" fill="#5c6270" {...line} />
        <path d="M60 100 Q100 84 140 100 L136 136 Q100 146 64 136Z" fill="#8a909c" {...line} />
        <path d="M70 70 Q100 24 130 70 L130 100 L70 100Z" fill="#9aa1ad" {...line} />
        <path d="M100 30 Q86 4 112 8 Q124 24 112 40Z" fill="#a0332e" {...line} />
        <rect x="76" y="68" width="48" height="12" rx="3" fill={INK} /><rect x="96" y="80" width="8" height="20" fill="#7b8190" {...line} strokeWidth={2} />
        <ellipse cx="88" cy="74" rx="6" ry="2.5" fill="#ff5f4a" /><ellipse cx="112" cy="74" rx="6" ry="2.5" fill="#ff5f4a" />
        <path d="M26 110 L58 110 L58 150 Q42 172 26 150Z" fill={base} {...line} /><path d="M42 118 L42 150 M32 132 L52 132" stroke={INK} strokeWidth="3" />
        <path d="M164 40 L164 150" stroke="#cfd6dd" strokeWidth="11" strokeLinecap="round" /><path d="M164 40 L164 150" stroke={INK} strokeWidth="2" opacity=".4" />
        <rect x="150" y="146" width="28" height="8" rx="3" fill="#5b3d2a" {...line} strokeWidth={2} />
      </>;
    case 'drake':
      return <>
        <path d="M18 120 L50 40 L84 104Z M182 120 L150 40 L116 104Z" fill={dark} {...line} />
        <path d="M50 40 L52 104 M150 40 L148 104" stroke={INK} strokeWidth="2" />
        <path d="M62 56 L52 22 L82 46Z M138 56 L148 22 L118 46Z" fill="#f0e2bb" {...line} />
        <path d="M54 110 Q54 54 100 52 Q146 54 146 110 Q146 168 100 176 Q54 168 54 110Z" fill={base} {...line} />
        <path d="M74 128 Q100 108 126 128 Q128 168 100 172 Q72 168 74 128Z" fill="#f2c27a" {...line} />
        <path d="M70 96 L92 100 L88 110 L66 104Z M130 96 L108 100 L112 110 L134 104Z" fill="#ffe65c" {...line} strokeWidth={2} />
        <ellipse cx="82" cy="104" rx="2.5" ry="7" fill={INK} /><ellipse cx="118" cy="104" rx="2.5" ry="7" fill={INK} />
        <circle cx="90" cy="146" r="4" fill={INK} /><circle cx="110" cy="146" r="4" fill={INK} />
        <path d="M80 158 L84 170 L90 160 M120 158 L116 170 L110 160" fill="#fff" {...line} strokeWidth={2} />
        <path d="M96 174 Q100 190 104 174" fill="#ff7a2f" opacity=".8" />
      </>;
    case 'final-boss':
      return <>
        <circle cx="100" cy="100" r="92" fill={base} opacity=".16" />
        <path d="M28 176 L48 96 Q100 70 152 96 L172 176Z" fill="#3a3144" {...line} />
        <path d="M58 100 Q100 82 142 100 L138 160 Q100 172 62 160Z" fill={base} {...line} />
        <path d="M100 108 L100 160 M76 124 L124 124" stroke={dark} strokeWidth="4" />
        <circle cx="100" cy="132" r="9" fill="#ff5f4a" {...line} strokeWidth={2} />
        <path d="M34 112 Q22 100 40 86 L62 100Z M166 112 Q178 100 160 86 L138 100Z" fill={light} {...line} />
        <path d="M72 74 Q100 20 128 74 L128 96 L72 96Z" fill={light} {...line} />
        <path d="M74 52 L50 14 L84 40Z M126 52 L150 14 L116 40Z" fill="#f4e6b6" {...line} />
        <path d="M80 72 L92 80 L80 84Z M120 72 L108 80 L120 84Z" fill="#ff4a3a" {...line} strokeWidth={2} />
        <circle cx="86" cy="78" r="12" fill="#ff4a3a" opacity=".3" /><circle cx="114" cy="78" r="12" fill="#ff4a3a" opacity=".3" />
        <path d="M86 92 L114 92" stroke={INK} strokeWidth="3" />
        <path d="M168 20 L168 160" stroke="#e8d9a4" strokeWidth="9" strokeLinecap="round" /><path d="M156 42 L180 42" stroke="#e8d9a4" strokeWidth="6" strokeLinecap="round" />
      </>;
    default:
      return <circle cx="100" cy="110" r="50" fill={base} {...line} />;
  }
}

function HeroArt({ hero, color }: { hero: HeroId; color: number }) {
  const base = hex(color);
  const dark = shade(color, 0.6);
  if (hero === 'warrior') {
    return <>
      <path d="M52 186 L62 106 Q100 88 138 106 L148 186Z" fill="#a8353a" {...line} />
      <path d="M100 100 L100 186" stroke="#7d2429" strokeWidth="3" />
      <path d="M64 108 Q100 94 136 108 L132 150 Q100 160 68 150Z" fill="#7d8796" {...line} />
      <circle cx="100" cy="74" r="28" fill="#98a2b3" {...line} />
      <path d="M72 70 L128 70" stroke={INK} strokeWidth="3" /><path d="M100 46 Q88 28 108 26 Q118 38 108 50Z" fill={base} {...line} />
      <path d="M30 112 L64 112 L64 156 Q47 180 30 156Z" fill={base} {...line} /><path d="M47 122 L47 158 M36 138 L58 138" stroke={dark} strokeWidth="3" />
      <path d="M150 112 L178 30" stroke="#dfe5ea" strokeWidth="10" strokeLinecap="round" /><path d="M150 112 L178 30" stroke={INK} strokeWidth="2" opacity=".4" />
      <rect x="140" y="106" width="22" height="8" rx="3" fill="#5b3d2a" {...line} strokeWidth={2} transform="rotate(-20 151 110)" />
    </>;
  }
  return <>
    <path d="M56 186 L66 104 Q100 82 134 104 L144 186Z" fill="#2a3a38" {...line} />
    <path d="M100 96 L100 186" stroke="#18242a" strokeWidth="3" />
    <path d="M62 112 L138 112 L134 126 L66 126Z" fill={dark} {...line} strokeWidth={2} />
    <path d="M66 96 Q100 14 134 96 Q100 116 66 96Z" fill="#33504a" {...line} />
    <path d="M78 82 Q100 50 122 82 Q100 100 78 82Z" fill="#12161c" opacity=".7" />
    <path d="M44 128 L26 174 M44 128 L36 178" stroke="#dfe5ea" strokeWidth="6" strokeLinecap="round" />
    <path d="M156 128 L174 174 M156 128 L164 178" stroke="#dfe5ea" strokeWidth="6" strokeLinecap="round" />
    <circle cx="44" cy="128" r="9" fill={base} {...line} strokeWidth={2} /><circle cx="156" cy="128" r="9" fill={base} {...line} strokeWidth={2} />
  </>;
}

const ZONE_BACKDROPS: Record<string, { sky: string; ground: string; glow: string; scene: ReactNode }> = {
  meadow: {
    sky: 'linear-gradient(#6fb7d9, #cfe9c9 70%)', ground: 'linear-gradient(#5f9f48, #37692f)', glow: '#2ee6c8',
    scene: <><path d="M0 200 Q200 120 420 190 T860 170 T1200 190 L1200 260 L0 260Z" fill="#79b55a" /><path d="M0 230 Q300 170 600 220 T1200 210 L1200 260 L0 260Z" fill="#5f9f48" />
      {[120, 330, 880, 1060].map((x, i) => <g key={x} transform={`translate(${x} ${170 + (i % 2) * 14})`}><rect x="-5" y="20" width="10" height="34" fill="#5b3d2a" /><circle cx="0" cy="10" r="30" fill="#2f7a40" /><circle cx="-10" cy="0" r="18" fill="#3e9350" /></g>)}</>,
  },
  forest: {
    sky: 'linear-gradient(#2c5b4a, #5a8a62 75%)', ground: 'linear-gradient(#2f5f36, #1c3d25)', glow: '#58ff6e',
    scene: <>{Array.from({ length: 14 }, (_, i) => <g key={i} transform={`translate(${i * 95 + (i % 3) * 14} ${150 + (i % 2) * 22})`}><rect x="-8" y="24" width="16" height="70" fill="#3d2b1e" /><path d="M0 -50 L38 30 L-38 30Z M0 -20 L46 60 L-46 60Z" fill={i % 2 ? '#1f5a34' : '#26703f'} /></g>)}</>,
  },
  marsh: {
    sky: 'linear-gradient(#53675f, #a1b29b 75%)', ground: 'linear-gradient(#4a6252, #2d4237)', glow: '#35a7ff',
    scene: <><path d="M0 220 Q300 190 600 215 T1200 205 L1200 260 L0 260Z" fill="#6f8f7a" opacity=".7" />
      {Array.from({ length: 16 }, (_, i) => <g key={i} transform={`translate(${i * 78 + 20} ${200 + (i % 3) * 12})`}><path d="M0 40 L-3 -20 M6 40 L8 -26 M-6 40 L-10 -14" stroke="#7a9a52" strokeWidth="3" /><rect x="5" y="-34" width="6" height="14" rx="3" fill="#6a4a2f" /></g>)}</>,
  },
  crypt: {
    sky: 'linear-gradient(#1c1b34, #4b4a73 80%)', ground: 'linear-gradient(#4a4a64, #2a2a3d)', glow: '#b36bff',
    scene: <><circle cx="940" cy="70" r="46" fill="#e8e6ff" opacity=".85" />
      {[60, 260, 480, 700, 900, 1100].map((x, i) => <g key={x} transform={`translate(${x} ${i % 2 ? 190 : 170})`}><path d="M-22 70 L-22 20 Q-22 -10 0 -10 Q22 -10 22 20 L22 70Z" fill="#7a7d9b" /><path d="M0 4 L0 40 M-10 18 L10 18" stroke="#3a3d57" strokeWidth="4" /></g>)}
      {[180, 620, 1000].map((x) => <g key={x} transform={`translate(${x} 120)`}><rect x="-14" y="0" width="28" height="140" fill="#6a6d8a" /><rect x="-20" y="-8" width="40" height="14" fill="#8487a6" /></g>)}</>,
  },
  ashen: {
    sky: 'linear-gradient(#2a1210, #b4452a 80%)', ground: 'linear-gradient(#5a3a30, #2b1a17)', glow: '#ff6a2e',
    scene: <><path d="M300 260 L520 60 L600 60 L820 260Z" fill="#2d1a17" /><path d="M520 60 L600 60 L584 90 L536 90Z" fill="#ff8a3a" />
      <path d="M0 230 L160 150 L300 220 L430 160 L560 240 L760 170 L920 230 L1060 150 L1200 220 L1200 260 L0 260Z" fill="#3c2420" />
      {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={i * 68 + 20} cy={60 + ((i * 53) % 150)} r="2.5" fill="#ffb347" opacity=".8" />)}</>,
  },
};

interface Hit { id: number; amount: number }

function useHits(hp: number): Hit[] {
  const previous = useRef(hp);
  const counter = useRef(0);
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    const lost = previous.current - hp;
    previous.current = hp;
    if (lost <= 0) return;
    const id = ++counter.current;
    setHits((current) => [...current.slice(-2), { id, amount: lost }]);
    const timer = window.setTimeout(() => setHits((current) => current.filter((hit) => hit.id !== id)), 900);
    return () => window.clearTimeout(timer);
  }, [hp]);
  return hits;
}

function Fighter({ name, hp, maxHp, extra, className, onClick, targeted, children, neon }: {
  name: string; hp: number; maxHp: number; extra?: string; className?: string; onClick?: () => void;
  targeted?: boolean; children: ReactNode; neon: string;
}) {
  const hits = useHits(hp);
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  return (
    <div className={`fighter ${className ?? ''} ${hp <= 0 ? 'down' : ''} ${targeted ? 'targeted' : ''}`} onClick={onClick}
      style={{ ['--neon' as string]: neon }}
      role={onClick ? 'button' : undefined} aria-label={`${name} ${hp} sur ${maxHp} PV`}>
      {targeted && <div className="target-arrow" aria-hidden="true">▼</div>}
      <div className="fighter-sprite" key={hits.length ? hits[hits.length - 1].id : 'idle'}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          {children}
        </svg>
        {hits.map((hit) => <span className="damage-number" key={hit.id}>-{hit.amount}</span>)}
      </div>
      <div className="fighter-hp"><i style={{ width: `${ratio * 100}%` }} /></div>
      <div className="fighter-name">{name}<small>{Math.max(0, hp)}/{maxHp}{extra}</small></div>
    </div>
  );
}

export interface BattleSceneProps {
  combat: CombatState;
  hero: HeroId;
  heroName: string;
  heroColor: number;
  zoneId: string;
  target: number;
  speed: number;
  saveError: boolean;
  onTarget(index: number): void;
  onRetry(): void;
}

export function BattleScene({ combat, hero, heroName, heroColor, zoneId, target, speed, saveError, onTarget, onRetry }: BattleSceneProps) {
  const backdrop = ZONE_BACKDROPS[zoneId] ?? ZONE_BACKDROPS.meadow;
  const count = combat.enemies.length;
  return (
    <section className={`battle ${count > 3 ? 'crowded' : ''}`} aria-label="Combat" style={{ ['--glow' as string]: backdrop.glow }}>
      <div className="battle-sky" />
      <svg className="battle-backdrop" viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">{backdrop.scene}</svg>
      <div className="battle-ground" />
      <div className="battle-speed" aria-hidden="true">×{speed} · ← → ou Tab : cible</div>
      <div className="battle-enemies">
        {combat.enemies.map((enemy, index) => (
          <Fighter key={enemy.unitId} name={enemy.name} hp={enemy.currentHp} maxHp={enemy.hp} neon={neonFor(enemy.color)}
            className={`enemy-fighter ${enemy.id.endsWith('boss') ? 'boss' : ''}`}
            extra={enemy.poisonTurns > 0 ? ` ☠${enemy.poisonTurns}` : ''}
            targeted={target === index && enemy.currentHp > 0} onClick={() => onTarget(index)}>
            <EnemyArt id={enemy.id} color={enemy.color} />
          </Fighter>
        ))}
      </div>
      <Fighter name={heroName} hp={combat.playerHp} maxHp={combat.playerMaxHp} className="hero-fighter" neon={neonFor(heroColor)}
        extra={combat.shield > 0 ? ` 🛡${combat.shield}` : ''}>
        <HeroArt hero={hero} color={heroColor} />
      </Fighter>
      <div className="battle-log" aria-live="polite">{combat.log.slice(-4).map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>)}</div>
      {saveError && combat.over !== 'none' && <button className="primary battle-retry" onClick={onRetry}>Réessayer l’enregistrement du combat</button>}
    </section>
  );
}
