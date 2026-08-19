export type ThemeMode = 'dark' | 'light' | 'system'

export interface Settings {
  fontFamily: string
  fontSize: number
  cursorStyle: 'block' | 'bar' | 'underline'
  accentColor: string
  defaultShell: string
  themeMode: ThemeMode
}

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: '"Cascadia Code", Consolas, monospace',
  fontSize: 14,
  cursorStyle: 'block',
  accentColor: '#7c6cff',
  defaultShell: 'powershell',
  themeMode: 'system'
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

export function applyAccentColor(color: string): void {
  document.documentElement.style.setProperty('--user-accent', color)
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

export const TERMINAL_COLORS = {
  dark: { background: '#0b0d14', foreground: '#d8dae8' },
  light: { background: '#f7f7fb', foreground: '#23253a' }
}
