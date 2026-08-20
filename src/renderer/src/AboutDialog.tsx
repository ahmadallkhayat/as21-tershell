import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { modalBackdropVariants, modalCardVariants } from './motion'
import { CloseIcon, ExternalLinkIcon } from './Icon'
import iconUrl from '../../../resources/icon.png'

interface Props {
  onClose: () => void
}

/**
 * About dialog modal displaying application version, runtime environment
 * details, architecture, and project links.
 */
export default function AboutDialog({ onClose }: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const openExternal = (url: string): void => {
    window.api.openExternal(url)
  }

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
        aria-labelledby="about-dialog-title"
        variants={modalCardVariants}
        className="w-[420px] overflow-hidden rounded-2xl border border-line/90 bg-titlebar/98 backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] [-webkit-app-region:no-drag]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={iconUrl} alt="App Icon" className="h-5 w-5 rounded-[4px]" />
            <span id="about-dialog-title" className="text-sm font-semibold text-bright">
              About AS21 Tershell
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

        <div className="p-5 text-xs text-fg">
          <div className="flex items-start gap-3.5 pb-4">
            <img src={iconUrl} alt="App Icon" className="h-12 w-12 rounded-lg shadow-md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-bright">AS21 Tershell</span>
                <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  v0.1.0
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                A custom Windows terminal UI with real shell passthrough, split panes, and integrated
                developer tool launchers.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface/80 p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
              Environment & Runtime
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
              <div className="text-muted">OS / Platform:</div>
              <div className="font-mono text-fg">Windows (x64)</div>

              <div className="text-muted">Electron:</div>
              <div className="font-mono text-fg">v33.2.1</div>

              <div className="text-muted">Terminal Core:</div>
              <div className="font-mono text-fg">xterm.js v5.5.0</div>

              <div className="text-muted">PTY Passthrough:</div>
              <div className="font-mono text-fg">node-pty v1.0.0</div>

              <div className="text-muted">UI Stack:</div>
              <div className="font-mono text-fg">React 18 · Tailwind v4</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px]">
            <button
              type="button"
              className="flex items-center gap-1.5 text-accent hover:underline"
              onClick={() => openExternal('https://github.com/ahmadallkhayat/as21-tershell')}
            >
              <span>GitHub Repository</span>
              <ExternalLinkIcon size={10} />
            </button>
            <span className="text-muted">Created by Ahmad Sadiq</span>
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
