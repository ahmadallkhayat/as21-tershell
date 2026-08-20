import { describe, expect, it } from 'vitest'
import {
  collectLeaves,
  countLeaves,
  createLeaf,
  findLeaf,
  removeLeaf,
  renameLeaf,
  reservePaneIds,
  splitLeaf,
  updateSplitSizes,
  type PaneNode,
  type SplitPane
} from './paneTree'

describe('createLeaf', () => {
  it('falls back to a generic title', () => {
    expect(createLeaf('cmd').title).toBe('Terminal')
  })

  it('honors explicit options', () => {
    const leaf = createLeaf('powershell', {
      initialCommand: 'claude',
      title: 'Claude Code',
      logoId: 'claude-code',
      cwd: 'C:\\work'
    })
    expect(leaf.title).toBe('Claude Code')
    expect(leaf.logoId).toBe('claude-code')
    expect(leaf.initialCommand).toBe('claude')
    expect(leaf.cwd).toBe('C:\\work')
  })

  it('assigns each leaf a distinct id', () => {
    const a = createLeaf('powershell')
    const b = createLeaf('powershell')
    expect(a.id).not.toBe(b.id)
  })
})

describe('reservePaneIds', () => {
  it('never reissues an id already present in a restored tree', () => {
    // Simulates restoring a session whose panes were numbered far above
    // whatever this process has handed out so far.
    const restored: PaneNode = {
      type: 'split',
      id: 'split-restored',
      direction: 'row',
      sizes: [50, 50],
      children: [
        { type: 'leaf', id: 'pane-900', shellKey: 'powershell', title: 'a' },
        { type: 'leaf', id: 'pane-901', shellKey: 'cmd', title: 'b' }
      ]
    }
    reservePaneIds([restored])

    const fresh = createLeaf('powershell')
    expect(fresh.id).not.toBe('pane-900')
    expect(fresh.id).not.toBe('pane-901')
    expect(Number(/^pane-(\d+)$/.exec(fresh.id)![1])).toBeGreaterThan(901)
  })
})

describe('findLeaf / collectLeaves / countLeaves', () => {
  it('finds a leaf nested inside multiple splits', () => {
    const a = createLeaf('powershell')
    const b = createLeaf('cmd')
    const c = createLeaf('powershell')
    const inner = splitLeaf(a, a.id, 'row', b)
    const tree = splitLeaf(inner, a.id, 'column', c)

    expect(findLeaf(tree, a.id)?.id).toBe(a.id)
    expect(findLeaf(tree, b.id)?.id).toBe(b.id)
    expect(findLeaf(tree, 'nonexistent')).toBeNull()
    expect(collectLeaves(tree).map((l) => l.id).sort()).toEqual([a.id, b.id, c.id].sort())
    expect(countLeaves(tree)).toBe(3)
  })
})

describe('splitLeaf', () => {
  it('wraps the target leaf in a new split with the original and a new leaf', () => {
    const original = createLeaf('powershell')
    const fresh = createLeaf('cmd')
    const result = splitLeaf(original, original.id, 'row', fresh)

    expect(result.type).toBe('split')
    const split = result as SplitPane
    expect(split.direction).toBe('row')
    expect(split.sizes).toEqual([50, 50])
    expect(split.children.map((c) => c.id)).toEqual([original.id, fresh.id])
    // The original leaf object itself is preserved, not recreated — this is
    // what lets the portaled TerminalView survive a split without remounting.
    expect(split.children[0]).toBe(original)
  })

  it('leaves an unrelated leaf untouched', () => {
    const target = createLeaf('powershell')
    const other = createLeaf('cmd')
    const fresh = createLeaf('cmd')
    const tree = splitLeaf(target, target.id, 'row', other) as SplitPane
    const resplit = splitLeaf(tree, target.id, 'column', fresh) as SplitPane

    // `other`'s object identity survives a split elsewhere in the tree.
    expect(resplit.children[1]).toBe(other)
  })
})

describe('removeLeaf', () => {
  it('removing the only leaf in a tree yields null', () => {
    const leaf = createLeaf('powershell')
    expect(removeLeaf(leaf, leaf.id)).toBeNull()
  })

  it('collapses a two-child split down to the remaining child directly', () => {
    const a = createLeaf('powershell')
    const b = createLeaf('cmd')
    const tree = splitLeaf(a, a.id, 'row', b)

    const result = removeLeaf(tree, a.id)
    expect(result?.type).toBe('leaf')
    expect(result?.id).toBe(b.id)
  })

  it('preserves siblings’ relative proportions instead of resetting everyone to even', () => {
    const a = createLeaf('powershell')
    const b = createLeaf('cmd')
    const c = createLeaf('powershell')
    // splitLeaf only ever produces binary splits; a 3-way split (and the
    // uneven sizes a user could have dragged into place) is built directly
    // to exercise removeLeaf's general N-child redistribution.
    const tree: SplitPane = { type: 'split', id: 'root', direction: 'row', sizes: [20, 30, 50], children: [a, b, c] }

    const afterRemoveA = removeLeaf(tree, a.id) as SplitPane
    expect(afterRemoveA.children.map((c) => c.id)).toEqual([b.id, c.id])
    // b:c were 30:50 before removal — that ratio must be preserved, not
    // reset to an even 50/50 split.
    expect(afterRemoveA.sizes[0]).toBeCloseTo((30 / 80) * 100)
    expect(afterRemoveA.sizes[1]).toBeCloseTo((50 / 80) * 100)
    expect(afterRemoveA.sizes[0] + afterRemoveA.sizes[1]).toBeCloseTo(100)
  })

  it('returns the exact same object when the id is not present anywhere in the tree', () => {
    const a = createLeaf('powershell')
    const b = createLeaf('cmd')
    const tree = splitLeaf(a, a.id, 'row', b)

    expect(removeLeaf(tree, 'nonexistent')).toBe(tree)
  })

  it('leaves an untouched sibling subtree with the same object identity', () => {
    const a = createLeaf('powershell')
    const b = createLeaf('cmd')
    const c = createLeaf('powershell')
    const d = createLeaf('cmd')
    const left = splitLeaf(a, a.id, 'column', b) as SplitPane
    const right = splitLeaf(c, c.id, 'column', d) as SplitPane
    const root: SplitPane = { type: 'split', id: 'root', direction: 'row', sizes: [50, 50], children: [left, right] }

    const result = removeLeaf(root, a.id) as SplitPane
    // Removing `a` collapses `left` down to `b`, but `right` never
    // contained `a` and none of its own children changed either — it
    // should come back as the exact same object, not a new one that
    // happens to look identical, so its subtree never needlessly re-renders.
    expect(result.children[1]).toBe(right)
    expect(result.children[0].id).toBe(b.id)
  })
})

describe('updateSplitSizes / renameLeaf', () => {
  it('updates only the matching split', () => {
    const a = createLeaf('powershell')
    const b = createLeaf('cmd')
    const tree = splitLeaf(a, a.id, 'row', b) as SplitPane

    const updated = updateSplitSizes(tree, tree.id, [30, 70]) as SplitPane
    expect(updated.sizes).toEqual([30, 70])
    expect(updateSplitSizes(tree, 'nonexistent', [10, 90])).toBe(tree)
  })

  it('renames only the matching leaf', () => {
    const a = createLeaf('powershell')
    const b = createLeaf('cmd')
    const tree = splitLeaf(a, a.id, 'row', b) as SplitPane

    const renamed = renameLeaf(tree, b.id, 'my-tab') as SplitPane
    expect(findLeaf(renamed, b.id)?.title).toBe('my-tab')
    expect(findLeaf(renamed, a.id)?.title).toBe(a.title)
  })
})
