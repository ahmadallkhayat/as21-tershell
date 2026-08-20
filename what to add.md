# AS21 Tershell — Feature Roadmap & Feature Additions

A prioritized list of features and enhancements comparing **AS21 Tershell** with **Microsoft Windows Terminal**, **PowerShell**, and modern terminal emulators.

---

## 🟢 Phase 1: High-Impact / Essential Features

### 1. "Run as Administrator" (Elevated Shells)
- **Description**: Add option to open PowerShell or Command Prompt with Administrator privileges.
- **Implementation**:
  - Add "New Elevated Tab" in File menu, `+` launcher, and Command Palette.
  - Show an **"Admin"** shield badge on elevated tabs.
  - Spawns process using `powershell -Command "Start-Process ... -Verb RunAs"` or elevated helper.

### 2. Tab Pinning (Pinned Tabs)
- **Description**: Pin critical, long-running tabs (dev servers, database watchers, background jobs) to the far left.
- **Implementation**:
  - Pinned tabs appear as compact icon-only badges.
  - Cannot be closed with `Ctrl+Shift+W` or accidental close button clicks until unpinned.
  - Right-click context menu: "Pin Tab" / "Unpin Tab".

### 3. Read-Only / Protected Tab Mode
- **Description**: Lock a tab so accidental keystrokes like `Ctrl+C`, `Ctrl+D`, or closing don't kill active builds or migrations.
- **Implementation**:
  - Adds a lock icon on the tab.
  - Intercepts `Ctrl+C` and closing attempts with a confirmation prompt: *"This tab is protected. Stop process?"*.

### 4. Background Activity Badges & Bell Notifications
- **Description**: Visual feedback when a command finishes or emits output in a background tab.
- **Implementation**:
  - Glowing dot / badge on the tab when new output arrives while the tab is inactive.
  - Optional audible bell / visual flash on terminal bell code (`\x07` / `\a`).

---

## 🟡 Phase 2: Power-User & Productivity Features

### 5. Broadcast / Multi-Input Mode (Send to All Panes)
- **Description**: Type once and broadcast keystrokes simultaneously to all open split panes in the active tab.
- **Implementation**:
  - Toggle via `Ctrl+Shift+B` or Command Palette.
  - Visual border highlight around all synchronized panes indicating broadcast mode is active.

### 6. Quake Mode / Global Summon Hotkey (`Win+~` / `Ctrl+~` / `F12`)
- **Description**: Pull down the terminal from the top of the screen from anywhere in Windows with a single hotkey.
- **Implementation**:
  - Global shortcut registered via Electron `globalShortcut`.
  - Smooth slide-in/out drop-down animation.

### 7. Custom Keybinding Remapping in Settings UI
- **Description**: Visual keyboard shortcuts manager allowing users to customize any shortcut in the app.
- **Implementation**:
  - Add "Keybindings" tab in Settings panel.
  - Record keystroke inputs with conflict detection.
  - Persist custom shortcut map to `localStorage` / configuration file.

### 8. Custom Background Image & Wallpaper
- **Description**: Support background images / GIFs with adjustable opacity, scale, and blur behind the terminal grid.
- **Implementation**:
  - Settings picker for local image file or URL.
  - Controls for image opacity (0%–100%), blur, and stretch/fill modes.

### 9. Command Execution Timers & Duration Badges
- **Description**: Show how long the last command took to execute (e.g. `[1.24s]` or `[42ms]`).
- **Implementation**:
  - Track time between `Enter` keypress and shell prompt return.
  - Display badge in the terminal status bar or corner overlay.

---

## 🔵 Phase 3: Advanced Architecture & Ecosystem

### 10. Multi-Window & Tab Tear-Off
- **Description**: Drag a tab out of the window to create a separate floating window; drag tabs between windows.

### 11. Session State Persistence & Crash Restore
- **Description**: Save open tabs, split layouts, and working directories on exit and restore them on next launch.

### 12. Quick Snippet Library
- **Description**: Custom snippet manager in Command Palette for storing and running parameterized one-liners (e.g., docker cleanup, git branch prune).
