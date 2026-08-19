export interface LeafPane {
  type: 'leaf'
  id: string
  shellKey: string
  initialCommand?: string
  title: string
  logoId?: string
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

export function createLeaf(shellKey: string, initialCommand?: string, title?: string, logoId?: string): LeafPane {
  return {
    type: 'leaf',
    id: nextPaneId(),
    shellKey,
    initialCommand,
    title: title ?? (shellKey === 'cmd' ? 'Command Prompt' : 'PowerShell'),
    logoId
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
  const children = node.children
    .map((c) => removeLeaf(c, id))
    .filter((c): c is PaneNode => c !== null)

  if (children.length === node.children.length) {
    // id wasn't in this subtree at all — recurse normally happened above,
    // nothing changed, return as-is.
    return { ...node, children }
  }
  if (children.length === 0) return null
  if (children.length === 1) return children[0]

  // Redistribute sizes evenly among the remaining children after a removal.
  const even = 100 / children.length
  return { ...node, children, sizes: children.map(() => even) }
}

export function updateSplitSizes(node: PaneNode, splitId: string, sizes: number[]): PaneNode {
  if (node.type === 'leaf') return node
  if (node.id === splitId) return { ...node, sizes }
  return { ...node, children: node.children.map((c) => updateSplitSizes(c, splitId, sizes)) }
}

export function renameLeaf(node: PaneNode, id: string, title: string): PaneNode {
  if (node.type === 'leaf') return node.id === id ? { ...node, title } : node
  return { ...node, children: node.children.map((c) => renameLeaf(c, id, title)) }
}
