import { useEffect, useState } from 'react';
import { DEFAULT_BINDINGS, type BindingAction, type Settings } from '../game/save';
import { MenuIcon, type MenuIconId } from './GameVisuals';
import './settings-page.css';

const ACTIONS: { id: BindingAction; label: string }[] = [{ id: 'up', label: 'Haut' }, { id: 'down', label: 'Bas' }, { id: 'left', label: 'Gauche' }, { id: 'right', label: 'Droite' }, { id: 'inventory', label: 'Inventaire' }, { id: 'character', label: 'Statistiques' }];
const TABS: { id: MenuIconId; label: string; description: string }[] = [
  { id: 'sound', label: 'Audio', description: 'Réglez le volume du jeu.' },
  { id: 'controls', label: 'Commandes', description: 'Adaptez les touches à votre façon de jouer.' },
  { id: 'display', label: 'Affichage', description: 'Ajustez la lumière et le mode d’affichage.' },
  { id: 'accessibility', label: 'Accessibilité', description: 'Choisissez votre confort de lecture et de mouvement.' },
];
const RESERVED = new Set(['Escape', 'Tab', 'Enter', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
type KeyboardLayoutMap = { get(code: string): string | undefined };
export function SettingsBody({ settings, setSettings }: { settings: Settings; setSettings(value: Settings): void }) {
  const [tab, setTab] = useState<MenuIconId>('sound');
  const [listening, setListening] = useState<BindingAction | null>(null);
  const [message, setMessage] = useState('');
  const [layout, setLayout] = useState<KeyboardLayoutMap | null>(null);
  useEffect(() => {
    const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<KeyboardLayoutMap> } }).keyboard;
    void keyboard?.getLayoutMap().then(setLayout).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopPropagation();
      if (event.code === 'Escape') { setListening(null); return; }
      if (RESERVED.has(event.code)) { setMessage('Cette touche est réservée. Choisissez une autre touche.'); return; }
      const bindings = { ...settings.bindings };
      const other = ACTIONS.find((action) => action.id !== listening && bindings[action.id] === event.code);
      if (other) bindings[other.id] = bindings[listening];
      bindings[listening] = event.code;
      setMessage(other ? 'Les deux commandes ont échangé leur touche.' : 'Touche enregistrée.');
      setSettings({ ...settings, bindings }); setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, settings, setSettings]);
  const active = TABS.find((entry) => entry.id === tab)!;
  const keyLabel = (code: string) => layout?.get(code)?.toUpperCase() || code.replace(/^Key|^Digit/, '');
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setSettings({ ...settings, fullscreen: !!document.fullscreenElement });
    } catch { setMessage('Le plein écran n’est pas disponible dans cette fenêtre.'); }
  };
  const switchControl = (key: 'highContrast' | 'reduceMotion', label: string) => <button className="preference-switch" role="switch" aria-label={label} aria-checked={settings[key]} onClick={() => setSettings({ ...settings, [key]: !settings[key] })}><span>{settings[key] ? 'Activé' : 'Désactivé'}</span><i aria-hidden="true" /></button>;
  return <div className="preferences-body">
    <nav className="preferences-tabs" aria-label="Catégories des paramètres">{TABS.map((entry) => <button key={entry.id} aria-pressed={tab === entry.id} onClick={() => { setTab(entry.id); setListening(null); setMessage(''); }}><MenuIcon id={entry.id} /><span>{entry.label}</span></button>)}</nav>
    <section className="preferences-board" aria-label={active.label}>
      <div className="preferences-identity"><MenuIcon id={active.id} size={72} /><h2>{active.label}</h2><p>{active.description}</p></div>
      <div className="preferences-content">
        {tab === 'sound' && <div className="preference-setting"><label htmlFor="master-volume">Volume général <strong>{Math.round(settings.volume * 100)} %</strong></label><input id="master-volume" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(event) => setSettings({ ...settings, volume: Number(event.target.value) })} /></div>}
        {tab === 'controls' && <><div className="preferences-bindings">{ACTIONS.map((action) => <button key={action.id} className={listening === action.id ? 'is-listening' : ''} aria-label={`${action.label} : ${listening === action.id ? 'en attente' : keyLabel(settings.bindings[action.id])}`} onClick={() => { setMessage(''); setListening(listening === action.id ? null : action.id); }}><span>{action.label}</span><kbd>{listening === action.id ? '…' : keyLabel(settings.bindings[action.id])}</kbd></button>)}</div><p className="preferences-help">{listening ? 'Appuyez sur une touche · Échap pour annuler' : 'Cliquez sur une touche pour la modifier. Les flèches restent disponibles.'}</p><button className="preferences-reset" onClick={() => { setListening(null); setMessage('Commandes par défaut rétablies.'); setSettings({ ...settings, bindings: { ...DEFAULT_BINDINGS } }); }}>Rétablir les commandes</button></>}
        {tab === 'display' && <><div className="preference-setting preference-inline"><span>Plein écran</span><button className="preferences-mode" onClick={() => void fullscreen()}>{document.fullscreenElement ? 'Quitter le plein écran' : 'Activer'}</button></div><div className="preference-setting"><span>Intensité du néon</span><div className="preferences-choices">{([['off', 'Aucun'], ['low', 'Réduit'], ['full', 'Complet']] as const).map(([value, label]) => <button key={value} aria-pressed={settings.glow === value} onClick={() => setSettings({ ...settings, glow: value })}>{label}</button>)}</div></div></>}
        {tab === 'accessibility' && <><div className="preference-setting"><span>Taille de l’interface</span><div className="preferences-choices">{([0.9, 1, 1.15, 1.3] as const).map((scale) => <button key={scale} aria-pressed={settings.uiScale === scale} onClick={() => setSettings({ ...settings, uiScale: scale })}>{Math.round(scale * 100)} %</button>)}</div></div><div className="preference-setting preference-inline"><span>Contraste élevé</span>{switchControl('highContrast', 'Contraste élevé')}</div><div className="preference-setting preference-inline"><span>Réduire les animations</span>{switchControl('reduceMotion', 'Réduire les animations')}</div></>}
        <p className="preferences-status" role="status">{message}</p>
      </div>
    </section>
  </div>;
}
