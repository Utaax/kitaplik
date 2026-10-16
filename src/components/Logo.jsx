// Kitaplık logosu: rafta duran üç kitap sırtı ve yaslanan bir kitap. Tek renkli, temaya uyar.
export const MOTTO = 'Kitaplığın, cebinde.';

export default function Logo({ size = 40, className = '' }) {
  return (
    <svg className={'logo ' + className} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Kitaplık logosu">
      <rect width="48" height="48" rx="12" fill="currentColor" />
      <g className="logo-ink">
        <rect x="12" y="13" width="6" height="22" rx="1.5" />
        <rect x="20" y="9.5" width="6" height="25.5" rx="1.5" />
        <rect x="28.5" y="14" width="6" height="21" rx="1.5" transform="rotate(16 34.5 35)" />
        <rect x="10.5" y="36" width="27" height="2.2" rx="1.1" />
      </g>
    </svg>
  );
}
