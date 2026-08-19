import { useCallback, useEffect, useRef, useState } from 'react'
import TitleBar from './TitleBar'
import PaneView, { type PaneActions } from './PaneView'
import SettingsPanel from './SettingsPanel'
import { applyAccentColor, loadSettings, saveSettings, type Settings } from './settings'
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

  useEffect(() => {
    applyAccentColor(settings.accentColor)
  }, [settings.accentColor])

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next)
    saveSettings(next)
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

  const focusAdjacentPane = useCallback(
    (tabId: string, direction: 1 | -1) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab) return
      const leaves = collectLeaves(tab.root)
      if (leaves.length <= 1) return
      const idx = leaves.findIndex((l) => l.id === tab.focusedPaneId)
      const next = leaves[(idx + direction + leaves.length) % leaves.length]
      if (next) focusPane(tabId, next.id)
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
        onClose={closeTab}
        onAdd={addTab}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => {
          const actions: PaneActions = {
            onExit: (paneId) => closePane(tab.id, paneId),
            onTitleChange: (paneId, title) => renamePane(tab.id, paneId, title),
            onFocus: (paneId) => focusPane(tab.id, paneId),
            onSplitRight: (paneId) => splitPane(tab.id, paneId, 'row'),
            onSplitDown: (paneId) => splitPane(tab.id, paneId, 'column'),
            onClosePane: (paneId) => closePane(tab.id, paneId),
            onResizeSplit: (splitId, sizes) => resizeSplit(tab.id, splitId, sizes),
            onFocusAdjacent: (direction) => focusAdjacentPane(tab.id, direction),
            onNewTab: newTab,
            onNextTab: selectNextTab,
            onPrevTab: selectPrevTab,
            onSelectTabIndex: selectTabByIndex
          }
          const active = tab.id === activeId
          return (
            <div key={tab.id} className="absolute inset-0" style={{ display: active ? 'flex' : 'none' }}>
              <PaneView
                node={tab.root}
                tabActive={active}
                focusedPaneId={tab.focusedPaneId}
                actions={actions}
                settings={settings}
              />
            </div>
          )
        })}
        {tabs.length === 0 && (
          <div className="flex h-full items-center justify-center text-[13px] text-muted">
            No terminal sessions. Click + to start one.
          </div>
        )}
      </div>
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          shells={shells}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
