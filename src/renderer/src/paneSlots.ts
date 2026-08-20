/**
 * Owns one long-lived DOM node per pane — the container each pane's
 * TerminalView is portaled into.
 *
 * The subtlety this exists to solve: `createPortal` is keyed on its
 * container, and React *unmounts and recreates* the whole portal subtree
 * whenever that container changes — it never relocates the existing DOM.
 * Meanwhile React freely reuses and recreates the layout tree's own divs
 * as panes split and collapse (splitting a leaf reuses its div as the new
 * split container and builds a fresh div for the original pane deeper
 * down). Portaling straight into those divs therefore tears down xterm and
 * kills the pty on every split.
 *
 * So the container is a plain node we create ourselves, once per pane id,
 * outside React's control. PaneView simply re-parents it into whatever div
 * currently represents that pane. Moving a node with appendChild preserves
 * its children, and the container object React holds never changes — so
 * the terminal inside is never unmounted, whatever the layout does.
 */
class SlotStore {
  private nodes = new Map<string, HTMLDivElement>()

  /** The stable container for a pane, created on first use. */
  acquire(id: string): HTMLDivElement {
    let node = this.nodes.get(id)
    if (!node) {
      node = document.createElement('div')
      // Fills its host exactly, and is itself a positioned ancestor so the
      // terminal's absolutely-placed overlays (dropdown, search, context
      // menu) resolve against the pane rather than the page.
      node.style.position = 'absolute'
      node.style.inset = '0'
      this.nodes.set(id, node)
    }
    return node
  }

  get(id: string): HTMLDivElement | undefined {
    return this.nodes.get(id)
  }

  /**
   * Drops containers for panes that no longer exist. Called with the full
   * set of live pane ids rather than releasing on unmount, because React
   * StrictMode unmounts and remounts components on purpose — releasing
   * there would throw away a container that is about to be used again, and
   * handing back a fresh one would remount the terminal, which is the very
   * thing this store prevents.
   */
  retainOnly(liveIds: Set<string>): void {
    for (const id of this.nodes.keys()) {
      if (!liveIds.has(id)) this.nodes.delete(id)
    }
  }
}

export const slotStore = new SlotStore()
