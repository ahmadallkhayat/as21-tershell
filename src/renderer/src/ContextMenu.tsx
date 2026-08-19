import { useRef } from 'react'
import { useClampToViewport } from './useClampToViewport'

interface Props {
  x: number
  y: number
  canCopy: boolean
  onCopy: () => void
  onPaste: () => void
  onSplitRight: () => void
  onSplitDown: () => void
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
  onClosePane
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useClampToViewport(ref, true, [x, y])

  return (
    <div
      ref={ref}
      className="absolute z-30 min-w-[160px] overflow-hidden rounded-md border border-hover-strong bg-hover shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        disabled={!canCopy}
        className="block w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-hover-strong disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent"
        onMouseDown={(e) => {
          e.preventDefault()
          onCopy()
        }}
      >
        Copy
        <span className="ml-2 text-[10px] text-muted">Ctrl+Shift+C</span>
      </button>
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-hover-strong"
        onMouseDown={(e) => {
          e.preventDefault()
          onPaste()
        }}
      >
        Paste
        <span className="ml-2 text-[10px] text-muted">Ctrl+Shift+V</span>
      </button>
      <div className="border-t border-line" />
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-hover-strong"
        onMouseDown={(e) => {
          e.preventDefault()
          onSplitRight()
        }}
      >
        Split Right
        <span className="ml-2 text-[10px] text-muted">Ctrl+Shift+D</span>
      </button>
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-hover-strong"
        onMouseDown={(e) => {
          e.preventDefault()
          onSplitDown()
        }}
      >
        Split Down
        <span className="ml-2 text-[10px] text-muted">Ctrl+Shift+E</span>
      </button>
      <div className="border-t border-line" />
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-hover-strong"
        onMouseDown={(e) => {
          e.preventDefault()
          onClosePane()
        }}
      >
        Close Pane
        <span className="ml-2 text-[10px] text-muted">Ctrl+Shift+W</span>
      </button>
    </div>
  )
}
