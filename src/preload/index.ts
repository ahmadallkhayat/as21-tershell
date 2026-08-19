import { contextBridge, ipcRenderer } from 'electron'

export interface ShellOption {
  key: string
  name: string
}

const api = {
  listShells: (): Promise<ShellOption[]> => ipcRenderer.invoke('pty:shells'),

  listCommands: (force?: boolean): Promise<string[]> => ipcRenderer.invoke('shell:commands', force),

  createSession: (shellKey: string, cols: number, rows: number): Promise<string> =>
    ipcRenderer.invoke('pty:create', { shell: shellKey, cols, rows }),

  write: (id: string, data: string): void => {
    ipcRenderer.send('pty:write', { id, data })
  },

  resize: (id: string, cols: number, rows: number): void => {
    ipcRenderer.send('pty:resize', { id, cols, rows })
  },

  dispose: (id: string): void => {
    ipcRenderer.send('pty:dispose', { id })
  },

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
