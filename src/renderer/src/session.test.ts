import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession, loadSession, saveSession, type PersistedTab } from './session'
import type { PaneNode } from './paneTree'

// jsdom isn't configured for this suite, so stand up the minimal
// localStorage the module touches.
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0
  } as unknown as Storage
})

function leaf(id: string, extra: Partial<PaneNode> = {}): PaneNode {
  return { type: 'leaf', id, shellKey: 'powershell', title: id, ...extra } as PaneNode
}

function tab(id: string, root: PaneNode): PersistedTab {
  return { id, root, focusedPaneId: root.type === 'leaf' ? root.id : '' }
}

describe('saveSession / loadSession', () => {
  it('round-trips tabs and the active id', () => {
    saveSession([tab('tab-1', leaf('pane-1'))], 'tab-1', () => undefined)
    const restored = loadSession()
    expect(restored?.activeId).toBe('tab-1')
    expect(restored?.tabs).toHaveLength(1)
    expect(restored?.tabs[0].root.id).toBe('pane-1')
  })

  it('drops initialCommand so install tabs never re-run on relaunch', () => {
    const withCommand = leaf('pane-1', {
      initialCommand: 'npm install -g something'
    } as Partial<PaneNode>)
    saveSession([tab('tab-1', withCommand)], 'tab-1', () => undefined)

    const root = loadSession()?.tabs[0].root
    expect(root && 'initialCommand' in root).toBe(false)
  })

  it('captures each pane’s live cwd at save time', () => {
    saveSession([tab('tab-1', leaf('pane-1'))], 'tab-1', (id) =>
      id === 'pane-1' ? 'C:\\projects\\app' : undefined
    )
    const root = loadSession()?.tabs[0].root
    expect(root?.type === 'leaf' && root.cwd).toBe('C:\\projects\\app')
  })

  it('keeps the configured cwd when the pane reports no live one', () => {
    saveSession([tab('tab-1', leaf('pane-1', { cwd: 'C:\\fallback' } as Partial<PaneNode>))], 'tab-1', () => undefined)
    const root = loadSession()?.tabs[0].root
    expect(root?.type === 'leaf' && root.cwd).toBe('C:\\fallback')
  })

  it('returns null rather than throwing on a corrupt payload', () => {
    store.set('as21-tershell:session', '{ not json')
    expect(loadSession()).toBeNull()
  })

  it('rejects a payload whose tabs are structurally invalid', () => {
    store.set(
      'as21-tershell:session',
      JSON.stringify({ version: 1, tabs: [{ id: 't', root: { type: 'bogus' } }], activeId: 't' })
    )
    expect(loadSession()).toBeNull()
  })

  it('repairs a focusedPaneId that no longer exists', () => {
    store.set(
      'as21-tershell:session',
      JSON.stringify({
        version: 1,
        tabs: [{ id: 'tab-1', root: leaf('pane-1'), focusedPaneId: 'pane-gone' }],
        activeId: 'tab-1'
      })
    )
    expect(loadSession()?.tabs[0].focusedPaneId).toBe('pane-1')
  })

  it('falls back to the first tab when activeId names a missing tab', () => {
    store.set(
      'as21-tershell:session',
      JSON.stringify({
        version: 1,
        tabs: [{ id: 'tab-1', root: leaf('pane-1'), focusedPaneId: 'pane-1' }],
        activeId: 'tab-nope'
      })
    )
    expect(loadSession()?.activeId).toBe('tab-1')
  })

  it('ignores a payload written by a future version', () => {
    store.set('as21-tershell:session', JSON.stringify({ version: 99, tabs: [], activeId: '' }))
    expect(loadSession()).toBeNull()
  })

  it('clearSession removes the stored payload', () => {
    saveSession([tab('tab-1', leaf('pane-1'))], 'tab-1', () => undefined)
    clearSession()
    expect(loadSession()).toBeNull()
  })
})
