/**
 * Registry of each pane's live PTY id, keyed by pane id. TerminalView
 * registers itself here once its session is created, so that a close
 * action elsewhere (App.tsx) can ask "is this pane's shell actually idle,
 * or does it have a live foreground process?" before tearing it down.
 */
const ptyIdByPane = new Map<string, string>()

export function registerPanePty(paneId: string, ptyId: string | null): void {
  if (ptyId) ptyIdByPane.set(paneId, ptyId)
  else ptyIdByPane.delete(paneId)
}

/** Returns the active PTY ID for a given pane ID if registered. */
export function getPanePty(paneId: string): string | undefined {
  return ptyIdByPane.get(paneId)
}


/** Base executables the app itself spawns as a shell — anything else
 * reported as the pty's foreground process is treated as "busy". */
const SHELL_EXECUTABLES = new Set(['powershell.exe', 'pwsh.exe', 'cmd.exe'])

/** Resolves to the foreground process's display name if it looks like
 * something other than an idle shell prompt, or null if the pane is idle
 * (or its pty is already gone). */
export async function busyProcessName(paneId: string): Promise<string | null> {
  const ptyId = ptyIdByPane.get(paneId)
  if (!ptyId) return null
  const name = await window.api.getActiveProcess(ptyId)
  if (!name) return null
  return SHELL_EXECUTABLES.has(name.toLowerCase()) ? null : name
}
