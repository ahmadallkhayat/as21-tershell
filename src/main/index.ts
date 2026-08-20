import { app, shell, BrowserWindow, ipcMain, webContents, dialog } from 'electron'
import { join } from 'path'
import { is } from './is'
import os from 'os'
import { existsSync } from 'fs'
import * as pty from 'node-pty'
import type { IPty } from 'node-pty'
import { getAvailableCommands } from './commands'
import { getShellProfiles, findProfile, type ShellProfile } from './shells'
import { loadWindowState, trackWindowState } from './windowState'
import icon from '../../resources/icon.png?asset'

interface Session {
  proc: IPty
  ownerId: number
}

interface CreateArgs {
  shell: string
  cols: number
  rows: number
  cwd?: string
  initialCommand?: string
  /** Whether to inject the OSC 7 prompt hook (a user-facing setting). */
  cwdTracking?: boolean
  /** A user-defined profile, sent whole since the main process only knows
   * about the ones it auto-detected. */
  custom?: ShellProfile
}

const sessions = new Map<string, Session>()
let sessionSeq = 0

/** Wraps whatever prompt the user already has so it *also* emits OSC 7 —
 * the standard "my working directory is now X" escape sequence. That's
 * what lets a split or duplicated tab inherit the pane's live directory
 * instead of always landing in the home folder. Capturing the existing
 * prompt first and calling through to it means a customized prompt
 * (oh-my-posh, starship, a hand-written one in $PROFILE) keeps working. */
const POWERSHELL_CWD_INTEGRATION = [
  '$__as21_prompt = $function:prompt',
  'function global:prompt {',
  '  $__as21_p = (Get-Location).ProviderPath',
  "  if ($__as21_p) { [Console]::Write(\"$([char]27)]7;file:///$($__as21_p -replace '\\\\','/')$([char]7)\") }",
  '  if ($__as21_prompt) { & $__as21_prompt } else { "PS $(Get-Location)> " }',
  '}'
].join('\n')

/** -EncodedCommand takes UTF-16LE base64, which sidesteps command-line
 * quoting entirely — the integration script above is full of quotes and
 * backslashes that would otherwise need escaping through two layers. */
function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

/** Builds the shell's actual launch args, folding an initial command into
 * shell-native startup flags instead of typing it after the shell is
 * already running. Typing races the shell's own startup — PowerShell in
 * particular can still be printing its banner when the first keystrokes
 * arrive, swallowing or interleaving them. */
function buildArgs(profile: ShellProfile, initialCommand?: string, cwdTracking?: boolean): string[] {
  if (profile.family === 'powershell') {
    const parts: string[] = []
    if (cwdTracking && profile.supportsCwdTracking) parts.push(POWERSHELL_CWD_INTEGRATION)
    if (initialCommand) parts.push(initialCommand)
    if (parts.length === 0) return profile.args
    return [...profile.args, '-NoExit', '-EncodedCommand', encodePowerShellCommand(parts.join('\n'))]
  }

  if (profile.family === 'cmd') {
    return initialCommand ? ['/K', initialCommand] : profile.args
  }

  // bash-like: run the command, then hand the session back to an
  // interactive shell rather than exiting the moment it finishes.
  if (!initialCommand) return profile.args
  const script = `${initialCommand}; exec bash -i`
  return /wsl\.exe$/i.test(profile.path)
    ? [...profile.args, '--', 'bash', '-lc', script]
    : ['-lc', script]
}

/** Falls back through requested -> profile default -> home, skipping any
 * that no longer exist. A restored session can name a directory the user
 * has since deleted, and spawning into a missing cwd throws. */
function resolveCwd(profile: ShellProfile, requested?: string): string {
  for (const candidate of [requested, profile.cwd]) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return os.homedir()
}

function createSession(profile: ShellProfile, args: CreateArgs, senderId: number): string {
  const id = `pty-${++sessionSeq}`

  // Left to throw straight through: ipcMain.handle turns it into a
  // rejection of the renderer's createSession() promise, so a bad shell
  // path or spawn failure surfaces there instead of leaving a tab
  // silently blank.
  const proc = pty.spawn(profile.path, buildArgs(profile, args.initialCommand, args.cwdTracking), {
    name: 'xterm-256color',
    cols: args.cols,
    rows: args.rows,
    cwd: resolveCwd(profile, args.cwd),
    env: {
      ...process.env,
      ...profile.env,
      TERM_PROGRAM: 'AS21Tershell'
    } as Record<string, string>
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

async function resolveProfile(args: CreateArgs): Promise<ShellProfile> {
  if (args.custom) return args.custom
  const profiles = await getShellProfiles()
  const match = findProfile(profiles, args.shell)
  if (match) return match
  // The saved default shell may name a profile that's since been
  // uninstalled (or a WSL distro that's been unregistered) — fall back to
  // whatever this machine does have rather than failing to open a tab.
  if (profiles.length === 0) throw new Error('No usable shell found on this system')
  return profiles[0]
}

function registerPtyHandlers(): void {
  ipcMain.handle('pty:create', async (event, args: CreateArgs) => {
    const profile = await resolveProfile(args)
    return createSession(profile, args, event.sender.id)
  })

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

  ipcMain.handle('shell:profiles', (_event, force?: boolean) => getShellProfiles(force))

  ipcMain.handle('shell:commands', (_event, force?: boolean) => getAvailableCommands(force))

  ipcMain.handle('dialog:pickFolder', async (event, defaultPath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      properties: ['openDirectory' as const],
      ...(defaultPath && existsSync(defaultPath) ? { defaultPath } : {})
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('dialog:saveFile', async (event, content: string, defaultPath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: 'Export Terminal Log',
      defaultPath: defaultPath || 'terminal-output.log',
      filters: [
        { name: 'Log files (*.log, *.txt)', extensions: ['log', 'txt'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    }
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return false
    const { promises: fsPromises } = await import('fs')
    await fsPromises.writeFile(result.filePath, content, 'utf8')
    return true
  })

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      await shell.openExternal(url)
    }
  })
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

  // Surface renderer-side errors in the terminal running `npm run dev`.
  // Without this a React render error just blanks the window silently,
  // with nothing to go on unless DevTools happens to be open.
  if (is.dev) {
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (level >= 2) console.error(`[renderer] ${message}  (${sourceId}:${line})`)
    })
  }

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
  getShellProfiles()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
