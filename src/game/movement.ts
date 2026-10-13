export interface Position { x: number; y: number }
export interface CircleObstacle extends Position { radius: number }
export type ClearanceField = (x: number, y: number) => number;
export const PLAYER_RADIUS = 9;
const SKIN = .05;

export function obstacleField(terrain: ClearanceField, obstacles: CircleObstacle[]): ClearanceField {
  const buckets = new Map<string, CircleObstacle[]>();
  for (const obstacle of obstacles) {
    const reach = obstacle.radius + PLAYER_RADIUS + 32;
    for (let x = Math.floor((obstacle.x-reach)/128); x <= Math.floor((obstacle.x+reach)/128); x++) {
      for (let y = Math.floor((obstacle.y-reach)/128); y <= Math.floor((obstacle.y+reach)/128); y++) {
        const key = `${x},${y}`;
        const list = buckets.get(key) ?? [];
        list.push(obstacle); buckets.set(key,list);
      }
    }
  }
  return (x,y) => {
    let distance = terrain(x,y);
    for (const obstacle of buckets.get(`${Math.floor(x/128)},${Math.floor(y/128)}`) ?? []) {
      distance = Math.min(distance, Math.hypot(x-obstacle.x,y-obstacle.y)-obstacle.radius);
    }
    return distance;
  };
}

function normal(field: ClearanceField, point: Position): Position {
  const epsilon = .5;
  const x = field(point.x+epsilon,point.y)-field(point.x-epsilon,point.y);
  const y = field(point.x,point.y+epsilon)-field(point.x,point.y-epsilon);
  const length = Math.hypot(x,y);
  return length > 1e-8 ? { x:x/length,y:y/length } : { x:0,y:0 };
}

/** Répare un petit chevauchement hérité d'une sauvegarde ou d'une correction de position. */
function recover(point: Position, field: ClearanceField, radius: number): Position {
  let position = { ...point };
  for (let i=0;i<16;i++) {
    const depth = radius+SKIN-field(position.x,position.y);
    if (depth<=0) return position;
    const n = normal(field,position);
    if (!n.x && !n.y) break;
    const push = Math.min(8,depth+.1);
    position = { x:position.x+n.x*push,y:position.y+n.y*push };
  }
  if (field(position.x,position.y)>=radius) return position;
  // Un centre d'obstacle n'a pas de normale : chercher une sortie locale déterministe.
  for(let distance=2;distance<=128;distance+=2) for(let angle=0;angle<24;angle++) {
    const a=angle*Math.PI/12;
    const candidate={x:point.x+Math.cos(a)*distance,y:point.y+Math.sin(a)*distance};
    if(field(candidate.x,candidate.y)>=radius+SKIN)return candidate;
  }
  return { ...point };
}

function safeFraction(position: Position, delta: Position, field: ClearanceField, radius: number): number {
  let low=0,high=1;
  for(let i=0;i<12;i++) {
    const middle=(low+high)/2;
    if(field(position.x+delta.x*middle,position.y+delta.y*middle)>=radius+SKIN)low=middle;
    else high=middle;
  }
  return low;
}

/** Avance jusqu'au contact, puis conserve la composante tangente au mur. */
export function moveWithSliding(start: Position, displacement: Position, field: ClearanceField, radius=PLAYER_RADIUS): Position {
  let position=recover(start,field,radius);
  const steps=Math.max(1,Math.ceil(Math.hypot(displacement.x,displacement.y)/2));
  for(let step=0;step<steps;step++) {
    let remaining={x:displacement.x/steps,y:displacement.y/steps};
    for(let contact=0;contact<4;contact++) {
      if(Math.hypot(remaining.x,remaining.y)<1e-6)break;
      const target={x:position.x+remaining.x,y:position.y+remaining.y};
      if(field(target.x,target.y)>=radius+SKIN){position=target;break;}
      const fraction=safeFraction(position,remaining,field,radius);
      position={x:position.x+remaining.x*fraction,y:position.y+remaining.y*fraction};
      remaining={x:remaining.x*(1-fraction),y:remaining.y*(1-fraction)};
      const project=(n:Position) => {
        const inward=Math.min(0,remaining.x*n.x+remaining.y*n.y);
        return {x:remaining.x-n.x*inward,y:remaining.y-n.y*inward};
      };
      const currentNormal=normal(field,position);
      let slide=project(currentNormal);
      // Une tangente au contact convient aux obstacles convexes. Pour une salle
      // arrondie, utiliser la normale visée si cette tangente sort du terrain.
      if(field(position.x+slide.x,position.y+slide.y)<radius+SKIN-1e-8) {
        const targetNormal=normal(field,{x:position.x+remaining.x,y:position.y+remaining.y});
        if(!targetNormal.x&&!targetNormal.y)break;
        slide=project(targetNormal);
      }
      if(!currentNormal.x&&!currentNormal.y)break;
      remaining=slide;
    }
  }
  return position;
}
