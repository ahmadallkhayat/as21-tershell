/**
 * Tracks each pane's live working directory, as reported by the shell via
 * the OSC 7 escape sequence. This is what lets "split", "duplicate tab"
 * and "new tab here" open in the directory you're actually standing in
 * rather than always in your home folder.
 *
 * Shells only report this if they emit OSC 7 — Git Bash and most WSL
 * distros do out of the box, and PowerShell is made to by the prompt hook
 * the main process injects (see POWERSHELL_CWD_INTEGRATION). cmd.exe has
 * no equivalent hook, so panes running it simply have no live cwd and fall
 * back to their profile's configured start directory.
 */
const cwdByPane = new Map<string, string>()

export function registerPaneCwd(paneId: string, cwd: string | null): void {
  if (cwd) cwdByPane.set(paneId, cwd)
  else cwdByPane.delete(paneId)
}

export function getPaneCwd(paneId: string): string | undefined {
  return cwdByPane.get(paneId)
}

/**
 * Parses an OSC 7 payload (`file://host/path`) into a filesystem path.
 * The host segment is always discarded — it names the machine, not the
 * location, and is commonly empty (`file:///C:/...`) or a WSL distro name.
 *
 * A POSIX result (from WSL) is returned as-is even though it can't be used
 * as a Windows spawn cwd; the main process checks existence before using
 * it and falls back, so a distro path degrades to the profile default
 * rather than failing to open a pane.
 */
export function parseOsc7(data: string): string | null {
  if (!data.startsWith('file://')) return null
  const withoutScheme = data.slice('file://'.length)
  const firstSlash = withoutScheme.indexOf('/')
  if (firstSlash === -1) return null

  let path = withoutScheme.slice(firstSlash + 1)
  try {
    path = decodeURIComponent(path)
  } catch {
    // Malformed percent-escapes — better to use the raw text than nothing.
  }
  if (!path) return null

  // Windows drive paths come across slash-separated; hand back the native
  // form so it can be passed straight to spawn and shown to the user.
  if (/^[a-zA-Z]:/.test(path)) return path.replace(/\//g, '\\')
  return `/${path}`
}
