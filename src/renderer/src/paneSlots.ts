import { useSyncExternalStore } from 'react'

/**
 * Registry of the DOM node each leaf pane portals its TerminalView into,
 * keyed by the pane's permanent id. This is what lets a pane survive a
 * split/close restructure: PaneView's leaf divs come and go freely as the
 * tree reshapes, but TerminalHost (rendered in one flat, App-level list
 * keyed by pane id) reads a pane's *current* slot through this store and
 * re-targets its portal there — the portaled TerminalView's own React
 * subtree, and the xterm/PTY session inside it, are never torn down.
 */
class SlotStore {
  private slots = new Map<string, HTMLElement>()
  private listeners = new Set<() => void>()

  register = (id: string, el: HTMLElement | null): void => {
    const current = this.slots.get(id)
    if (el) {
      if (current === el) return
      this.slots.set(id, el)
    } else {
      if (!current) return
      this.slots.delete(id)
    }
    this.listeners.forEach((l) => l())
  }

  get = (id: string): HTMLElement | undefined => this.slots.get(id)

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export const slotStore = new SlotStore()

export function useSlotElement(id: string): HTMLElement | undefined {
  return useSyncExternalStore(slotStore.subscribe, () => slotStore.get(id))
}
