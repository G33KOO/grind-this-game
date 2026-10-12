import { renderToStaticMarkup } from 'react-dom/server';
import { EnemyArt } from './BattleScene';

/** SVG autonome du boss, identique au dessin affiché en combat. */
export function bossSvg(id: string, color: number, size = 320): string {
  const channels = [16, 8, 0].map((shift) => (color >> shift) & 255);
  const peak = Math.max(...channels, 1);
  const neon = `#${channels.map((value) => Math.round((value / peak) * 255).toString(16).padStart(2, '0')).join('')}`;
  const markup = renderToStaticMarkup(<EnemyArt id={id} color={color} />)
    .replace(/<ellipse[^>]*fill="#000"[^>]*\/>/g, '')
    .replace(/stroke="#12161c"/g, `stroke="${neon}"`)
    .replace(/stroke-width="3"/g, 'stroke-width="2.5"')
    .replace(/fill="(#[0-9a-fA-F]{3,6})"/g, (match, value: string) => (value === '#000' ? match : `fill="${value}" fill-opacity=".22"`));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}"><defs><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${neon}" flood-opacity=".8"/></filter></defs><g filter="url(#g)">${markup}</g></svg>`;
}
