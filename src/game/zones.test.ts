import { describe, expect, it } from 'vitest';
import { ENEMIES, ZONES } from './content';
import { newRun, rollEncounter, decodeRun } from './engine';
import { BOSS_POSITIONS, BOSS_BLOCK_RADIUS, GATES, ZONE_ENTRIES, ZONE_ROUTES, WORLD_WIDTH, WORLD_HEIGHT, WORLD_VERSION, routeDistance, generateDecor, PATHS, SECRET_POSITIONS, WORLD_START, ZONE_SHAPES, isWalkable, zoneAt } from './world';

describe('authored biome journeys', () => {
  it('keeps key points inside walkable space', () => {
    const points = [WORLD_START, ...Object.values(BOSS_POSITIONS), ...Object.values(SECRET_POSITIONS), ...Object.values(ZONE_SHAPES)];
    for (const point of points) expect(isWalkable(point.x, point.y, 30)).toBe(true);
  });

  it('keeps every corridor continuously walkable', () => {
    for (const { from, to } of PATHS) {
      for (let step = 0; step <= 100; step++) {
        const t = step / 100;
        expect(isWalkable(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 40)).toBe(true);
      }
    }
  });

  it('has solid walls outside the rooms', () => {
    expect(isWalkable(5, 5)).toBe(false);
    expect(isWalkable(2500, 1500)).toBe(false);
  });
});

describe('zones, groups and bosses', () => {
  it('never rolls more enemies than the zone allows and only zone enemies', () => {
    for (const zone of ZONES) {
      let run = newRun('warrior', 7);
      for (let index = 0; index < 300; index++) {
        const result = rollEncounter(run, zone.id);
        run = result.run;
        expect(result.enemies.length).toBeGreaterThanOrEqual(1);
        expect(result.enemies.length).toBeLessThanOrEqual(zone.maxGroup);
        for (const id of result.enemies) expect(zone.enemies).toContain(id);
      }
    }
  });

  it('keeps the first zone to single-enemy encounters', () => {
    expect(ZONES[0].maxGroup).toBe(1);
  });

  it('keeps each boss in its zone and on the final route point', () => {
    for(const zone of ZONES) {
      const boss=BOSS_POSITIONS[zone.boss];
      expect(ZONE_ROUTES[zone.id].at(-1)).toEqual(boss);
      expect(zoneAt(boss.x,boss.y).id).toBe(zone.id);
      expect(zoneAt(ZONE_ENTRIES[zone.id].x,ZONE_ENTRIES[zone.id].y).id).toBe(zone.id);
    }
    expect(GATES.map(gate=>gate.gate)).toEqual(ZONES.slice(0,-1).map(zone=>zone.boss));
  });

  it('defines every zone boss as an enemy', () => {
    for (const zone of ZONES) expect(ENEMIES.some((enemy) => enemy.id === zone.boss)).toBe(true);
  });

  it('forms a progression chain where each zone needs the previous boss', () => {
    expect(ZONES[0].requires).toBeNull();
    for (let index = 1; index < ZONES.length; index++) expect(ZONES[index].requires).toBe(ZONES[index - 1].boss);
  });
});

// Parcours réel à l'échelle du corps de collision, pas la seule longueur de la ligne dessinée.
const STEP=20, COLS=Math.ceil(WORLD_WIDTH/STEP), ROWS=Math.ceil(WORLD_HEIGHT/STEP);
const terrain=new Uint8Array(COLS*ROWS);
const solids:Record<string,number>={tree:.4,rock:.45,pond:.48,pillar:.45,tombstone:.4,lava:.45,obsidian:.42,'dead-tree':.3,log:.3,house:.5,well:.4,cart:.4};
const decor=generateDecor().filter(entry=>solids[entry.kind]);
for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) {
  const px=x*STEP,py=y*STEP;
  terrain[y*COLS+x]=Number(isWalkable(px,py,10)&&!decor.some(entry=>Math.hypot(px-entry.x,py-entry.y)<Math.max(5,entry.size*solids[entry.kind])+10));
}
function distance(from:{x:number;y:number},to:{x:number;y:number},closed:string[]=[]):number {
  const start=Math.round(from.y/STEP)*COLS+Math.round(from.x/STEP),target=Math.round(to.y/STEP)*COLS+Math.round(to.x/STEP);
  const lengths=new Int32Array(terrain.length).fill(-1),queue=new Int32Array(terrain.length);
  queue[0]=start;lengths[start]=0;let head=0,tail=1;
  while(head<tail) {
    const node=queue[head++],x=node%COLS,y=Math.floor(node/COLS);
    if(node===target) return lengths[node]*STEP;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy,next=ny*COLS+nx;
      if(nx<0||ny<0||nx>=COLS||ny>=ROWS||!terrain[next]||lengths[next]>=0)continue;
      if(closed.some(id=>Math.hypot(nx*STEP-BOSS_POSITIONS[id].x,ny*STEP-BOSS_POSITIONS[id].y)<BOSS_BLOCK_RADIUS+10))continue;
      lengths[next]=lengths[node]+1;queue[tail++]=next;
    }
  }
  return Infinity;
}
describe('level traversal and progression',()=>{
  it('increases both authored and shortest playable distance to successive bosses',()=>{
    let previous=0,authored=0;
    for(const zone of ZONES) {
      const length=distance(ZONE_ENTRIES[zone.id],BOSS_POSITIONS[zone.boss]);
      expect(Number.isFinite(length),zone.id).toBe(true);
      expect(length,zone.id).toBeGreaterThan(previous);
      expect(routeDistance(zone.id),zone.id).toBeGreaterThan(authored);
      previous=length;authored=routeDistance(zone.id);
    }
  });
  it('cannot bypass gate bosses to enter the next level',()=>{
    for(let i=0;i<ZONES.length-1;i++) {
      const zone=ZONES[i];
      expect(distance(ZONE_ENTRIES[zone.id],ZONE_ENTRIES[ZONES[i+1].id],[zone.boss]),zone.id).toBe(Infinity);
      expect(Number.isFinite(distance(ZONE_ENTRIES[zone.id],ZONE_ENTRIES[ZONES[i+1].id])),zone.id).toBe(true);
    }
  });
  it('keeps both secrets reachable with the authored solid decorations',()=>{
    for(const secret of Object.values(SECRET_POSITIONS))expect(Number.isFinite(distance(WORLD_START,secret))).toBe(true);
  });
  it('moves old saves to the entry of their first unfinished zone without losing progress',()=>{
    const old={...newRun('warrior'),worldVersion:undefined,position:{x:1600,y:500},defeatedBosses:['meadow-boss'],kills:12};
    const saved=decodeRun(JSON.stringify(old));
    expect(saved.worldVersion).toBe(WORLD_VERSION);
    expect(saved.position).toEqual(ZONE_ENTRIES.forest);
    expect(saved.kills).toBe(12);
    expect(saved.defeatedBosses).toEqual(old.defeatedBosses);
  });
});
