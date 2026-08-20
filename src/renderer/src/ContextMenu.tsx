import { useRef } from 'react'
import { motion } from 'framer-motion'
import { contextMenuVariants } from './motion'
import { useClampToViewport } from './useClampToViewport'

interface Props {
  x: number
  y: number
  canCopy: boolean
  onCopy: () => void
  onPaste: () => void
  onSplitRight: () => void
  onSplitDown: () => void
  onClear?: () => void
  onExportLog?: () => void
  onClosePane: () => void
}

export default function ContextMenu({
  x,
  y,
  canCopy,
  onCopy,
  onPaste,
  onSplitRight,
  onSplitDown,
  onClear,
  onExportLog,
  onClosePane
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useClampToViewport(ref, true, [x, y])

  return (
    <motion.div
      ref={ref}
      role="menu"
      variants={contextMenuVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute z-30 min-w-[190px] overflow-hidden rounded-lg border border-line/90 bg-titlebar/95 p-1 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.65)] [-webkit-app-region:no-drag]"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        role="menuitem"
        disabled={!canCopy}
        className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-hover hover:text-bright disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent"
        onMouseDown={(e) => {
          e.preventDefault()
          onCopy()
        }}
      >
        <span>Copy</span>
        <kbd className="rounded border border-line/60 bg-surface/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
          Ctrl+Shift+C
        </kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-hover hover:text-bright"
        onMouseDown={(e) => {
          e.preventDefault()
          onPaste()
        }}
      >
        <span>Paste</span>
        <kbd className="rounded border border-line/60 bg-surface/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
          Ctrl+Shift+V
        </kbd>
      </button>
      <div className="my-1 border-t border-line/60" />
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-hover hover:text-bright"
        onMouseDown={(e) => {
          e.preventDefault()
          onSplitRight()
        }}
      >
        <span>Split Right</span>
        <kbd className="rounded border border-line/60 bg-surface/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
          Ctrl+Shift+D
        </kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-hover hover:text-bright"
        onMouseDown={(e) => {
          e.preventDefault()
          onSplitDown()
        }}
      >
        <span>Split Down</span>
        <kbd className="rounded border border-line/60 bg-surface/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
          Ctrl+Shift+E
        </kbd>
      </button>
      {onClear && (
        <>
          <div className="my-1 border-t border-line/60" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-hover hover:text-bright"
            onMouseDown={(e) => {
              e.preventDefault()
              onClear()
            }}
          >
            <span>Clear Buffer</span>
            <kbd className="rounded border border-line/60 bg-surface/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
              Ctrl+K
            </kbd>
          </button>
        </>
      )}
      {onExportLog && (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-hover hover:text-bright"
          onMouseDown={(e) => {
            e.preventDefault()
            onExportLog()
          }}
        >
          <span>Export Log to File…</span>
        </button>
      )}
      <div className="my-1 border-t border-line/60" />
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-hover hover:text-danger"
        onMouseDown={(e) => {
          e.preventDefault()
          onClosePane()
        }}
      >
        <span>Close Pane</span>
        <kbd className="rounded border border-line/60 bg-surface/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
          Ctrl+Shift+W
        </kbd>
      </button>
    </motion.div>
  )
}
