import { app, shell, BrowserWindow, ipcMain, webContents } from 'electron'
import { join } from 'path'
import { is } from './is'
import os from 'os'
import * as pty from 'node-pty'
import type { IPty } from 'node-pty'
import { getAvailableCommands } from './commands'
import { loadWindowState, trackWindowState } from './windowState'
import icon from '../../resources/icon.png?asset'

interface ShellDef {
  name: string
  path: string
  args: string[]
}

const SHELLS: Record<string, ShellDef> = {
  powershell: { name: 'PowerShell', path: 'powershell.exe', args: ['-NoLogo'] },
  cmd: { name: 'Command Prompt', path: process.env.COMSPEC || 'cmd.exe', args: [] }
}

interface Session {
  proc: IPty
  ownerId: number
}

const sessions = new Map<string, Session>()
let sessionSeq = 0

/** Builds the shell's actual launch args, folding an initial command into
 * shell-native startup flags (`-Command`/`/K`) instead of typing it after
 * the shell is already running. Typing races the shell's own startup —
 * PowerShell in particular can still be printing its banner when the first
 * keystrokes arrive, swallowing or interleaving them. */
function buildArgs(def: ShellDef, initialCommand?: string): string[] {
  if (!initialCommand) return def.args
  if (def.path.toLowerCase().includes('powershell')) {
    return [...def.args, '-NoExit', '-Command', initialCommand]
  }
  return ['/K', initialCommand]
}

function createSession(
  shellKey: string,
  cols: number,
  rows: number,
  senderId: number,
  initialCommand?: string
): string {
  const def = SHELLS[shellKey] ?? SHELLS.powershell
  const id = `pty-${++sessionSeq}`

  // Left to throw straight through: ipcMain.handle turns it into a
  // rejection of the renderer's createSession() promise, so a bad shell
  // path or spawn failure surfaces there instead of leaving a tab
  // silently blank.
  const proc = pty.spawn(def.path, buildArgs(def, initialCommand), {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: os.homedir(),
    env: { ...process.env, TERM_PROGRAM: 'AS21Tershell' } as Record<string, string>
  })

  proc.onData((data) => {
    const wc = webContents.fromId(senderId)
    wc?.send('pty:data', { id, data })
  })

  proc.onExit(({ exitCode }) => {
    const wc = webContents.fromId(senderId)
    wc?.send('pty:exit', { id, exitCode })
    sessions.delete(id)
  })

  sessions.set(id, { proc, ownerId: senderId })
  return id
}

function killSessionsOwnedBy(ownerId: number): void {
  for (const [id, session] of sessions) {
    if (session.ownerId !== ownerId) continue
    session.proc.kill()
    sessions.delete(id)
  }
}

function registerPtyHandlers(): void {
  ipcMain.handle(
    'pty:create',
    (event, args: { shell: string; cols: number; rows: number; initialCommand?: string }) => {
      return createSession(args.shell, args.cols, args.rows, event.sender.id, args.initialCommand)
    }
  )

  ipcMain.on('pty:write', (_event, args: { id: string; data: string }) => {
    sessions.get(args.id)?.proc.write(args.data)
  })

  ipcMain.on('pty:resize', (_event, args: { id: string; cols: number; rows: number }) => {
    const s = sessions.get(args.id)
    if (s && args.cols > 0 && args.rows > 0) {
      try {
        s.proc.resize(args.cols, args.rows)
      } catch {
        // ignore resize races during shutdown
      }
    }
  })

  ipcMain.on('pty:dispose', (_event, args: { id: string }) => {
    sessions.get(args.id)?.proc.kill()
    sessions.delete(args.id)
  })

  ipcMain.handle('pty:activeProcess', (_event, args: { id: string }) => {
    return sessions.get(args.id)?.proc.process ?? null
  })

  ipcMain.handle('pty:shells', () => {
    return Object.entries(SHELLS).map(([key, def]) => ({ key, name: def.name }))
  })

  ipcMain.handle('shell:commands', (_event, force?: boolean) => getAvailableCommands(force))
}

/** A renderer reload (dev HMR, Ctrl+R, or a crash) discards all React state
 * without running component cleanup, so PTYs it owned would otherwise stay
 * alive and orphaned in this process indefinitely. */
function reapSessionsOnReload(win: BrowserWindow): void {
  win.webContents.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) killSessionsOwnedBy(win.webContents.id)
  })
  win.webContents.on('render-process-gone', () => killSessionsOwnedBy(win.webContents.id))
}

function createWindow(): void {
  const savedState = loadWindowState()

  const win = new BrowserWindow({
    width: savedState?.bounds.width ?? 1100,
    height: savedState?.bounds.height ?? 700,
    x: savedState?.bounds.x,
    y: savedState?.bounds.y,
    minWidth: 480,
    minHeight: 320,
    icon,
    show: false,
    frame: false,
    backgroundColor: '#0b0d14',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const ownerId = win.webContents.id

  win.on('ready-to-show', () => {
    if (savedState?.maximized) win.maximize()
    win.show()
  })

  trackWindowState(win)
  reapSessionsOnReload(win)

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  ipcMain.on('window:minimize', () => win.minimize())
  ipcMain.on('window:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()))
  ipcMain.on('window:close', () => win.close())

  win.on('maximize', () => win.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win.webContents.send('window:maximized', false))

  win.on('closed', () => killSessionsOwnedBy(ownerId))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerPtyHandlers()
  getAvailableCommands()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
