export function BrandMark({ size = 42 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="logo-paper" x="5" y="4" width="30" height="32" rx="8" />
      <path className="logo-check" d="M12 20.5l5.2 5.2L28.5 14" />
      <path className="logo-fold" d="M25 4v8h10" />
      <circle className="logo-dot" cx="9" cy="9" r="2" />
    </svg>
  );
}
