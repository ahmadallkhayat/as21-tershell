import { contextBridge, ipcRenderer } from 'electron'

export type ShellFamily = 'powershell' | 'cmd' | 'bash'

export interface ShellProfile {
  key: string
  name: string
  path: string
  args: string[]
  family: ShellFamily
  cwd?: string
  env?: Record<string, string>
  color: string
  supportsCwdTracking: boolean
}

export interface CreateSessionOptions {
  cwd?: string
  initialCommand?: string
  cwdTracking?: boolean
  custom?: ShellProfile
}

const api = {
  listProfiles: (force?: boolean): Promise<ShellProfile[]> =>
    ipcRenderer.invoke('shell:profiles', force),

  listCommands: (force?: boolean): Promise<string[]> => ipcRenderer.invoke('shell:commands', force),

  pickFolder: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pickFolder', defaultPath),

  saveFile: (content: string, defaultPath?: string): Promise<boolean> =>
    ipcRenderer.invoke('dialog:saveFile', content, defaultPath),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', url),

  createSession: (
    shellKey: string,
    cols: number,
    rows: number,
    options: CreateSessionOptions = {}
  ): Promise<string> => ipcRenderer.invoke('pty:create', { shell: shellKey, cols, rows, ...options }),

  write: (id: string, data: string): void => {
    ipcRenderer.send('pty:write', { id, data })
  },

  resize: (id: string, cols: number, rows: number): void => {
    ipcRenderer.send('pty:resize', { id, cols, rows })
  },

  dispose: (id: string): void => {
    ipcRenderer.send('pty:dispose', { id })
  },

  getActiveProcess: (id: string): Promise<string | null> =>
    ipcRenderer.invoke('pty:activeProcess', { id }),

  onData: (cb: (id: string, data: string) => void): (() => void) => {
    const listener = (_e: unknown, args: { id: string; data: string }): void =>
      cb(args.id, args.data)
    ipcRenderer.on('pty:data', listener)
    return () => ipcRenderer.removeListener('pty:data', listener)
  },

  onExit: (cb: (id: string, exitCode: number) => void): (() => void) => {
    const listener = (_e: unknown, args: { id: string; exitCode: number }): void =>
      cb(args.id, args.exitCode)
    ipcRenderer.on('pty:exit', listener)
    return () => ipcRenderer.removeListener('pty:exit', listener)
  },

  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    maximize: (): void => ipcRenderer.send('window:maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    onMaximizedChange: (cb: (maximized: boolean) => void): (() => void) => {
      const listener = (_e: unknown, maximized: boolean): void => cb(maximized)
      ipcRenderer.on('window:maximized', listener)
      return () => ipcRenderer.removeListener('window:maximized', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
