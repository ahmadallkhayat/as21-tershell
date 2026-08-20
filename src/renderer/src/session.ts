import { collectLeaves, reservePaneIds, type PaneNode } from './paneTree'

const SESSION_KEY = 'as21-tershell:session'

export interface PersistedTab {
  id: string
  root: PaneNode
  focusedPaneId: string
}

interface PersistedSession {
  version: 1
  tabs: PersistedTab[]
  activeId: string
}

/**
 * Strips anything that must not survive a restart. `initialCommand` is the
 * important one: it's how the tool launcher opens an "Install X" tab, and
 * replaying it on every launch would silently re-run installers. A restored
 * pane keeps its shell and directory, but starts at a plain prompt.
 *
 * Live cwds are captured at save time (see saveSession) so a restored pane
 * reopens where it was, not where it originally started.
 */
function sanitize(node: PaneNode): PaneNode {
  if (node.type === 'leaf') {
    const { initialCommand: _dropped, ...rest } = node
    return rest
  }
  return { ...node, children: node.children.map(sanitize) }
}

export function saveSession(
  tabs: PersistedTab[],
  activeId: string,
  liveCwd: (paneId: string) => string | undefined
): void {
  try {
    const withCwd = (node: PaneNode): PaneNode => {
      if (node.type === 'leaf') {
        return { ...node, cwd: liveCwd(node.id) ?? node.cwd }
      }
      return { ...node, children: node.children.map(withCwd) }
    }

    const payload: PersistedSession = {
      version: 1,
      tabs: tabs.map((t) => ({ ...t, root: sanitize(withCwd(t.root)) })),
      activeId
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch {
    // Persistence is best-effort; a quota error shouldn't break the app.
  }
}

/** Cheap shape check — localStorage is user-editable and survives version
 * changes, so a malformed or half-written payload must not take the app
 * down on launch. */
function isValidNode(node: unknown): node is PaneNode {
  if (!node || typeof node !== 'object') return false
  const n = node as Record<string, unknown>
  if (n.type === 'leaf') return typeof n.id === 'string' && typeof n.shellKey === 'string'
  if (n.type === 'split') {
    return (
      typeof n.id === 'string' &&
      (n.direction === 'row' || n.direction === 'column') &&
      Array.isArray(n.sizes) &&
      Array.isArray(n.children) &&
      n.children.length > 0 &&
      n.children.every(isValidNode)
    )
  }
  return false
}

export function loadSession(): { tabs: PersistedTab[]; activeId: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (parsed?.version !== 1 || !Array.isArray(parsed.tabs)) return null

    const tabs = parsed.tabs.filter(
      (t) => t && typeof t.id === 'string' && isValidNode(t.root)
    )
    if (tabs.length === 0) return null

    // Restored ids must be walled off before any new pane is created, or
    // the id counter would hand out ids that are already in use.
    reservePaneIds(tabs.map((t) => t.root))

    return {
      tabs: tabs.map((t) => ({
        ...t,
        // A saved focusedPaneId can point at a pane that no longer exists
        // if the payload was edited or partially written.
        focusedPaneId: collectLeaves(t.root).some((l) => l.id === t.focusedPaneId)
          ? t.focusedPaneId
          : (collectLeaves(t.root)[0]?.id ?? '')
      })),
      activeId: tabs.some((t) => t.id === parsed.activeId) ? parsed.activeId : tabs[0].id
    }
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}
