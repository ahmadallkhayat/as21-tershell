import { useState, type ReactNode } from 'react'
import {
  DEFAULT_SETTINGS,
  FONT_OPTIONS,
  type Settings,
  type ShellFamily,
  type ShellProfile,
  type ThemeMode
} from './settings'
import ColorPicker from './ColorPicker'
import { CloseIcon, FolderIcon, PlusIcon } from './Icon'
import { NumberInput, SegmentedControl, Select, TextInput } from './ui'

interface Props {
  settings: Settings
  profiles: ShellProfile[]
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

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <div className="text-xs text-fg">{label}</div>
        {hint && <div className="mt-0.5 text-[10px] leading-tight text-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        value ? 'bg-accent' : 'bg-hover-strong'
      }`}
      onClick={() => onChange(!value)}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
          value ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

/** Editor for one custom profile. Kept inline in the panel rather than in
 * its own dialog since a profile is only four fields. */
function CustomProfileRow({
  profile,
  onChange,
  onRemove
}: {
  profile: ShellProfile
  onChange: (next: ShellProfile) => void
  onRemove: () => void
}): JSX.Element {
  return (
    <div className="mb-2 rounded-md border border-hover-strong bg-hover p-2">
      <div className="mb-1.5 flex items-center gap-2">
        <TextInput
          value={profile.name}
          placeholder="Name"
          onChange={(name) => onChange({ ...profile, name })}
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          title="Remove profile"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:bg-hover-strong hover:text-danger"
          onClick={onRemove}
        >
          <CloseIcon size={10} />
        </button>
      </div>
      <TextInput
        value={profile.path}
        placeholder="Executable path"
        onChange={(path) => onChange({ ...profile, path })}
        className="mb-1.5 w-full"
      />
      <TextInput
        value={profile.args.join(' ')}
        placeholder="Arguments (space-separated)"
        onChange={(args) => onChange({ ...profile, args: args.split(' ').filter(Boolean) })}
        className="mb-1.5 w-full"
      />
      <div className="flex items-center gap-2">
        <TextInput
          value={profile.cwd ?? ''}
          placeholder="Starting directory (optional)"
          onChange={(cwd) => onChange({ ...profile, cwd: cwd || undefined })}
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          title="Browse…"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:bg-hover-strong hover:text-fg"
          onClick={async () => {
            const folder = await window.api.pickFolder(profile.cwd)
            if (folder) onChange({ ...profile, cwd: folder })
          }}
        >
          <FolderIcon size={11} />
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted">Command dialect</span>
        <Select
          value={profile.family}
          options={[
            { value: 'powershell', label: 'PowerShell' },
            { value: 'cmd', label: 'cmd' },
            { value: 'bash', label: 'bash' }
          ]}
          onChange={(family) => onChange({ ...profile, family: family as ShellFamily })}
          minWidth={110}
        />
      </div>
    </div>
  )
}

export default function SettingsPanel({ settings, profiles, onChange, onClose }: Props): JSX.Element {
  const [profilesOpen, setProfilesOpen] = useState(false)

  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value })
  }

  const detected = profiles.filter((p) => !settings.customProfiles.some((c) => c.key === p.key))

  const updateCustom = (index: number, next: ShellProfile): void => {
    const customProfiles = [...settings.customProfiles]
    customProfiles[index] = next
    update('customProfiles', customProfiles)
  }

  const addCustom = (): void => {
    update('customProfiles', [
      ...settings.customProfiles,
      {
        key: `custom-${Date.now().toString(36)}`,
        name: 'New profile',
        path: '',
        args: [],
        family: 'powershell',
        color: '#a855f7',
        supportsCwdTracking: true
      }
    ])
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-[440px] overflow-hidden rounded-xl border border-hover-strong bg-titlebar shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
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

        <div className="scroll-custom max-h-[70vh] overflow-y-auto px-4 pb-4">
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
              options={profiles.map((p) => ({ value: p.key, label: p.name }))}
              onChange={(v) => update('defaultShell', v)}
              minWidth={170}
            />
          </Field>

          <Field label="Restore tabs on launch" hint="Reopens last session's tabs and panes.">
            <Toggle value={settings.restoreSession} onChange={(v) => update('restoreSession', v)} />
          </Field>

          <Field
            label="Track working directory"
            hint="Lets splits and duplicates open in the current folder."
          >
            <Toggle value={settings.cwdTracking} onChange={(v) => update('cwdTracking', v)} />
          </Field>

          <SectionLabel>Shell profiles</SectionLabel>

          <button
            type="button"
            aria-expanded={profilesOpen}
            className="mb-2 w-full rounded-md border border-hover-strong bg-hover px-2.5 py-1.5 text-left text-xs text-fg hover:border-accent-line"
            onClick={() => setProfilesOpen((v) => !v)}
          >
            {profilesOpen ? 'Hide' : 'Show'} profiles ({profiles.length} available)
          </button>

          {profilesOpen && (
            <>
              {detected.map((profile) => (
                <div key={profile.key} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="flex min-w-0 items-center gap-2 text-xs text-fg">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: profile.color }}
                    />
                    <span className="truncate">{profile.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="max-w-[150px] truncate text-[10px] text-muted" title={profile.cwd}>
                      {profile.cwd ?? 'Home folder'}
                    </span>
                    <button
                      type="button"
                      title="Set starting directory"
                      className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-hover-strong hover:text-fg"
                      onClick={async () => {
                        const folder = await window.api.pickFolder(profile.cwd)
                        if (folder) {
                          update('profileCwd', { ...settings.profileCwd, [profile.key]: folder })
                        }
                      }}
                    >
                      <FolderIcon size={11} />
                    </button>
                    {settings.profileCwd[profile.key] && (
                      <button
                        type="button"
                        title="Reset to home folder"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-hover-strong hover:text-danger"
                        onClick={() => {
                          const { [profile.key]: _removed, ...rest } = settings.profileCwd
                          update('profileCwd', rest)
                        }}
                      >
                        <CloseIcon size={9} />
                      </button>
                    )}
                  </span>
                </div>
              ))}

              <div className="mb-2 mt-3 text-[10px] uppercase tracking-wider text-muted">Custom</div>
              {settings.customProfiles.map((profile, i) => (
                <CustomProfileRow
                  key={profile.key}
                  profile={profile}
                  onChange={(next) => updateCustom(i, next)}
                  onRemove={() =>
                    update(
                      'customProfiles',
                      settings.customProfiles.filter((_, idx) => idx !== i)
                    )
                  }
                />
              ))}
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-hover-strong px-2 py-1.5 text-xs text-muted hover:border-accent-line hover:text-fg"
                onClick={addCustom}
              >
                <PlusIcon size={11} />
                Add profile
              </button>
            </>
          )}
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
