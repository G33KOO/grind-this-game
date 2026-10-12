export function NeonLogo({ size = 96 }: { size?: number }) {
  return <svg className="neon-logo" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Grind It">
    <defs>
      <filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.4" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#logo-glow)">
      <polygon points="94,50 72,88.1 28,88.1 6,50 28,11.9 72,11.9" stroke="#2ee6c8" strokeWidth="2.2" />
      <polygon points="82,50 66,77.7 34,77.7 18,50 34,22.3 66,22.3" stroke="#2ee6c8" strokeWidth="1" opacity=".45" />
      <path d="M69.7 36.2 A24 24 0 1 0 74 50 H54" stroke="#ffa733" strokeWidth="4.5" />
    </g>
  </svg>;
}
