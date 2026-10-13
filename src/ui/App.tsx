import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import { ACHIEVEMENTS, BALANCE, ENEMIES, HEROES, ITEMS, PASSIVES, ZONES, masteryLevelsForRank, masteryRank, MASTERY_MAX_RANK, STARTING_OPTIONS } from '../game/content';
import {
  addAchievements, advanceEncounter, allocatePoints, applyProgress, deriveStats,
  gainExperience, initialProfile, newRun, rememberLoadout, resolveLoadout, rollEncounter,
  respecStats, rollLoot, startCombat, stepCombat,
} from '../game/engine';
import type { Loadout } from '../game/engine';
import { DEFAULT_SETTINGS, loadProfile, loadRun, loadSettings, saveProfile, saveRun, saveSettings, type Settings } from '../game/save';
import { SettingsPage } from './SettingsPage';
import { NeonLogo } from './NeonLogo';
import { HERO_NEON, PlatformScene, type MapCallbacks, type MapEvent } from '../game/PlatformScene';
import { ZONE_ENTRIES, zoneAt } from '../game/world';
import { BattleScene } from './BattleScene';
import { CombatRecap, type CombatRecapData } from './CombatRecap';
import { HERO_ACCENT, ItemIcon, RARITIES, passiveRarity } from './icons';
import { LoadoutPage } from './LoadoutPage';
import { ZoneLoot } from './ZoneLoot';
import { InventoryPage } from './InventoryPage';
import { ClassDetailsPage } from './ClassDetailsPage';
import { AchievementsPage } from './AchievementsPage';
import { BestiaryPage } from './BestiaryPage';
import { SpaceBackdrop } from './SpaceBackdrop';
import { HeroPortrait, HeroIdentity, MenuIcon, MenuFooter, StatIcon } from './GameVisuals';


import './game-hud.css';

import type { CombatState, HeroId, Profile, RunState } from '../game/types';

type Screen = 'title' | 'world' | 'combat' | 'inventory' | 'stats' | 'settings' | 'achievements' | 'summary' | 'loot';
const percentage = (value: number, max: number) => `${Math.max(0, Math.min(100, Math.round(value / Math.max(1, max) * 100)))}%`;

export function App() {
  const [profile, setProfile] = useState<Profile>(() => initialProfile());
  const [run, setRun] = useState<RunState | null>(null);
  const runRef = useRef<RunState | null>(null);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const profileRef = useRef(profile);
  const profileHealthy = useRef(true);
  const [screen, setScreen] = useState<Screen>('title');
  const [newRunSelection, setNewRunSelection] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [titlePanel, setTitlePanel] = useState<'settings' | 'achievements' | 'bestiary' | null>(null);
  const [heroDetail, setHeroDetail] = useState<HeroId | null>(null);
  const [loadoutHero, setLoadoutHero] = useState<HeroId | null>(null);
  const [worldReady, setWorldReady] = useState(false);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const combatRef = useRef<CombatState | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [error, setError] = useState('');
  const [, setDevice] = useState<'keyboard' | 'gamepad'>('keyboard');
  const [developmentMode, setDevelopmentMode] = useState(false);
  const [developerToolsOpen, setDeveloperToolsOpen] = useState(false);
  const [devItem, setDevItem] = useState(ITEMS[0].id);
  const [devEnemy, setDevEnemy] = useState(ENEMIES[0].id);
  const [notice, setNotice] = useState('');
  const [recap, setRecap] = useState<CombatRecapData | null>(null);
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
        setScreen('world');
      } else {
        if (profileSaved) await saveRun(null);
        setScreen('summary');
      }
    }).catch((loadError: unknown) => {
      if (alive) setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.');
    });
    return () => { alive = false; };
  }, [syncRun, updateProfile]);

  useEffect(() => { saveSettings(settings); settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    const { up, down, left, right } = settings.bindings;
    sceneRef.current?.setMoveKeys({ up, down, left, right });
  }, [settings.bindings, screen]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.glow = settings.glow;
    sceneRef.current?.setReduceMotion(settings.reduceMotion);
    root.dataset.motion = settings.reduceMotion ? 'reduced' : 'full';
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.style.setProperty('--ui-scale', String(settings.uiScale));
  }, [settings.glow, settings.reduceMotion, settings.highContrast, settings.uiScale]);
  const launchCombat = useCallback((ids: string[]) => {
    const current = runRef.current;
    if (!current || current.result !== 'active' || combatRef.current) return;
    finishLock.current = false;
    targetRef.current = undefined;
    const prepared = { ...current, pendingCombat: [...ids] };
    syncRun(prepared);
    void saveRun(prepared).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
    syncCombat(startCombat(prepared, ids));
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
      ready: (scene) => {
        if (gameRef.current !== game) return;
        sceneRef.current = scene;
        const { up, down, left, right } = settingsRef.current.bindings;
        scene.setMoveKeys({ up, down, left, right });
        scene.setReduceMotion(settingsRef.current.reduceMotion);
        window.requestAnimationFrame(() => setWorldReady(true));
      },
      travel: (pending) => {
        const bar = encounterBarRef.current;
        const meter = runRef.current?.encounterMeter ?? 0;
        if (bar) bar.style.width = `${Math.min(1, meter + pending * BALANCE.encounterMeterChancePerUnit / BALANCE.maxEncounterMeter) * 100}%`;
      },
      control: setDevice,
      isBossDefeated: (bossId) => !!runRef.current?.defeatedBosses.includes(bossId) ||
        (bossId === 'crypt-boss' && profileRef.current.paths.includes('ashen-path')),
    };
    const worldScene = new PlatformScene(callbacks, run.position, HERO_NEON[run.hero] ?? HEROES[run.hero].color, run.hero);
    let game: Phaser.Game | null = null;
    setWorldReady(false);
    // Laisse l'écran de chargement s'afficher avant la construction (synchrone) du monde
    const timer = window.setTimeout(() => {
      game = new Phaser.Game({
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
    }, 80);
    return () => {
      window.clearTimeout(timer);
      game?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, [gameVisible, !!run, onMapEvent, syncRun, developmentMode]);

  useEffect(() => {
    sceneRef.current?.togglePause(screen !== 'world');
  }, [screen]);

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
    if (screen !== 'combat' || !combat) return;
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
  }, [screen, !!combat, settings.combatSpeed]);

  const resolveCombat = useCallback(async (result: CombatState) => {
    let current = runRef.current;
    if (!current) return;
    const defeated = result.enemies.filter((enemy) => enemy.currentHp <= 0);
    let updated: RunState = {
      ...current, hp: result.playerHp, lifestealRemainder: result.lifestealRemainder ?? 0, pendingCombat: null, kills: current.kills + defeated.length,
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
    const before = { level: current.level, xp: current.xp, xpToNext: current.xpToNext, inventoryCount: current.inventory.length };
    try {
      await saveRun(updated);
    } catch (saveError) {
      setError(saveError instanceof Error ? `Combat résolu mais sauvegarde impossible : ${saveError.message}` : 'Combat résolu mais sauvegarde impossible.');
      return;
    }
    current = updated;
    syncRun(updated);
    const profileSaved = updateProfile(profileAfter);
    if (result.over === 'win' && updated.result === 'active') {
      setRecap({
        xpGained: defeated.reduce((sum, enemy) => sum + enemy.xp, 0),
        kills: defeated.length,
        levelBefore: before.level,
        levelAfter: updated.level,
        fillBefore: before.xp / Math.max(1, before.xpToNext),
        fillAfter: updated.xp / Math.max(1, updated.xpToNext),
        loot: updated.inventory.slice(before.inventoryCount).map((instance) => ITEMS.find((item) => item.id === instance.itemId)?.name).filter((name): name is string => !!name),
        notes: [
          ...(rankAfter > rankBefore ? [`Maîtrise ${HEROES[updated.hero].name} : rang ${rankAfter} !`] : []),
          ...newAchievements.map((name) => `Succès : ${name}`),
        ],
      });
      return;
    }
    syncCombat(null);
    if (updated.result !== 'active') {
      if (profileSaved) {
        try { await saveRun(null); }
        catch (saveError) { setError(saveError instanceof Error ? `Partie terminée, impossible d’effacer la sauvegarde active : ${saveError.message}` : 'Partie terminée, effacement de sauvegarde impossible.'); }
      }
      setScreen('summary');
    } else {
      setScreen('world');
      sceneRef.current?.togglePause(false);
    }
  }, [syncCombat, syncRun, updateProfile]);

  const continueAfterCombat = () => {
    setRecap(null);
    syncCombat(null);
    setScreen('world');
    sceneRef.current?.togglePause(false);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmAbandon) { setConfirmAbandon(false); return; }
        if (screen === 'title') {
          if (loadoutHero) setLoadoutHero(null);
          else if (heroDetail) setHeroDetail(null);
          else if (titlePanel) setTitlePanel(null);
          else setNewRunSelection(false);
          return;
        }
        if (screen !== 'summary' && screen !== 'combat') setScreen('world');
      }
      if (event.code === settings.bindings.inventory && screen === 'world') setScreen('inventory');
      if (event.code === settings.bindings.character && screen === 'world') setScreen('stats');
      if (event.code === 'KeyL' && screen === 'world') setScreen('loot');
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
  }, [screen, confirmAbandon, loadoutHero, heroDetail, titlePanel, settings.bindings.inventory, settings.bindings.character]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (screen === 'world' || (screen === 'combat' && !recap)) return;
      const surface = document.querySelector('.confirm-dialog') ?? document.querySelector('.recap-card') ?? document.querySelector('.modal-panel') ?? document.querySelector('main');
      surface?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')?.focus({ preventScroll: true });
    });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || (screen === 'combat' && !recap)) return;
      const surface = document.querySelector('.confirm-dialog') ?? document.querySelector('.recap-card') ?? document.querySelector('.modal-panel');
      if (!surface) return;
      const controls = Array.from(surface.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')).filter((element) => element.getClientRects().length > 0);
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (index < 0 || (!event.shiftKey && index === controls.length - 1) || (event.shiftKey && index === 0)) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
    };
    window.addEventListener('keydown', trap);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', trap); };
  }, [screen, titlePanel, loadoutHero, heroDetail, newRunSelection, confirmAbandon, !!recap]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const pad = navigator.getGamepads?.().find((item) => item?.connected);
      if (!pad) return;
      const confirm = !!(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
      const up = !!(pad.buttons[12]?.pressed);
      const down = !!(pad.buttons[13]?.pressed);
      if ((up && !padButtonsRef.current.up) || (down && !padButtonsRef.current.down)) {
        const surface = document.querySelector('.confirm-dialog') ?? document.querySelector('.recap-card') ?? document.querySelector('.modal-panel') ?? document;
        const buttons = Array.from(surface.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter((button) => button.getClientRects().length > 0);
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

  const startGame = (hero: HeroId, loadout: Required<Loadout>) => {
    const fresh = newRunFor(hero, developmentMode, resolveLoadout(hero, profile, loadout));
    setLoadoutHero(null);
    syncRun(fresh);
    syncCombat(null);
    setNotice('');
    setError('');
    setNewRunSelection(false);
    setScreen('world');
    void saveRun(fresh).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
  };

  const stats = useMemo(() => run ? deriveStats(run) : null, [run]);
  const hudHp = combat?.playerHp ?? run?.hp ?? 0;
  const hudMaxHp = combat?.playerMaxHp ?? stats?.maxHp ?? 0;
  const persistRun = (updated: RunState) => {
    syncRun(updated);
    void saveRun(updated).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
  };

  const pickStat = (key: keyof typeof HEROES.warrior.stats, amount: number) => {
    if (run) persistRun(allocatePoints(run, key, amount));
  };

  const openInventory = () => { setScreen('inventory'); sceneRef.current?.togglePause(true); };
  const backToWorld = () => {
    setScreen('world');
    sceneRef.current?.togglePause(false);
  };

  const abandonRun = () => {
    syncRun(null); syncCombat(null); setNewRunSelection(false); setScreen('title');
    void saveRun(null).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
  };

  if ((!run || screen === 'title') && loadoutHero) {
    return <LoadoutPage key={loadoutHero} hero={loadoutHero} profile={profile} onChange={(loadout) => updateProfile(rememberLoadout(profileRef.current, loadoutHero, loadout))} onStart={(loadout) => startGame(loadoutHero, loadout)} onBack={() => setLoadoutHero(null)} />;
  }

  if ((!run || screen === 'title') && heroDetail) {
    return <ClassDetailsPage hero={heroDetail} profile={profile} onHero={setHeroDetail} onBack={() => setHeroDetail(null)} />;
  }

  if ((!run || screen === 'title') && titlePanel === 'achievements') {
    return <AchievementsPage profile={profile} onBack={() => setTitlePanel(null)} />;
  }

  if ((!run || screen === 'title') && titlePanel === 'bestiary') {
    return <BestiaryPage profile={profile} onBack={() => setTitlePanel(null)} />;
  }

  if ((!run || screen === 'title') && titlePanel === 'settings') {
    return <SettingsPage settings={settings} setSettings={setSettings} onBack={() => setTitlePanel(null)} />;
  }

  if ((!run || screen === 'title') && newRunSelection) {
    return <main className="shell title-screen classes-page class-selection-page">
      <SpaceBackdrop />
      <div className="class-selection-heading"><p className="eyebrow">NOUVELLE PARTIE</p><h1>Choisissez votre voie</h1></div>
      <div className="class-selection-cards">{(['warrior', 'assassin'] as const).map((hero) => <article className="class-choice-option" key={hero} style={{ ['--accent' as string]: HERO_ACCENT[hero] }}>
        <button className="class-choice" aria-label={`Choisir ${HEROES[hero].name}`} onClick={() => setLoadoutHero(hero)}>
          <HeroPortrait hero={hero} /><div className="class-choice-body"><h2>{HEROES[hero].name}</h2>
          <MasterySegments levels={profile.mastery[hero]} /></div>
        </button>
        <button className="class-details-link" aria-label={`Details du ${HEROES[hero].name}`} onClick={() => setHeroDetail(hero)}>Details</button>
      </article>)}</div>
      <div className="class-selection-bottom">{run?.result === 'active' && <p className="small-note">La partie actuelle sera remplacée lorsque vous commencerez la nouvelle.</p>}<label className="dev-toggle"><input type="checkbox" checked={developmentMode} onChange={(event) => setDevelopmentMode(event.target.checked)} /> Mode développeur · départ niveau 8</label><MenuFooter /><div className="page-bottom-actions"><button onClick={() => setNewRunSelection(false)}>Accueil</button></div></div>
    </main>;
  }

  if (!run || screen === 'title') {
    return <main className="shell title-screen main-menu-screen">
      <div className="title-grid" aria-hidden="true" />
      <SpaceBackdrop />
      <section className="main-menu-content">
        <div className="main-menu-brand"><NeonLogo size={140} /></div>
        <h1 className="wordmark-title"><span>GRIND</span><small>IT</small></h1>
        {error && <div className="notice error">{error}</div>}
        <nav className="main-menu-actions" aria-label="Menu principal">
          {run?.result === 'active' && <button className="main-menu-button" onClick={() => setScreen('world')}><span>Continuer</span></button>}
          <button className="main-menu-button" onClick={() => setNewRunSelection(true)}><span>Nouvelle partie</span></button>
          <button className="main-menu-button" onClick={() => setTitlePanel('achievements')}><span>Succès</span></button>
          <button className="main-menu-button" onClick={() => setTitlePanel('bestiary')}><span>Bestiaire</span></button>
          <button className="main-menu-button" onClick={() => setTitlePanel('settings')}><span>Options</span></button>
          {run?.result === 'active' && <button className="main-menu-button" onClick={() => setConfirmAbandon(true)}><span>Abandonner la partie</span></button>}
          <button className="main-menu-button" onClick={() => window.close()}><span>Quitter</span></button>
        </nav>
      </section>
      {confirmAbandon && <div className="confirm-backdrop" role="presentation" onClick={() => setConfirmAbandon(false)}>
        <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(event) => event.stopPropagation()}>
          <span className="confirm-kicker">ATTENTION</span><h3 id="confirm-title">Abandonner la partie ?</h3><p>La progression de cette partie sera perdue. Les succès et la maîtrise sont conservés.</p>
          <div className="confirm-actions"><button autoFocus onClick={() => setConfirmAbandon(false)}>Annuler</button><button className="danger" onClick={() => { setConfirmAbandon(false); abandonRun(); }}>Abandonner</button></div>
        </div>
      </div>}
    </main>;
  }

  return <main className="shell game-shell">
    <header className="game-hud" style={{ ['--accent' as string]: HERO_ACCENT[run.hero] }}>
      <section className="hud-status" aria-label="État du personnage">
        <div className="hud-class-emblem"><HeroPortrait hero={run.hero} /><span>{run.level}</span></div>
        <div className="hud-life-panel"><div className="hud-life-heading"><strong>{HEROES[run.hero].name}</strong><span>{hudHp}<small> / {hudMaxHp}</small></span></div>
          <div className={hudHp / Math.max(1, hudMaxHp) < .3 ? 'hud-life-track is-low' : 'hud-life-track'} role="progressbar" aria-label="Points de vie" aria-valuemin={0} aria-valuemax={hudMaxHp} aria-valuenow={hudHp}><i style={{ width: percentage(hudHp, hudMaxHp) }} /></div>
          <div className="hud-xp-line"><span>XP</span><div className="hud-xp-track" role="progressbar" aria-label="Expérience" aria-valuemin={0} aria-valuemax={run.xpToNext} aria-valuenow={run.xp}><i style={{ width: percentage(run.xp, run.xpToNext) }} /></div><small>{run.xp}/{run.xpToNext}</small></div>
        </div>
        <button className="hud-build-seal" aria-label={`Passif de départ : ${PASSIVES.find((entry) => entry.id === run.passives[0]?.id)?.name ?? 'Aucun'}`} data-tip={PASSIVES.find((entry) => entry.id === run.passives[0]?.id)?.description} disabled={screen === 'combat'} onClick={() => { setScreen('stats'); sceneRef.current?.togglePause(true); }}>{run.passives[0] && <ItemIcon id={run.passives[0].id} rarity={passiveRarity(PASSIVES.find((entry) => entry.id === run.passives[0].id)?.weight ?? 5)} size={36} />}</button>
      </section>
      <nav className="hud-utilities" aria-label="Options du jeu">
        <button aria-label="Succès" data-tip="Succès" disabled={screen === 'combat'} onClick={() => { setScreen('achievements'); sceneRef.current?.togglePause(true); }}><MenuIcon id="achievements" size={22} /></button>
        <button aria-label="Options" data-tip="Paramètres" disabled={screen === 'combat'} onClick={() => setScreen('settings')}><MenuIcon id="settings" size={22} /></button>
        <button aria-label={`Vitesse du jeu ×${settings.combatSpeed}`} data-tip="Vitesse des combats" onClick={() => setSettings({ ...settings, combatSpeed: settings.combatSpeed === 1 ? 2 : settings.combatSpeed === 2 ? 4 : 1 })}><span>×{settings.combatSpeed}</span></button>
        <button aria-label="Retour au menu" data-tip="Menu principal" disabled={screen === 'combat'} onClick={() => setScreen('title')}><NeonLogo size={26} /></button>
      </nav>
      <nav className="hud-actions" aria-label="Menu du jeu">
        <button aria-label="Zones et butins" disabled={screen === 'combat'} onClick={() => setScreen('loot')}><MenuIcon id="loot" size={26} /><span>Butin</span><kbd>L</kbd></button>
        <button aria-label="Inventaire" disabled={screen === 'combat'} onClick={openInventory}><MenuIcon id="inventory" size={26} /><span>Sac</span><kbd>I</kbd></button>
        <button className={run.unspentPoints > 0 ? 'has-alert' : ''} aria-label={run.unspentPoints > 0 ? `Personnage : ${run.unspentPoints} points à répartir` : 'Personnage'} disabled={screen === 'combat'} onClick={() => { setScreen('stats'); sceneRef.current?.togglePause(true); }}><MenuIcon id="character" size={26} /><span>Build</span><kbd>C</kbd>{run.unspentPoints > 0 && <b className="alert-badge">{run.unspentPoints}</b>}</button>
      </nav>
    </header>
    <section className={`stage ${screen === 'summary' ? 'stage-hidden' : ''}`} aria-label="Carte du monde">
      <div id="game-canvas" />
      {!worldReady && <div className="loading-screen" role="status" aria-live="polite">
        <div className="title-grid" aria-hidden="true" />
        <NeonLogo size={72} />
        <p>Chargement du monde</p>
        <div className="loading-bar" aria-hidden="true"><i /></div>
      </div>}
      {screen !== 'world' && <div className="stage-veil" />}
      <div className="world-location" aria-label="Zone actuelle"><strong>{zoneAt(run.position.x, run.position.y).name}</strong><span>Niveau {zoneAt(run.position.x, run.position.y).level}</span></div>
      <div className="encounter-bar" role="progressbar" aria-label="Risque de rencontre"><span>Risque de rencontre</span><div className="encounter-track"><i ref={encounterBarRef} /></div></div>
      {screen === 'world' && notice && <div className="floating-notice">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}
      {screen === 'world' && developmentMode && <div className={`dev-tools ${developerToolsOpen ? 'is-open' : ''}`}>
        <button className="dev-tools-toggle" aria-expanded={developerToolsOpen} onClick={() => setDeveloperToolsOpen((open) => !open)}>DEV {developerToolsOpen ? '−' : '+'}</button>
        {developerToolsOpen && <>
          <div>{ZONES.map((zone) => <button key={zone.id} onClick={() => {
            const position = { ...ZONE_ENTRIES[zone.id] };
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
      speed={settings.combatSpeed} saveError={!!error}
      onTarget={(index) => { targetRef.current = index; syncCombat({ ...combat }); }}
      onRetry={() => { setError(''); void resolveCombat(combat); }} />}
    {screen === 'combat' && combat && recap && <CombatRecap recap={recap} points={run.unspentPoints}
      stats={(['strength', 'speed', 'luck', 'defense', 'maxHp'] as const).map((key) => ({ key, label: statLabel(key) }))}
      onSpend={(key, amount) => pickStat(key as keyof typeof HEROES.warrior.stats, amount)} onContinue={continueAfterCombat} />}

    {screen === 'loot' && <ZoneLoot run={run} profile={profile} onClose={backToWorld} />}
    {screen === 'inventory' && <InventoryPage run={run} onChange={persistRun} onClose={backToWorld} />}

    {screen === 'stats' && <section className="panel modal-panel">
      <PanelHeading label="PERSONNAGE" title="Statistiques & maîtrise" onClose={backToWorld} />
        <><HeroIdentity hero={run.hero} level={run.level} subtitle="VOTRE BUILD" /><div className="stat-grid">{(Object.entries(stats ?? {}) as [string, number][]).map(([key, value]) => <div key={key}><StatIcon stat={key} /><span>{statLabel(key)}</span><strong>{Number.isInteger(value) ? value : value.toFixed(2)}</strong></div>)}</div>
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
        </>
    </section>}

    {screen === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} onBack={backToWorld} inGame />}

    {screen === 'achievements' && <AchievementsPage profile={profile} onBack={backToWorld} inGame />}

    {screen === 'summary' && <section className="panel modal-panel summary-panel">
      <HeroPortrait hero={run.hero} className="summary-portrait" /><p className="eyebrow">BILAN DE PARTIE</p><h2>{run.result === 'victory' ? 'Seuil franchi' : 'Le dernier souffle'}</h2>
      <p>{HEROES[run.hero].name} · niveau {run.level} · {run.kills} élimination(s) · {run.victories} combat(s)</p>
      <p>Secrets découverts : {run.secrets.length} · Boss vaincus : {run.defeatedBosses.length}</p>
      <h3>Objets obtenus</h3><div className="summary-loot">{run.inventory.map((instance) => { const item = ITEMS.find((item) => item.id === instance.itemId); return item ? <span key={instance.instanceId} title={item.name}><ItemIcon id={item.id} rarity={item.rarity} size={48} /><small>{item.name}</small></span> : null; })}</div>
      <h3>Déblocages permanents</h3><p>{profile.achievements.map((id) => ACHIEVEMENTS.find((entry) => entry.id === id)?.name).filter(Boolean).join(' · ') || 'Aucun pour le moment'}</p>
      <button className="primary" onClick={() => {
        syncRun(null); syncCombat(null); setScreen('title');
        void saveRun(null).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Échec de sauvegarde.'));
      }}>Nouvelle partie</button>
    </section>}
    {error && <div className="toast error">{error}<button onClick={() => setError('')}>×</button></div>}
    <MenuFooter /><p className="sr-only">Commandes : flèches pour naviguer, Entrée pour valider, Échap pour fermer.</p>
  </main>;
}

function newRunFor(hero: HeroId, developer: boolean, loadout: Required<Loadout>): RunState {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  let run = newRun(hero, seed, loadout);
  if (developer) {
    run = { ...run, developerMode: true, level: 8, xp: 0, xpToNext: 228, unspentPoints: 14 };
  }
  return run;
}

function MasterySegments({ levels }: { levels: number }) {
  const rank = masteryRank(levels);
  const floor = rank === 0 ? 0 : masteryLevelsForRank(rank);
  const next = masteryLevelsForRank(Math.min(rank + 1, MASTERY_MAX_RANK));
  const progress = rank >= MASTERY_MAX_RANK ? 0 : Math.max(0, Math.min(1, (levels - floor) / (next - floor)));
  return <div className="class-mastery">
    <div className="class-mastery-label"><span>Maîtrise</span><strong>{rank} / {MASTERY_MAX_RANK}</strong></div>
    <div className="mastery-segments" role="progressbar" aria-label="Maîtrise de la classe" aria-valuemin={0} aria-valuemax={MASTERY_MAX_RANK} aria-valuenow={rank + progress} aria-valuetext={`Maîtrise ${rank} sur ${MASTERY_MAX_RANK}${rank < MASTERY_MAX_RANK ? `, ${Math.round(progress * 100)} % vers le prochain rang` : ', maximum'}`}>
      {Array.from({ length: MASTERY_MAX_RANK }, (_, index) => <span key={index} className={index < rank ? 'is-complete' : ''} aria-hidden="true"><i style={{ width: `${index < rank ? 100 : index === rank ? progress * 100 : 0}%` }} /></span>)}
    </div>
  </div>;
}

function MasteryPanel({ hero, levels }: { hero: HeroId; levels: number }) {
  const rank = masteryRank(levels);
  const floor = rank === 0 ? 0 : masteryLevelsForRank(rank);
  const next = rank >= MASTERY_MAX_RANK ? floor : masteryLevelsForRank(rank + 1);
  const ratio = next === floor ? 1 : (levels - floor) / (next - floor);
  const rewards = [...STARTING_OPTIONS[hero].weapons.map((option) => ({ ...option, kind: 'Équipement', name: ITEMS.find((item) => item.id === option.id)?.name })), ...STARTING_OPTIONS[hero].passives.map((option) => ({ ...option, kind: 'Passif', name: PASSIVES.find((passive) => passive.id === option.id)?.name }))].filter((option) => option.masteryRequired > 0).sort((a,b) => a.masteryRequired - b.masteryRequired);
  return <div className="mastery-panel">
    <div className="mastery-head"><strong>Maîtrise {HEROES[hero].name} · niveau {rank}</strong><span>{levels} niveaux gagnés{rank < MASTERY_MAX_RANK ? ` · prochain palier : ${next}` : ' · maximum'}</span></div>
    <div className="mastery-track"><i style={{ width: `${Math.round(ratio * 100)}%` }} /></div>
    <ul className="mastery-rewards">{rewards.map((reward) => <li key={reward.id} className={rank >= reward.masteryRequired ? 'reached' : ''}><b>Maîtrise {reward.masteryRequired}</b> · {reward.kind} de départ « {reward.name} »</li>)}</ul>
  </div>;
}

function PanelHeading({ label, title, onClose }: { label: string; title: string; onClose?: () => void }) {
  return <div className="panel-heading"><div><p className="eyebrow">{label}</p><h2>{title}</h2></div>{onClose && <button onClick={onClose}>Retour <kbd>Échap</kbd></button>}</div>;
}

function statLabel(key: string): string {
  return ({ strength: 'Force', speed: 'Vitesse', luck: 'Chance', critChance: 'Critique', critDamage: 'Dégâts critiques', maxHp: 'PV maximum', defense: 'Défense' })[key] ?? key;
}

