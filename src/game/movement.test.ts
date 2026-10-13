import { describe, expect, it } from 'vitest';
import { moveWithSliding, obstacleField, PLAYER_RADIUS } from './movement';
import { BOSS_BLOCK_RADIUS, BOSS_POSITIONS, PATHS, WORLD_START, clearance } from './world';

describe('wall sliding', () => {
  it('preserves tangential movement against a straight wall', () => {
    const position=moveWithSliding({x:10,y:0},{x:-8,y:12},x=>x);
    expect(position.x).toBeGreaterThanOrEqual(PLAYER_RADIUS);
    expect(position.y).toBeCloseTo(12,1);
  });

  it('slides along angled walls instead of cancelling both world axes', () => {
    const field=(x:number,y:number)=>100-(x+y)/Math.SQRT2;
    const start={x:(100-9.1)/Math.SQRT2,y:(100-9.1)/Math.SQRT2};
    const position=moveWithSliding(start,{x:12,y:0},field);
    expect(position.x).toBeGreaterThan(start.x+4);
    expect(position.y).toBeLessThan(start.y-4);
    expect(field(position.x,position.y)).toBeGreaterThanOrEqual(PLAYER_RADIUS);
  });

  it('continues sliding around curved room edges', () => {
    const field=(x:number,y:number)=>100-Math.hypot(x,y);
    const start={x:90.9/Math.SQRT2,y:90.9/Math.SQRT2};
    let position=start;
    for(let frame=0;frame<20;frame++) {
      position=moveWithSliding(position,{x:2,y:0},field);
      expect(field(position.x,position.y)).toBeGreaterThanOrEqual(PLAYER_RADIUS);
    }
    expect(position.x).toBeGreaterThan(start.x+10);
    expect(position.y).toBeLessThan(start.y-10);
  });

  it('allows immediate retreat from an inside corner', () => {
    const field=(x:number,y:number)=>Math.min(x,y);
    const corner=moveWithSliding({x:9.1,y:9.1},{x:-12,y:-12},field);
    const retreat=moveWithSliding(corner,{x:12,y:8},field);
    expect(retreat.x).toBeGreaterThan(corner.x+11);
    expect(retreat.y).toBeGreaterThan(corner.y+7);
  });

  it('recovers a small overlap and permits movement away from a wall', () => {
    const position=moveWithSliding({x:7,y:0},{x:6,y:8},x=>x);
    expect(position.x).toBeGreaterThan(14);
    expect(position.y).toBeCloseTo(8);
  });

  it('slides around solid decorations without passing through them', () => {
    const field=obstacleField(()=>1000,[{x:0,y:0,radius:30}]);
    let position={x:39.1,y:0};
    for(let frame=0;frame<12;frame++) {
      position=moveWithSliding(position,{x:-2,y:3},field);
      expect(Math.hypot(position.x,position.y)).toBeGreaterThanOrEqual(39);
    }
    expect(position.y).toBeGreaterThan(25);
  });

  it('cannot tunnel through a boss gate with a large displacement', () => {
    const boss=BOSS_POSITIONS['meadow-boss'];
    const field=obstacleField(clearance,[{...boss,radius:BOSS_BLOCK_RADIUS}]);
    const position=moveWithSliding({x:boss.x-110,y:boss.y},{x:220,y:0},field);
    expect(position.x).toBeLessThan(boss.x);
    expect(Math.hypot(position.x-boss.x,position.y-boss.y)).toBeGreaterThanOrEqual(BOSS_BLOCK_RADIUS+PLAYER_RADIUS);
  });

  it('keeps travel along all narrow and bent world paths within walkable space', () => {
    expect(clearance(WORLD_START.x,WORLD_START.y)).toBeGreaterThan(PLAYER_RADIUS);
    for(const path of PATHS) {
      let position={...path.from};
      for(let step=0;step<120;step++) {
        const dx=path.to.x-position.x,dy=path.to.y-position.y,length=Math.hypot(dx,dy);
        if(length<2)break;
        const distance=Math.min(12,length);
        position=moveWithSliding(position,{x:dx/length*distance,y:dy/length*distance},clearance);
        expect(clearance(position.x,position.y)).toBeGreaterThanOrEqual(PLAYER_RADIUS);
      }
      expect(Math.hypot(position.x-path.to.x,position.y-path.to.y)).toBeLessThan(2);
    }
  });
});
