import type { ReactNode } from 'react'
import { FONT_OPTIONS, type Settings, type ThemeMode } from './settings'
import ColorPicker from './ColorPicker'
import { CloseIcon } from './Icon'

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

function SectionLabel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="mb-2.5 mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted first:mt-0">
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-fg">{label}</span>
      {children}
    </label>
  )
}

const SELECT_CLASS =
  'rounded-md border border-hover-strong bg-hover px-2 py-1.5 text-xs text-fg outline-none focus:border-accent-line'

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
      <div className="w-[400px] overflow-hidden rounded-xl border border-hover-strong bg-titlebar shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm font-semibold text-bright">Settings</span>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg"
            onClick={onClose}
          >
            <CloseIcon size={11} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 pb-4">
          <SectionLabel>Appearance</SectionLabel>

          <Field label="Theme">
            <div className="flex overflow-hidden rounded-md border border-hover-strong">
              {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`px-2.5 py-1 text-[11px] capitalize ${
                    settings.themeMode === mode
                      ? 'bg-accent text-white'
                      : 'bg-hover text-muted hover:bg-hover-strong hover:text-fg'
                  }`}
                  onClick={() => update('themeMode', mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Accent color">
            <ColorPicker value={settings.accentColor} onChange={(hex) => update('accentColor', hex)} />
          </Field>

          <SectionLabel>Terminal</SectionLabel>

          <Field label="Font family">
            <select
              value={settings.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
              className={SELECT_CLASS}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {fontLabel(f)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Font size">
            <input
              type="number"
              min={8}
              max={32}
              value={settings.fontSize}
              onChange={(e) => update('fontSize', Number(e.target.value) || settings.fontSize)}
              className={`w-16 text-right ${SELECT_CLASS}`}
            />
          </Field>

          <Field label="Cursor style">
            <select
              value={settings.cursorStyle}
              onChange={(e) => update('cursorStyle', e.target.value as Settings['cursorStyle'])}
              className={SELECT_CLASS}
            >
              <option value="block">Block</option>
              <option value="bar">Bar</option>
              <option value="underline">Underline</option>
            </select>
          </Field>

          <SectionLabel>Behavior</SectionLabel>

          <Field label="Default shell">
            <select
              value={settings.defaultShell}
              onChange={(e) => update('defaultShell', e.target.value)}
              className={SELECT_CLASS}
            >
              {shells.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </div>
  )
}
