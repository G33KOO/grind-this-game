import type Phaser from 'phaser';
import type { Decor } from './world';

const ACCENTS = { meadow: 0x2ee6c8, forest: 0x58ff6e, marsh: 0x35a7ff, crypt: 0xb36bff, ashen: 0xff6a2e };
/** Dark silhouettes and luminous outlines throughout every biome. */
export function drawDecorArt(g: Phaser.GameObjects.Graphics, decor: Decor): void {
  const { x,y,size:s,variant:v }=decor;
  const color=ACCENTS[decor.zone];
  const pts=(pairs:number[][])=>pairs.map(([dx,dy])=>({x:x+dx*s,y:y+dy*s}));
  const glow=(draw:()=>void,width=1,alpha=1)=>{
    for(const [spread,opacity] of [[5,.055],[2.5,.14],[1,.85]]) {
      g.lineStyle(width*spread,color,alpha*opacity);draw();
    }
  };
  const stroke=(pairs:number[][],width=1,alpha=1)=>glow(()=>g.strokePoints(pts(pairs),false),width,alpha);
  const polygon=(pairs:number[][],alpha=1)=>{
    g.fillStyle(0x040b12,.78).fillPoints(pts(pairs),true);
    g.fillStyle(color,.025).fillPoints(pts(pairs),true);
    glow(()=>g.strokePoints(pts(pairs),true),1,alpha);
  };
  const ellipse=(dx:number,dy:number,rx:number,ry:number,alpha=1)=>{
    g.fillStyle(0x040b12,.65).fillEllipse(x+dx*s,y+dy*s,rx*2*s,ry*2*s);
    glow(()=>g.strokeEllipse(x+dx*s,y+dy*s,rx*2*s,ry*2*s),.9,alpha);
  };
  const rect=(dx:number,dy:number,w:number,h:number,alpha=1)=>polygon([[dx,dy],[dx+w,dy],[dx+w,dy+h],[dx,dy+h]],alpha);
  const spark=(dx:number,dy:number,r=.025)=>{
    for(const [spread,alpha] of [[4,.04],[2,.15],[1,.9]])g.fillStyle(color,alpha).fillCircle(x+dx*s,y+dy*s,r*s*spread);
  };
  const irregular=(rx:number,ry:number,offset=0)=>Array.from({length:12},(_,i)=>{
    const a=i*Math.PI/6,r=.93+Math.sin(i*2.7+v*8)*.07;
    return [Math.cos(a)*rx*r,Math.sin(a)*ry*r+offset];
  });
  switch(decor.kind) {
    case 'tree':
      if(decor.zone==='forest') {
        polygon([[-.45,.22],[-.23,-.06],[-.34,-.06],[-.15,-.34],[-.24,-.34],[0,-.72],[.24,-.34],[.15,-.34],[.34,-.06],[.23,-.06],[.45,.22]]);
        stroke([[0,-.51],[0,.4]],.8,.45);stroke([[-.2,-.12],[0,.01],[.2,-.12]],.8,.5);
      } else {
        polygon(irregular(.46,.43,-.17));stroke([[0,.42],[0,-.22]],1,.8);
        stroke([[-.25,-.2],[0,.04],[.23,-.27]],.8,.65);stroke([[-.23,-.35],[-.08,-.45],[.12,-.43]],.7,.4);
      }
      stroke([[-.08,.42],[.08,.42]],1,.7);break;
    case 'dead-tree':
      stroke([[0,.4],[0,-.55]],1.5);stroke([[0,-.08],[-.22,-.26],[-.31,-.5]],1.2,.8);
      stroke([[0,-.27],[.24,-.39],[.29,-.6]],1.2,.8);stroke([[0,.25],[.16,.1],[.2,-.06]],.8,.5);break;
    case 'house':
      rect(-.43,-.13,.86,.55);polygon([[-.57,-.13],[0,-.67],[.58,-.13]]);
      stroke([[0,-.67],[.12,-.13]],.7,.4);rect(.12,.1,.19,.32,.8);rect(-.29,.02,.18,.18);
      stroke([[-.2,.02],[-.2,.2]],.7,.75);stroke([[-.29,.11],[-.11,.11]],.7,.75);
      stroke([[-.43,.25],[.1,.25]],.7,.35);stroke([[.25,-.43],[.25,-.61],[.38,-.61],[.38,-.33]],.8,.65);spark(-.2,.11,.03);break;
    case 'well':
      ellipse(0,-.08,.48,.22);ellipse(0,-.08,.3,.12,.45);
      stroke([[-.48,-.08],[-.48,.2],[.48,.2],[.48,-.08]],1,.8);
      stroke([[-.4,-.08],[-.4,-.59],[.4,-.59],[.4,-.08]],1,.8);stroke([[.04,-.59],[.04,-.16]],.8,.6);break;
    case 'cart':
      polygon([[-.5,-.27],[.42,-.27],[.5,.2],[-.42,.2]]);
      for(const dx of [-.32,-.08,.16])stroke([[dx,-.24],[dx+.08,.17]],.7,.35);
      for(const dx of [-.33,.35]) {ellipse(dx,.25,.14,.14);stroke([[dx-.1,.25],[dx+.1,.25]],.7,.6);}
      stroke([[.46,-.15],[.78,-.21]],1,.8);break;
    case 'bush':
      polygon([[-.46,.2],[-.49,-.02],[-.32,-.19],[-.19,-.14],[-.08,-.36],[.15,-.3],[.2,-.14],[.4,-.19],[.48,.02],[.4,.2]],.75);
      stroke([[-.21,.1],[-.05,-.1],[.12,.06]],.7,.4);break;
    case 'flower':
      stroke([[0,.24],[0,-.04]],.7,.55);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipse(Math.cos(a)*.14,Math.sin(a)*.14-.1,.09,.09,.7);}
      spark(0,-.1,.04);break;
    case 'rock':
      polygon([[-.48,.1],[-.32,-.35],[.03,-.44],[.4,-.24],[.47,.21],[.07,.34]],.75);
      stroke([[-.32,-.35],[.07,-.06],[.4,-.24]],.8,.45);stroke([[.07,-.06],[.07,.34]],.8,.45);break;
    case 'obsidian':
      polygon([[-.43,.28],[-.3,-.2],[0,-.57],[.25,-.25],[.4,.26],[.03,.42]]);
      stroke([[0,-.57],[.06,-.1],[.03,.42]],.8,.6);stroke([[-.28,.18],[-.12,.03],[-.04,.11]],.8,.6);spark(.04,.17);break;
    case 'pond':
      polygon(irregular(.58,.38),.55);ellipse(-.12,-.04,.22,.06,.5);stroke([[.03,.1],[.27,.1]],.7,.4);break;
    case 'mushroom':
      for(const [dx,dy,scale] of [[-.18,.04,.8],[.19,-.07,1]]) {
        stroke([[dx-.04*scale,dy],[dx-.04*scale,dy+.27*scale],[dx+.04*scale,dy+.27*scale],[dx+.04*scale,dy]],.8,.6);
        ellipse(dx,dy,.23*scale,.14*scale,.8);spark(dx-.06,dy-.03,.02);
      }break;
    case 'log':
      polygon([[-.5,-.14],[.46,-.14],[.46,.16],[-.5,.16]],.7);
      ellipse(.46,.01,.1,.15,.75);ellipse(.46,.01,.05,.09,.4);stroke([[-.38,-.05],[.27,-.05]],.7,.4);break;
    case 'reed':
      for(let i=-2;i<=2;i++){const dx=i*.11,tip=-.3-Math.abs(Math.sin(v*7+i))*.28;
        stroke([[dx,.3],[dx+i*.04,tip]],.7,.65);stroke([[dx+i*.04,tip-.1],[dx+i*.04,tip+.04]],1.7,.75);
      }break;
    case 'tombstone':
      polygon([[-.34,.35],[-.31,-.2],[-.2,-.43],[.13,-.48],[.31,-.27],[.34,.35]]);
      stroke([[0,-.21],[0,.14]],.9,.9);stroke([[-.12,-.04],[.12,-.04]],.9,.9);stroke([[-.39,.4],[.39,.4]],.9,.5);break;
    case 'pillar':
      rect(-.25,-.38,.5,.78,.8);rect(-.38,-.51,.76,.13);rect(-.37,.37,.74,.13);
      stroke([[-.13,-.3],[-.13,.28]],.7,.4);stroke([[.1,-.3],[.1,.28]],.7,.4);spark(0,-.23,.035);break;
    case 'bones':
      stroke([[-.37,.15],[.34,.25]],1,.7);ellipse(-.13,-.11,.2,.18,.75);
      ellipse(-.2,-.12,.045,.045,.8);ellipse(-.07,-.12,.045,.045,.8);
      for(let i=0;i<3;i++)stroke([[.08+i*.12,-.2],[.13+i*.12,-.03],[.06+i*.12,.08]],.8,.6);break;
    case 'brazier':
      stroke([[-.18,.1],[-.27,.44]],1,.8);stroke([[.18,.1],[.27,.44]],1,.8);
      polygon([[-.34,-.05],[.34,-.05],[.2,.22],[-.2,.22]]);
      polygon([[-.25,-.08],[-.17,-.31],[-.06,-.23],[.02,-.6],[.16,-.28],[.24,-.07]]);
      stroke([[-.1,-.06],[0,-.38],[.12,-.06]],.8,.8);spark(0,-.2,.06);break;
    case 'lava':
      polygon(irregular(.59,.4),.6);polygon(irregular(.44,.26),.7);
      stroke([[-.34,.06],[-.12,-.06],[.08,.07],[.31,-.02]],1,.9);spark(-.11,-.03,.045);spark(.21,.12,.035);break;
    case 'ember':spark(0,0,.1);stroke([[0,.13],[.09,.28]],.6,.35);break;
  }
}
