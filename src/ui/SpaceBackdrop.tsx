import type { CSSProperties } from 'react';

// Fixed visual seed: stars stay stable across rerenders and use no gameplay RNG.
const STARS = Array.from({ length: 85 }, (_, index) => {
  const random = (salt: number) => {
    const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  return {
    left: `${random(1) * 100}%`, top: `${random(2) * 100}%`,
    '--star-size': `${random(3) > .9 ? 3 : random(3) > .55 ? 2 : 1}px`,
    '--star-opacity': .2 + random(4) * .55,
    '--twinkle-time': `${3 + random(5) * 6}s`,
    animationDelay: `${-random(6) * 12}s`,
  } as CSSProperties;
});

export function SpaceBackdrop() {
  return <div className="space-backdrop" aria-hidden="true">
    <div className="space-nebula nebula-cyan" /><div className="space-nebula nebula-violet" />
    <div className="space-dust" />
    <div className="space-starfield">{STARS.map((style, index) => <i className="space-star" key={index} style={style} />)}</div>
    <div className="space-orbit orbit-one" /><div className="space-orbit orbit-two" />
    <div className="space-meteors"><i /><i /><i /></div>
    <div className="space-vignette" />
  </div>;
}
