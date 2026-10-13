import type { Settings } from '../game/save';
import { SettingsBody } from './SettingsBody';
import { SpaceBackdrop } from './SpaceBackdrop';
export function SettingsPage({ settings, setSettings, onBack, inGame = false }: { settings: Settings; setSettings(value: Settings): void; onBack(): void; inGame?: boolean }) {
  return <section className={`shell title-screen classes-page preferences-screen${inGame ? ' modal-panel in-game' : ''}`} role={inGame ? 'dialog' : undefined} aria-modal={inGame || undefined} aria-label="Paramètres">
    {!inGame && <SpaceBackdrop />}<h1>Paramètres</h1>
    <SettingsBody settings={settings} setSettings={setSettings} />
    <footer className="preferences-return"><button onClick={onBack}>{inGame ? 'Retour au jeu' : 'Accueil'}</button></footer>
  </section>;
}
