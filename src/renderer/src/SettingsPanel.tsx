import { FONT_OPTIONS, type Settings } from './settings'

interface ShellOption {
  key: string
  name: string
}

interface Props {
  settings: Settings
  shells: ShellOption[]
  onChange: (settings: Settings) => void
  onClose: () => void
}

function fontLabel(fontFamily: string): string {
  return fontFamily.split(',')[0].replace(/"/g, '')
}

export default function SettingsPanel({ settings, shells, onChange, onClose }: Props): JSX.Element {
  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value })
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-[380px] rounded-lg border border-hover-strong bg-titlebar p-4 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-bright">Settings</span>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg"
            onClick={onClose}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M0 0L10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted">Accent color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => update('accentColor', e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-hover-strong bg-transparent"
              />
              <span className="text-xs text-fg">{settings.accentColor}</span>
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted">Font family</span>
            <select
              value={settings.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
              className="rounded border border-hover-strong bg-hover px-2 py-1.5 text-xs text-fg outline-none"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {fontLabel(f)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted">Font size</span>
            <input
              type="number"
              min={8}
              max={32}
              value={settings.fontSize}
              onChange={(e) => update('fontSize', Number(e.target.value) || settings.fontSize)}
              className="rounded border border-hover-strong bg-hover px-2 py-1.5 text-xs text-fg outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted">Cursor style</span>
            <select
              value={settings.cursorStyle}
              onChange={(e) => update('cursorStyle', e.target.value as Settings['cursorStyle'])}
              className="rounded border border-hover-strong bg-hover px-2 py-1.5 text-xs text-fg outline-none"
            >
              <option value="block">Block</option>
              <option value="bar">Bar</option>
              <option value="underline">Underline</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted">Default shell (new tabs)</span>
            <select
              value={settings.defaultShell}
              onChange={(e) => update('defaultShell', e.target.value)}
              className="rounded border border-hover-strong bg-hover px-2 py-1.5 text-xs text-fg outline-none"
            >
              {shells.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  )
}
