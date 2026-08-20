export interface LeafPane {
  type: 'leaf'
  id: string
  shellKey: string
  initialCommand?: string
  title: string
  logoId?: string
  /** Directory this pane's shell starts in. Undefined defers to the
   * profile's configured start directory (then the user's home). */
  cwd?: string
}

export interface SplitPane {
  type: 'split'
  id: string
  direction: 'row' | 'column'
  sizes: number[]
  children: PaneNode[]
}

export type PaneNode = LeafPane | SplitPane

let paneSeq = 0
export function nextPaneId(): string {
  return `pane-${++paneSeq}`
}

/** Pushes the id counter past every id in a restored tree. Without this a
 * session restored with `pane-7` would hand out `pane-1`, `pane-2`, ...
 * again for new panes and eventually collide with a live one — and pane
 * ids key the slot/pty/search registries, so a collision would cross two
 * panes' wires. */
export function reservePaneIds(nodes: PaneNode[]): void {
  let max = paneSeq
  const walk = (node: PaneNode): void => {
    if (node.type === 'leaf') {
      const n = Number(/^pane-(\d+)$/.exec(node.id)?.[1])
      if (Number.isFinite(n) && n > max) max = n
      return
    }
    node.children.forEach(walk)
  }
  nodes.forEach(walk)
  paneSeq = max
}

let tabSeq = 0
export function nextTabId(): string {
  return `tab-${++tabSeq}`
}

/** Same collision guard as reservePaneIds, for restored tab ids. */
export function reserveTabIds(ids: string[]): void {
  for (const id of ids) {
    const n = Number(/^tab-(\d+)$/.exec(id)?.[1])
    if (Number.isFinite(n) && n > tabSeq) tabSeq = n
  }
}

export interface CreateLeafOptions {
  initialCommand?: string
  title?: string
  logoId?: string
  cwd?: string
}

export function createLeaf(shellKey: string, options: CreateLeafOptions = {}): LeafPane {
  return {
    type: 'leaf',
    id: nextPaneId(),
    shellKey,
    initialCommand: options.initialCommand,
    title: options.title ?? 'Terminal',
    logoId: options.logoId,
    cwd: options.cwd
  }
}

export function findLeaf(node: PaneNode, id: string): LeafPane | null {
  if (node.type === 'leaf') return node.id === id ? node : null
  for (const child of node.children) {
    const found = findLeaf(child, id)
    if (found) return found
  }
  return null
}

export function collectLeaves(node: PaneNode): LeafPane[] {
  if (node.type === 'leaf') return [node]
  return node.children.flatMap(collectLeaves)
}

export function countLeaves(node: PaneNode): number {
  return node.type === 'leaf' ? 1 : node.children.reduce((sum, c) => sum + countLeaves(c), 0)
}

/** Splits the leaf with `id` into a new split node containing the original leaf plus a fresh one. */
export function splitLeaf(
  node: PaneNode,
  id: string,
  direction: 'row' | 'column',
  newLeaf: LeafPane
): PaneNode {
  if (node.type === 'leaf') {
    if (node.id !== id) return node
    return {
      type: 'split',
      id: nextPaneId(),
      direction,
      sizes: [50, 50],
      children: [node, newLeaf]
    }
  }
  return { ...node, children: node.children.map((c) => splitLeaf(c, id, direction, newLeaf)) }
}

/**
 * Removes the leaf with `id`. If its parent split ends up with only one
 * child left, that split collapses and is replaced by the remaining child.
 * Returns null if removing `id` would remove the tree's only leaf.
 */
export function removeLeaf(node: PaneNode, id: string): PaneNode | null {
  if (node.type === 'leaf') {
    return node.id === id ? null : node
  }

  const survivedIdx: number[] = []
  const children: PaneNode[] = []
  node.children.forEach((c, i) => {
    const result = removeLeaf(c, id)
    if (result !== null) {
      children.push(result)
      survivedIdx.push(i)
    }
  })

  if (children.length === node.children.length) {
    // id wasn't in this subtree — a descendant may still have changed
    // identity from its own removal, but if none did, keep this node's own
    // identity too rather than spreading a new object that only re-renders
    // everything for no reason.
    const unchanged = children.every((c, i) => c === node.children[i])
    return unchanged ? node : { ...node, children }
  }
  if (children.length === 0) return null
  if (children.length === 1) return children[0]

  // Redistribute only the removed leaf's freed size, scaling the
  // survivors' existing sizes up to fill it — sizes the user manually set
  // on panes that weren't touched by this removal are preserved relative
  // to each other, instead of every remaining pane snapping to even.
  const survivedSizes = survivedIdx.map((i) => node.sizes[i])
  const survivedTotal = survivedSizes.reduce((a, b) => a + b, 0)
  const sizes =
    survivedTotal > 0
      ? survivedSizes.map((s) => (s / survivedTotal) * 100)
      : children.map(() => 100 / children.length)

  return { ...node, children, sizes }
}

export function updateSplitSizes(node: PaneNode, splitId: string, sizes: number[]): PaneNode {
  if (node.type === 'leaf') return node
  if (node.id === splitId) return { ...node, sizes }
  const children = node.children.map((c) => updateSplitSizes(c, splitId, sizes))
  const unchanged = children.every((c, i) => c === node.children[i])
  return unchanged ? node : { ...node, children }
}

export function renameLeaf(node: PaneNode, id: string, title: string): PaneNode {
  if (node.type === 'leaf') return node.id === id ? { ...node, title } : node
  const children = node.children.map((c) => renameLeaf(c, id, title))
  const unchanged = children.every((c, i) => c === node.children[i])
  return unchanged ? node : { ...node, children }
}
