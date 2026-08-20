import type { ReactNode } from 'react'

export interface IconProps {
  className?: string
  size?: number
}

const DEFAULT_SIZE = 14

/**
 * Base wrapper every UI-chrome icon renders through, so size, viewBox and
 * stroke weight stay identical across the whole app by construction —
 * individual icons only ever supply their own path/shape geometry.
 */
export function Icon({
  className,
  size = DEFAULT_SIZE,
  children
}: IconProps & { children: ReactNode }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

export function MinimizeIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M3 8H13" />
    </Icon>
  )
}

export function MaximizeIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="9" height="9" />
    </Icon>
  )
}

export function RestoreIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <rect x="5.5" y="2.5" width="8" height="8" />
      <path d="M2.5 5.5H10.5V13.5H2.5V5.5Z" fill="var(--color-titlebar)" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M8 3V13M3 8H13" />
    </Icon>
  )
}

export function DownloadIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M8 2.5V9.5" />
      <path d="M4.5 7L8 10.5L11.5 7" />
      <path d="M3 13.5H13" />
    </Icon>
  )
}

export function GearIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="2.5" />
      <path
        d="M12.2,8 L14.2,8 M10.97,10.97 L12.38,12.38 M8,12.2 L8,14.2 M5.03,10.97 L3.62,12.38
           M3.8,8 L1.8,8 M5.03,5.03 L3.62,3.62 M8,3.8 L8,1.8 M10.97,5.03 L12.38,3.62"
      />
    </Icon>
  )
}

export function ChevronUpIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M3.5 10.5L8 5.5L12.5 10.5" />
    </Icon>
  )
}

export function ChevronDownIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M3.5 5.5L8 10.5L12.5 5.5" />
    </Icon>
  )
}

export function FolderIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M2 4.5A1 1 0 0 1 3 3.5H6.5L8 5.5H13A1 1 0 0 1 14 6.5V12A1 1 0 0 1 13 13H3A1 1 0 0 1 2 12Z" />
    </Icon>
  )
}

export function SpinnerIcon({ className, size = DEFAULT_SIZE }: IconProps): JSX.Element {
  return (
    <Icon size={size} className={`animate-spin ${className ?? ''}`}>
      <circle cx="8" cy="8" r="5.5" strokeDasharray="19 34" />
    </Icon>
  )
}
