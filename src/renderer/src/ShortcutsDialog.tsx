import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { modalBackdropVariants, modalCardVariants } from './motion'
import { CloseIcon, KeyboardIcon } from './Icon'

interface Props {
  onClose: () => void
}

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutCategory {
  title: string
  items: ShortcutItem[]
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Command Palette & Navigation',
    items: [
      { keys: ['Ctrl', 'Shift', 'P'], description: 'Open Command Palette (Quick Launcher)' },
      { keys: ['Ctrl', 'Shift', 'T'], description: 'Open new tab (default shell)' },
      { keys: ['Ctrl', 'Shift', 'W'], description: 'Close focused pane (or tab if last pane)' },
      { keys: ['Ctrl', 'Tab'], description: 'Switch to next tab' },
      { keys: ['Ctrl', 'Shift', 'Tab'], description: 'Switch to previous tab' },
      { keys: ['Ctrl', 'Shift', '1-9'], description: 'Jump to tab by index' },
      { keys: ['Ctrl', ','], description: 'Open Settings dialog' },
      { keys: ['F1'], description: 'Open Keyboard Shortcuts reference' }
    ]
  },
  {
    title: 'Split Panes',
    items: [
      { keys: ['Ctrl', 'Shift', 'D'], description: 'Split focused pane horizontally (right)' },
      { keys: ['Ctrl', 'Shift', 'E'], description: 'Split focused pane vertically (down)' },
      { keys: ['Alt', '← / → / ↑ / ↓'], description: 'Move focus to adjacent pane (spatial)' }
    ]
  },
  {
    title: 'Terminal & Editing',
    items: [
      { keys: ['Ctrl', 'Shift', 'C'], description: 'Copy active terminal selection' },
      { keys: ['Ctrl', 'Shift', 'V'], description: 'Paste clipboard content' },
      { keys: ['Ctrl', 'Shift', 'F'], description: 'Open in-terminal search bar' },
      { keys: ['Ctrl', 'K'], description: 'Clear terminal scrollback buffer' },
      { keys: ['Ctrl', '+ / ='], description: 'Zoom terminal font size in' },
      { keys: ['Ctrl', '-'], description: 'Zoom terminal font size out' },
      { keys: ['Ctrl', '0'], description: 'Reset terminal font size to default' }
    ]
  },
  {
    title: 'Command Suggestions',
    items: [
      { keys: ['Ctrl', '↑ / ↓'], description: 'Navigate suggestion dropdown items' },
      { keys: ['Tab'], description: 'Accept selected suggestion' },
      { keys: ['Escape'], description: 'Dismiss suggestion dropdown' }
    ]
  }
]

function KeyBadge({ text }: { text: string }): JSX.Element {
  return (
    <kbd className="inline-flex min-w-[20px] items-center justify-center rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-bright shadow-xs">
      {text}
    </kbd>
  )
}

/**
 * Modal dialog presenting a categorized reference of all keyboard shortcuts.
 */
export default function ShortcutsDialog({ onClose }: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      variants={modalBackdropVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm [-webkit-app-region:no-drag]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        variants={modalCardVariants}
        className="flex max-h-[85vh] w-[540px] flex-col overflow-hidden rounded-2xl border border-line/90 bg-titlebar/98 backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] [-webkit-app-region:no-drag]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <KeyboardIcon className="text-accent" size={16} />
            <span id="shortcuts-dialog-title" className="text-sm font-semibold text-bright">
              Keyboard Shortcuts
            </span>
          </div>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg"
            title="Close (Esc)"
            onClick={onClose}
          >
            <CloseIcon size={12} />
          </button>
        </div>

        <div className="scroll-custom flex-1 overflow-y-auto p-4 text-xs">
          <div className="space-y-4">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.title} className="rounded-lg border border-line bg-surface/60 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {category.title}
                </div>
                <div className="space-y-1.5">
                  {category.items.map((item) => (
                    <div
                      key={item.description}
                      className="flex items-center justify-between gap-3 py-0.5 text-[11px]"
                    >
                      <span className="text-fg">{item.description}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.keys.map((k, idx) => (
                          <span key={idx} className="flex items-center gap-1">
                            <KeyBadge text={k} />
                            {idx < item.keys.length - 1 && <span className="text-[10px] text-muted">+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-line bg-hover/40 px-4 py-2.5">
          <button
            type="button"
            className="rounded-md bg-hover-strong px-4 py-1.5 text-xs font-medium text-fg hover:bg-accent hover:text-accent-contrast transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
