import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { contextMenuVariants } from './motion'
import { useClampToViewport } from './useClampToViewport'
import { ACCENT_PRESETS } from './settings'

interface Props {
  x: number
  y: number
  canCloseOthers: boolean
  onRename: () => void
  onDuplicate: () => void
  onSetColor?: (color?: string) => void
  onClose: () => void
  onCloseOthers: () => void
  onDismiss: () => void
}

export default function TabContextMenu({
  x,
  y,
  canCloseOthers,
  onRename,
  onDuplicate,
  onSetColor,
  onClose,
  onCloseOthers,
  onDismiss
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [showColors, setShowColors] = useState(false)
  useClampToViewport(ref, true, [x, y])

  useEffect(() => {
    const dismiss = (): void => onDismiss()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDismiss()
    }
    // Deferred to the next frame so the very click that opened the menu
    // doesn't immediately close it again.
    const id = requestAnimationFrame(() => {
      window.addEventListener('mousedown', dismiss)
      window.addEventListener('blur', dismiss)
      window.addEventListener('keydown', onKey)
    })
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('mousedown', dismiss)
      window.removeEventListener('blur', dismiss)
      window.removeEventListener('keydown', onKey)
    }
  }, [onDismiss])

  const item = (label: string, action: () => void, disabled = false, danger = false): JSX.Element => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
        danger
          ? 'text-fg hover:bg-hover hover:text-danger'
          : 'text-fg hover:bg-hover hover:text-bright'
      } disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent`}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        action()
      }}
    >
      <span>{label}</span>
    </button>
  )

  return (
    <motion.div
      ref={ref}
      role="menu"
      variants={contextMenuVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed z-50 min-w-[180px] overflow-hidden rounded-lg border border-line/90 bg-titlebar/95 p-1 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.65)] [-webkit-app-region:no-drag]"
      style={{ left: x, top: y }}
    >
      {item('Rename Tab', onRename)}
      {item('Duplicate Tab', onDuplicate)}
      {onSetColor && (
        <>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-hover hover:text-bright"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowColors((v) => !v)
            }}
          >
            <span>Set Tab Color</span>
            <span className="text-[10px] text-muted">▶</span>
          </button>
          {showColors && (
            <div className="my-1 border-y border-line/60 bg-hover/30 p-2">
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted">
                <span>Color</span>
                <button
                  type="button"
                  className="hover:text-fg underline text-[9px]"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onSetColor(undefined)
                    onDismiss()
                  }}
                >
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-5 w-5 rounded-full border border-line/80 transition-transform hover:scale-110 shadow-xs"
                    style={{ backgroundColor: color }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onSetColor(color)
                      onDismiss()
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <div className="my-1 border-t border-line/60" />
      {item('Close Tab', onClose, false, true)}
      {item('Close Other Tabs', onCloseOthers, !canCloseOthers)}
    </motion.div>
  )
}
