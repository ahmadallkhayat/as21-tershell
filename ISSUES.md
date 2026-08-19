# AS21 Tershell — Known Issues & Gaps

Audit date: 2026-08-19. Written by reading the source, not by runtime testing.

**Legend**
- `[CONFIRMED]` — traced to specific code, I'm confident it's real.
- `[LIKELY]` — strongly implied by the code but not runtime-verified.
- `[GAP]` — not a bug; a missing feature or design limitation.

---

## 1. Critical / correctness

### 1.1 Splitting a pane restarts BOTH terminals `[CONFIRMED]`
**Where:** `PaneView.tsx` + `paneTree.ts` + `App.tsx`

When a leaf is split, the tree changes shape: `PaneView` for that node stops
returning a leaf `<div>` and starts returning a split flex container with the
original leaf nested two levels deeper. React reconciles by element
type/position, so the existing `TerminalView` unmounts and a fresh one mounts.
Its cleanup runs `window.api.dispose(ptyId)` and kills the PTY — you lose
scrollback, shell state, cwd, and any running process.

**Root cause:** terminals live *inside* the recursive layout tree, so any
structural change to the tree destroys them.

**Fix direction:** hoist terminals out of the layout tree. Render every
`TerminalView` once in a flat, stable list (keyed by pane id) and position them
via absolute coordinates computed from the tree, or render them into
per-pane containers with React portals. The layout tree then only describes
geometry and can restructure freely without remounting anything.

### 1.2 `lineBuffer` desyncs from the shell's real input line `[CONFIRMED]`
**Where:** `TerminalView.tsx` — `onInput` handler

We shadow-track typed characters in `lineBuffer` to drive suggestions, but only
handle plain chars, Enter, Backspace and Ctrl+C. It desyncs on:
- **Paste** — `handlePaste` / `Ctrl+Shift+V` write straight to the PTY without touching `lineBuffer`.
- **Left/Right/Home/End** — cursor moves mid-line; `lineBuffer` still assumes cursor-at-end.
- **Ctrl+U / Ctrl+W / Ctrl+K** — shell clears or deletes words; `lineBuffer` unaware.
- **Shell history recall (Up arrow)** — shell replaces the line; `lineBuffer` unaware.
- **Shell-side tab completion** — shell rewrites the line; `lineBuffer` unaware.

### 1.3 Accepting a suggestion can mangle the command line `[CONFIRMED]`
**Where:** `TerminalView.tsx` — `acceptSuggestion`

It sends `'\x7f'.repeat(lineBuffer.length)` then the chosen text. If
`lineBuffer` is out of sync (see 1.2) this deletes the **wrong number of
characters** — either leaving fragments or eating the prompt/previous content.
Worst case it silently corrupts a command before you press Enter.

**Fix direction:** prefer `Ctrl+U` (kill whole line) over counted backspaces,
or abandon shadow-tracking and read the current line from the terminal buffer.

### 1.4 Suggestions fire inside full-screen TUI apps `[CONFIRMED]`
**Where:** `TerminalView.tsx` — no alt-screen check

`vim`, `htop`, `less`, and interactive agent CLIs take over the screen, but we
keep feeding keystrokes into `lineBuffer` and popping the dropdown over their
UI. Arrow keys also get hijacked (see 2.1), which actively breaks navigation
inside those programs.

**Fix direction:** disable all suggestion logic when
`term.buffer.active.type === 'alternate'`.

### 1.5 PTY processes leak on renderer reload `[CONFIRMED]`
**Where:** `main/index.ts` — `sessions` map

Sessions are only killed on the window's `closed` event. A renderer reload
(dev HMR, `Ctrl+R`, a renderer crash) discards all React state without running
component cleanup, so every PTY from before the reload stays alive and
orphaned in the main process. During a long dev session this accumulates
shells indefinitely.

**Fix direction:** kill sessions belonging to a `webContents` on its
`did-start-navigation` / `render-process-gone`, or track owner and reap.

### 1.6 `initialCommand` is written before the shell is ready `[LIKELY]`
**Where:** `TerminalView.tsx` — `createSession(...).then(...)`

The command is written the instant the PTY handle exists, with no wait for the
shell to initialize or print a prompt. PowerShell's startup is slow enough that
input can be swallowed or interleaved into the banner. This affects every
tool-launch and every "Install X" tab.

**Fix direction:** wait for first prompt output, or a short settle delay, or
pass the command as a shell argument instead of typing it.

---

## 2. UX problems

### 2.1 Suggestion dropdown steals Up/Down from shell history `[CONFIRMED]`
While the dropdown is open, `\x1b[A` / `\x1b[B` are consumed to move the
selection and never forwarded to the shell — so you cannot use normal shell
history while a suggestion is showing, which is most of the time you're typing.
Consider Ctrl+Up/Down, or only capturing arrows after an explicit trigger.

### 2.2 Closing a pane/tab kills running processes with no warning `[CONFIRMED]`
`Ctrl+Shift+W` and the tab `×` immediately dispose the PTY. A long-running AI
agent, build, or SSH session dies instantly with no confirmation and no undo.

### 2.3 A pane vanishes the moment its process exits `[CONFIRMED]`
**Where:** `onExit` → `closePane`

If a command crashes or a shell exits, the pane disappears instantly, taking
any error message with it. You can't read what went wrong.
Windows Terminal makes this configurable ("close / keep open on exit").

### 2.4 Newly installed tools still show "Install" until restart `[CONFIRMED]`
**Where:** `TitleBar.tsx` — `useEffect(..., [])`

This is a **regression** from the "load tools at launch, not on every `+`"
change. The command list is now fetched exactly once on mount and never
invalidated, and the main-process cache is permanent too. After installing a
tool the UI keeps offering to install it again.

**Fix direction:** re-fetch with `force` after an install tab is created, or
when the window regains focus.

### 2.5 Pane focus navigation is order-based, not spatial `[CONFIRMED]`
`Alt+←/→` cycles through panes in flat tree order. In a 2x2 layout "left"
frequently moves somewhere non-adjacent. There is also no `Alt+↑/↓`.

### 2.6 Resizing panes resets unrelated pane sizes `[CONFIRMED]`
**Where:** `paneTree.ts` — `removeLeaf`

On removal, remaining siblings are redistributed to **even** sizes, discarding
manual sizing the user set on panes that weren't involved.

### 2.7 Command history is per-terminal and stale `[CONFIRMED]`
**Where:** `suggestions.ts` + `TerminalView.tsx`

Each `TerminalView` loads its own in-memory copy of history at mount. A command
run in pane A never appears in pane B's suggestions until B is recreated.
History is also global across all shells — `cmd` suggestions bleed into
PowerShell panes and vice versa.

### 2.8 No confirmation or feedback when a shell fails to spawn `[LIKELY]`
If `pty.spawn` throws (missing shell, bad path), nothing is surfaced to the
renderer. The tab appears but stays blank forever with no error.

---

## 3. Theming / visual

### 3.1 Search highlight colors are hardcoded dark `[CONFIRMED]`
**Where:** `TerminalView.tsx` — `SEARCH_OPTIONS`

`matchBackground: '#2a2e42'`, `activeMatchBorder: '#f4f5fc'` etc. are literal
dark-theme values that ignore both the theme mode and the accent color. In
light mode search highlights will be near-invisible or wrong.

### 3.2 Terminal ANSI palette is not themed `[CONFIRMED]`
**Where:** `settings.ts` — `TERMINAL_COLORS` only sets `background`/`foreground`.

The 16 ANSI colors fall back to xterm defaults, which are tuned for dark
backgrounds. In light mode, bright yellow/cyan/green program output will be
hard or impossible to read. Needs a full 16-color palette per theme.

### 3.3 Accent color has no contrast validation `[CONFIRMED]`
Several elements render `text-white` on `bg-accent` (segmented control, theme
buttons). Pick a light accent (or use light mode) and that text becomes
illegible. The picker also happily produces accents invisible against the
surface.

**Fix direction:** compute a readable foreground per accent, or constrain
picker lightness per theme.

### 3.4 Color picker can only produce one saturation/lightness `[CONFIRMED]`
**Where:** `ColorPicker.tsx` — `PICKER_SATURATION` / `PICKER_LIGHTNESS` fixed.

The hue slider always emits `hsl(h, 72%, 60%)`. Pastels, deep tones, greys and
near-blacks are unreachable except by typing hex manually.

### 3.5 Popups don't re-clamp on window resize `[CONFIRMED]`
**Where:** `useClampToViewport.ts`

Clamping runs on open and on dependency change only. Resizing or maximizing
the window while a popup is open leaves it mispositioned.

---

## 4. Accessibility

### 4.1 Custom `Select` lost native keyboard support `[CONFIRMED]`
**Where:** `ui.tsx`

Replacing `<select>` removed arrow-key navigation, Home/End, type-ahead, and
Enter-to-confirm. Only `Escape` is handled. Keyboard users are worse off than
before the custom component.

### 4.2 No ARIA roles / semantics on any custom control `[CONFIRMED]`
Menus, dropdowns, the color picker and the context menu are plain `div`/`button`
soup — no `role="menu"`, `aria-expanded`, `aria-selected`, or focus management.
Screen readers can't interpret them.

### 4.3 No visible focus indicators `[CONFIRMED]`
Custom controls set `outline-none` and rely on hover styling only, so
tab-focus position is invisible.

### 4.4 `NumberInput` fights the user while typing `[CONFIRMED]`
**Where:** `ui.tsx` — `Number('')` is `0`, which then clamps to `min` (8).
Clearing the field to retype snaps it to `8` mid-edit.

---

## 5. Missing features (vs. Windows Terminal)

### 5.1 No shell profiles `[GAP]`
`SHELLS` is hardcoded to PowerShell + cmd. No WSL, Git Bash, pwsh 7, Python
REPL, custom args, per-profile starting directory, env vars, or icons.

### 5.2 New tabs always open in the home directory `[GAP]`
`cwd: os.homedir()` is fixed. No "open in current project", no per-profile
start dir, no "duplicate tab in same cwd".

### 5.3 No font size zoom shortcuts `[GAP]`
`Ctrl+=` / `Ctrl+-` / `Ctrl+0` are standard in every terminal; we only expose
font size via the settings dialog.

### 5.4 Scrollback is unbounded-by-default-but-small and unconfigurable `[GAP]`
xterm's default is 1000 lines and we never set it. Long AI-agent or build
output gets silently truncated. Should be a setting.

### 5.5 No tab reordering, renaming, or duplication `[GAP]`
No drag-to-reorder, no manual rename (titles are OSC-only), no duplicate.

### 5.6 No window state persistence `[GAP]`
Size, position and maximized state are not saved between launches.

### 5.7 No session restore `[GAP]`
Tabs/panes are not restored on relaunch.

### 5.8 No settings reset / import / export `[GAP]`
No way to get back to defaults short of clearing localStorage.

### 5.9 Search is per-pane only `[GAP]`
No "search all panes", no regex/case/whole-word toggles (the addon supports
them; we don't expose them).

### 5.10 No app icon `[CONFIRMED]`
`package.json` build config sets no `icon`, so `dist:win` will ship the default
Electron icon.

---

## 6. Code quality / infrastructure

### 6.1 Zero tests `[CONFIRMED]`
No test runner, no unit tests. `paneTree.ts` in particular is pure, tricky
logic (split/remove/collapse) that is ideal for unit testing and currently has
none.

### 6.2 `removeLeaf` returns a new object even when nothing changed `[CONFIRMED]`
**Where:** `paneTree.ts`

The `children.length === node.children.length` branch still returns
`{ ...node, children }`, producing new identity for untouched subtrees and
causing unnecessary re-renders. The comment there is also inaccurate.

### 6.3 Any settings change refits every terminal `[CONFIRMED]`
The `[settings]` effect fires on the whole object, so changing
`defaultShell` (which affects nothing about rendering) still triggers
`fit()` + `resize()` on every open pane.

### 6.4 `dist:win` has never been run `[CONFIRMED]`
The packaging path is unverified — native `node-pty` binaries in particular
often need `asarUnpack` / rebuild config that isn't present.

### 6.5 Renderer bundle is ~717 KB with no splitting `[CONFIRMED]`
Vite emits a size warning on every build.

### 6.6 `tsc` is never run as part of build or CI `[CONFIRMED]`
`npm run build` uses esbuild via electron-vite, which strips types without
checking them. Type errors only surface if `tsc --noEmit` is run manually.
No CI at all.

---

## Suggested priority

1. **1.1** split restarts terminals — most damaging, affects core workflow
2. **1.5** PTY leak on reload — silently eats resources
3. **1.2 / 1.3 / 1.4** suggestion engine correctness — can corrupt commands
4. **2.4** installed-tool detection regression — visible, easy fix
5. **3.1 / 3.2** light-mode legibility — light mode is half-finished without it
6. **2.2 / 2.3** destructive close with no warning/recovery
7. **6.1 / 6.6** tests + typecheck in build — prevents regressions like 2.4
