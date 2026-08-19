export interface ToolDef {
  id: string
  name: string
  checkCommand: string
  installCommand: string
}

export const TOOLS: ToolDef[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    checkCommand: 'claude',
    installCommand: 'npm install -g @anthropic-ai/claude-code'
  },
  {
    id: 'antigravity',
    name: 'Antigravity CLI',
    checkCommand: 'agy',
    installCommand: 'irm https://antigravity.google/cli/install.ps1 | iex'
  },
  {
    id: 'cline',
    name: 'Cline',
    checkCommand: 'cline',
    installCommand: 'npm install -g cline'
  },
  {
    id: 'github',
    name: 'GitHub CLI',
    checkCommand: 'gh',
    installCommand: 'winget install --id GitHub.cli -e'
  },
  {
    id: 'vercel',
    name: 'Vercel CLI',
    checkCommand: 'vercel',
    installCommand: 'npm install -g vercel'
  },
  {
    id: 'netlify',
    name: 'Netlify CLI',
    checkCommand: 'netlify',
    installCommand: 'npm install -g netlify-cli'
  },
  {
    id: 'firebase',
    name: 'Firebase CLI',
    checkCommand: 'firebase',
    installCommand: 'npm install -g firebase-tools'
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Wrangler',
    checkCommand: 'wrangler',
    installCommand: 'npm install -g wrangler'
  },
  {
    id: 'ollama',
    name: 'Ollama',
    checkCommand: 'ollama',
    installCommand: 'winget install Ollama.Ollama'
  }
]
