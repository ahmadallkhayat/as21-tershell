import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { modalBackdropVariants, modalCardVariants } from './motion'
import type { ShellProfile, ThemeMode } from './settings'
import { TOOLS } from './tools'
import { CloseIcon, KeyboardIcon } from './Icon'

export interface CommandItem {
  id: string
  title: string
  subtitle?: string
  category: 'Actions' | 'Shells' | 'Tools' | 'Tabs'
  shortcut?: string
  action: () => void
}

interface Props {
  profiles: ShellProfile[]
  openTabs: { id: string; title: string; index: number }[]
  activeTheme: ThemeMode
  onSelectTab: (id: string) => void
  onNewTab: (shellKey?: string, options?: { initialCommand?: string; title?: string; logoId?: string }) => void
  onSplitRight: () => void
  onSplitDown: () => void
  onCloseCurrentPane: () => void
  onFind: () => void
  onClearTerminal: () => void
  onZoom: (delta: number | 'reset') => void
  onToggleTheme: (mode: ThemeMode) => void
  onOpenSettings: () => void
  onShowShortcuts: () => void
  onShowAbout: () => void
  onClose: () => void
}

export default function CommandPalette({
  profiles,
  openTabs,
  activeTheme,
  onSelectTab,
  onNewTab,
  onSplitRight,
  onSplitDown,
  onCloseCurrentPane,
  onFind,
  onClearTerminal,
  onZoom,
  onToggleTheme,
  onOpenSettings,
  onShowShortcuts,
  onShowAbout,
  onClose
}: Props): JSX.Element {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const allCommands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      {
        id: 'new-tab',
        title: 'New Tab (Default Shell)',
        category: 'Actions',
        shortcut: 'Ctrl+Shift+T',
        action: () => onNewTab()
      },
      {
        id: 'split-right',
        title: 'Split Pane Right',
        category: 'Actions',
        shortcut: 'Ctrl+Shift+D',
        action: onSplitRight
      },
      {
        id: 'split-down',
        title: 'Split Pane Down',
        category: 'Actions',
        shortcut: 'Ctrl+Shift+E',
        action: onSplitDown
      },
      {
        id: 'close-pane',
        title: 'Close Focused Pane',
        category: 'Actions',
        shortcut: 'Ctrl+Shift+W',
        action: onCloseCurrentPane
      },
      {
        id: 'find',
        title: 'Find in Terminal',
        category: 'Actions',
        shortcut: 'Ctrl+Shift+F',
        action: onFind
      },
      {
        id: 'clear',
        title: 'Clear Terminal Buffer',
        category: 'Actions',
        shortcut: 'Ctrl+K',
        action: onClearTerminal
      },
      {
        id: 'zoom-in',
        title: 'Zoom In Font Size',
        category: 'Actions',
        shortcut: 'Ctrl++',
        action: () => onZoom(1)
      },
      {
        id: 'zoom-out',
        title: 'Zoom Out Font Size',
        category: 'Actions',
        shortcut: 'Ctrl+-',
        action: () => onZoom(-1)
      },
      {
        id: 'zoom-reset',
        title: 'Reset Font Size',
        category: 'Actions',
        shortcut: 'Ctrl+0',
        action: () => onZoom('reset')
      },
      {
        id: 'theme-toggle',
        title: `Switch Theme (Current: ${activeTheme})`,
        category: 'Actions',
        action: () => onToggleTheme(activeTheme === 'dark' ? 'light' : 'dark')
      },
      {
        id: 'open-settings',
        title: 'Open Settings',
        category: 'Actions',
        shortcut: 'Ctrl+,',
        action: onOpenSettings
      },
      {
        id: 'show-shortcuts',
        title: 'Keyboard Shortcuts Reference',
        category: 'Actions',
        shortcut: 'F1',
        action: onShowShortcuts
      },
      {
        id: 'show-about',
        title: 'About AS21 Tershell',
        category: 'Actions',
        action: onShowAbout
      }
    ]

    // Add Shell Profiles
    for (const p of profiles) {
      list.push({
        id: `shell-${p.key}`,
        title: `Open Shell: ${p.name}`,
        subtitle: p.path,
        category: 'Shells',
        action: () => onNewTab(p.key, { title: p.name })
      })
    }

    // Add Dev Tools
    for (const t of TOOLS) {
      list.push({
        id: `tool-${t.id}`,
        title: `Launch Tool: ${t.name}`,
        subtitle: t.checkCommand,
        category: 'Tools',
        action: () =>
          onNewTab('powershell', {
            initialCommand: t.checkCommand,
            title: t.name,
            logoId: t.id
          })
      })
    }

    // Add Open Tabs
    for (const tab of openTabs) {
      list.push({
        id: `tab-${tab.id}`,
        title: `Jump to Tab: ${tab.title}`,
        subtitle: `Tab #${tab.index + 1}`,
        category: 'Tabs',
        shortcut: `Ctrl+Shift+${tab.index + 1 <= 9 ? tab.index + 1 : ''}`,
        action: () => onSelectTab(tab.id)
      })
    }

    return list
  }, [
    profiles,
    openTabs,
    activeTheme,
    onSelectTab,
    onNewTab,
    onSplitRight,
    onSplitDown,
    onCloseCurrentPane,
    onFind,
    onClearTerminal,
    onZoom,
    onToggleTheme,
    onOpenSettings,
    onShowShortcuts,
    onShowAbout
  ])

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allCommands
    return allCommands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q))
    )
  }, [allCommands, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(
        (prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length)
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filteredCommands[selectedIndex]
      if (item) {
        item.action()
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <motion.div
      variants={modalBackdropVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/65 backdrop-blur-sm [-webkit-app-region:no-drag]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        variants={modalCardVariants}
        className="w-[560px] max-w-[90vw] overflow-hidden rounded-2xl border border-line/90 bg-titlebar/98 backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] [-webkit-app-region:no-drag]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <KeyboardIcon size={18} className="text-accent shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Type a command or search actions, shells, tools, tabs…"
            className="flex-1 bg-transparent text-sm text-bright placeholder:text-muted outline-none"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg"
            onClick={onClose}
          >
            <CloseIcon size={12} />
          </button>
        </div>

        <div ref={listRef} className="scroll-custom max-h-[60vh] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">No matching commands</div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={cmd.id}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-accent-soft text-bright font-medium ring-1 ring-accent/30'
                      : 'text-fg hover:bg-hover hover:text-bright'
                  }`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    cmd.action()
                    onClose()
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                        cmd.category === 'Actions'
                          ? 'bg-hover-strong text-muted'
                          : cmd.category === 'Shells'
                            ? 'bg-powershell/20 text-powershell'
                            : cmd.category === 'Tools'
                              ? 'bg-accent/20 text-accent'
                              : 'bg-surface text-muted'
                      }`}
                    >
                      {cmd.category}
                    </span>
                    <div className="truncate">
                      <span className="text-bright font-medium">{cmd.title}</span>
                      {cmd.subtitle && (
                        <span className="ml-2 truncate text-[10px] text-muted">{cmd.subtitle}</span>
                      )}
                    </div>
                  </div>

                  {cmd.shortcut && (
                    <kbd className="shrink-0 rounded border border-line/60 bg-surface/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line/60 bg-hover/30 px-4 py-2 text-[10px] text-muted">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Execute</span>
            <span>Esc Dismiss</span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </motion.div>
    </motion.div>
  )
}
