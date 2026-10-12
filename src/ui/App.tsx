import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import { ACHIEVEMENTS, BALANCE, ENEMIES, HEROES, ITEMS, PASSIVES, ZONES, masteryLevelsForRank, masteryRank, MASTERY_MAX_RANK } from '../game/content';
import {
  addAchievements, advanceEncounter, allocatePoints, applyProgress, choosePassive, deriveStats,
  equipItem, gainExperience, initialProfile, itemForInstance, newRun, passiveChoices, rollEncounter,
  respecStats, rollLoot, slotForItem, startCombat, stepCombat, useConsumable,
} from '../game/engine';
import { loadProfile, loadRun, loadSettings, saveProfile, saveRun, saveSettings, type Settings } from '../game/save';
import { PlatformScene, type MapCallbacks, type MapEvent } from '../game/PlatformScene';
import { ZONE_SHAPES, zoneAt } from '../game/world';
import { BattleScene } from './BattleScene';
import { ItemIcon, RARITIES, type Rarity } from './icons';

const passiveRarity = (weight: number): Rarity => weight >= 4 ? 'common' : weight >= 3 ? 'uncommon' : weight >= 2 ? 'rare' : weight >= 1 ? 'epic' : 'legendary';
import type { CombatState, HeroId, Profile, RunState } from '../game/types';

type Screen = 'title' | 'world' | 'combat' | 'inventory' | 'stats' | 'settings' | 'summary';
const percentage = (value: number, max: number) => `${Math.max(0, Math.min(100, Math.round(value / Math.max(1, max) * 100)))}%`;

export function App() {
  const [profile, setProfile] = useState<Profile>(() => initialProfile());
  const [run, setRun] = useState<RunState | null>(null);
  const runRef = useRef<RunState | null>(null);
  const profileRef = useRef(profile);
  const profileHealthy = useRef(true);
  const [screen, setScreen] = useState<Screen>('title');
  const [newRunSelection, setNewRunSelection] = useState(false);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const combatRef = useRef<CombatState | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [error, setError] = useState('');
  const [device, setDevice] = useState<'keyboard' | 'gamepad'>('keyboard');
  const [pause, setPause] = useState(false);
  const [developmentMode, setDevelopmentMode] = useState(false);
  const [developerToolsOpen, setDeveloperToolsOpen] = useState(false);
  const [devItem, setDevItem] = useState(ITEMS[0].id);
  const [devEnemy, setDevEnemy] = useState(ENEMIES[0].id);
  const [notice, setNotice] = useState('');
  const [passiveOffers, setPassiveOffers] = useState<string[]>([]);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<PlatformScene | null>(null);
  const encounterBarRef = useRef<HTMLElement | null>(null);
  const targetRef = useRef<number | undefined>(undefined);
  const finishLock = useRef(false);
  const devItemCount = useRef(0);
  const padButtonsRef = useRef({ confirm: false, up: false, down: false });

  const syncRun = useCallback((updated: RunState | null) => {
    runRef.current = updated;
    setRun(updated);
  }, []);
  const syncCombat = useCallback((updated: CombatState | null) => {
    combatRef.current = updated;
    setCombat(updated);
  }, []);
  const updateProfile = useCallback((updated: Profile): boolean => {
    if (!profileHealthy.current) {
      setError('Le profil permanent est invalide ; achievements et déblocages ne peuvent pas être enregistrés.');
      return false;
    }
    try {
      saveProfile(updated);
      profileRef.current = updated;
      setProfile(updated);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? `Impossible d’enregistrer le profil : ${saveError.message}` : 'Impossible d’enregistrer le profil.');
      return false;
    }
  }, []);

  useEffect(() => {
    try {
      const savedProfile = loadProfile();
      profileRef.current = savedProfile;
      setProfile(savedProfile);
    } catch (loadError) {
      profileHealthy.current = false;
      setError(loadError instanceof Error ? loadError.message : 'Le profil permanent est invalide.');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void loadRun().then(async (saved) => {
      if (!alive || !saved) return;
      syncRun(saved);
      setDevelopmentMode(saved.developerMode);
      const profileSaved = updateProfile(addAchievements(profileRef.current, saved));
      if (saved.result === 'active') {
        if (saved.pendingCombat) {
          setScreen('world');
        } else if (saved.pendingPassivePicks > 0) {
          setPassiveOffers(passiveChoices(saved, profileRef.current));
          setScreen('stats');
        } else {
          setScreen('world');
        }
      } else {
        if (profileSaved) await saveRun(null);
        setScreen('summary');
      }
    }).catch((loadError: unknown) => {
      if (alive) setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.');
    });
    return () => { alive = false; };
  }, [syncRun, updateProfile]);

  useEffect(() => { saveSettings(settings); }, [settings]);
  const launchCombat = useCallback((ids: string[]) => {
    const current = runRef.current;
    if (!current || current.result !== 'active' || combatRef.current) return;
    finishLock.current = false;
    targetRef.current = undefined;
    const prepared = { ...current, pendingCombat: [...ids] };
    syncRun(prepared);
    void saveRun(prepared).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
    syncCombat(startCombat(prepared, ids));
    setPause(false);
    setScreen('combat');
    sceneRef.current?.togglePause(true);
  }, [syncCombat, syncRun]);

  useEffect(() => {
    if (screen === 'world' && run?.pendingCombat && !combatRef.current) launchCombat(run.pendingCombat);
  }, [screen, run?.pendingCombat, launchCombat]);

  const onMapEvent = useCallback((event: MapEvent) => {
    const current = runRef.current;
    if (!current || current.result !== 'active') return;
    if (event === 'encounter') {
      const zone = zoneAt(current.position.x, current.position.y);
      const result = rollEncounter(current, zone.id);
      syncRun(result.run);
      launchCombat(result.enemies);
    } else if (event.startsWith('boss:')) {
      const bossId = event.slice(5);
      if (!current.defeatedBosses.includes(bossId)) launchCombat([bossId]);
    } else if (event === 'locked-zone') {
      setNotice('Zone verrouillée : battez le gardien de la zone précédente pour passer.');
    } else if (event === 'shrine') {
      if (current.usedShrines.includes('meadow-shrine')) {
        setNotice('Le sanctuaire a déjà été utilisé pendant cette partie.');
      } else {
        const healed = Math.min(deriveStats(current).maxHp, current.hp + 45);
        const updated = { ...current, hp: healed, usedShrines: [...current.usedShrines, 'meadow-shrine'] };
        syncRun(updated);
        void saveRun(updated).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
        setNotice(`Sanctuaire : +${healed - current.hp} PV (une fois par partie).`);
      }
    } else {
      const secret = event === 'secret-one' ? 'hidden-cache-one' : 'hidden-cache-two';
      if (current.secrets.includes(secret)) return;
      const updated = {
        ...current, secrets: [...current.secrets, secret],
        inventory: [...current.inventory, { instanceId: `secret-${secret}`, itemId: 'small-potion' }],
      };
      syncRun(updated);
      void saveRun(updated).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
      setNotice(`Secret découvert : une potion mineure trouvée (${current.secrets.length + 1}/2).`);
    }
  }, [launchCombat, syncRun]);

  const gameVisible = screen !== 'title' && screen !== 'summary';
  useEffect(() => {
    if (!gameVisible || !run) return;
    const callbacks: MapCallbacks = {
      moved: (x, y, distance) => {
        const current = runRef.current;
        if (!current || current.result !== 'active') return;
        let updated: RunState = { ...current, position: { x, y } };
        if (distance > 0) {
          const check = advanceEncounter(updated, distance, profileRef.current);
          updated = check.run;
          syncRun(updated);
          if (check.triggered) onMapEvent('encounter');
        } else {
          runRef.current = updated;
          setRun(updated);
        }
      },
      event: onMapEvent,
      ready: (scene) => { if (gameRef.current === game) sceneRef.current = scene; },
      travel: (pending) => {
        const bar = encounterBarRef.current;
        const meter = runRef.current?.encounterMeter ?? 0;
        if (bar) bar.style.width = `${Math.min(1, meter + pending * BALANCE.encounterMeterChancePerUnit / BALANCE.maxEncounterMeter) * 100}%`;
      },
      explored: (data) => {
        if (runRef.current) runRef.current = { ...runRef.current, explored: data };
      },
      control: setDevice,
      canEnterZone: (zoneId) => {
        const zone = ZONES.find((entry) => entry.id === zoneId);
        return !!zone && (developmentMode || !zone.requires || !!runRef.current?.defeatedBosses.includes(zone.requires) ||
          (zone.id === 'ashen' && profileRef.current.paths.includes('ashen-path')));
      },
      isBossDefeated: (bossId) => !!runRef.current?.defeatedBosses.includes(bossId),
    };
    const worldScene = new PlatformScene(callbacks, run.position, HEROES[run.hero].color, run.explored);
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: 'game-canvas',
      width: 960,
      height: 620,
      backgroundColor: '#243b34',
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { debug: false } },
      input: { gamepad: true },
      scene: [worldScene],
    });
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, [gameVisible, !!run, onMapEvent, syncRun, developmentMode]);

  useEffect(() => {
    sceneRef.current?.togglePause(screen !== 'world' || pause);
  }, [screen, pause]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = runRef.current;
      if (current?.result === 'active') {
        void saveRun(current).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (screen !== 'combat' || !combat || pause) return;
    const timer = window.setInterval(() => {
      const current = combatRef.current;
      if (!current || current.over !== 'none') return;
      const next = stepCombat(current, targetRef.current);
      syncCombat(next);
      if (next.over !== 'none' && !finishLock.current) {
        finishLock.current = true;
        window.setTimeout(() => resolveCombat(next), 350);
      }
    }, Math.max(110, 650 / settings.combatSpeed));
    return () => window.clearInterval(timer);
  }, [screen, !!combat, pause, settings.combatSpeed]);

  const resolveCombat = useCallback(async (result: CombatState) => {
    let current = runRef.current;
    if (!current) return;
    const defeated = result.enemies.filter((enemy) => enemy.currentHp <= 0);
    let updated: RunState = {
      ...current, hp: result.playerHp, pendingCombat: null, kills: current.kills + defeated.length,
      victories: current.victories + (result.over === 'win' ? 1 : 0),
      rngState: result.rngState,
    };
    let profileAfter = profileRef.current;
    if (result.over === 'win') {
      updated = gainExperience(updated, defeated.reduce((sum, enemy) => sum + enemy.xp, 0));
      for (const boss of defeated.filter((enemy) => enemy.id.endsWith('boss') && !updated.defeatedBosses.includes(enemy.id))) {
        updated = { ...updated, defeatedBosses: [...updated.defeatedBosses, boss.id] };
      }
      if (defeated.some((enemy) => enemy.id === 'final-boss')) updated = { ...updated, result: 'victory' };
      for (const enemy of defeated) {
        const loot = rollLoot(updated, enemy.id, profileRef.current);
        updated = loot.run;
      }
      const progress = applyProgress(profileAfter, updated);
      profileAfter = progress.profile;
      updated = progress.run;
    } else {
      updated = { ...updated, hp: 0, result: 'death' };
      const progress = applyProgress(profileAfter, updated);
      profileAfter = progress.profile;
      updated = progress.run;
    }
    const newAchievements = profileAfter.achievements.filter((id) => !profileRef.current.achievements.includes(id))
      .map((id) => ACHIEVEMENTS.find((entry) => entry.id === id)?.name).filter(Boolean);
    const rankBefore = masteryRank(profileRef.current.mastery[updated.hero]);
    const rankAfter = masteryRank(profileAfter.mastery[updated.hero]);
    const progressNotice = [
      ...(rankAfter > rankBefore ? [`Maîtrise ${HEROES[updated.hero].name} niveau ${rankAfter} !`] : []),
      ...(newAchievements.length ? [`Succès : ${newAchievements.join(', ')}`] : []),
    ].join(' · ');
    try {
      await saveRun(updated);
    } catch (saveError) {
      setError(saveError instanceof Error ? `Combat résolu mais sauvegarde impossible : ${saveError.message}` : 'Combat résolu mais sauvegarde impossible.');
      return;
    }
    current = updated;
    syncRun(updated);
    const profileSaved = updateProfile(profileAfter);
    syncCombat(null);
    setPause(false);
    if (updated.pendingPassivePicks > 0 && updated.result === 'active') {
      setPassiveOffers(passiveChoices(updated, profileRef.current));
      setScreen('stats');
    } else if (updated.result !== 'active') {
      if (profileSaved) {
        try { await saveRun(null); }
        catch (saveError) { setError(saveError instanceof Error ? `Partie terminée, impossible d’effacer la sauvegarde active : ${saveError.message}` : 'Partie terminée, effacement de sauvegarde impossible.'); }
      }
      setScreen('summary');
    } else {
      setScreen('world');
      sceneRef.current?.togglePause(false);
      setNotice([result.over === 'win' ? `Combat gagné : ${defeated.length} ennemi(s), ${defeated.reduce((sum, enemy) => sum + enemy.xp, 0)} XP.` : 'La partie est terminée.', progressNotice].filter(Boolean).join(' — '));
    }
  }, [syncCombat, syncRun, updateProfile]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (screen === 'combat') setPause((value) => !value);
        else if (screen !== 'title' && screen !== 'summary') setScreen('world');
      }
      if (event.key === ' ' && screen === 'world') setPause((value) => !value);
      if (event.key.toLowerCase() === 'i' && screen === 'world') setScreen('inventory');
      if (event.key.toLowerCase() === 'c' && screen === 'world') setScreen('stats');
      if (screen === 'combat' && combatRef.current && (event.key === 'Tab' || event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        event.preventDefault();
        const alive = combatRef.current.enemies.map((enemy, index) => enemy.currentHp > 0 ? index : -1).filter((index) => index >= 0);
        if (alive.length) {
          const current = targetRef.current ?? alive[0];
          const index = alive.indexOf(current);
          targetRef.current = alive[(index + (event.key === 'ArrowLeft' ? -1 : 1) + alive.length) % alive.length];
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const pad = navigator.getGamepads?.().find((item) => item?.connected);
      if (!pad) return;
      const confirm = !!(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
      const up = !!(pad.buttons[12]?.pressed);
      const down = !!(pad.buttons[13]?.pressed);
      if ((up && !padButtonsRef.current.up) || (down && !padButtonsRef.current.down)) {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const shift = down ? 1 : -1;
        buttons[(current + shift + buttons.length) % buttons.length]?.focus();
      }
      if (confirm && !padButtonsRef.current.confirm) {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.tagName === 'BUTTON') active.click();
      }
      padButtonsRef.current = { confirm, up, down };
    }, 220);
    return () => window.clearInterval(timer);
  }, []);

  const startGame = (hero: HeroId) => {
    const fresh = newRunFor(hero, developmentMode);
    syncRun(fresh);
    syncCombat(null);
    setPause(false);
    setNotice('');
    setError('');
    setNewRunSelection(false);
    setScreen('world');
    void saveRun(fresh).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
  };

  const stats = useMemo(() => run ? deriveStats(run) : null, [run]);
  const persistRun = (updated: RunState) => {
    syncRun(updated);
    void saveRun(updated).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
  };

  const clickPassive = (id: string) => {
    if (!run) return;
    const updated = choosePassive(run, id);
    if (updated === run) return;
    persistRun(updated);
    setPassiveOffers([]);
    if (updated.pendingPassivePicks > 0) setPassiveOffers(passiveChoices(updated, profile));
    else {
      setScreen('world');
      sceneRef.current?.togglePause(false);
    }
  };

  const pickStat = (key: keyof typeof HEROES.warrior.stats, amount: number) => {
    if (run) persistRun(allocatePoints(run, key, amount));
  };

  const openInventory = () => { setScreen('inventory'); sceneRef.current?.togglePause(true); };
  const backToWorld = () => {
    setScreen('world');
    sceneRef.current?.togglePause(false);
  };

  if (!run || screen === 'title') {
    return <main className="shell title-screen">
      <div className="title-mark">G/T/G</div><p className="eyebrow">UN RPG D’EXPLORATION À COMBATS AUTOMATIQUES</p>
      <h1>Grind This Game</h1><p className="intro">Explorez. Construisez votre légende. Brisez le sceau du Gardien.</p>
      {error && <div className="notice error">{error}</div>}
      {run?.result === 'active' && !newRunSelection && <>
        <button className="primary" onClick={() => setScreen('world')}>Reprendre la partie</button>
        <button onClick={() => setNewRunSelection(true)}>Nouvelle partie</button>
      </>}
      {(!run || run.result !== 'active' || newRunSelection) && <div className="hero-picks">
        {(['warrior', 'assassin'] as const).map((hero) => <button key={hero} className="hero-card" onClick={() => startGame(hero)}>
          <span className="hero-icon">{hero === 'warrior' ? '◆' : '◇'}</span>
          <strong>{HEROES[hero].name}</strong>
          <span>{hero === 'warrior' ? 'Défense, boucliers et endurance.' : 'Vitesse, critiques et poison.'}</span>
          <small>{HEROES[hero].stats.maxHp} PV · {HEROES[hero].stats.speed.toFixed(2)} vitesse</small>
        </button>)}
      </div>}
      {run?.result === 'active' && newRunSelection && <button onClick={() => setNewRunSelection(false)}>Annuler et reprendre la sauvegarde</button>}
      {(!run || run.result !== 'active' || newRunSelection) && <label className="dev-toggle"><input type="checkbox" checked={developmentMode} onChange={(event) => setDevelopmentMode(event.target.checked)} /> Mode développeur : départ niveau 8</label>}
      <p className="small-note">Sauvegarde automatique locale · Solo · Aucun compte requis</p>
    </main>;
  }

  return <main className="shell game-shell">
    <header className="topbar">
      <div className="hud-player">
        <button className="wordmark" aria-label="Retour au menu" title="Menu" disabled={screen === 'combat'} onClick={() => setScreen('title')}>G</button>
        <div className="hud-details">
          <div className="hud-identity"><strong>{HEROES[run.hero].name}</strong><span>NIV. {run.level}</span></div>
          <div className="hud-vitals">
            <div className="hud-meter" aria-label={`Vie : ${run.hp} sur ${stats?.maxHp ?? 0}`}>
              <span>PV</span><div className="meter hp"><i style={{ width: percentage(run.hp, stats?.maxHp ?? 1) }} /></div><small>{run.hp}</small>
            </div>
            <div className="hud-meter" aria-label={`Expérience : ${run.xp} sur ${run.xpToNext}`}>
              <span>XP</span><div className="meter xp"><i style={{ width: percentage(run.xp, run.xpToNext) }} /></div><small>{run.xp}/{run.xpToNext}</small>
            </div>
          </div>
        </div>
      </div>
      <div className="world-location">{zoneAt(run.position.x, run.position.y).name}</div>
      <nav aria-label="Menu du jeu">
        <button aria-label="Inventaire" title="Inventaire (I)" disabled={screen === 'combat'} onClick={openInventory}><span aria-hidden="true">▣</span><kbd>I</kbd></button>
        <button aria-label="Personnage" title="Personnage (C)" disabled={screen === 'combat'} onClick={() => { if (run.pendingPassivePicks > 0) setPassiveOffers(passiveChoices(run, profile)); setScreen('stats'); sceneRef.current?.togglePause(true); }}><span aria-hidden="true">✦</span><kbd>C</kbd></button>
        <button aria-label="Options" title="Options" disabled={screen === 'combat'} onClick={() => setScreen('settings')}><span aria-hidden="true">⚙</span></button>
        <button aria-label={pause ? 'Reprendre' : 'Mettre en pause'} title={pause ? 'Reprendre (Échap)' : 'Pause (Échap)'} onClick={() => setPause((value) => !value)}><span aria-hidden="true">{pause ? '▶' : 'Ⅱ'}</span></button>
      </nav>
    </header>
    <section className={`stage ${screen === 'summary' ? 'stage-hidden' : ''}`} aria-label="Carte du monde">
      <div id="game-canvas" />
      {screen !== 'world' && <div className="stage-veil" />}
      <div className="encounter-bar" role="progressbar" aria-label="Danger de rencontre"><span>DANGER</span><div className="encounter-track"><i ref={encounterBarRef} /></div></div>
      {screen === 'world' && notice && <div className="floating-notice">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}
      {screen === 'world' && <div className="map-legend"><span>{device === 'gamepad' ? 'Manette détectée' : 'WASD · ZQSD · Flèches'}</span><span>Pause : Échap</span></div>}
      {screen === 'world' && developmentMode && <div className={`dev-tools ${developerToolsOpen ? 'is-open' : ''}`}>
        <button className="dev-tools-toggle" aria-expanded={developerToolsOpen} onClick={() => setDeveloperToolsOpen((open) => !open)}>DEV {developerToolsOpen ? '−' : '+'}</button>
        {developerToolsOpen && <>
          <div>{ZONES.map((zone) => <button key={zone.id} onClick={() => {
            const shape = ZONE_SHAPES[zone.id];
            const position = { x: shape.x + 90, y: shape.y + 40 };
            persistRun({ ...run, position });
            sceneRef.current?.teleport(position.x, position.y);
          }}>Aller : {zone.name}</button>)}</div>
          <div><button onClick={() => persistRun({ ...run, level: run.level + 1, unspentPoints: run.unspentPoints + 2, xpToNext: Math.round(60 + run.level * 24) })}>Niveau +1</button>
            <select aria-label="Objet de test" value={devItem} onChange={(event) => setDevItem(event.target.value)}>{ITEMS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <button onClick={() => persistRun({ ...run, inventory: [...run.inventory, { instanceId: `dev-${++devItemCount.current}`, itemId: devItem }] })}>Ajouter objet</button></div>
          <div><select aria-label="Monstre de test" value={devEnemy} onChange={(event) => setDevEnemy(event.target.value)}>{ENEMIES.map((enemy) => <option key={enemy.id} value={enemy.id}>{enemy.name}</option>)}</select>
            <button onClick={() => launchCombat([devEnemy])}>Lancer combat</button></div>
        </>}
      </div>}
    </section>

    {screen === 'combat' && combat && <BattleScene combat={combat} hero={run.hero} heroName={HEROES[run.hero].name}
      heroColor={HEROES[run.hero].color} zoneId={zoneAt(run.position.x, run.position.y).id} target={targetRef.current ?? 0}
      speed={settings.combatSpeed} paused={pause} saveError={!!error}
      onTarget={(index) => { targetRef.current = index; syncCombat({ ...combat }); }}
      onPause={() => setPause((value) => !value)}
      onRetry={() => { setError(''); void resolveCombat(combat); }} />}

    {screen === 'inventory' && <section className="panel modal-panel">
      <PanelHeading label="ÉQUIPEMENT" title="Inventaire" onClose={backToWorld} />
      <div className="equipment-grid">{(['weapon', 'armor', 'charm', 'charm2'] as const).map((slot) => {
        const equipped = itemForInstance(run, run.equipment[slot]);
        return <div className={`equipment-slot${equipped ? ` rarity-${equipped.rarity}` : ''}`} key={slot}>
          <span>{slot === 'weapon' ? 'ARME' : slot === 'armor' ? 'ARMURE' : `ACCESSOIRE ${slot === 'charm' ? '1' : '2'}`}</span>
          {equipped && <ItemIcon id={equipped.id} rarity={equipped.rarity} size={52} />}
          <strong className="rarity-text" style={equipped ? { color: RARITIES[equipped.rarity].color } : undefined}>{equipped?.name ?? 'Vide'}</strong>
        </div>;
      })}</div>
      <div className="inventory-list">{run.inventory.map((instance) => {
        const item = ITEMS.find((entry) => entry.id === instance.itemId);
        if (!item) return null;
        const equipped = Object.values(run.equipment).includes(instance.instanceId);
        const comparison = item.slot === 'consumable' ? '' : compareEquipment(run, instance.instanceId);
        return <article className={`item-row rarity-${item.rarity}`} key={instance.instanceId}><ItemIcon id={item.id} rarity={item.rarity} /><div><strong style={{ color: RARITIES[item.rarity].color }}>{item.name}</strong> <small className="rarity-tag" style={{ color: RARITIES[item.rarity].color }}>{RARITIES[item.rarity].label}</small><p>{item.description}</p>{comparison && <p className="item-comparison">{comparison}</p>}</div>
          {item.slot === 'consumable' ? <button disabled={run.hp >= (stats?.maxHp ?? run.hp)} onClick={() => persistRun(useConsumable(run, instance.instanceId))}>Utiliser</button> :
            <span className="equip-buttons">{equipped ? <>
              <small>Équipé</small><button onClick={() => {
                const equipment = Object.fromEntries(Object.entries(run.equipment).filter(([, value]) => value !== instance.instanceId));
                const updated = { ...run, equipment };
                updated.hp = Math.min(deriveStats(updated).maxHp, run.hp);
                persistRun(updated);
              }}>Retirer</button>
            </> : (item.slot === 'charm' ? (['charm', 'charm2'] as const) : [slotForItem(instance.itemId)]).filter((slot): slot is 'weapon' | 'armor' | 'charm' | 'charm2' => !!slot).map((slot) => <button key={slot} onClick={() => persistRun(equipItem(run, instance.instanceId, slot))}>Équiper {slot === 'charm2' ? 'accessoire 2' : slot === 'charm' ? 'accessoire 1' : ''}</button>)}</span>}
        </article>;
      })}</div>
      <p className="small-note">Comparaison : les statistiques sont recalculées à partir des objets actuellement équipés. Les objets trouvés ne persistent pas après la partie.</p>
    </section>}

    {screen === 'stats' && <section className="panel modal-panel">
      <PanelHeading label={passiveOffers.length ? 'CHOIX DE PASSIF' : 'PERSONNAGE'} title={passiveOffers.length ? `${run.pendingPassivePicks} choix en attente` : 'Statistiques & maîtrise'} onClose={() => { if (!passiveOffers.length) backToWorld(); }} />
      {passiveOffers.length ? <div className="passive-offers">{passiveOffers.map((id) => {
        const passive = PASSIVES.find((entry) => entry.id === id)!;
        const rank = run.passives.find((entry) => entry.id === id)?.rank ?? 0;
        const rarity = passiveRarity(passive.weight);
        return <button className={`passive-card rarity-${rarity}`} key={id} onClick={() => clickPassive(id)}><ItemIcon id={passive.id} rarity={rarity} size={56} /><small style={{ color: RARITIES[rarity].color }}>{RARITIES[rarity].label.toUpperCase()} · RANG {rank + 1}/{passive.maxRank}</small><strong>{passive.name}</strong><span>{passive.description}</span></button>;
      })}</div> : run.pendingPassivePicks > 0 ? <div className="empty-choice"><p>Aucun passif débloqué disponible pour ce palier.</p><button onClick={() => { const updated = { ...run, pendingPassivePicks: run.pendingPassivePicks - 1 }; persistRun(updated); if (updated.pendingPassivePicks === 0) backToWorld(); }}>Passer ce choix</button></div> :
        <><div className="stat-grid">{(Object.entries(stats ?? {}) as [string, number][]).map(([key, value]) => <div key={key}><span>{statLabel(key)}</span><strong>{Number.isInteger(value) ? value : value.toFixed(2)}</strong></div>)}</div>
        {run.unspentPoints > 0 && <div className="points-panel"><strong>{run.unspentPoints} points à répartir</strong>{(['strength', 'speed', 'luck', 'defense', 'maxHp'] as const).map((stat) => <div className="point-row" key={stat}><span>{statLabel(stat)}</span>{Array.from(new Set([1, 5, run.unspentPoints])).map((amount) => <button key={amount} onClick={() => pickStat(stat, amount)}>{amount === run.unspentPoints ? 'Tout' : `+${amount}`}</button>)}</div>)}
          {Object.values(run.invested).some((value) => (value ?? 0) > 0) && <button className="respec-button" onClick={() => persistRun(respecStats(run))}>Réinitialiser les points (gratuit)</button>}
        </div>}
        <MasteryPanel hero={run.hero} levels={profile.mastery[run.hero]} />
        <p className="small-note">Réattribution des statistiques gratuite dans ce prototype.</p>
        <div className="passive-list">{run.passives.map((passive) => {
          const definition = PASSIVES.find((entry) => entry.id === passive.id);
          const rarity = passiveRarity(definition?.weight ?? 5);
          return <span key={passive.id} className={`rarity-${rarity}`} style={{ color: RARITIES[rarity].color, borderLeft: `3px solid ${RARITIES[rarity].color}` }}><ItemIcon id={passive.id} rarity={rarity} size={26} />{definition?.name} · rang {passive.rank}</span>;
        })}</div>
        <AchievementList profile={profile} hero={run.hero} /></>}
    </section>}

    {screen === 'settings' && <section className="panel modal-panel">
      <PanelHeading label="PRÉFÉRENCES" title="Options" onClose={backToWorld} />
      <label className="setting-row">Volume <input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(event) => setSettings({ ...settings, volume: Number(event.target.value) })} /><span>{Math.round(settings.volume * 100)} %</span></label>
      <div className="setting-row">Vitesse du combat <div className="button-group">{([1, 2, 4] as const).map((speed) => <button className={settings.combatSpeed === speed ? 'selected' : ''} key={speed} onClick={() => setSettings({ ...settings, combatSpeed: speed })}>×{speed}</button>)}</div></div>
      <button onClick={() => { const fullscreen = !settings.fullscreen; setSettings({ ...settings, fullscreen }); if (fullscreen) void document.documentElement.requestFullscreen?.(); else if (document.fullscreenElement) void document.exitFullscreen(); }}>Plein écran : {settings.fullscreen ? 'activé' : 'désactivé'}</button>
      <p className="small-note">L’accélération ne change que la présentation et l’avancement du temps logique : les décisions et l’ordre des actions restent déterministes.</p>
    </section>}

    {screen === 'summary' && <section className="panel modal-panel summary-panel">
      <p className="eyebrow">BILAN DE PARTIE</p><h2>{run.result === 'victory' ? 'Victoire !' : 'Fin de partie'}</h2>
      <p>{HEROES[run.hero].name} · niveau {run.level} · {run.kills} élimination(s) · {run.victories} combat(s)</p>
      <p>Secrets découverts : {run.secrets.length} · Boss vaincus : {run.defeatedBosses.length}</p>
      <h3>Objets obtenus</h3><p>{run.inventory.map((instance) => ITEMS.find((item) => item.id === instance.itemId)?.name).filter(Boolean).join(' · ') || 'Aucun objet'}</p>
      <h3>Déblocages permanents</h3><p>{profile.achievements.map((id) => ACHIEVEMENTS.find((entry) => entry.id === id)?.name).filter(Boolean).join(' · ') || 'Aucun pour le moment'}</p>
      <button className="primary" onClick={() => {
        syncRun(null); syncCombat(null); setScreen('title');
        void saveRun(null).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
      }}>Nouvelle partie</button>
    </section>}
    {error && <div className="toast error">{error}<button onClick={() => setError('')}>×</button></div>}
    <p className="sr-only">Commandes : flèches pour naviguer, Entrée pour valider, Échap pour fermer ou mettre en pause.</p>
  </main>;
}

function newRunFor(hero: HeroId, developer: boolean): RunState {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  let run = newRun(hero, seed);
  if (developer) {
    run = { ...run, developerMode: true, level: 8, xp: 0, xpToNext: 228, unspentPoints: 14 };
  }
  return run;
}

function MasteryPanel({ hero, levels }: { hero: HeroId; levels: number }) {
  const rank = masteryRank(levels);
  const floor = rank === 0 ? 0 : masteryLevelsForRank(rank);
  const next = rank >= MASTERY_MAX_RANK ? floor : masteryLevelsForRank(rank + 1);
  const ratio = next === floor ? 1 : (levels - floor) / (next - floor);
  const rewards = PASSIVES.filter((passive) => passive.hero === hero && passive.masteryRequired !== undefined)
    .sort((a, b) => (a.masteryRequired ?? 0) - (b.masteryRequired ?? 0));
  return <div className="mastery-panel">
    <div className="mastery-head"><strong>Maîtrise {HEROES[hero].name} · niveau {rank}</strong><span>{levels} niveaux gagnés{rank < MASTERY_MAX_RANK ? ` · prochain palier : ${next}` : ' · maximum'}</span></div>
    <div className="mastery-track"><i style={{ width: `${Math.round(ratio * 100)}%` }} /></div>
    <ul className="mastery-rewards">{rewards.map((passive) => <li key={passive.id} className={rank >= (passive.masteryRequired ?? 0) ? 'reached' : ''}>
      <b>Maîtrise {passive.masteryRequired}</b> · passif « {passive.name} »</li>)}</ul>
  </div>;
}

function AchievementList({ profile, hero }: { profile: Profile; hero: HeroId }) {
  const visible = ACHIEVEMENTS.filter((entry) => !entry.hero || entry.hero === hero);
  return <div className="achievement-list">
    <h3>Succès · {visible.filter((entry) => profile.achievements.includes(entry.id)).length}/{visible.length}</h3>
    {visible.map((entry) => {
      const done = profile.achievements.includes(entry.id);
      const rewards = (entry.unlocks ?? []).map((id) => ITEMS.find((item) => item.id === id)?.name ?? PASSIVES.find((passive) => passive.id === id)?.name).filter(Boolean).join(', ');
      return <div key={entry.id} className={`achievement${done ? ' done' : ''}`}>
        <strong>{done ? '✔' : '○'} {entry.name}</strong><span>{entry.description}</span>
        {rewards && <small>Récompense : {rewards}</small>}
      </div>;
    })}
  </div>;
}

function PanelHeading({ label, title, onClose }: { label: string; title: string; onClose: () => void }) {
  return <div className="panel-heading"><div><p className="eyebrow">{label}</p><h2>{title}</h2></div><button onClick={onClose}>Fermer <kbd>Échap</kbd></button></div>;
}

function statLabel(key: string): string {
  return ({ strength: 'Force', speed: 'Vitesse', luck: 'Chance', critChance: 'Critique', critDamage: 'Dégâts critiques', maxHp: 'PV maximum', defense: 'Défense' })[key] ?? key;
}

function compareEquipment(run: RunState, instanceId: string): string {
  const item = ITEMS.find((entry) => entry.id === run.inventory.find((entry) => entry.instanceId === instanceId)?.itemId);
  if (!item || item.slot === 'consumable') return '';
  const equippedSlot = Object.entries(run.equipment).find(([, id]) => id === instanceId)?.[0];
  const slot = equippedSlot === 'weapon' || equippedSlot === 'armor' || equippedSlot === 'charm' || equippedSlot === 'charm2'
    ? equippedSlot
    : slotForItem(item.id);
  if (!slot) return '';
  const before = deriveStats(run);
  const after = deriveStats(equipItem(run, instanceId, slot));
  return (Object.keys(before) as (keyof typeof before)[])
    .filter((key) => before[key] !== after[key])
    .map((key) => {
      const format = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);
      return `${statLabel(key)} ${format(before[key])} → ${format(after[key])}`;
    })
    .join(' · ');
}
