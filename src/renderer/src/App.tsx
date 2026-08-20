import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import TitleBar from './TitleBar'
import PaneView, { type PaneActions } from './PaneView'
import TerminalHost from './TerminalHost'
import SettingsPanel from './SettingsPanel'
import ConfirmCloseDialog from './ConfirmCloseDialog'
import AboutDialog from './AboutDialog'
import ShortcutsDialog from './ShortcutsDialog'
import CommandPalette from './CommandPalette'
import { busyProcessName, getPanePty } from './paneProcess'
import { getPaneCwd } from './paneCwd'
import { slotStore } from './paneSlots'
import { openPaneSearch, setActiveTabPanes, setFocusPaneHandler } from './paneSearch'
import { clearSession, loadSession, saveSession } from './session'
import {
  applyAccentColor,
  applyThemeMode,
  DEFAULT_SETTINGS,
  loadSettings,
  resolveProfiles,
  saveSettings,
  type Settings,
  type ShellProfile,
  type ThemeMode
} from './settings'
import {
  type PaneNode,
  createLeaf,
  findLeaf,
  collectLeaves,
  splitLeaf,
  removeLeaf,
  updateSplitSizes,
  renameLeaf,
  countLeaves,
  reserveTabIds,
  nextTabId
} from './paneTree'

interface Tab {
  id: string
  root: PaneNode
  focusedPaneId: string
  customColor?: string
}

const DEFAULT_LOCAL_PROFILES: ShellProfile[] = [
  {
    key: 'powershell',
    name: 'Windows PowerShell',
    path: 'powershell.exe',
    args: ['-NoLogo'],
    family: 'powershell',
    color: '#5b9dff',
    supportsCwdTracking: true
  },
  {
    key: 'cmd',
    name: 'Command Prompt',
    path: 'cmd.exe',
    args: [],
    family: 'cmd',
    color: '#ffb454',
    supportsCwdTracking: false
  }
]

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  // Restore is read once, during the very first render, so the persistence
  // effect below never observes an empty tab list and overwrite the saved
  // session before it has been read back.
  const [restored] = useState(() => (settings.restoreSession ? loadSession() : null))

  const [profiles, setProfiles] = useState<ShellProfile[]>(DEFAULT_LOCAL_PROFILES)
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const initial = restored?.tabs ?? []
    reserveTabIds(initial.map((t) => t.id))
    if (initial.length > 0) return initial
    const key = settings.defaultShell || 'powershell'
    const name = key === 'cmd' ? 'Command Prompt' : 'Windows PowerShell'
    const leaf = createLeaf(key, { title: name })
    const id = nextTabId()
    return [{ id, root: leaf, focusedPaneId: leaf.id }]
  })
  const [activeId, setActiveId] = useState<string>(() => restored?.activeId ?? (tabs[0]?.id ?? ''))
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState<{ processNames: string[]; onConfirm: () => void } | null>(
    null
  )

  const setTabColor = useCallback((tabId: string, color?: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, customColor: color } : t)))
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') || e.key === 'F2') {
        e.preventDefault()
        setCommandPaletteOpen((v) => !v)
      } else if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setSettingsOpen((v) => !v)
      } else if (e.key === 'F1' || (e.ctrlKey && e.shiftKey && (e.key === '?' || e.key === '/'))) {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])

  /** Detected profiles plus the user's own, with per-profile starting
   * directory overrides folded in. */
  const allProfiles = useMemo(() => resolveProfiles(profiles, settings), [profiles, settings])

  const profileFor = useCallback(
    (key: string): ShellProfile | undefined => allProfiles.find((p) => p.key === key),
    [allProfiles]
  )

  useEffect(() => {
    applyAccentColor(settings.accentColor)
  }, [settings.accentColor])

  useEffect(() => {
    applyThemeMode(settings.themeMode)
  }, [settings.themeMode])

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }, [])

  const zoomFont = useCallback((delta: number | 'reset') => {
    setSettings((prev) => {
      const fontSize =
        delta === 'reset' ? DEFAULT_SETTINGS.fontSize : Math.max(8, Math.min(32, prev.fontSize + delta))
      const next = { ...prev, fontSize }
      saveSettings(next)
      return next
    })
  }, [])

  const addTab = useCallback(
    (
      shellKey?: string,
      options: { initialCommand?: string; title?: string; logoId?: string; cwd?: string } = {}
    ) => {
      const key = shellKey || settings.defaultShell || allProfiles[0]?.key || 'powershell'
      const leaf = createLeaf(key, options)
      const id = nextTabId()
      setTabs((prev) => [...prev, { id, root: leaf, focusedPaneId: leaf.id }])
      setActiveId(id)
    },
    [settings.defaultShell, allProfiles]
  )

  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    window.api.listProfiles().then((list) => {
      if (list && list.length > 0) {
        setProfiles(list)
      }
    })
  }, [])

  // Persist the session (debounced — tab state churns on every resize
  // drag). Live working directories are captured at save time so a
  // restored pane reopens where it was left, not where it first started.
  useEffect(() => {
    if (!settings.restoreSession) {
      clearSession()
      return
    }
    // Empty is saved too, so closing every tab and quitting doesn't
    // resurrect them on the next launch. Safe because the restore above
    // happens during the first render, before this effect ever runs.
    const timer = setTimeout(() => saveSession(tabs, activeId, getPaneCwd), 500)
    return () => clearTimeout(timer)
  }, [tabs, activeId, settings.restoreSession])

  const renamePane = useCallback((tabId: string, paneId: string, title: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, root: renameLeaf(t.root, paneId, title) } : t))
    )
  }, [])

  const renameTab = useCallback(
    (tabId: string, title: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (tab) renamePane(tabId, tab.focusedPaneId, title)
    },
    [tabs, renamePane]
  )

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      const next = prev.filter((t) => t.id !== id)
      setActiveId((current) => {
        if (current !== id) return current
        const fallback = next[idx] ?? next[idx - 1] ?? next[0]
        return fallback ? fallback.id : ''
      })
      return next
    })
  }, [])

  const closePane = useCallback(
    (tabId: string, paneId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab) return
      if (countLeaves(tab.root) <= 1) {
        closeTab(tabId)
        return
      }
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t
          const nextRoot = removeLeaf(t.root, paneId)
          if (!nextRoot) return t
          const leaves = collectLeaves(nextRoot)
          const focusedPaneId = t.focusedPaneId === paneId ? (leaves[0]?.id ?? '') : t.focusedPaneId
          return { ...t, root: nextRoot, focusedPaneId }
        })
      )
    },
    [tabs, closeTab]
  )

  /** Gate a destructive close behind a confirmation if any of the affected
   * panes still has a live foreground process (see paneProcess.ts) —
   * otherwise proceed immediately. */
  const requestClose = useCallback((paneIds: string[], perform: () => void) => {
    Promise.all(paneIds.map(busyProcessName)).then((names) => {
      const busy = names.filter((n): n is string => !!n)
      if (busy.length === 0) {
        perform()
        return
      }
      setConfirmClose({ processNames: busy, onConfirm: () => { setConfirmClose(null); perform() } })
    })
  }, [])

  const requestClosePane = useCallback(
    (tabId: string, paneId: string) => requestClose([paneId], () => closePane(tabId, paneId)),
    [requestClose, closePane]
  )

  const requestCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab) return
      requestClose(collectLeaves(tab.root).map((l) => l.id), () => closeTab(tabId))
    },
    [tabs, requestClose, closeTab]
  )

  const requestCloseOtherTabs = useCallback(
    (keepId: string) => {
      const others = tabs.filter((t) => t.id !== keepId)
      const paneIds = others.flatMap((t) => collectLeaves(t.root).map((l) => l.id))
      requestClose(paneIds, () => {
        setTabs((prev) => prev.filter((t) => t.id === keepId))
        setActiveId(keepId)
      })
    },
    [tabs, requestClose]
  )

  /** The directory a pane spawned from `paneId` should start in: wherever
   * that shell actually is right now if it reports its cwd, else whatever
   * that pane was configured to start in. */
  const inheritedCwd = useCallback(
    (tabId: string, paneId: string): string | undefined => {
      const tab = tabs.find((t) => t.id === tabId)
      const leaf = tab && findLeaf(tab.root, paneId)
      return getPaneCwd(paneId) ?? leaf?.cwd
    },
    [tabs]
  )

  const splitPane = useCallback(
    (tabId: string, paneId: string, direction: 'row' | 'column') => {
      const tab = tabs.find((t) => t.id === tabId)
      const leaf = tab && findLeaf(tab.root, paneId)
      if (!tab || !leaf) return
      const newLeaf = createLeaf(leaf.shellKey, {
        title: leaf.title,
        cwd: inheritedCwd(tabId, paneId)
      })
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, root: splitLeaf(t.root, paneId, direction, newLeaf), focusedPaneId: newLeaf.id }
            : t
        )
      )
    },
    [tabs, inheritedCwd]
  )

  const duplicateTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      const leaf = tab && findLeaf(tab.root, tab.focusedPaneId)
      if (!tab || !leaf) return
      // Deliberately a fresh single pane rather than a clone of the whole
      // split layout: duplicating means "another shell like this one, here",
      // and initialCommand is dropped so an install tab doesn't re-run.
      addTab(leaf.shellKey, {
        title: leaf.title,
        logoId: leaf.logoId,
        cwd: inheritedCwd(tabId, tab.focusedPaneId)
      })
    },
    [tabs, addTab, inheritedCwd]
  )

  const moveTab = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    setTabs((prev) => {
      const from = prev.findIndex((t) => t.id === draggedId)
      const to = prev.findIndex((t) => t.id === targetId)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const openFolderInNewTab = useCallback(async () => {
    const focusedTab = tabs.find((t) => t.id === activeId)
    const start = focusedTab ? inheritedCwd(focusedTab.id, focusedTab.focusedPaneId) : undefined
    const folder = await window.api.pickFolder(start)
    if (!folder) return
    const key = settings.defaultShell || allProfiles[0]?.key || 'powershell'
    addTab(key, { title: folder.split(/[\\/]/).pop() || folder, cwd: folder })
  }, [tabs, activeId, inheritedCwd, settings.defaultShell, allProfiles, addTab])

  const resizeSplit = useCallback((tabId: string, splitId: string, sizes: number[]) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, root: updateSplitSizes(t.root, splitId, sizes) } : t))
    )
  }, [])

  const focusPane = useCallback((tabId: string, paneId: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, focusedPaneId: paneId } : t)))
  }, [])

  /** True spatial pane navigation: reads each leaf's actual on-screen rect
   * (available now that terminals are portaled into stable slot divs — see
   * paneSlots.ts) and picks the nearest pane whose center lies in the
   * requested direction, rather than cycling flat tree order (which, in
   * anything but a single row/column of panes, routinely "moves left" into
   * a pane that isn't spatially adjacent at all). */
  const focusAdjacentPane = useCallback(
    (tabId: string, direction: 'left' | 'right' | 'up' | 'down') => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab) return
      const leaves = collectLeaves(tab.root)
      if (leaves.length <= 1) return
      const currentEl = slotStore.get(tab.focusedPaneId)
      if (!currentEl) return
      const currentRect = currentEl.getBoundingClientRect()
      const cx = currentRect.left + currentRect.width / 2
      const cy = currentRect.top + currentRect.height / 2

      let bestId: string | null = null
      let bestScore = Infinity
      for (const leaf of leaves) {
        if (leaf.id === tab.focusedPaneId) continue
        const el = slotStore.get(leaf.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        const dx = rect.left + rect.width / 2 - cx
        const dy = rect.top + rect.height / 2 - cy

        let primary: number
        let perpendicular: number
        if (direction === 'left') {
          if (dx >= -1) continue
          primary = -dx
          perpendicular = Math.abs(dy)
        } else if (direction === 'right') {
          if (dx <= 1) continue
          primary = dx
          perpendicular = Math.abs(dy)
        } else if (direction === 'up') {
          if (dy >= -1) continue
          primary = -dy
          perpendicular = Math.abs(dx)
        } else {
          if (dy <= 1) continue
          primary = dy
          perpendicular = Math.abs(dx)
        }

        // Favor panes aligned with the current one over merely-closer ones
        // that are off to the side.
        const score = primary + perpendicular * 2
        if (score < bestScore) {
          bestScore = score
          bestId = leaf.id
        }
      }
      if (bestId) focusPane(tabId, bestId)
    },
    [tabs, focusPane]
  )

  const newTab = useCallback(() => {
    const key = settings.defaultShell || allProfiles[0]?.key || 'powershell'
    addTab(key, { title: profileFor(key)?.name })
  }, [addTab, allProfiles, settings.defaultShell, profileFor])

  const selectNextTab = useCallback(() => {
    if (tabs.length === 0) return
    const idx = tabs.findIndex((t) => t.id === activeId)
    const next = tabs[(idx + 1) % tabs.length]
    if (next) setActiveId(next.id)
  }, [tabs, activeId])

  const selectPrevTab = useCallback(() => {
    if (tabs.length === 0) return
    const idx = tabs.findIndex((t) => t.id === activeId)
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length]
    if (prev) setActiveId(prev.id)
  }, [tabs, activeId])

  const selectTabByIndex = useCallback(
    (index: number) => {
      const tab = tabs[index]
      if (tab) setActiveId(tab.id)
    },
    [tabs]
  )

  useEffect(() => {
    if (tabs.length > 0) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'T') {
        e.preventDefault()
        newTab()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tabs.length, newTab])

  // Pane containers outlive individual React components on purpose (see
  // paneSlots.ts), so they're reclaimed here, by comparing against the
  // panes that actually still exist, rather than on unmount.
  useEffect(() => {
    slotStore.retainOnly(new Set(tabs.flatMap((t) => collectLeaves(t.root).map((l) => l.id))))
  }, [tabs])

  const activeTab = tabs.find((t) => t.id === activeId)

  // Cross-pane search needs to know the active tab's pane order (to step
  // through panes as they appear on screen) and how to focus one (to
  // reveal the pane a match was found in).
  useEffect(() => {
    setActiveTabPanes(activeTab ? collectLeaves(activeTab.root).map((l) => l.id) : [])
  }, [activeTab])

  useEffect(() => {
    if (!activeTab) return
    const tabId = activeTab.id
    setFocusPaneHandler((paneId) => focusPane(tabId, paneId))
    return () => setFocusPaneHandler(null)
  }, [activeTab, focusPane])

  const makeActions = (tabId: string): PaneActions => ({
    onExit: (paneId) => closePane(tabId, paneId),
    onTitleChange: (paneId, title) => renamePane(tabId, paneId, title),
    onFocus: (paneId) => focusPane(tabId, paneId),
    onSplitRight: (paneId) => splitPane(tabId, paneId, 'row'),
    onSplitDown: (paneId) => splitPane(tabId, paneId, 'column'),
    onClosePane: (paneId) => requestClosePane(tabId, paneId),
    onResizeSplit: (splitId, sizes) => resizeSplit(tabId, splitId, sizes),
    onFocusAdjacent: (direction) => focusAdjacentPane(tabId, direction),
    onNewTab: newTab,
    onNextTab: selectNextTab,
    onPrevTab: selectPrevTab,
    onSelectTabIndex: selectTabByIndex,
    onZoom: zoomFont,
    onOpenSettings: () => setSettingsOpen(true),
    onShowShortcuts: () => setShortcutsOpen(true)
  })

  const splitCurrentPane = useCallback(
    (direction: 'row' | 'column') => {
      const tab = tabs.find((t) => t.id === activeId)
      if (tab) splitPane(tab.id, tab.focusedPaneId, direction)
    },
    [tabs, activeId, splitPane]
  )

  const closeCurrentPane = useCallback(() => {
    const tab = tabs.find((t) => t.id === activeId)
    if (tab) requestClosePane(tab.id, tab.focusedPaneId)
  }, [tabs, activeId, requestClosePane])

  const copySelection = useCallback(() => {
    const selection = window.getSelection()?.toString()
    if (selection) {
      navigator.clipboard.writeText(selection)
    }
  }, [])

  const pasteToActive = useCallback(() => {
    const tab = tabs.find((t) => t.id === activeId)
    if (!tab) return
    const ptyId = getPanePty(tab.focusedPaneId)
    if (!ptyId) return
    navigator.clipboard.readText().then((text) => {
      if (text) window.api.write(ptyId, text)
    })
  }, [tabs, activeId])

  const findInActive = useCallback(() => {
    const tab = tabs.find((t) => t.id === activeId)
    if (tab) openPaneSearch(tab.focusedPaneId)
  }, [tabs, activeId])

  const clearActiveTerminal = useCallback(() => {
    const tab = tabs.find((t) => t.id === activeId)
    if (!tab) return
    const ptyId = getPanePty(tab.focusedPaneId)
    if (ptyId) window.api.write(ptyId, '\x0c')
  }, [tabs, activeId])

  const toggleThemeMode = useCallback(
    (mode: ThemeMode) => {
      updateSettings({ ...settings, themeMode: mode })
    },
    [settings, updateSettings]
  )

  const titleBarTabs = tabs.map((tab) => {
    const focused = findLeaf(tab.root, tab.focusedPaneId)
    const shellKey = focused?.shellKey ?? 'powershell'
    return {
      id: tab.id,
      shellKey,
      title: focused?.title ?? 'Terminal',
      logoId: focused?.logoId,
      color: profileFor(shellKey)?.color,
      customColor: tab.customColor
    }
  })

  const paletteOpenTabs = useMemo(
    () =>
      tabs.map((tab, index) => {
        const focused = findLeaf(tab.root, tab.focusedPaneId)
        return {
          id: tab.id,
          title: focused?.title ?? 'Terminal',
          index
        }
      }),
    [tabs]
  )

  return (
    <div
      className="flex h-screen flex-col transition-opacity"
      style={{ opacity: settings.backgroundOpacity ?? 1 }}
    >
      <TitleBar
        tabs={titleBarTabs}
        activeId={activeId}
        profiles={allProfiles}
        activeTheme={settings.themeMode}
        onSelect={setActiveId}
        onClose={requestCloseTab}
        onCloseOthers={requestCloseOtherTabs}
        onAdd={addTab}
        onRename={renameTab}
        onDuplicate={duplicateTab}
        onReorder={moveTab}
        onOpenFolder={openFolderInNewTab}
        onOpenSettings={() => setSettingsOpen(true)}
        onSplitRight={() => splitCurrentPane('row')}
        onSplitDown={() => splitCurrentPane('column')}
        onCloseCurrentPane={closeCurrentPane}
        onCopy={copySelection}
        onPaste={pasteToActive}
        onFind={findInActive}
        onClearTerminal={clearActiveTerminal}
        onZoom={zoomFont}
        onNextTab={selectNextTab}
        onPrevTab={selectPrevTab}
        onToggleTheme={toggleThemeMode}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onSetTabColor={setTabColor}
        onShowAbout={() => setAboutOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => {
          const actions = makeActions(tab.id)
          const active = tab.id === activeId
          return (
            <div key={tab.id} className="absolute inset-0" style={{ display: active ? 'flex' : 'none' }}>
              <PaneView node={tab.root} tabActive={active} focusedPaneId={tab.focusedPaneId} actions={actions} />
            </div>
          )
        })}
        {tabs.length === 0 && (
          <div className="flex h-full items-center justify-center text-[13px] text-muted">
            No terminal sessions. Click + to start one.
          </div>
        )}
        {tabs.flatMap((tab) => {
          const actions = makeActions(tab.id)
          const active = tab.id === activeId
          const isSplit = countLeaves(tab.root) > 1
          return collectLeaves(tab.root).map((leaf) => (
            <TerminalHost
              key={leaf.id}
              leaf={leaf}
              tabActive={active}
              focused={active && leaf.id === tab.focusedPaneId}
              isSplit={isSplit}
              customProfile={profileFor(leaf.shellKey)}
              settings={settings}
              actions={actions}
            />
          ))
        })}
      </div>
      <AnimatePresence>
        {commandPaletteOpen && (
          <CommandPalette
            profiles={allProfiles}
            openTabs={paletteOpenTabs}
            activeTheme={settings.themeMode}
            onSelectTab={setActiveId}
            onNewTab={addTab}
            onSplitRight={() => splitCurrentPane('row')}
            onSplitDown={() => splitCurrentPane('column')}
            onCloseCurrentPane={closeCurrentPane}
            onFind={findInActive}
            onClearTerminal={clearActiveTerminal}
            onZoom={zoomFont}
            onToggleTheme={toggleThemeMode}
            onOpenSettings={() => setSettingsOpen(true)}
            onShowShortcuts={() => setShortcutsOpen(true)}
            onShowAbout={() => setAboutOpen(true)}
            onClose={() => setCommandPaletteOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            profiles={allProfiles}
            onChange={updateSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmClose && (
          <ConfirmCloseDialog
            processNames={confirmClose.processNames}
            onConfirm={confirmClose.onConfirm}
            onCancel={() => setConfirmClose(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
