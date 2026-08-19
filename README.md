# AS21 Tershell

A custom Windows terminal app built with Electron, React, and [xterm.js](https://xtermjs.org/) — real shell passthrough (PowerShell / Command Prompt) via [node-pty](https://github.com/microsoft/node-pty), with split panes, a live command-suggestion engine, and one-click install/launch for AI and dev-tool CLIs.

## Features

- **Real shell sessions** — PowerShell and Command Prompt run as genuine PTY processes, not emulated. Each tab/pane is fully independent and keeps running in the background when you switch away.
- **Split panes** — divide any tab horizontally or vertically, resize by dragging, navigate between panes with the keyboard.
- **Tool launcher** — install and launch CLI tools (Claude Code, Cline, Antigravity CLI, GitHub CLI, Vercel, Netlify, Firebase, Cloudflare Wrangler, Ollama) directly from the `+` menu, with real logos and live installed-state detection.
- **Command suggestions** — a dropdown as you type, drawing from your own history, a curated list of common commands, and a live scan of every executable on your `PATH` plus PowerShell's cmdlet list.
- **In-terminal search** — `Ctrl+Shift+F`, live highlighting, jump between matches.
- **Copy/paste and a full keyboard-shortcut layer** — routed through xterm's key-interception API so nothing collides with shell-level bindings (readline, PSReadLine, etc).
- **Settings panel** — accent color, font, font size, cursor style, and default shell, all applied live and persisted.
- **Tabs that rename themselves** — any process that sets its terminal title via the standard OSC escape sequence updates its tab label automatically.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+T` | New tab |
| `Ctrl+Shift+W` | Close focused pane (closes the tab if it's the last pane) |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab |
| `Ctrl+Shift+1`–`9` | Jump to tab by number |
| `Ctrl+Shift+D` | Split pane right |
| `Ctrl+Shift+E` | Split pane down |
| `Alt+←` / `Alt+→` | Move focus between panes |
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | Copy / paste |
| `Ctrl+Shift+F` | Find in terminal |

## Development

Requires Node.js, and on Windows, MSVC Build Tools with the Spectre-mitigated libraries component (needed to compile `node-pty`'s native binding).

```bash
npm install
npm run dev
```

## Building

```bash
npm run build       # compile main/preload/renderer
npm run dist:win     # produce a Windows installer via electron-builder
```

## Architecture

- `src/main` — Electron main process: spawns and owns PTY sessions via `node-pty`, exposes them over IPC, scans `PATH`/PowerShell for available commands.
- `src/preload` — the `contextBridge` API surface exposed to the renderer.
- `src/renderer` — the React UI: tabs own a recursive pane tree (`paneTree.ts`), each leaf pane renders an independent `xterm.js` terminal (`TerminalView.tsx`) wired to its own PTY session.

## Tech stack

Electron · React · TypeScript · Tailwind CSS v4 · xterm.js · node-pty
