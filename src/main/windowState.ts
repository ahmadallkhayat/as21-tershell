import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface WindowState {
  bounds: Rectangle
  maximized: boolean
}

function stateFile(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

/** Only trust a saved position if it would actually land on a display
 * that's still connected — otherwise a window last placed on a monitor
 * the user has since unplugged would open off-screen and be unreachable. */
function isOnScreen(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    )
  })
}

export function loadWindowState(): WindowState | null {
  try {
    const state = JSON.parse(readFileSync(stateFile(), 'utf-8')) as WindowState
    if (!isOnScreen(state.bounds)) return null
    return state
  } catch {
    return null
  }
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const maximized = win.isMaximized()
    const bounds = maximized ? win.getNormalBounds() : win.getBounds()
    writeFileSync(stateFile(), JSON.stringify({ bounds, maximized }))
  } catch {
    // Best-effort persistence — a failed write here shouldn't be fatal.
  }
}

export function trackWindowState(win: BrowserWindow): void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  const debouncedSave = (): void => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => saveWindowState(win), 500)
  }
  win.on('resize', debouncedSave)
  win.on('move', debouncedSave)
  win.on('close', () => {
    if (timeout) clearTimeout(timeout)
    saveWindowState(win)
  })
}
