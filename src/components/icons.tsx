const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true, focusable: false } as const

export function GearIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" strokeLinecap="square" />
    </svg>
  )
}

export function SlidersIcon() {
  return (
    <svg {...base}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="square" />
      <rect x="14" y="5" width="4" height="4" />
      <rect x="8" y="15" width="4" height="4" />
    </svg>
  )
}

export function ArrowUpIcon() {
  return (
    <svg {...base}>
      <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="square" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg {...base} width={14} height={14}>
      <path d="M5 5l14 14M19 5 5 19" strokeLinecap="square" />
    </svg>
  )
}

export function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <path d={dir === 'left' ? 'M7.5 2 3.5 6l4 4' : 'M4.5 2l4 4-4 4'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  )
}

export function Diamond() {
  return (
    <svg className="diamond" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
      <path d="M5 0.8 9.2 5 5 9.2 0.8 5z" fill="currentColor" />
    </svg>
  )
}

export function MoveIcon({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg {...base} width={16} height={16}>
      <path d={dir === 'up' ? 'M6 14l6-6 6 6' : 'M6 10l6 6 6-6'} strokeLinecap="square" />
    </svg>
  )
}

// ─── Page icons (tab bar and "More" sheet) ──────────────────────────────────
const tab = { ...base, width: 22, height: 22, strokeWidth: 1.5 } as const

export function TodayIcon() {
  return (
    <svg {...tab}>
      <rect x="4" y="5" width="16" height="15" />
      <path d="M4 10h16M9 3v4M15 3v4" strokeLinecap="square" />
      <rect x="9.5" y="13" width="5" height="4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function WeekIcon() {
  return (
    <svg {...tab}>
      <rect x="3" y="5" width="18" height="14" />
      <path d="M7.5 5v14M12 5v14M16.5 5v14" />
    </svg>
  )
}

export function PlanIcon() {
  return (
    <svg {...tab}>
      <path d="M6 3v18" />
      <rect x="4.5" y="5" width="3" height="3" fill="currentColor" />
      <rect x="4.5" y="16" width="3" height="3" />
      <path d="M10 6.5h10M10 12h7M10 17.5h10" strokeLinecap="square" />
    </svg>
  )
}

export function ResourcesIcon() {
  return (
    <svg {...tab}>
      <path d="M5 4h9l5 5v11H5z" strokeLinejoin="miter" />
      <path d="M14 4v5h5M8.5 13h7M8.5 16.5h7" strokeLinecap="square" />
    </svg>
  )
}

export function AbsencesIcon() {
  return (
    <svg {...tab}>
      <rect x="4" y="5" width="16" height="15" />
      <path d="M4 10h16M9 3v4M15 3v4M9.5 12.5l5 5M14.5 12.5l-5 5" strokeLinecap="square" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg {...tab}>
      <path d="M4 20h16" strokeLinecap="square" />
      <path d="M4 16l5-5 4 3 7-8" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

export function SettingsIcon() {
  return (
    <svg {...tab}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" strokeLinecap="square" />
    </svg>
  )
}

export function MoreIcon() {
  return (
    <svg {...tab}>
      <rect x="4.5" y="4.5" width="5.5" height="5.5" />
      <rect x="14" y="4.5" width="5.5" height="5.5" />
      <rect x="4.5" y="14" width="5.5" height="5.5" />
      <rect x="14" y="14" width="5.5" height="5.5" />
    </svg>
  )
}
