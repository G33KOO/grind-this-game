import { describe, expect, it } from 'vitest';
import { ENEMIES, HEROES, ITEMS, PASSIVES } from './content';
import { deriveStats, newRun, startCombat, stepCombat, validateRun } from './engine';
import type { CombatState } from './types';

function durable(state:CombatState):CombatState {
  return {...state,playerHp:100000,playerMaxHp:100000,shield:0,playerEffects:[],playerStats:{...state.playerStats,strength:1,critChance:0},enemies:state.enemies.map(e=>({...e,strength:1,currentHp:100000}))};
}

describe('integer statistics and initiative balance',()=>{
  it('has whole statistics and bonuses of at least one point throughout authored content',()=>{
    for(const hero of Object.values(HEROES))expect(Object.values(hero.stats).every(Number.isInteger)).toBe(true);
    for(const entry of [...ITEMS,...PASSIVES])for(const amount of Object.values(entry.stats??{})) {
      expect(Number.isInteger(amount)).toBe(true);expect(Math.abs(amount)).toBeGreaterThanOrEqual(1);
    }
    for(const enemy of ENEMIES)expect([enemy.hp,enemy.strength,enemy.speed,enemy.defense,enemy.xp].every(Number.isInteger)).toBe(true);
    for(const hero of ['warrior','assassin'] as const)expect(Object.values(deriveStats(newRun(hero))).every(Number.isInteger)).toBe(true);
  });

  it('never grants extra turns for double or hundredfold speed',()=>{
    for(const speed of [14,700]) {
      const run={...newRun('warrior'),invested:{speed:speed-HEROES.warrior.stats.speed}};
      let state=durable(startCombat(run,['slime']));
      expect(state.playerNextAction).toBe(1);
      let player=0,enemy=0;
      for(let action=0;action<20;action++) {
        const next=stepCombat(state);
        if(next.playerNextAction!==state.playerNextAction)player++;
        if(next.enemies[0].nextAction!==state.enemies[0].nextAction)enemy++;
        state=next;
      }
      expect(player).toBe(10);expect(enemy).toBe(10);
    }
  });

  it('orders groups by initiative and gives each living fighter exactly one turn per round',()=>{
    let state=durable(startCombat(newRun('assassin'),['slime','wisp','rat']));
    expect(state.enemies.map(e=>e.nextAction)).toEqual([4,1,3]);
    expect(state.playerNextAction).toBe(2);
    const counts=[0,0,0,0];
    for(let action=0;action<24;action++) {
      const next=stepCombat(state);
      if(next.playerNextAction!==state.playerNextAction)counts[0]++;
      next.enemies.forEach((enemy,i)=>{if(enemy.nextAction!==state.enemies[i].nextAction)counts[i+1]++});
      state=next;
    }
    expect(counts).toEqual([6,6,6,6]);
  });

  it('resolves equal initiative deterministically and skips defeated enemies',()=>{
    const equal=startCombat({...newRun('warrior'),invested:{speed:4}},['rat','rat']);
    expect(equal.playerNextAction).toBe(1);
    expect(equal.enemies.map(e=>e.nextAction)).toEqual([2,3]);
    const first=stepCombat({...equal,playerStats:{...equal.playerStats,strength:1000,critChance:0}},0);
    expect(first.enemies[0].currentHp).toBe(0);
    const second=stepCombat(first);
    expect(second.time).toBe(3);
    expect(second.enemies[0].nextAction).toBe(first.enemies[0].nextAction);
    expect(second.enemies[1].nextAction).toBeGreaterThan(first.enemies[1].nextAction);
  });

  it('applies enemy defense to player attacks',()=>{
    const base=startCombat(newRun('warrior'),['golem']);
    const state={...base,playerNextAction:0,playerEffects:[],playerStats:{...base.playerStats,strength:20,critChance:0}};
    const armored=stepCombat(state).enemies[0].currentHp;
    const bare=stepCombat({...state,enemies:state.enemies.map(e=>({...e,defense:0}))}).enemies[0].currentHp;
    expect(armored).toBeGreaterThan(bare);
    expect(state.enemies[0].currentHp-bare).toBe(20);
  });

  it('uses integer percentages for critical chance and damage',()=>{
    const base=startCombat(newRun('warrior',42),['slime']);
    let rng=base.rngState,crits=0;
    for(let trial=0;trial<3000;trial++) {
      const state={...base,rngState:rng,playerNextAction:0,playerEffects:[],playerStats:{...base.playerStats,strength:20,critChance:25,critDamage:150},enemies:base.enemies.map(e=>({...e,defense:0,currentHp:1000}))};
      const next=stepCombat(state),damage=1000-next.enemies[0].currentHp;
      expect([20,30]).toContain(damage);
      if(damage===30)crits++;
      rng=next.rngState;
    }
    expect(crits/3000).toBeGreaterThan(.22);expect(crits/3000).toBeLessThan(.28);
  });

  it('refunds old allocations once while keeping run progress and possessions',()=>{
    const initial=newRun('assassin');
    const old={...initial,balanceVersion:undefined,invested:{strength:5,speed:2},unspentPoints:3,hp:200,level:8,kills:50};
    const migrated=validateRun(old);
    expect(migrated.invested).toEqual({});expect(migrated.unspentPoints).toBe(10);
    expect(migrated.hp).toBeLessThanOrEqual(deriveStats(migrated).maxHp);
    expect(migrated.inventory).toEqual(old.inventory);expect(migrated.equipment).toEqual(old.equipment);
    expect(migrated.level).toBe(8);expect(migrated.kills).toBe(50);
    expect(validateRun(migrated).unspentPoints).toBe(10);
  });
});
