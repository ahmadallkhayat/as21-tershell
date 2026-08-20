// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { slotStore } from './paneSlots'

beforeEach(() => {
  slotStore.retainOnly(new Set())
  document.body.innerHTML = ''
})

describe('slotStore', () => {
  it('returns the same container for a pane every time', () => {
    const first = slotStore.acquire('pane-1')
    expect(slotStore.acquire('pane-1')).toBe(first)
    expect(slotStore.acquire('pane-2')).not.toBe(first)
  })

  it('gives each container a positioned, full-bleed box', () => {
    const node = slotStore.acquire('pane-1')
    expect(node.style.position).toBe('absolute')
    expect(node.style.inset).toBe('0px')
  })

  /**
   * The invariant the whole design rests on. React's createPortal unmounts
   * and rebuilds its subtree whenever its container changes, so a pane's
   * container object must survive being moved between hosts — otherwise
   * splitting tears down xterm and kills the pty ("split makes it empty").
   */
  it('keeps the container object and its contents across a re-parent', () => {
    const container = slotStore.acquire('pane-1')
    const terminal = document.createElement('canvas')
    container.appendChild(terminal)

    const firstHost = document.createElement('div')
    document.body.appendChild(firstHost)
    firstHost.appendChild(container)

    // Simulates a split: the pane is now represented by a brand-new host
    // div nested deeper in the layout tree.
    const deeperHost = document.createElement('div')
    document.body.appendChild(deeperHost)
    deeperHost.appendChild(slotStore.acquire('pane-1'))

    expect(slotStore.acquire('pane-1')).toBe(container)
    expect(container.parentElement).toBe(deeperHost)
    expect(container.firstChild).toBe(terminal)
    expect(firstHost.childElementCount).toBe(0)
  })

  it('retainOnly drops containers for panes that are gone', () => {
    const kept = slotStore.acquire('pane-keep')
    slotStore.acquire('pane-drop')

    slotStore.retainOnly(new Set(['pane-keep']))

    expect(slotStore.get('pane-keep')).toBe(kept)
    expect(slotStore.get('pane-drop')).toBeUndefined()
    // Re-acquiring a kept pane must not mint a replacement.
    expect(slotStore.acquire('pane-keep')).toBe(kept)
  })

  it('hands out a fresh container after a pane is released', () => {
    const original = slotStore.acquire('pane-1')
    slotStore.retainOnly(new Set())
    expect(slotStore.acquire('pane-1')).not.toBe(original)
  })
})
