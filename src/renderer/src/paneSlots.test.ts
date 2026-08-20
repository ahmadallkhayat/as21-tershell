import { describe, expect, it, vi } from 'vitest'
import { slotStore } from './paneSlots'

function fakeEl(): HTMLElement {
  return {} as HTMLElement
}

describe('slotStore', () => {
  it('notifies subscribers when a slot is registered', () => {
    const listener = vi.fn()
    const unsub = slotStore.subscribe(listener)
    const el = fakeEl()
    slotStore.register('pane-notify', el)
    expect(slotStore.get('pane-notify')).toBe(el)
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('keeps a slot alive across a same-commit detach+reattach (the split-restart race)', async () => {
    const oldEl = fakeEl()
    const newEl = fakeEl()
    slotStore.register('pane-move', oldEl)

    // Simulates what React does when a leaf's position in the tree moves:
    // the old div's ref fires with null, then — synchronously, in the same
    // commit — the new div's ref fires with an element. A subscriber must
    // never observe "no slot" in between, or it unmounts the portaled
    // terminal (this was the actual bug behind "splitting restarts the
    // terminal").
    slotStore.register('pane-move', null)
    slotStore.register('pane-move', newEl)

    expect(slotStore.get('pane-move')).toBe(newEl)

    await Promise.resolve() // flush the deferred-delete microtask
    expect(slotStore.get('pane-move')).toBe(newEl)
  })

  it('actually removes a slot that is never re-registered', async () => {
    const el = fakeEl()
    slotStore.register('pane-gone', el)
    slotStore.register('pane-gone', null)
    // Still present synchronously — deletion is deferred.
    expect(slotStore.get('pane-gone')).toBe(el)

    await Promise.resolve()
    expect(slotStore.get('pane-gone')).toBeUndefined()
  })
})
