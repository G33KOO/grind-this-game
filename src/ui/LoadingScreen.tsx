import { NeonLogo } from './NeonLogo';
import { SpaceBackdrop } from './SpaceBackdrop';
import './loading-screen.css';

export function LoadingScreen({ zone }: { zone: string }) {
  return <div className="loading-screen" role="status" aria-live="polite" aria-busy="true">
    <SpaceBackdrop />
    <div className="loading-content">
      <div className="loading-emblem"><div className="loading-orbit" aria-hidden="true" /><NeonLogo size={140} /></div>
      <h1 className="loading-wordmark" aria-label="Grind It">GRIND <span>IT</span></h1>
      <div className="loading-destination"><span>Chargement du monde</span><strong>{zone}</strong></div>
      <div className="loading-track" aria-hidden="true"><i /></div>
    </div>
  </div>;
}
