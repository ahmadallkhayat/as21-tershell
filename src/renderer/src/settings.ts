export interface Settings {
  fontFamily: string
  fontSize: number
  cursorStyle: 'block' | 'bar' | 'underline'
  accentColor: string
  defaultShell: string
}

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: '"Cascadia Code", Consolas, monospace',
  fontSize: 14,
  cursorStyle: 'block',
  accentColor: '#7c6cff',
  defaultShell: 'powershell'
}

export const FONT_OPTIONS = [
  '"Cascadia Code", Consolas, monospace',
  'Consolas, monospace',
  '"Courier New", monospace',
  '"JetBrains Mono", Consolas, monospace',
  '"Fira Code", Consolas, monospace'
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
