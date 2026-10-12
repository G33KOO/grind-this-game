import { useEffect, useState } from 'react';
import { DEFAULT_BINDINGS, type BindingAction, type Settings } from '../game/save';

const ACTIONS: { id: BindingAction; label: string }[] = [
  { id: 'up', label: 'Haut' },
  { id: 'down', label: 'Bas' },
  { id: 'left', label: 'Gauche' },
  { id: 'right', label: 'Droite' },
  { id: 'inventory', label: 'Inventaire' },
  { id: 'character', label: 'Personnage' },
];

const RESERVED = new Set(['Escape', 'Tab', 'Enter', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

type KeyboardLayoutMap = { get(code: string): string | undefined };

function useLayoutMap(): KeyboardLayoutMap | null {
  const [map, setMap] = useState<KeyboardLayoutMap | null>(null);
  useEffect(() => {
    const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<KeyboardLayoutMap> } }).keyboard;
    void keyboard?.getLayoutMap().then(setMap).catch(() => undefined);
  }, []);
  return map;
}

function keyLabel(code: string, map: KeyboardLayoutMap | null): string {
  const mapped = map?.get(code);
  if (mapped) return mapped.toUpperCase();
  return code.replace(/^Key/, '').replace(/^Digit/, '');
}

export function SettingsBody({ settings, setSettings }: { settings: Settings; setSettings: (value: Settings) => void }) {
  const [listening, setListening] = useState<BindingAction | null>(null);
  const [conflict, setConflict] = useState('');
  const layout = useLayoutMap();

  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') { setListening(null); return; }
      if (RESERVED.has(event.code)) { setConflict('Cette touche est réservée.'); return; }
      const bindings = { ...settings.bindings };
      const other = (Object.keys(bindings) as BindingAction[]).find((action) => action !== listening && bindings[action] === event.code);
      if (other) bindings[other] = bindings[listening];
      bindings[listening] = event.code;
      setConflict(other ? 'Les deux commandes ont échangé leur touche.' : '');
      setSettings({ ...settings, bindings });
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, settings, setSettings]);

  const toggle = (key: 'reduceMotion' | 'highContrast') => setSettings({ ...settings, [key]: !settings[key] });

  return <div className="settings-body">
    <section className="settings-group">
      <h3>Son</h3>
      <label className="setting-row">Volume général <input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(event) => setSettings({ ...settings, volume: Number(event.target.value) })} /><span>{Math.round(settings.volume * 100)} %</span></label>
    </section>

    <section className="settings-group">
      <h3>Commandes</h3>
      <p className="small-note">Cliquez sur une touche puis appuyez sur la nouvelle. Les flèches fonctionnent toujours. Les touches physiques sont conservées quelle que soit la disposition du clavier.</p>
      <div className="binding-grid">
        {ACTIONS.map((action) => <button key={action.id} className={`binding${listening === action.id ? ' listening' : ''}`} onClick={() => { setConflict(''); setListening(listening === action.id ? null : action.id); }}>
          <span>{action.label}</span><kbd>{listening === action.id ? '…' : keyLabel(settings.bindings[action.id], layout)}</kbd>
        </button>)}
      </div>
      {conflict && <p className="small-note" role="status">{conflict}</p>}
      <button onClick={() => { setListening(null); setConflict(''); setSettings({ ...settings, bindings: { ...DEFAULT_BINDINGS } }); }}>Rétablir les commandes par défaut</button>
    </section>

    <section className="settings-group">
      <h3>Graphismes</h3>
      <button onClick={() => { const fullscreen = !settings.fullscreen; setSettings({ ...settings, fullscreen }); if (fullscreen) void document.documentElement.requestFullscreen?.(); else if (document.fullscreenElement) void document.exitFullscreen(); }}>Plein écran : {settings.fullscreen ? 'activé' : 'désactivé'}</button>
      <div className="setting-row">Intensité du néon <div className="button-group">{([['full', 'Complet'], ['low', 'Réduit'], ['off', 'Aucun']] as const).map(([value, label]) => <button key={value} className={settings.glow === value ? 'selected' : ''} onClick={() => setSettings({ ...settings, glow: value })}>{label}</button>)}</div></div>
    </section>

    <section className="settings-group">
      <h3>Accessibilité</h3>
      <div className="setting-row">Taille de l’interface <div className="button-group">{([0.9, 1, 1.15, 1.3] as const).map((scale) => <button key={scale} className={settings.uiScale === scale ? 'selected' : ''} onClick={() => setSettings({ ...settings, uiScale: scale })}>{Math.round(scale * 100)} %</button>)}</div></div>
      <button role="switch" aria-checked={settings.highContrast} onClick={() => toggle('highContrast')}>Contraste élevé : {settings.highContrast ? 'activé' : 'désactivé'}</button>
      <button role="switch" aria-checked={settings.reduceMotion} onClick={() => toggle('reduceMotion')}>Réduire les animations : {settings.reduceMotion ? 'activé' : 'désactivé'}</button>
    </section>
  </div>;
}
