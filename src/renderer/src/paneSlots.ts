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
    if (el) {
      if (this.slots.get(id) === el) return
      this.slots.set(id, el)
      this.notify()
      return
    }

    // A leaf whose position in the tree moves — e.g. splitting wraps it one
    // level deeper — unmounts its old slot div and mounts a new one for the
    // SAME pane id within the very same React commit: the old div's ref
    // fires with null here, and moments later the new div's ref fires with
    // an element. If we deleted synchronously on this null, a subscriber
    // (TerminalHost) could observe a "no slot" state in between and
    // unmount the portaled terminal — which is exactly the split-restarts-
    // the-terminal bug this store exists to prevent. Deferring the delete
    // to a microtask gives that synchronous re-registration a chance to
    // land first; if it does, `current` will have moved on and we skip the
    // delete entirely. Only a pane that's genuinely gone (nothing
    // re-registers its id) actually gets removed.
    const current = this.slots.get(id)
    if (current === undefined) return
    queueMicrotask(() => {
      if (this.slots.get(id) === current) {
        this.slots.delete(id)
        this.notify()
      }
    })
  }

  get = (id: string): HTMLElement | undefined => this.slots.get(id)

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach((l) => l())
  }
}

export const slotStore = new SlotStore()

export function useSlotElement(id: string): HTMLElement | undefined {
  return useSyncExternalStore(slotStore.subscribe, () => slotStore.get(id))
}
