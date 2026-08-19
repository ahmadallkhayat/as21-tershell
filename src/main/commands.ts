import { readdirSync } from 'fs'
import { execFile } from 'child_process'

function scanPathExecutables(): string[] {
  const pathEnv = process.env.PATH || process.env.Path || ''
  const dirs = pathEnv.split(';').filter(Boolean)
  const extsEnv = process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD'
  const exts = extsEnv.split(';').map((e) => e.toLowerCase())

  const found = new Set<string>()
  for (const dir of dirs) {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const dot = entry.lastIndexOf('.')
      if (dot === -1) continue
      const ext = entry.slice(dot).toLowerCase()
      if (!exts.includes(ext)) continue
      found.add(entry.slice(0, dot))
    }
  }
  return Array.from(found)
}

function scanPowerShellCommands(): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-Command', 'Get-Command | Select-Object -ExpandProperty Name'],
      { timeout: 8000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve([])
          return
        }
        resolve(
          stdout
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
        )
      }
    )
  })
}

let cache: string[] | null = null
let pending: Promise<string[]> | null = null

export function getAvailableCommands(force = false): Promise<string[]> {
  if (force) {
    cache = null
    pending = null
  }
  if (cache) return Promise.resolve(cache)
  if (pending) return pending

  pending = (async () => {
    const [pathCmds, psCmds] = await Promise.all([
      Promise.resolve(scanPathExecutables()),
      scanPowerShellCommands()
    ])
    const merged = Array.from(new Set([...pathCmds, ...psCmds])).sort((a, b) =>
      a.localeCompare(b)
    )
    cache = merged
    return merged
  })()

  return pending
}
