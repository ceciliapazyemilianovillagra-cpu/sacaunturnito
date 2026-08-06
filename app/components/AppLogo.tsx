type AppLogoProps = {
  className?: string;
  title?: string;
};

export default function AppLogo({ className = '', title = 'SACA UN TURNITO' }: AppLogoProps) {
  return (
    <span className={`app-logo ${className}`.trim()}>
      <svg viewBox="0 0 64 64" role="img" aria-label={title}>
        <title>{title}</title>
        <defs>
          <linearGradient id="turnito-flow" x1="12" y1="11" x2="53" y2="53" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0a73df" />
            <stop offset="1" stopColor="#064785" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="58" height="58" rx="19" fill="#e9f3ff" />
        <path d="M45 16H27c-7.8 0-12 3.7-12 9.1s4.2 8.8 11.2 8.8h11.6c7 0 11.2 3.1 11.2 7.7S44.8 49 37.5 49H19" fill="none" stroke="url(#turnito-flow)" strokeWidth="8" strokeLinecap="round" />
        <circle cx="46.5" cy="16" r="5.5" fill="#78aff3" stroke="#e9f3ff" strokeWidth="2.5" />
        <circle cx="18" cy="49" r="4.7" fill="#064785" stroke="#e9f3ff" strokeWidth="2.5" />
      </svg>
    </span>
  );
}
