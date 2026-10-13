import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from './world';
import { drawDecorArt } from './decorArt';
import type { Decor, Point } from './world';

const TILE = 384;
const SCALE = 3;
const LIMIT = 24;

/** Static neon art is rasterized above the maximum camera zoom, once per tile.
 * Only nearby tiles stay allocated; transparent tiles meet without overlap. */
export class WorldArtCache {
  private tiles = new Map<string, Phaser.GameObjects.Image>();
  private sources = new Map<string, Phaser.GameObjects.Graphics>();
  private range = '';

  constructor(private scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private key(x: number, y: number): string { return `world-art-${x}-${y}`; }

  private source(x: number, y: number): Phaser.GameObjects.Graphics {
    const key = this.key(x,y);
    let graphics = this.sources.get(key);
    if (!graphics) {
      graphics = this.scene.make.graphics({ x:0,y:0 },false).setScrollFactor(0).setScale(SCALE);
      graphics.translateCanvas(-x*TILE,-y*TILE);
      this.sources.set(key,graphics);
    }
    return graphics;
  }

  private eachTile(left:number,top:number,right:number,bottom:number,draw:(x:number,y:number)=>void): void {
    for(let y=Math.max(0,Math.floor(top/TILE));y<=Math.min(Math.ceil(WORLD_HEIGHT/TILE)-1,Math.floor(bottom/TILE));y++) {
      for(let x=Math.max(0,Math.floor(left/TILE));x<=Math.min(Math.ceil(WORLD_WIDTH/TILE)-1,Math.floor(right/TILE));x++) draw(x,y);
    }
  }

  strokePath(points: Point[], width: number, color: number, alpha: number): void {
    const paths = new Map<string,{ x:number;y:number;runs:Point[][] }>();
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],margin=width/2+2;
      this.eachTile(Math.min(a.x,b.x)-margin,Math.min(a.y,b.y)-margin,Math.max(a.x,b.x)+margin,Math.max(a.y,b.y)+margin,(x,y)=>{
        const key=this.key(x,y);
        const entry=paths.get(key)??{x,y,runs:[]};
        const run=entry.runs[entry.runs.length-1];
        if(run?.[run.length-1]===a)run.push(b); else entry.runs.push([a,b]);
        paths.set(key,entry);
      });
    }
    for(const {x,y,runs} of paths.values()) {
      const graphics=this.source(x,y).lineStyle(width,color,alpha);
      for(const run of runs)graphics.strokePoints(run,false);
    }
  }

  drawDecor(decor: Decor): void {
    const reach=decor.size*1.2+8;
    this.eachTile(decor.x-reach,decor.y-reach,decor.x+reach,decor.y+reach,(x,y)=>drawDecorArt(this.source(x,y),decor));
  }

  update(view: Phaser.Geom.Rectangle): void {
    const left = Math.max(0, Math.floor((view.left-96)/TILE));
    const top = Math.max(0, Math.floor((view.top-96)/TILE));
    const right = Math.min(Math.ceil(WORLD_WIDTH/TILE)-1, Math.floor((view.right+96)/TILE));
    const bottom = Math.min(Math.ceil(WORLD_HEIGHT/TILE)-1, Math.floor((view.bottom+96)/TILE));
    const range = `${left},${top},${right},${bottom}`;
    if (range === this.range) return;
    this.range = range;
    const wanted = new Set<string>();
    for (let y=top;y<=bottom;y++) for(let x=left;x<=right;x++) wanted.add(this.key(x,y));
    for (const [key, image] of this.tiles) image.setVisible(wanted.has(key));
    for (let y=top;y<=bottom;y++) for(let x=left;x<=right;x++) {
      const key = this.key(x,y);
      const source = this.sources.get(key);
      if(!source)continue;
      let image = this.tiles.get(key);
      if (!image) {
        source.generateTexture(key,TILE*SCALE,TILE*SCALE);
        this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
        image = this.scene.add.image(x*TILE,y*TILE,key).setOrigin(0).setScale(1/SCALE).setDepth(1);
      }
      this.tiles.delete(key);
      this.tiles.set(key,image.setVisible(true));
    }
    for (const [key,image] of this.tiles) {
      if (this.tiles.size<=LIMIT) break;
      if (wanted.has(key)) continue;
      image.destroy();
      this.scene.textures.remove(key);
      this.tiles.delete(key);
    }
  }

  private destroy(): void {
    for(const [key,image] of this.tiles) {
      image.destroy();
      this.scene.textures.remove(key);
    }
    this.tiles.clear();
    for(const source of this.sources.values())source.destroy();
    this.sources.clear();
  }
}
