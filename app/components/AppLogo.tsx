type AppLogoProps = {
  className?: string;
  title?: string;
};

export default function AppLogo({ className = '', title = 'SACA UN TURNITO' }: AppLogoProps) {
  return (
    <span className={`app-logo ${className}`.trim()} aria-hidden={title ? undefined : 'true'}>
      <svg viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-label={title || undefined}>
        {title && <title>{title}</title>}
        <defs>
          <linearGradient id="turnito-blue" x1="10" y1="8" x2="54" y2="57" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5f73ff" />
            <stop offset="1" stopColor="#2949d9" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="58" height="58" rx="18" fill="url(#turnito-blue)" />
        <path d="M14 21.5a4.5 4.5 0 0 0 4.5-4.5h27a4.5 4.5 0 0 0 4.5 4.5v21a4.5 4.5 0 0 0-4.5 4.5h-27a4.5 4.5 0 0 0-4.5-4.5v-21Z" fill="#fff" />
        <path d="M22 25h11M22 31h8" fill="none" stroke="#c7d1ff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="39" cy="36" r="10" fill="#ff8060" />
        <path d="M39 30.5V36l3.8 2.4" fill="none" stroke="#fff" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="39" cy="36" r="1.6" fill="#fff" />
      </svg>
    </span>
  );
}
