import { renderToStaticMarkup } from 'react-dom/server';
import { EnemyArt } from './BattleScene';

/** SVG autonome du boss, identique au dessin affiché en combat. */
export function bossSvg(id: string, color: number, size = 320): string {
  const markup = renderToStaticMarkup(<EnemyArt id={id} color={color} />);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 224 224" width="${size}" height="${size}">${markup}</svg>`;
}
