const MAX_HISTORY = 200

// Namespaced per shell so cmd suggestions don't bleed into PowerShell panes
// and vice versa.
function historyKey(shellKey: string): string {
  return `as21-tershell:history:${shellKey}`
}

// Handy multi-word snippets that a plain PATH/cmdlet scan wouldn't surface.
const COMMON_SNIPPETS = [
  'git status',
  'git add .',
  'git commit -m ""',
  'git push',
  'git pull',
  'git log',
  'git diff',
  'git branch',
  'git checkout',
  'git clone',
  'npm install',
  'npm run dev',
  'npm run build',
  'npm start',
  'npm test',
  'code .'
]

let systemCommands: string[] = []

window.api.listCommands().then((list) => {
  systemCommands = list
})

// Always read fresh from storage rather than trusting an in-memory copy a
// caller might be holding — a command run in one pane should show up in
// every other open pane's suggestions immediately, not only after that
// pane is recreated.
export function loadHistory(shellKey: string): string[] {
  try {
    const raw = localStorage.getItem(historyKey(shellKey))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function commitToHistory(shellKey: string, line: string): string[] {
  const trimmed = line.trim()
  const current = loadHistory(shellKey)
  if (!trimmed) return current
  const next = [trimmed, ...current.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY)
  localStorage.setItem(historyKey(shellKey), JSON.stringify(next))
  return next
}

export function getSuggestions(shellKey: string, line: string): string[] {
  const query = line.trim().toLowerCase()
  if (!query) return []
  const history = loadHistory(shellKey)

  const seen = new Set<string>()
  const results: string[] = []

  const add = (candidates: string[]): void => {
    for (const c of candidates) {
      const key = c.toLowerCase()
      if (c === line || !key.startsWith(query) || seen.has(key)) continue
      seen.add(key)
      results.push(c)
    }
  }

  add(history)
  add(COMMON_SNIPPETS)
  add(systemCommands)

  return results.slice(0, 8)
}
