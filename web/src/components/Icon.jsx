// Minimal inline SVG icon set (stroke icons, 24x24 grid).
// Decorative by default; pass `title` to expose an accessible label.
const PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  tooth: (
    <path d="M12 5.5c-1.6-1.4-4.6-2-6.3-.4-2 1.9-1.4 5.3-.4 7.6.7 1.7.9 3.6 1.3 5.5.3 1.6 1 2.8 2 2.8 1.3 0 1.5-2.3 1.9-4 .3-1.2.8-1.8 1.5-1.8s1.2.6 1.5 1.8c.4 1.7.6 4 1.9 4 1 0 1.7-1.2 2-2.8.4-1.9.6-3.8 1.3-5.5 1-2.3 1.6-5.7-.4-7.6-1.7-1.6-4.7-1-6.3.4Z" />
  ),
  braces: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="5" />
      <path d="M3 12h18" />
      <rect x="6.5" y="10" width="3" height="4" rx="0.5" />
      <rect x="14.5" y="10" width="3" height="4" rx="0.5" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </>
  ),
  scalpel: (
    <>
      <path d="M14.5 3.5 20.5 9.5 10 20H4v-6Z" />
      <path d="m11.5 6.5 6 6" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9.5 15 1.8 1.8 3.2-3.3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  // Solid shape: style with `fill: currentColor; stroke: none`
  quote: (
    <path d="M5 7h5v5c0 3.6-1.8 6-5 7l-.8-1.8c1.8-.8 2.6-2.2 2.7-4.2H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm9 0h5v5c0 3.6-1.8 6-5 7l-.8-1.8c1.8-.8 2.6-2.2 2.7-4.2H14a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>
  ),
  phone: (
    <path d="M5 4h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2 4.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4Z" />
  ),
  facebook: (
    <path d="M14 8.5V7a1.5 1.5 0 0 1 1.5-1.5H17V2.5h-2.5A4.5 4.5 0 0 0 10 7v1.5H7.5v3H10v10h4v-10h2.5l.5-3Z" />
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17 7h.01" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  star: (
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
  ),
  building: (
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
      <path d="M15 9h4a1 1 0 0 1 1 1v11" />
      <path d="M3 21h18M8 8h3M8 12h3M8 16h3" />
    </>
  ),
};

function Icon({ name, size = 20, title, className }) {
  const labelled = Boolean(title);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : 'true'}
      focusable="false"
    >
      {labelled && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

export default Icon;
