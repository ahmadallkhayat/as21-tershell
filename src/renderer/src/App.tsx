import { useCallback, useEffect, useRef, useState } from 'react'
import TitleBar from './TitleBar'
import PaneView, { type PaneActions } from './PaneView'
import TerminalHost from './TerminalHost'
import SettingsPanel from './SettingsPanel'
import ConfirmCloseDialog from './ConfirmCloseDialog'
import { busyProcessName } from './paneProcess'
import { slotStore } from './paneSlots'
import {
  applyAccentColor,
  applyThemeMode,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings
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
  countLeaves
} from './paneTree'

interface Tab {
  id: string
  root: PaneNode
  focusedPaneId: string
}

let tabSeq = 0

export default function App(): JSX.Element {
  const [shells, setShells] = useState<{ key: string; name: string }[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState<{ processNames: string[]; onConfirm: () => void } | null>(
    null
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

  // Ctrl+=/Ctrl+-/Ctrl+0, the zoom shortcuts every terminal/browser/editor
  // supports, but which this app only ever exposed through the settings
  // dialog's font-size field.
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
    (shellKey: string, initialCommand?: string, title?: string, logoId?: string) => {
      const leaf = createLeaf(shellKey, initialCommand, title, logoId)
      const id = `tab-${++tabSeq}`
      setTabs((prev) => [...prev, { id, root: leaf, focusedPaneId: leaf.id }])
      setActiveId(id)
    },
    []
  )

  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    window.api.listShells().then((list) => {
      setShells(list)
      addTab(settings.defaultShell || list[0]?.key || 'powershell')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTab])

  const renamePane = useCallback((tabId: string, paneId: string, title: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, root: renameLeaf(t.root, paneId, title) } : t))
    )
  }, [])

  /** Manual rename from double-clicking a tab, as opposed to renamePane's
   * other caller — the shell's own OSC title escape sequence — which
   * always targets a specific pane it already knows. This one only has a
   * tab id to go on, so it resolves that tab's currently-focused pane. */
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

  const splitPane = useCallback(
    (tabId: string, paneId: string, direction: 'row' | 'column') => {
      const tab = tabs.find((t) => t.id === tabId)
      const leaf = tab && findLeaf(tab.root, paneId)
      if (!tab || !leaf) return
      const newLeaf = createLeaf(leaf.shellKey)
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, root: splitLeaf(t.root, paneId, direction, newLeaf), focusedPaneId: newLeaf.id }
            : t
        )
      )
    },
    [tabs]
  )

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
    addTab(settings.defaultShell || shells[0]?.key || 'powershell')
  }, [addTab, shells, settings.defaultShell])

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
    return {
      id: tab.id,
      shellKey: focused?.shellKey ?? 'powershell',
      title: focused?.title ?? 'Terminal',
      logoId: focused?.logoId
    }
  })

  return (
    <div className="flex h-screen flex-col">
      <TitleBar
        tabs={titleBarTabs}
        activeId={activeId}
        shells={shells}
        onSelect={setActiveId}
        onClose={requestCloseTab}
        onAdd={addTab}
        onRename={renameTab}
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
              settings={settings}
              actions={actions}
            />
          ))
        })}
      </div>
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          shells={shells}
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
