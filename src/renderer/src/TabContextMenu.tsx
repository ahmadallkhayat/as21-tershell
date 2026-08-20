import { useEffect, useRef } from 'react'
import { useClampToViewport } from './useClampToViewport'

interface Props {
  x: number
  y: number
  canCloseOthers: boolean
  onRename: () => void
  onDuplicate: () => void
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
  onClose,
  onCloseOthers,
  onDismiss
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
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

  const item = (label: string, action: () => void, disabled = false): JSX.Element => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className="block w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-hover-strong disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent"
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        action()
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border border-hover-strong bg-hover shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{ left: x, top: y }}
    >
      {item('Rename', onRename)}
      {item('Duplicate', onDuplicate)}
      <div className="border-t border-line" />
      {item('Close', onClose)}
      {item('Close others', onCloseOthers, !canCloseOthers)}
    </div>
  )
}
