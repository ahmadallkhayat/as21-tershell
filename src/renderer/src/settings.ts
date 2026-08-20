export type ThemeMode = 'dark' | 'light' | 'system'

export type ShellFamily = 'powershell' | 'cmd' | 'bash'

export interface ShellProfile {
  key: string
  name: string
  path: string
  args: string[]
  family: ShellFamily
  cwd?: string
  env?: Record<string, string>
  color: string
  supportsCwdTracking: boolean
}

export interface Settings {
  fontFamily: string
  fontSize: number
  cursorStyle: 'block' | 'bar' | 'underline'
  accentColor: string
  defaultShell: string
  themeMode: ThemeMode
  scrollback: number
  /** Reopen the previous session's tabs/panes on launch. */
  restoreSession: boolean
  /** Inject the shell's OSC 7 prompt hook so splits/duplicates can
   * inherit the pane's live working directory. */
  cwdTracking: boolean
  /** Per-profile starting-directory overrides, keyed by profile key. */
  profileCwd: Record<string, string>
  /** User-defined profiles, alongside the auto-detected ones. */
  customProfiles: ShellProfile[]
}

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: '"Cascadia Code", Consolas, monospace',
  fontSize: 14,
  cursorStyle: 'block',
  accentColor: '#7c6cff',
  defaultShell: 'powershell',
  themeMode: 'system',
  // xterm.js's own default (1000 lines) is small enough that a chatty
  // build or an AI agent's output silently truncates the top of what it
  // printed within a screenful of activity.
  scrollback: 5000,
  restoreSession: true,
  cwdTracking: true,
  profileCwd: {},
  customProfiles: []
}

export const FONT_OPTIONS = [
  '"Cascadia Code", Consolas, monospace',
  'Consolas, monospace',
  '"Courier New", monospace',
  '"JetBrains Mono", Consolas, monospace',
  '"Fira Code", Consolas, monospace'
]

export const ACCENT_PRESETS = [
  '#7c6cff',
  '#2563eb',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7'
]

const STORAGE_KEY = 'as21-tershell:settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

/** The profile list the UI actually works with: everything the main
 * process detected, plus the user's own profiles, with any per-profile
 * starting-directory override folded in. */
export function resolveProfiles(detected: ShellProfile[], settings: Settings): ShellProfile[] {
  return [...detected, ...settings.customProfiles].map((p) => ({
    ...p,
    cwd: settings.profileCwd[p.key] || p.cwd
  }))
}

export function applyAccentColor(color: string): void {
  document.documentElement.style.setProperty('--user-accent', color)
  document.documentElement.style.setProperty('--accent-contrast', contrastTextColor(color))
}

export function applyThemeMode(mode: ThemeMode): void {
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', mode)
  }
}

export function resolveThemeMode(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return mode
}

// Full 16-color ANSI palette per mode. Without this, only background/
// foreground were themed and the 16 ANSI colors fell back to xterm's
// defaults — which are tuned for a dark background, so in light mode
// bright program output (yellow/cyan/green especially) becomes hard or
// impossible to read.
export const TERMINAL_COLORS = {
  dark: {
    background: '#0b0d14',
    foreground: '#d8dae8',
    black: '#1a1d2b',
    red: '#ff5d5d',
    green: '#4ade80',
    yellow: '#facc15',
    blue: '#5b9dff',
    magenta: '#c084fc',
    cyan: '#34e2e2',
    white: '#d8dae8',
    brightBlack: '#6b7086',
    brightRed: '#ff8080',
    brightGreen: '#86efac',
    brightYellow: '#fde047',
    brightBlue: '#93c5fd',
    brightMagenta: '#e0aaff',
    brightCyan: '#67e8f9',
    brightWhite: '#f4f5fc'
  },
  light: {
    background: '#f7f7fb',
    foreground: '#23253a',
    black: '#23253a',
    red: '#dc2626',
    green: '#15803d',
    yellow: '#a16207',
    blue: '#2563eb',
    magenta: '#9333ea',
    cyan: '#0e7c8c',
    white: '#6b7086',
    brightBlack: '#4b5065',
    brightRed: '#ef4444',
    brightGreen: '#16a34a',
    brightYellow: '#ca8a04',
    brightBlue: '#3b82f6',
    brightMagenta: '#a855f7',
    brightCyan: '#0891b2',
    brightWhite: '#0a0b14'
  }
}

// Search-match highlight colors, themed the same way — the addon's
// decorations previously stayed hardcoded to dark-theme hex values
// regardless of mode, making them near-invisible in light mode.
export const SEARCH_COLORS = {
  dark: {
    matchBackground: '#2a2e42',
    matchBorder: '#7c6cff',
    matchOverviewRuler: '#7c6cff',
    activeMatchBackground: '#7c6cff',
    activeMatchBorder: '#f4f5fc',
    activeMatchColorOverviewRuler: '#f4f5fc'
  },
  light: {
    matchBackground: '#dcdee8',
    matchBorder: '#7c6cff',
    matchOverviewRuler: '#7c6cff',
    activeMatchBackground: '#7c6cff',
    activeMatchBorder: '#0a0b14',
    activeMatchColorOverviewRuler: '#0a0b14'
  }
}

/** Perceived-luminance-based black/white pick for legible text on top of an
 * arbitrary accent color — used instead of a hardcoded text-white, which
 * becomes illegible the moment the user picks a light accent. */
export function contrastTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#ffffff'
  const toLinear = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const r = toLinear(parseInt(m[1].slice(0, 2), 16))
  const g = toLinear(parseInt(m[1].slice(2, 4), 16))
  const b = toLinear(parseInt(m[1].slice(4, 6), 16))
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.4 ? '#0a0b14' : '#ffffff'
}
