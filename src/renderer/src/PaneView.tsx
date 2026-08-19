import { Fragment, useRef } from 'react'
import type { PaneNode } from './paneTree'
import type { Settings } from './settings'
import TerminalView from './TerminalView'

export interface PaneActions {
  onExit: (paneId: string) => void
  onTitleChange: (paneId: string, title: string) => void
  onFocus: (paneId: string) => void
  onSplitRight: (paneId: string) => void
  onSplitDown: (paneId: string) => void
  onClosePane: (paneId: string) => void
  onResizeSplit: (splitId: string, sizes: number[]) => void
  onFocusAdjacent: (direction: 1 | -1) => void
  onNewTab: () => void
  onNextTab: () => void
  onPrevTab: () => void
  onSelectTabIndex: (index: number) => void
}

interface Props {
  node: PaneNode
  tabActive: boolean
  focusedPaneId: string
  actions: PaneActions
  settings: Settings
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

export default function PaneView({ node, tabActive, focusedPaneId, actions, settings }: Props): JSX.Element {
  if (node.type === 'leaf') {
    const focused = tabActive && node.id === focusedPaneId
    return (
      <div
        className={`relative min-h-0 min-w-0 flex-1 ${focused ? 'ring-1 ring-inset ring-accent' : ''}`}
        onMouseDown={() => actions.onFocus(node.id)}
      >
        <TerminalView
          shellKey={node.shellKey}
          initialCommand={node.initialCommand}
          visible={tabActive}
          focused={focused}
          settings={settings}
          onExit={() => actions.onExit(node.id)}
          onTitleChange={(title) => actions.onTitleChange(node.id, title)}
          onNewTab={actions.onNewTab}
          onCloseTab={() => actions.onClosePane(node.id)}
          onNextTab={actions.onNextTab}
          onPrevTab={actions.onPrevTab}
          onSelectTabIndex={actions.onSelectTabIndex}
          onSplitRight={() => actions.onSplitRight(node.id)}
          onSplitDown={() => actions.onSplitDown(node.id)}
          onFocusAdjacent={actions.onFocusAdjacent}
        />
      </div>
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
              settings={settings}
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
