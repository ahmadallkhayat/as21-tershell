interface Props {
  processNames: string[]
  onConfirm: () => void
  onCancel: () => void
}

/** Guards a destructive close — Ctrl+Shift+W, a tab's ×, "Close Pane" — when
 * the pane still has a live foreground process (an agent, a build, an SSH
 * session) rather than an idle shell prompt. */
export default function ConfirmCloseDialog({ processNames, onConfirm, onCancel }: Props): JSX.Element {
  const unique = Array.from(new Set(processNames))
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-[360px] overflow-hidden rounded-xl border border-hover-strong bg-titlebar shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
        <div className="border-b border-line px-4 py-3">
          <span className="text-sm font-semibold text-bright">Close anyway?</span>
        </div>
        <div className="px-4 py-3 text-xs text-fg">
          {unique.length === 1 ? (
            <>
              <span className="font-medium text-bright">{unique[0]}</span> is still running in this pane.
            </>
          ) : (
            <>
              Still running: <span className="font-medium text-bright">{unique.join(', ')}</span>
            </>
          )}
          . Closing now will end it immediately.
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs text-fg hover:bg-hover"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-danger px-3 py-1.5 text-xs text-white hover:brightness-110"
            onClick={onConfirm}
          >
            Close anyway
          </button>
        </div>
      </div>
    </div>
  )
}
