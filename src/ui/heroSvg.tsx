import { renderToStaticMarkup } from 'react-dom/server';
import type { HeroId } from '../game/types';
import { HeroArt } from './BattleScene';

/** Même illustration que le choix de classe, sans variante du personnage. */
export function heroSvg(hero: HeroId, color: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 224 224" width="224" height="224">${renderToStaticMarkup(<HeroArt hero={hero} color={color} />)}</svg>`;
}
