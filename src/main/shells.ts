import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

/** Which command-line dialect a profile speaks. Decides how an initial
 * command gets folded into the shell's own startup flags (see buildArgs in
 * index.ts) rather than being typed in after the fact. */
export type ShellFamily = 'powershell' | 'cmd' | 'bash'

export interface ShellProfile {
  key: string
  name: string
  path: string
  args: string[]
  family: ShellFamily
  /** Starting directory. Undefined means the user's home directory. */
  cwd?: string
  env?: Record<string, string>
  /** Hex color for this profile's dot/badge in the UI. */
  color: string
  /** Whether this profile emits OSC 7 (or can be made to), so panes
   * spawned from it can inherit the live working directory. */
  supportsCwdTracking: boolean
}

const POWERSHELL_COLOR = '#5b9dff'
const PWSH_COLOR = '#2f74c0'
const CMD_COLOR = '#ffb454'
const GIT_BASH_COLOR = '#f05133'
const WSL_COLOR = '#ffd242'

function firstExisting(...candidates: string[]): string | null {
  return candidates.find((c) => c && existsSync(c)) ?? null
}

function detectPowerShell(): ShellProfile | null {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  const path = firstExisting(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'))
  if (!path) return null
  return {
    key: 'powershell',
    name: 'Windows PowerShell',
    path,
    args: ['-NoLogo'],
    family: 'powershell',
    color: POWERSHELL_COLOR,
    supportsCwdTracking: true
  }
}

function detectPwsh(): ShellProfile | null {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const localAppData = process.env.LOCALAPPDATA || ''
  const path = firstExisting(
    join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
    localAppData ? join(localAppData, 'Microsoft', 'WindowsApps', 'pwsh.exe') : ''
  )
  if (!path) return null
  return {
    key: 'pwsh',
    name: 'PowerShell 7',
    path,
    args: ['-NoLogo'],
    family: 'powershell',
    color: PWSH_COLOR,
    supportsCwdTracking: true
  }
}

function detectCmd(): ShellProfile {
  return {
    key: 'cmd',
    name: 'Command Prompt',
    path: process.env.COMSPEC || 'cmd.exe',
    args: [],
    family: 'cmd',
    color: CMD_COLOR,
    // cmd.exe has no prompt hook we can use to emit OSC 7 without
    // clobbering the user's PROMPT, so panes from it fall back to the
    // profile's configured starting directory.
    supportsCwdTracking: false
  }
}

function detectGitBash(): ShellProfile | null {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const localAppData = process.env.LOCALAPPDATA || ''
  const path = firstExisting(
    join(programFiles, 'Git', 'bin', 'bash.exe'),
    join(programFilesX86, 'Git', 'bin', 'bash.exe'),
    localAppData ? join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe') : ''
  )
  if (!path) return null
  return {
    key: 'git-bash',
    name: 'Git Bash',
    path,
    args: ['--login', '-i'],
    family: 'bash',
    color: GIT_BASH_COLOR,
    // Git for Windows' default bash profile already emits OSC 7.
    supportsCwdTracking: true
  }
}

/** `wsl.exe --list --quiet` writes UTF-16LE, which is why this decodes the
 * raw buffer rather than letting execFile hand back a mojibake string. */
function detectWslDistros(): Promise<ShellProfile[]> {
  return new Promise((resolve) => {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const wslExe = join(systemRoot, 'System32', 'wsl.exe')
    if (!existsSync(wslExe)) {
      resolve([])
      return
    }

    execFile(
      wslExe,
      ['--list', '--quiet'],
      { encoding: 'buffer', timeout: 1500, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout || stdout.length === 0) {
          resolve([])
          return
        }
        try {
          const names = stdout
            .toString('utf16le')
            .replace(/\u0000/g, '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)

          resolve(
            names.map((name) => ({
              key: `wsl-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
              name: `WSL: ${name}`,
              path: 'wsl.exe',
              args: ['--distribution', name],
              family: 'bash' as const,
              color: WSL_COLOR,
              // Most distros' default bash/zsh profiles emit OSC 7.
              supportsCwdTracking: true
            }))
          )
        } catch {
          resolve([])
        }
      }
    )
  })
}

function getLocalProfiles(): ShellProfile[] {
  return [
    detectPowerShell(),
    detectPwsh(),
    detectCmd(),
    detectGitBash()
  ].filter((p): p is ShellProfile => p !== null)
}

let cache: ShellProfile[] | null = null
let pendingWsl: Promise<void> | null = null

/** Discovers the shells actually installed on this machine. Local shells
 * (PowerShell, Cmd, Git Bash) are returned immediately without blocking,
 * while WSL distros are probed asynchronously in the background. */
export function getShellProfiles(force = false): Promise<ShellProfile[]> {
  if (force || !cache) {
    cache = getLocalProfiles()
    pendingWsl = detectWslDistros().then((wsl) => {
      if (wsl.length > 0) {
        const local = getLocalProfiles()
        cache = [...local, ...wsl]
      }
    }).catch(() => {
      // Ignore WSL detection errors
    })
  }

  return Promise.resolve(cache)
}

export function findProfile(profiles: ShellProfile[], key: string): ShellProfile | undefined {
  return profiles.find((p) => p.key === key)
}
