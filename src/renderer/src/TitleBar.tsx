import { useEffect, useRef, useState } from 'react'
import { TOOLS } from './tools'
import {
  ClaudeLogo,
  ClineLogo,
  CloudflareLogo,
  FirebaseLogo,
  GitHubLogo,
  NetlifyLogo,
  OllamaLogo,
  ToolMonogramLogo,
  VercelLogo
} from './logos'
import {
  CloseIcon,
  DownloadIcon,
  GearIcon,
  MaximizeIcon,
  MinimizeIcon,
  PlusIcon,
  RestoreIcon,
  SpinnerIcon
} from './Icon'
import { useClampToViewport } from './useClampToViewport'
import { useDragScroll } from './useDragScroll'
import iconUrl from '../../../resources/icon.png'

interface Tab {
  id: string
  shellKey: string
  title: string
  logoId?: string
}

interface ShellOption {
  key: string
  name: string
}

interface Props {
  tabs: Tab[]
  activeId: string
  shells: ShellOption[]
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onAdd: (shellKey: string, initialCommand?: string, title?: string, logoId?: string) => void
  onRename: (id: string, title: string) => void
  onOpenSettings: () => void
}

const LOGOS: Record<string, (props: { className?: string }) => JSX.Element> = {
  'claude-code': ClaudeLogo,
  cline: ClineLogo,
  github: GitHubLogo,
  vercel: VercelLogo,
  netlify: NetlifyLogo,
  firebase: FirebaseLogo,
  cloudflare: CloudflareLogo,
  ollama: OllamaLogo
}

function toolLogo(id: string): (props: { className?: string }) => JSX.Element {
  return LOGOS[id] ?? ToolMonogramLogo
}

const DEFAULT_SHELLS: ShellOption[] = [
  { key: 'powershell', name: 'PowerShell' },
  { key: 'cmd', name: 'Command Prompt' }
]

function shellDotClass(shellKey: string): string {
  return shellKey === 'cmd' ? 'bg-cmd' : 'bg-powershell'
}

function TabIcon({ logoId, shellKey }: { logoId?: string; shellKey: string }): JSX.Element {
  if (logoId) {
    const LogoIcon = toolLogo(logoId)
    return <LogoIcon className="h-3 w-3 shrink-0" />
  }
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${shellDotClass(shellKey)}`} />
}

export default function TitleBar({
  tabs,
  activeId,
  shells,
  onSelect,
  onClose,
  onAdd,
  onRename,
  onOpenSettings
}: Props): JSX.Element {
  const [maximized, setMaximized] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [installedCommands, setInstalledCommands] = useState<string[] | null>(null)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const tabsRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuPopupRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useDragScroll(tabsRef)

  useEffect(() => {
    if (editingTabId) editInputRef.current?.select()
  }, [editingTabId])

  const startRename = (tab: Tab): void => {
    setEditingTabId(tab.id)
    setEditValue(tab.title)
  }

  const commitRename = (): void => {
    if (editingTabId) {
      const trimmed = editValue.trim()
      if (trimmed) onRename(editingTabId, trimmed)
    }
    setEditingTabId(null)
  }

  useClampToViewport(menuPopupRef, menuOpen, [installedCommands])

  useEffect(() => window.api.window.onMaximizedChange(setMaximized), [])

  useEffect(() => {
    window.api.listCommands().then(setInstalledCommands)
  }, [])

  // The installed-command cache is fetched once at launch, so it never
  // notices a tool the user just installed. Re-check (bypassing the main
  // process's cache) whenever the menu is about to be looked at, and when
  // the window regains focus after time spent in an install tab elsewhere.
  useEffect(() => {
    if (!menuOpen) return
    window.api.listCommands(true).then(setInstalledCommands)
  }, [menuOpen])

  useEffect(() => {
    const onFocus = (): void => {
      window.api.listCommands(true).then(setInstalledCommands)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  const shellOptions = shells.length > 0 ? shells : DEFAULT_SHELLS

  return (
    <div className="relative z-10 flex h-9 shrink-0 items-center justify-between border-b border-line bg-titlebar shadow-[0_2px_12px_rgba(0,0,0,0.35)] [-webkit-app-region:drag]">
      <div className="flex h-full min-w-0 flex-1 items-center gap-3 pl-2.5">
        <div className="flex shrink-0 items-center gap-2">
          <img src={iconUrl} alt="" draggable={false} className="h-4 w-4 rounded-[3px]" />
          <span className="text-xs font-semibold tracking-wide text-muted">AS21 Tershell</span>
        </div>
        <div
          ref={tabsRef}
          className="tabs flex h-full min-w-0 shrink items-center gap-1 overflow-x-auto overflow-y-hidden [-webkit-app-region:no-drag]"
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex h-[30px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 pl-2.5 pr-2 text-xs ${
                tab.id === activeId
                  ? 'border-accent bg-accent-soft text-bright'
                  : 'border-transparent text-muted hover:bg-hover/60 hover:text-fg'
              }`}
              onClick={() => onSelect(tab.id)}
              onDoubleClick={() => startRename(tab)}
            >
              <TabIcon logoId={tab.logoId} shellKey={tab.shellKey} />
              {editingTabId === tab.id ? (
                <input
                  ref={editInputRef}
                  value={editValue}
                  className="w-[120px] max-w-[160px] bg-transparent text-xs text-bright outline-none"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    else if (e.key === 'Escape') setEditingTabId(null)
                  }}
                />
              ) : (
                <span className="max-w-[160px] truncate" title={tab.title}>
                  {tab.title}
                </span>
              )}
              <button
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded hover:bg-hover-strong"
                title="Close tab"
                onClick={(e): void => {
                  e.stopPropagation()
                  onClose(tab.id)
                }}
              >
                <CloseIcon size={10} />
              </button>
            </div>
          ))}
        </div>
        <div className="relative shrink-0 [-webkit-app-region:no-drag]" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-accent"
            title="New tab"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <PlusIcon />
          </button>
          {menuOpen && (
            <div
              ref={menuPopupRef}
              role="menu"
              className="absolute left-0 top-full z-10 mt-1 w-max overflow-hidden rounded-md border border-hover-strong bg-hover shadow-lg"
            >
              {shellOptions.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs text-fg hover:bg-accent-soft"
                  onClick={() => {
                    onAdd(s.key)
                    setMenuOpen(false)
                  }}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${shellDotClass(s.key)}`} />
                  {s.name}
                </button>
              ))}
              <div className="flex items-center gap-1.5 border-t border-line px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted">
                Tools
                {installedCommands === null && <SpinnerIcon size={10} />}
              </div>
              {TOOLS.map((tool) => {
                const checking = installedCommands === null
                const installed = !checking && installedCommands.includes(tool.checkCommand)
                const LogoIcon = toolLogo(tool.id)
                return (
                  <button
                    key={tool.id}
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs text-fg hover:bg-accent-soft"
                    onClick={() => {
                      if (installed) {
                        onAdd('powershell', tool.checkCommand, tool.name, tool.id)
                      } else {
                        onAdd('powershell', tool.installCommand, `Install ${tool.name}`, tool.id)
                      }
                      setMenuOpen(false)
                    }}
                  >
                    <LogoIcon
                      className={`h-3 w-3 shrink-0 ${
                        checking ? 'animate-pulse text-hover-strong' : installed ? 'text-accent' : 'text-hover-strong'
                      }`}
                    />
                    <span className={`flex-1 ${checking ? 'animate-pulse' : ''}`}>{tool.name}</span>
                    {checking ? (
                      <SpinnerIcon size={10} className="text-muted" />
                    ) : (
                      !installed && (
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted">
                          <DownloadIcon size={10} />
                          Install
                        </span>
                      )
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <div className="flex h-full shrink-0 [-webkit-app-region:no-drag]">
        <button
          className="flex h-full w-11 items-center justify-center text-muted hover:bg-hover hover:text-bright"
          title="Settings"
          onClick={onOpenSettings}
        >
          <GearIcon />
        </button>
        <button
          className="flex h-full w-11 items-center justify-center text-muted hover:bg-hover hover:text-bright"
          title="Minimize"
          onClick={() => window.api.window.minimize()}
        >
          <MinimizeIcon />
        </button>
        <button
          className="flex h-full w-11 items-center justify-center text-muted hover:bg-hover hover:text-bright"
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={() => window.api.window.maximize()}
        >
          {maximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          className="flex h-full w-11 items-center justify-center text-muted hover:bg-danger hover:text-white"
          title="Close"
          onClick={() => window.api.window.close()}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
