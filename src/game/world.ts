import { ZONES } from './content';
export type ZoneId = typeof ZONES[number]['id'];
export type ZoneDefinition = typeof ZONES[number];
export interface Point { x: number; y: number }
export const WORLD_VERSION = 2;
export const WORLD_WIDTH = 4200;
export const WORLD_HEIGHT = 3000;
export const WORLD_START = { x: 280, y: 600 };
export const BOSS_BLOCK_RADIUS = 70;
export const BOSS_POSITIONS: Record<string, Point> = {
  'meadow-boss': { x: 1150, y: 600 }, 'forest-boss': { x: 2530, y: 500 },
  'marsh-boss': { x: 3920, y: 1450 }, 'crypt-boss': { x: 2520, y: 2550 }, 'final-boss': { x: 600, y: 1680 },
};
export const SECRET_POSITIONS = { 'secret-one': { x: 1800, y: 1100 }, 'secret-two': { x: 2750, y: 2100 } } as const;
export const ZONE_ENTRIES: Record<ZoneId, Point> = {
  meadow: WORLD_START, forest: { x: 1330, y: 600 }, marsh: { x: 2700, y: 500 }, crypt: { x: 3920, y: 1680 }, ashen: { x: 2280, y: 2550 },
};
// Repères de téléportation et de classement des biomes : tous sont sur un chemin.
export const ZONE_SHAPES: Record<ZoneId, { x: number; y: number; weight: number; rx: number; ry: number }> = {
  meadow: { x: 700, y: 350, weight: 1, rx: 180, ry: 140 },
  forest: { x: 1900, y: 900, weight: 1, rx: 150, ry: 120 },
  marsh: { x: 3300, y: 800, weight: 1, rx: 110, ry: 100 },
  crypt: { x: 3300, y: 2300, weight: 1, rx: 150, ry: 115 },
  ashen: { x: 1250, y: 2300, weight: 1, rx: 120, ry: 100 },
};
const points = (pairs: number[][]): Point[] => pairs.map(([x,y]) => ({ x,y }));
export const ZONE_ROUTES: Record<ZoneId, Point[]> = {
  meadow: points([[280,600],[400,350],[700,350],[900,600],[1150,600]]),
  forest: points([[1330,600],[1450,800],[1900,900],[2150,650],[1850,350],[2250,300],[2530,500]]),
  marsh: points([[2700,500],[3000,300],[3700,300],[3800,700],[3300,800],[3000,1100],[3750,1200],[3920,1450]]),
  crypt: points([[3920,1680],[3750,1650],[2950,1650],[2950,2300],[3700,2300],[3700,2750],[2800,2750],[2520,2550]]),
  ashen: points([[2280,2550],[1950,2700],[1900,2300],[2250,1900],[1700,1750],[1250,1800],[1250,2300],[1550,2650],[700,2650],[500,2100],[850,1900],[600,1680]]),
};
export interface Path { from: Point; to: Point; width: number; zone: ZoneId; gate?: string }
const WIDTHS: Record<ZoneId, number> = { meadow: 260, forest: 190, marsh: 140, crypt: 120, ashen: 105 };
export const PATHS: Path[] = ZONES.flatMap(zone => ZONE_ROUTES[zone.id].slice(1).map((to,index) => ({ from: ZONE_ROUTES[zone.id][index], to, zone: zone.id, width: index === ZONE_ROUTES[zone.id].length - 2 && zone.id !== 'ashen' ? 110 : WIDTHS[zone.id] })));
export const GATES: Path[] = ZONES.slice(0,-1).map((zone,index) => ({ from: BOSS_POSITIONS[zone.boss], to: ZONE_ENTRIES[ZONES[index+1].id], width: 110, zone: zone.id, gate: zone.boss }));
PATHS.push(...GATES,
  { from: { x: 700,y:350 }, to: { x: 700,y:150 }, width: 145, zone:'meadow' },
  { from: { x:1900,y:900 }, to:SECRET_POSITIONS['secret-one'], width:115,zone:'forest' },
  { from:{x:3800,y:700},to:{x:4000,y:900},width:105,zone:'marsh' },
  { from:{x:2950,y:2200},to:SECRET_POSITIONS['secret-two'],width:105,zone:'crypt' },
  { from:{x:1700,y:1750},to:{x:1750,y:1500},width:100,zone:'ashen' },
);
interface Room extends Point { rx: number; ry: number; zone: ZoneId }
const ROOMS: Room[] = ZONES.flatMap(zone => ZONE_ROUTES[zone.id].slice(0,-1).map((point) => ({ ...point, zone:zone.id,
  rx: zone.id==='meadow' ? 165 : zone.id==='forest' ? 125 : zone.id==='crypt' ? 115 : 85,
  ry: zone.id==='meadow' ? 135 : zone.id==='forest' ? 110 : zone.id==='crypt' ? 95 : 75,
})));
ROOMS.push({x:600,y:1680,rx:150,ry:130,zone:'ashen'}, {x:700,y:150,rx:100,ry:80,zone:'meadow'}, {x:1800,y:1100,rx:90,ry:75,zone:'forest'}, {x:4000,y:900,rx:90,ry:80,zone:'marsh'}, {x:2750,y:2100,rx:90,ry:75,zone:'crypt'});
export const LANDMARKS: { zone: ZoneId; name: string; position: Point; kind: 'village'|'grove'|'bridge'|'ruins'|'altar' }[] = [
  {zone:'meadow',name:'Ferme du ruisseau',position:{x:400,y:350},kind:'village'},
  {zone:'meadow',name:'Verger abandonné',position:{x:700,y:350},kind:'grove'},
  {zone:'forest',name:'Camp des bûcherons',position:{x:1450,y:800},kind:'village'},
  {zone:'forest',name:'Clairière des racines',position:{x:1850,y:350},kind:'grove'},
  {zone:'marsh',name:'Ancienne chaussée',position:{x:3700,y:300},kind:'bridge'},
  {zone:'marsh',name:'Îlot des roseaux',position:{x:3000,y:1100},kind:'bridge'},
  {zone:'crypt',name:'Galerie funéraire',position:{x:2950,y:1650},kind:'ruins'},
  {zone:'crypt',name:'Salle des veilleurs',position:{x:3700,y:2300},kind:'ruins'},
  {zone:'ashen',name:'Carrière effondrée',position:{x:2250,y:1900},kind:'ruins'},
  {zone:'ashen',name:'Autel du seuil',position:{x:600,y:1680},kind:'altar'},
];
export const routeDistance = (zone: ZoneId): number => ZONE_ROUTES[zone].slice(1).reduce((sum,point,index) => sum + Math.hypot(point.x-ZONE_ROUTES[zone][index].x,point.y-ZONE_ROUTES[zone][index].y),0);
const hash = (x: number, y: number): number => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const top = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u;
  const bottom = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u;
  return top + (bottom - top) * v;
}

const segmentDistance = (x: number, y: number, a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
};


// Index spatial : la carte agrandie ne parcourt que les formes locales à chaque requête.
const buckets = new Map<string, { rooms: Room[]; paths: Path[] }>();
const register = (minX:number,minY:number,maxX:number,maxY:number,room?:Room,path?:Path) => {
  for(let x=Math.floor(minX/256);x<=Math.floor(maxX/256);x++) for(let y=Math.floor(minY/256);y<=Math.floor(maxY/256);y++) {
    const key=x+','+y; const bucket=buckets.get(key)??{rooms:[],paths:[]};
    if(room) bucket.rooms.push(room); if(path) bucket.paths.push(path); buckets.set(key,bucket);
  }
};
for(const room of ROOMS) register(room.x-room.rx*1.2,room.y-room.ry*1.2,room.x+room.rx*1.2,room.y+room.ry*1.2,room);
for(const path of PATHS) register(Math.min(path.from.x,path.to.x)-path.width,Math.min(path.from.y,path.to.y)-path.width,Math.max(path.from.x,path.to.x)+path.width,Math.max(path.from.y,path.to.y)+path.width,undefined,path);
export function clearance(x:number,y:number):number {
  if(x<30||y<30||x>WORLD_WIDTH-30||y>WORLD_HEIGHT-30) return -30;
  const bucket=buckets.get(Math.floor(x/256)+','+Math.floor(y/256));
  if(!bucket) return -120;
  let best=-120;
  for(const room of bucket.rooms) {
    const rectangular=room.zone==='crypt'; const p=rectangular?8:2;
    const edge=rectangular?1:1+(noise(x/90,y/90)-.5)*.12;
    const norm=Math.pow(Math.pow(Math.abs(x-room.x)/room.rx,p)+Math.pow(Math.abs(y-room.y)/room.ry,p),1/p)/edge;
    best=Math.max(best,(1-norm)*Math.min(room.rx,room.ry));
  }
  for(const path of bucket.paths) best=Math.max(best,path.width/2-segmentDistance(x,y,path.from,path.to));
  return best;
}
export const isWalkable=(x:number,y:number,margin=0):boolean=>clearance(x,y)>margin;
const ZONE_PATHS = Object.fromEntries(ZONES.map(zone => [zone.id, PATHS.filter(path => path.zone === zone.id && !path.gate)])) as Record<ZoneId, Path[]>;
export function zoneScores(x:number,y:number):{zone:ZoneDefinition;score:number}[] {
  return ZONES.map(zone=>{
    const local=ZONE_PATHS[zone.id];
    const score=local.reduce((best,path)=>Math.min(best,segmentDistance(x,y,path.from,path.to)),Infinity);
    return {zone,score};
  }).sort((a,b)=>a.score-b.score);
}
export const zoneAt=(x:number,y:number):ZoneDefinition=>zoneScores(x,y)[0].zone;
export type DecorKind = 'tree'|'bush'|'flower'|'rock'|'pond'|'mushroom'|'log'|'dead-tree'|'reed'|'tombstone'|'pillar'|'bones'|'brazier'|'lava'|'ember'|'obsidian'|'house'|'well'|'cart';
export interface Decor {kind:DecorKind;x:number;y:number;size:number;zone:ZoneId;variant:number}
const DECOR_TABLE:Record<ZoneId,{density:number;kinds:[DecorKind,number][]}> = {
  meadow:{density:.8,kinds:[['flower',6],['bush',3],['tree',2],['rock',1]]},
  forest:{density:1,kinds:[['tree',12],['mushroom',3],['bush',3],['log',2]]},
  marsh:{density:.95,kinds:[['reed',9],['pond',2],['dead-tree',3],['rock',1]]},
  crypt:{density:.8,kinds:[['tombstone',5],['pillar',3],['bones',4],['brazier',2]]},
  ashen:{density:.9,kinds:[['ember',6],['obsidian',4],['lava',2],['dead-tree',1]]},
};
const BASE_SIZE:Record<DecorKind,[number,number]> = { tree:[26,48],bush:[11,19],flower:[3,5],rock:[14,30],pond:[45,75],mushroom:[6,12],log:[34,54],'dead-tree':[24,40],reed:[12,22],tombstone:[16,24],pillar:[20,30],bones:[8,13],brazier:[12,18],lava:[45,85],ember:[3,6],obsidian:[22,40],house:[50,70],well:[22,30],cart:[28,40] };
export const DECOR_CLEARANCE=100;
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


export function generateDecor():Decor[] {
  const random=seededRandom(0x51eed5);
  const reserved=[WORLD_START,...Object.values(BOSS_POSITIONS),...Object.values(SECRET_POSITIONS)];
  const placed:Decor[]=[];
  const add=(kind:DecorKind,x:number,y:number,size:number,zone:ZoneId)=>placed.push({kind,x,y,size,zone,variant:random()});
  for(const landmark of LANDMARKS) {
    const {x,y}=landmark.position;
    if(landmark.kind==='village') {add('house',x-105,y-75,58,landmark.zone);add('house',x+105,y-70,50,landmark.zone);add('well',x-75,y+75,24,landmark.zone);add('cart',x+85,y+80,32,landmark.zone);}
    if(landmark.kind==='ruins') for(const dx of [-90,90]) {add('pillar',x+dx,y-65,28,landmark.zone);add('brazier',x+dx,y+65,15,landmark.zone);}
    if(landmark.kind==='grove') for(const dx of [-95,95]) add('tree',x+dx,y-65,45,landmark.zone);
    if(landmark.kind==='bridge') for(const dx of [-65,65]) add('reed',x+dx,y+55,20,landmark.zone);
    if(landmark.kind==='altar') for(const dx of [-110,110]) add('brazier',x+dx,y+55,22,landmark.zone);
  }
  for(let attempt=0;attempt<16000;attempt++) {
    const x=60+random()*(WORLD_WIDTH-120), y=60+random()*(WORLD_HEIGHT-120);
    const depth=clearance(x,y);
    if(depth < -50) continue;
    // Les axes de marche et les passages des boss restent dégagés.
    if(PATHS.some(path=>segmentDistance(x,y,path.from,path.to)<32)) continue;
    if(reserved.some(p=>Math.hypot(x-p.x,y-p.y)<DECOR_CLEARANCE)) continue;
    const zone=zoneAt(x,y).id, table=DECOR_TABLE[zone];
    // La végétation déborde les sentiers ; le vide n'est plus leur seul décor.
    if(depth<25 && zone!=='forest' && zone!=='meadow') continue;
    if(random()>table.density) continue;
    let pick=random()*table.kinds.reduce((sum,[,w])=>sum+w,0),kind=table.kinds[0][0];
    for(const [candidate,weight] of table.kinds) {pick-=weight;if(pick<=0){kind=candidate;break;}}
    if(depth<25 && kind!=='tree' && kind!=='bush' && kind!=='flower') continue;
    const [a,b]=BASE_SIZE[kind],size=a+random()*(b-a);
    if(PATHS.some(path=>segmentDistance(x,y,path.from,path.to)<32+size*.5)) continue;
    if(placed.some(other=>Math.hypot(other.x-x,other.y-y)<(size+other.size)*.65)) continue;
    add(kind,x,y,size,zone);
  }
  return placed;
}
