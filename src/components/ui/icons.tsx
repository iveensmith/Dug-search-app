import { type SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export function IconSearch(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

export function IconMapPin(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function IconPhone(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  )
}

export function IconRoute(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h7a4 4 0 000-8H9a4 4 0 010-8h6" />
    </svg>
  )
}

export function IconX(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
    </svg>
  )
}

export function IconUpload(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 16V4M6 10l6-6 6 6" />
      <path d="M4 20h16" />
    </svg>
  )
}

export function IconSend(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}

export function IconAlertCircle(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  )
}

export function IconShieldCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function IconLogOut(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}

export function IconClipboardList(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-3" />
      <path d="M9 12h6M9 16h6M9 8h1" />
    </svg>
  )
}

export function IconMessageCircle(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  )
}

export function IconStore(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 9l1.5-5h15L21 9M3 9v10a1 1 0 001 1h16a1 1 0 001-1V9M3 9h18" />
      <path d="M9 20v-6h6v6" />
    </svg>
  )
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0116 0v1" />
    </svg>
  )
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

export function IconLoader(props: IconProps) {
  return (
    <svg {...base} className={`animate-spin ${props.className ?? ''}`} {...props}>
      <circle cx="12" cy="12" r="10" opacity={0.25} />
      <path d="M12 2a10 10 0 0110 10" opacity={0.9} />
    </svg>
  )
}
