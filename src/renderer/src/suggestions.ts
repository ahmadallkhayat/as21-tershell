const HISTORY_KEY = 'as21-tershell:history'
const MAX_HISTORY = 200

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

export function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function commitToHistory(history: string[], line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed) return history
  const next = [trimmed, ...history.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return next
}

export function getSuggestions(line: string, history: string[]): string[] {
  const query = line.trim().toLowerCase()
  if (!query) return []

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
