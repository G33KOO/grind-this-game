import { useState } from 'react';
import { HEROES, PASSIVES, masteryRank, MASTERY_MAX_RANK, masteryLevelsForRank } from '../game/content';
import { allocatePoints, deriveStats, respecStats } from '../game/engine';
import { characterTraits } from '../game/character-sheet';
import { movementSpeed } from '../game/movement';
import type { Profile, RunState, Stats } from '../game/types';
import { HeroPortrait, StatIcon, formatStatValue } from './GameVisuals';
import { HERO_ACCENT, ItemIcon, passiveRarity } from './icons';
import './inventory-stats.css';

const ATTRIBUTES = ['strength','defense','speed','maxHp','luck'] as const;
const TRAITS = ['lifesteal','shield','damageReduction','extraStrike','cleave','poisonDamage','poisonTurns','lowHealthDamage','defenseDamage'] as const;
type StatKey = keyof Stats | typeof TRAITS[number];
const LABELS: Record<StatKey,string> = { strength:'Force',defense:'Défense',speed:'Vitesse',maxHp:'PV maximum',luck:'Chance',critChance:'Critique',critDamage:'Dégâts critiques',lifesteal:'Vol de vie',shield:'Bouclier de départ',damageReduction:'Réduction des dégâts',extraStrike:'Frappes supplémentaires',cleave:'Dégâts de zone',poisonDamage:'Poison par attaque',poisonTurns:'Durée du poison',lowHealthDamage:'Dégâts à PV faibles',defenseDamage:'Défense en dégâts' };
const DETAILS: Record<StatKey,string> = {
  strength:'Augmente les dégâts de vos attaques.', defense:'Réduit les dégâts reçus. Certaines maîtrises transforment aussi la défense en puissance offensive.',
  speed:'Chaque point ajoute 5 unités/s au déplacement. En combat, fixe l’ordre d’attaque : un tour par combattant, priorité au joueur à vitesse égale.', maxHp:'Augmente votre réserve maximale de points de vie.',
  luck:'Augmente les chances de trouver du butin et favorise les objets rares.', critChance:'Pourcentage de chances de porter un coup critique.', critDamage:'150 % de dégâts critiques signifie 50 % de dégâts supplémentaires. Les bonus ajoutent des points de pourcentage.',
  lifesteal:'Part des dégâts directs réellement infligés récupérée en points de vie. Inclut les frappes supplémentaires et les dégâts de zone, mais pas le poison. Les fractions de soin sont conservées entre les attaques.',
  shield:'Points de bouclier accordés au début de chaque combat. Le bouclier absorbe les dégâts avant vos points de vie.',
  damageReduction:'Réduction des dégâts directs apportée par votre défense, affichée au pourcentage entier le plus proche. Limitée à 72 %.',
  extraStrike:'Dégâts combinés des frappes supplémentaires, en pourcentage de votre attaque de base. Ces frappes sont déclenchées par vos effets actifs pendant votre tour ; la vitesse ne les déclenche pas.',
  cleave:'Part des dégâts de l’attaque infligée à chaque autre ennemi vivant. La défense de chaque ennemi réduit ces dégâts.',
  poisonDamage:'Dégâts de poison ajoutés par chaque attaque. Ils se cumulent sur la cible jusqu’à 50 dégâts par tour, ignorent la défense et ne déclenchent pas le vol de vie.',
  poisonTurns:'Durée du poison appliqué par vos attaques, en tours de la cible. Chaque application rafraîchit la durée, jusqu’à 5 tours.',
  lowHealthDamage:'Bonus de dégâts de votre attaque principale lorsque vos PV sont strictement inférieurs à 35 % de vos PV maximum.',
  defenseDamage:'Part de votre défense ajoutée à la force pour calculer les dégâts de vos attaques. Par exemple, 60 % avec 10 défense ajoute 6 dégâts de base.',
};
const value = formatStatValue;

export function InventoryStats({ run, profile, onChange }: { run:RunState; profile?:Profile; onChange(run:RunState):void }) {
  const [step,setStep] = useState<'1'|'5'|'all'>('1');
  const [selected,setSelected] = useState<StatKey>('strength');
  const stats = deriveStats(run);
  const traits = characterTraits(run);
  const rows: { key: StatKey; value: string; attribute?: typeof ATTRIBUTES[number] }[] = [
    ...ATTRIBUTES.map(key => ({ key, value: value(key, stats[key]), attribute: key })),
    ...(['critChance','critDamage'] as const).map(key => ({ key, value: value(key, stats[key]) })),
    ...TRAITS.map(key => ({ key, value: key === 'shield' ? `${traits[key]} PV` : key === 'poisonDamage' ? `${traits[key]} / tour` : key === 'poisonTurns' ? `${traits[key]} tours` : `${traits[key]} %` })),
  ];
  const spent = Object.values(run.invested).reduce((sum,n)=>sum+(n??0),0);
  const levels = profile?.mastery[run.hero] ?? 0;
  const rank = masteryRank(levels);
  const floor = masteryLevelsForRank(rank),next = masteryLevelsForRank(Math.min(rank+1,MASTERY_MAX_RANK));
  const progress = rank>=MASTERY_MAX_RANK?1:Math.max(0,Math.min(1,(levels-floor)/(next-floor)));
  return <div className="inventory-stat-sheet" style={{['--accent' as string]:HERO_ACCENT[run.hero]}}>
    <aside className="inventory-stat-hero"><div><small>Niveau {run.level}</small><h3>{HEROES[run.hero].name}</h3></div><HeroPortrait hero={run.hero}/>
      <div className="inventory-mastery"><span>Maîtrise <strong>{rank} / {MASTERY_MAX_RANK}</strong></span><div className="inventory-mastery-track" role="progressbar" aria-label="Maîtrise de classe" aria-valuemin={0} aria-valuemax={MASTERY_MAX_RANK} aria-valuenow={rank>=MASTERY_MAX_RANK?rank:rank+progress}>{Array.from({length:MASTERY_MAX_RANK},(_,i)=><span key={i}><i style={{width:`${i<rank?100:i===rank?progress*100:0}%`}}/></span>)}</div></div>
    </aside>
    <section className="inventory-attributes" aria-label="Statistiques du personnage">
      <header><div className="inventory-point-total"><span>Points disponibles</span><strong aria-live="polite">{run.unspentPoints}</strong></div><nav className="inventory-point-step" aria-label="Nombre de points à attribuer">{(['1','5','all'] as const).map(n=><button key={n} aria-pressed={step===n} onClick={()=>setStep(n)}>{n==='all'?'Tout':`+${n}`}</button>)}</nav></header>
      <div className="inventory-stat-list">{rows.map(row=><div className={`inventory-stat-row${row.attribute ? '' : ' is-readonly'}`} key={row.key}>
        <button className="inventory-stat-label" aria-pressed={selected===row.key} onClick={()=>setSelected(row.key)}><StatIcon stat={row.key}/><span><strong>{LABELS[row.key]}</strong>{row.attribute && <small>{run.invested[row.attribute]??0} points investis</small>}</span></button>
        <b>{row.value}</b>{row.attribute && <button className="inventory-stat-add" aria-label={`Ajouter ${step==='all'?'tous les points':step==='1'?'un point':'cinq points'} : ${LABELS[row.key]}`} disabled={!run.unspentPoints} onClick={()=>onChange(allocatePoints(run,row.attribute!,step==='all'?run.unspentPoints:Number(step)))}>+</button>}
      </div>)}</div>
      <footer className="inventory-stat-reset"><button disabled={!spent} onClick={()=>onChange(respecStats(run))}>Réinitialiser les statistiques</button><small>Gratuit · {spent} point{spent!==1?'s':''} récupérable{spent!==1?'s':''}</small></footer>
    </section>
    <aside className="inventory-stat-info"><div className="inventory-stat-description"><StatIcon stat={selected}/><h3>{LABELS[selected]}</h3><p>{DETAILS[selected]}</p>{selected==='speed' && <p className="inventory-movement-value">Déplacement : {movementSpeed(stats.speed)} unités / seconde</p>}</div>
      <div className="inventory-passives"><h3>Passifs actifs</h3>{run.passives.map(passive=>{const definition=PASSIVES.find(p=>p.id===passive.id);return definition&&<div key={passive.id}><ItemIcon id={definition.id} rarity={passiveRarity(definition.weight)} size={38}/><span><strong>{definition.name}</strong><p>{definition.description}</p></span></div>})}</div>
    </aside>
  </div>;
}
