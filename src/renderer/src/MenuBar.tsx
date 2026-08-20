import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { dropdownVariants, submenuVariants } from './motion'
import type { ShellProfile, ThemeMode } from './settings'
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
  DownloadIcon,
  ExternalLinkIcon,
  FolderIcon,
  InfoIcon,
  KeyboardIcon,
  SpinnerIcon
} from './Icon'

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

export interface MenuBarProps {
  profiles: ShellProfile[]
  installedCommands: string[] | null
  activeTheme: ThemeMode
  hasActiveTab: boolean
  onNewTab: (shellKey?: string, options?: { initialCommand?: string; title?: string; logoId?: string }) => void
  onOpenFolder: () => void
  onSplitRight: () => void
  onSplitDown: () => void
  onClosePane: () => void
  onOpenSettings: () => void
  onExitApp: () => void
  onCopy: () => void
  onPaste: () => void
  onFind: () => void
  onClearTerminal: () => void
  onZoom: (delta: number | 'reset') => void
  onNextTab: () => void
  onPrevTab: () => void
  onToggleTheme: (mode: ThemeMode) => void
  onOpenCommandPalette?: () => void
  onShowAbout: () => void
  onShowShortcuts: () => void
}

type MenuId = 'file' | 'edit' | 'view' | 'terminal' | 'help'

interface MenuItemBase {
  type?: 'item' | 'divider' | 'submenu'
  label?: string
  shortcut?: string
  icon?: ReactNode
  action?: () => void
  disabled?: boolean
  checked?: boolean
  items?: MenuItemBase[]
}

export default function MenuBar({
  profiles,
  installedCommands,
  activeTheme,
  hasActiveTab,
  onNewTab,
  onOpenFolder,
  onSplitRight,
  onSplitDown,
  onClosePane,
  onOpenSettings,
  onExitApp,
  onCopy,
  onPaste,
  onFind,
  onClearTerminal,
  onZoom,
  onNextTab,
  onPrevTab,
  onToggleTheme,
  onOpenCommandPalette,
  onShowAbout,
  onShowShortcuts
}: MenuBarProps): JSX.Element {
  const [activeMenu, setActiveMenu] = useState<MenuId | null>(null)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const submenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openSubmenu = (label: string): void => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current)
      submenuTimeoutRef.current = null
    }
    setActiveSubmenu(label)
  }

  const closeSubmenuWithDelay = (): void => {
    if (submenuTimeoutRef.current) clearTimeout(submenuTimeoutRef.current)
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null)
    }, 200)
  }

  const cancelCloseSubmenu = (): void => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current)
      submenuTimeoutRef.current = null
    }
  }

  const openExternal = (url: string): void => {
    window.api.openExternal(url)
  }

  // Close menus when clicking outside
  useEffect(() => {
    if (!activeMenu) return
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Element | null
      if (
        containerRef.current?.contains(target as Node) ||
        target?.closest?.('[role="menu"], [role="menuitem"]')
      ) {
        return
      }
      setActiveMenu(null)
      setActiveSubmenu(null)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setActiveMenu(null)
        setActiveSubmenu(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [activeMenu])

  const menuHeaders: { id: MenuId; label: string }[] = [
    { id: 'file', label: 'File' },
    { id: 'edit', label: 'Edit' },
    { id: 'view', label: 'View' },
    { id: 'terminal', label: 'Terminal' },
    { id: 'help', label: 'Help' }
  ]

  const getMenuItems = (menuId: MenuId): MenuItemBase[] => {
    switch (menuId) {
      case 'file':
        return [
          {
            label: 'New Tab',
            shortcut: 'Ctrl+Shift+T',
            action: () => onNewTab()
          },
          {
            type: 'submenu',
            label: 'New Tab With',
            items: profiles.map((p) => ({
              label: p.name,
              icon: (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
              ),
              action: () => onNewTab(p.key, { title: p.name })
            }))
          },
          {
            label: 'Open Folder in New Tab…',
            icon: <FolderIcon size={12} className="text-muted" />,
            action: onOpenFolder
          },
          { type: 'divider' },
          {
            label: 'Split Pane Right',
            shortcut: 'Ctrl+Shift+D',
            disabled: !hasActiveTab,
            action: onSplitRight
          },
          {
            label: 'Split Pane Down',
            shortcut: 'Ctrl+Shift+E',
            disabled: !hasActiveTab,
            action: onSplitDown
          },
          { type: 'divider' },
          {
            label: 'Settings…',
            shortcut: 'Ctrl+,',
            action: onOpenSettings
          },
          { type: 'divider' },
          {
            label: 'Close Pane',
            shortcut: 'Ctrl+Shift+W',
            disabled: !hasActiveTab,
            action: onClosePane
          },
          {
            label: 'Exit',
            shortcut: 'Alt+F4',
            action: onExitApp
          }
        ]

      case 'edit':
        return [
          {
            label: 'Copy',
            shortcut: 'Ctrl+Shift+C',
            disabled: !hasActiveTab,
            action: onCopy
          },
          {
            label: 'Paste',
            shortcut: 'Ctrl+Shift+V',
            disabled: !hasActiveTab,
            action: onPaste
          },
          { type: 'divider' },
          {
            label: 'Find in Terminal…',
            shortcut: 'Ctrl+Shift+F',
            disabled: !hasActiveTab,
            action: onFind
          },
          {
            label: 'Clear Terminal Buffer',
            shortcut: 'Ctrl+K',
            disabled: !hasActiveTab,
            action: onClearTerminal
          }
        ]

      case 'view':
        return [
          ...(onOpenCommandPalette
            ? [
                {
                  label: 'Command Palette…',
                  shortcut: 'Ctrl+Shift+P',
                  action: onOpenCommandPalette
                },
                { type: 'divider' as const }
              ]
            : []),
          {
            label: 'Zoom In',
            shortcut: 'Ctrl+=',
            action: () => onZoom(1)
          },
          {
            label: 'Zoom Out',
            shortcut: 'Ctrl+-',
            action: () => onZoom(-1)
          },
          {
            label: 'Reset Zoom',
            shortcut: 'Ctrl+0',
            action: () => onZoom('reset')
          },
          { type: 'divider' },
          {
            label: 'Next Tab',
            shortcut: 'Ctrl+Tab',
            disabled: !hasActiveTab,
            action: onNextTab
          },
          {
            label: 'Previous Tab',
            shortcut: 'Ctrl+Shift+Tab',
            disabled: !hasActiveTab,
            action: onPrevTab
          },
          { type: 'divider' },
          {
            label: 'Theme: Dark',
            checked: activeTheme === 'dark',
            action: () => onToggleTheme('dark')
          },
          {
            label: 'Theme: Light',
            checked: activeTheme === 'light',
            action: () => onToggleTheme('light')
          },
          {
            label: 'Theme: System Default',
            checked: activeTheme === 'system',
            action: () => onToggleTheme('system')
          }
        ]

      case 'terminal':
        return [
          ...profiles.map((p) => ({
            label: `Launch ${p.name}`,
            icon: (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
            ),
            action: () => onNewTab(p.key, { title: p.name })
          })),
          { type: 'divider' as const },
          {
            type: 'submenu' as const,
            label: 'Install / Launch CLI Tools',
            items: TOOLS.map((tool) => {
              const checking = installedCommands === null
              const installed = !checking && installedCommands.includes(tool.checkCommand)
              const Logo = toolLogo(tool.id)
              return {
                label: tool.name,
                icon: (
                  <Logo
                    className={`h-3 w-3 shrink-0 ${
                      installed ? 'text-accent' : 'text-muted'
                    }`}
                  />
                ),
                shortcut: installed ? 'Installed' : 'Install',
                action: () => {
                  if (installed) {
                    onNewTab('powershell', {
                      initialCommand: tool.checkCommand,
                      title: tool.name,
                      logoId: tool.id
                    })
                  } else {
                    onNewTab('powershell', {
                      initialCommand: tool.installCommand,
                      title: `Install ${tool.name}`,
                      logoId: tool.id
                    })
                  }
                }
              }
            })
          }
        ]

      case 'help':
        return [
          {
            label: 'Keyboard Shortcuts',
            shortcut: 'F1',
            icon: <KeyboardIcon size={12} className="text-muted" />,
            action: onShowShortcuts
          },
          {
            label: 'GitHub Repository',
            icon: <ExternalLinkIcon size={12} className="text-muted" />,
            action: () => openExternal('https://github.com/ahmadallkhayat/as21-tershell')
          },
          {
            label: 'Report an Issue',
            icon: <ExternalLinkIcon size={12} className="text-muted" />,
            action: () => openExternal('https://github.com/ahmadallkhayat/as21-tershell/issues')
          },
          { type: 'divider' },
          {
            label: 'About AS21 Tershell…',
            icon: <InfoIcon size={12} className="text-muted" />,
            action: onShowAbout
          }
        ]
    }
  }

  const renderItem = (
    item: MenuItemBase,
    index: number,
    isSubmenuChild = false
  ): JSX.Element => {
    if (item.type === 'divider') {
      return <div key={`div-${index}`} className="my-1 border-t border-line/60" />
    }

    if (item.type === 'submenu') {
      const isOpen = activeSubmenu === item.label
      return (
        <div
          key={item.label || index}
          className="relative"
          onMouseEnter={() => openSubmenu(item.label || '')}
          onMouseLeave={closeSubmenuWithDelay}
        >
          <button
            type="button"
            className={`flex w-full items-center justify-between gap-3 rounded px-2.5 py-1.5 text-left text-xs transition-colors [-webkit-app-region:no-drag] select-none cursor-pointer ${
              isOpen
                ? 'bg-accent-soft text-accent font-medium'
                : 'text-fg hover:bg-hover hover:text-bright'
            } disabled:opacity-40`}
            disabled={item.disabled}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              openSubmenu(item.label || '')
            }}
          >
            <span className="flex items-center gap-2">
              {item.icon}
              <span>{item.label}</span>
            </span>
            <span className="text-[10px] text-muted">▶</span>
          </button>

          <AnimatePresence>
            {isOpen && item.items && item.items.length > 0 && (
              <motion.div
                role="menu"
                variants={submenuVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                onMouseEnter={cancelCloseSubmenu}
                onMouseLeave={closeSubmenuWithDelay}
                className="absolute left-full top-0 z-30 -ml-1.5 pl-3 min-w-[220px] [-webkit-app-region:no-drag]"
              >
                <div className="scroll-custom max-h-[70vh] overflow-y-auto rounded-lg border border-line/80 bg-titlebar/98 p-1 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.65)] [-webkit-app-region:no-drag]">
                  {item.items.map((subItem, sIdx) => renderItem(subItem, sIdx, true))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )
    }

    return (
      <button
        key={item.label || index}
        type="button"
        role="menuitem"
        disabled={item.disabled}
        className="flex w-full items-center justify-between gap-4 rounded px-2.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-hover hover:text-bright disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg [-webkit-app-region:no-drag] select-none cursor-pointer"
        onMouseEnter={() => {
          if (isSubmenuChild) {
            cancelCloseSubmenu()
          } else {
            closeSubmenuWithDelay()
          }
        }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (item.action && !item.disabled) {
            setActiveMenu(null)
            setActiveSubmenu(null)
            item.action()
          }
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {item.checked !== undefined && (
            <span className="flex h-3 w-3 items-center justify-center font-bold text-accent">
              {item.checked ? '✓' : ''}
            </span>
          )}
          {item.icon}
          <span className="truncate">{item.label}</span>
        </span>
        {item.shortcut && (
          <kbd className="shrink-0 rounded border border-line/60 bg-surface/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
            {item.shortcut}
          </kbd>
        )}
      </button>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex shrink-0 items-center gap-0.5 [-webkit-app-region:no-drag]"
    >
      {menuHeaders.map((header) => {
        const isOpen = activeMenu === header.id
        return (
          <div key={header.id} className="relative [-webkit-app-region:no-drag]">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all [-webkit-app-region:no-drag] ${
                isOpen
                  ? 'bg-accent-soft text-accent shadow-xs'
                  : 'text-muted hover:bg-hover hover:text-bright'
              }`}
              onClick={() => {
                setActiveMenu(isOpen ? null : header.id)
                setActiveSubmenu(null)
              }}
              onMouseEnter={() => {
                if (activeMenu) {
                  setActiveMenu(header.id)
                  setActiveSubmenu(null)
                }
              }}
            >
              {header.label}
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  role="menu"
                  variants={dropdownVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="absolute left-0 top-full z-50 mt-1 min-w-[210px] overflow-visible rounded-lg border border-line/80 bg-titlebar/95 p-1 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.65)] [-webkit-app-region:no-drag]"
                >
                  {getMenuItems(header.id).map((item, idx) => renderItem(item, idx))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
