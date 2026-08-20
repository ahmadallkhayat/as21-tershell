import { Fragment, useRef } from 'react'
import type { PaneNode } from './paneTree'
import { slotStore } from './paneSlots'

export interface PaneActions {
  onExit: (paneId: string) => void
  onTitleChange: (paneId: string, title: string) => void
  onFocus: (paneId: string) => void
  onSplitRight: (paneId: string) => void
  onSplitDown: (paneId: string) => void
  onClosePane: (paneId: string) => void
  onResizeSplit: (splitId: string, sizes: number[]) => void
  onFocusAdjacent: (direction: 'left' | 'right' | 'up' | 'down') => void
  onNewTab: () => void
  onNextTab: () => void
  onPrevTab: () => void
  onSelectTabIndex: (index: number) => void
  onZoom: (delta: number | 'reset') => void
}

interface Props {
  node: PaneNode
  tabActive: boolean
  focusedPaneId: string
  actions: PaneActions
}

function Divider({
  direction,
  onDrag
}: {
  direction: 'row' | 'column'
  onDrag: (deltaPercent: number) => void
}): JSX.Element {
  const draggingRef = useRef(false)
  const lastPosRef = useRef(0)
  const containerSizeRef = useRef(1)

  return (
    <div
      className={
        direction === 'row'
          ? 'w-1 shrink-0 cursor-col-resize bg-line hover:bg-accent'
          : 'h-1 shrink-0 cursor-row-resize bg-line hover:bg-accent'
      }
      onPointerDown={(e) => {
        draggingRef.current = true
        lastPosRef.current = direction === 'row' ? e.clientX : e.clientY
        const parent = e.currentTarget.parentElement
        containerSizeRef.current = parent
          ? direction === 'row'
            ? parent.clientWidth
            : parent.clientHeight
          : 1
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return
        const pos = direction === 'row' ? e.clientX : e.clientY
        const delta = pos - lastPosRef.current
        lastPosRef.current = pos
        onDrag((delta / containerSizeRef.current) * 100)
      }}
      onPointerUp={(e) => {
        draggingRef.current = false
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
    />
  )
}

/**
 * Pure layout: renders the split/leaf structure (flex tree + drag dividers
 * + focus ring) but never the terminal content itself. Each leaf is just a
 * slot div registered into `slotStore` under its permanent pane id — the
 * flat, App-level list of TerminalHost components portals the actual
 * TerminalView into whichever slot currently exists for that id. That
 * indirection is what lets this tree freely restructure (splitting,
 * closing siblings, collapsing) without ever unmounting a terminal: a
 * leaf's own div can come and go, but the pane id — and the portaled
 * TerminalView/xterm/PTY behind it — never does.
 */
export default function PaneView({ node, tabActive, focusedPaneId, actions }: Props): JSX.Element {
  if (node.type === 'leaf') {
    const focused = tabActive && node.id === focusedPaneId
    return (
      <div
        ref={(el) => slotStore.register(node.id, el)}
        className={`relative min-h-0 min-w-0 flex-1 ${focused ? 'ring-1 ring-inset ring-accent' : ''}`}
        onMouseDown={() => actions.onFocus(node.id)}
      />
    )
  }

  return (
    <div className={`flex h-full w-full min-h-0 min-w-0 ${node.direction === 'row' ? 'flex-row' : 'flex-col'}`}>
      {node.children.map((child, i) => (
        <Fragment key={child.id}>
          <div
            className="flex min-h-0 min-w-0"
            style={{ flex: `${node.sizes[i]} ${node.sizes[i]} 0%` }}
          >
            <PaneView
              node={child}
              tabActive={tabActive}
              focusedPaneId={focusedPaneId}
              actions={actions}
            />
          </div>
          {i < node.children.length - 1 && (
            <Divider
              direction={node.direction}
              onDrag={(deltaPercent) => {
                const sizes = [...node.sizes]
                const applied = Math.max(-sizes[i] + 5, Math.min(sizes[i + 1] - 5, deltaPercent))
                sizes[i] += applied
                sizes[i + 1] -= applied
                actions.onResizeSplit(node.id, sizes)
              }}
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}
