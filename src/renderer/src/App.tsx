import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TitleBar from './TitleBar'
import PaneView, { type PaneActions } from './PaneView'
import TerminalHost from './TerminalHost'
import SettingsPanel from './SettingsPanel'
import ConfirmCloseDialog from './ConfirmCloseDialog'
import { busyProcessName } from './paneProcess'
import { getPaneCwd } from './paneCwd'
import { slotStore } from './paneSlots'
import { setActiveTabPanes, setFocusPaneHandler } from './paneSearch'
import { clearSession, loadSession, saveSession } from './session'
import {
  applyAccentColor,
  applyThemeMode,
  DEFAULT_SETTINGS,
  loadSettings,
  resolveProfiles,
  saveSettings,
  type Settings,
  type ShellProfile
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
}

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  // Restore is read once, during the very first render, so the persistence
  // effect below never observes an empty tab list and overwrite the saved
  // session before it has been read back.
  const [restored] = useState(() => (settings.restoreSession ? loadSession() : null))

  const [profiles, setProfiles] = useState<ShellProfile[]>([])
  // Terminals must not spawn until profiles are known. A restored session
  // renders its panes on the very first frame, and resolving a pane's
  // profile before the list arrives would silently fall back to the wrong
  // shell — badly wrong for a user-defined profile, which the main process
  // cannot look up by key at all.
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const initial = restored?.tabs ?? []
    reserveTabIds(initial.map((t) => t.id))
    return initial
  })
  const [activeId, setActiveId] = useState<string>(() => restored?.activeId ?? '')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState<{ processNames: string[]; onConfirm: () => void } | null>(
    null
  )

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
      shellKey: string,
      options: { initialCommand?: string; title?: string; logoId?: string; cwd?: string } = {}
    ) => {
      const leaf = createLeaf(shellKey, options)
      const id = nextTabId()
      setTabs((prev) => [...prev, { id, root: leaf, focusedPaneId: leaf.id }])
      setActiveId(id)
    },
    []
  )

  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    window.api.listProfiles().then((list) => {
      setProfiles(list)
      setProfilesLoaded(true)
      // Only open a starting tab when nothing was restored.
      setTabs((prev) => {
        if (prev.length > 0) return prev
        const key = list.some((p) => p.key === settings.defaultShell)
          ? settings.defaultShell
          : (list[0]?.key ?? 'powershell')
        const name = list.find((p) => p.key === key)?.name ?? 'Terminal'
        const leaf = createLeaf(key, { title: name })
        const id = nextTabId()
        setActiveId(id)
        return [{ id, root: leaf, focusedPaneId: leaf.id }]
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    onZoom: zoomFont
  })

  const titleBarTabs = tabs.map((tab) => {
    const focused = findLeaf(tab.root, tab.focusedPaneId)
    const shellKey = focused?.shellKey ?? 'powershell'
    return {
      id: tab.id,
      shellKey,
      title: focused?.title ?? 'Terminal',
      logoId: focused?.logoId,
      color: profileFor(shellKey)?.color
    }
  })

  return (
    <div className="flex h-screen flex-col">
      <TitleBar
        tabs={titleBarTabs}
        activeId={activeId}
        profiles={allProfiles}
        onSelect={setActiveId}
        onClose={requestCloseTab}
        onCloseOthers={requestCloseOtherTabs}
        onAdd={addTab}
        onRename={renameTab}
        onDuplicate={duplicateTab}
        onReorder={moveTab}
        onOpenFolder={openFolderInNewTab}
        onOpenSettings={() => setSettingsOpen(true)}
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
        {profilesLoaded && tabs.flatMap((tab) => {
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
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          profiles={allProfiles}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {confirmClose && (
        <ConfirmCloseDialog
          processNames={confirmClose.processNames}
          onConfirm={confirmClose.onConfirm}
          onCancel={() => setConfirmClose(null)}
        />
      )}
    </div>
  )
}
