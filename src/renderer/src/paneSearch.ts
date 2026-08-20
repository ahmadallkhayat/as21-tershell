import type { ISearchOptions } from '@xterm/addon-search'

export interface SearchResults {
  index: number
  count: number
}

export interface PaneSearchController {
  /** Runs the query so this pane highlights its matches and reports a
   * count, without being treated as the active match. */
  highlight(query: string, opts: ISearchOptions): void
  findNext(query: string, opts: ISearchOptions): boolean
  findPrevious(query: string, opts: ISearchOptions): boolean
  clear(): void
  getResults(): SearchResults
}

const controllers = new Map<string, PaneSearchController>()

/** Pane order for the active tab, left-to-right / top-to-bottom, so
 * cross-pane search advances in the order panes appear on screen rather
 * than in registration order. Owned by App, which is the only place that
 * knows the tab's layout. */
let activeTabPanes: string[] = []
let focusPane: ((paneId: string) => void) | null = null

export function registerPaneSearch(paneId: string, controller: PaneSearchController | null): void {
  if (controller) controllers.set(paneId, controller)
  else controllers.delete(paneId)
}

export function setActiveTabPanes(paneIds: string[]): void {
  activeTabPanes = paneIds
}

export function setFocusPaneHandler(handler: ((paneId: string) => void) | null): void {
  focusPane = handler
}

function orderedControllers(): { paneId: string; controller: PaneSearchController }[] {
  return activeTabPanes
    .map((paneId) => ({ paneId, controller: controllers.get(paneId) }))
    .filter((e): e is { paneId: string; controller: PaneSearchController } => !!e.controller)
}

/** Highlights the query in every pane of the active tab except the one
 * driving the search, so "all panes" shows matches everywhere at once and
 * every pane can report a count for the global tally. */
export function highlightOtherPanes(originPaneId: string, query: string, opts: ISearchOptions): void {
  for (const { paneId, controller } of orderedControllers()) {
    if (paneId === originPaneId) continue
    if (query) controller.highlight(query, opts)
    else controller.clear()
  }
}

export function clearOtherPanes(originPaneId: string): void {
  for (const { paneId, controller } of orderedControllers()) {
    if (paneId !== originPaneId) controller.clear()
  }
}

/** Global match tally across the active tab, plus where the origin pane's
 * current match sits within it — so the counter reads "7/23 across the
 * whole tab" instead of restarting at 1 in each pane. */
export function globalResults(originPaneId: string, originResults: SearchResults): SearchResults {
  let count = 0
  let index = -1
  for (const { paneId, controller } of orderedControllers()) {
    const local = paneId === originPaneId ? originResults : controller.getResults()
    if (paneId === originPaneId && local.index >= 0) index = count + local.index
    count += Math.max(0, local.count)
  }
  return { index, count }
}

/**
 * Advances the search across pane boundaries. Within a pane the addon
 * always wraps, so instead of letting it wrap we detect that we're sitting
 * on the pane's last match and hand off to the next pane that has any —
 * focusing it, since that's where the match the user is being shown lives.
 * Returns true if this call handled the move; false means the caller
 * should just search within its own pane as usual.
 */
export function advanceAcrossPanes(
  originPaneId: string,
  direction: 1 | -1,
  query: string,
  opts: ISearchOptions
): boolean {
  const panes = orderedControllers()
  if (panes.length <= 1) return false

  const originIdx = panes.findIndex((p) => p.paneId === originPaneId)
  if (originIdx === -1) return false

  const origin = panes[originIdx].controller.getResults()
  const atEdge =
    direction === 1
      ? origin.count === 0 || origin.index >= origin.count - 1
      : origin.count === 0 || origin.index <= 0
  if (!atEdge) return false

  // Walk outward from the origin, wrapping, for the next pane with matches.
  const len = panes.length
  for (let step = 1; step <= len; step++) {
    const target = panes[(((originIdx + direction * step) % len) + len) % len]
    if (target.paneId === originPaneId) break
    if (target.controller.getResults().count === 0) continue

    focusPane?.(target.paneId)
    if (direction === 1) target.controller.findNext(query, opts)
    else target.controller.findPrevious(query, opts)
    return true
  }
  return false
}
