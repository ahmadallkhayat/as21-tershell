import type { ReactNode } from 'react'
import { DEFAULT_SETTINGS, FONT_OPTIONS, type Settings, type ThemeMode } from './settings'
import ColorPicker from './ColorPicker'
import { CloseIcon } from './Icon'
import { NumberInput, SegmentedControl, Select } from './ui'

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
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-fg">{label}</span>
      {children}
    </div>
  )
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
            <SegmentedControl<ThemeMode>
              value={settings.themeMode}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'System' }
              ]}
              onChange={(mode) => update('themeMode', mode)}
            />
          </Field>

          <Field label="Accent color">
            <ColorPicker value={settings.accentColor} onChange={(hex) => update('accentColor', hex)} />
          </Field>

          <SectionLabel>Terminal</SectionLabel>

          <Field label="Font family">
            <Select
              value={settings.fontFamily}
              options={FONT_OPTIONS.map((f) => ({ value: f, label: fontLabel(f) }))}
              onChange={(f) => update('fontFamily', f)}
              minWidth={170}
            />
          </Field>

          <Field label="Font size">
            <NumberInput
              value={settings.fontSize}
              min={8}
              max={32}
              onChange={(n) => update('fontSize', n)}
            />
          </Field>

          <Field label="Cursor style">
            <Select
              value={settings.cursorStyle}
              options={[
                { value: 'block', label: 'Block' },
                { value: 'bar', label: 'Bar' },
                { value: 'underline', label: 'Underline' }
              ]}
              onChange={(v) => update('cursorStyle', v as Settings['cursorStyle'])}
              minWidth={130}
            />
          </Field>

          <Field label="Scrollback">
            <Select
              value={String(settings.scrollback)}
              options={[
                { value: '1000', label: '1,000 lines' },
                { value: '5000', label: '5,000 lines' },
                { value: '10000', label: '10,000 lines' },
                { value: '50000', label: '50,000 lines' }
              ]}
              onChange={(v) => update('scrollback', Number(v))}
              minWidth={130}
            />
          </Field>

          <SectionLabel>Behavior</SectionLabel>

          <Field label="Default shell">
            <Select
              value={settings.defaultShell}
              options={shells.map((s) => ({ value: s.key, label: s.name }))}
              onChange={(v) => update('defaultShell', v)}
              minWidth={170}
            />
          </Field>
        </div>

        <div className="flex items-center justify-end border-t border-line px-4 py-3">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-fg"
            onClick={() => onChange(DEFAULT_SETTINGS)}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  )
}
