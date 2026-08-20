import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon, type ISearchOptions } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { commitToHistory, getSuggestions } from './suggestions'
import SuggestionDropdown from './SuggestionDropdown'
import ContextMenu from './ContextMenu'
import SearchBar from './SearchBar'
import {
  resolveThemeMode,
  SEARCH_COLORS,
  TERMINAL_COLORS,
  type Settings,
  type ShellProfile
} from './settings'
import { registerPanePty } from './paneProcess'
import { parseOsc7, registerPaneCwd } from './paneCwd'
import {
  advanceAcrossPanes,
  clearOtherPanes,
  globalResults,
  highlightOtherPanes,
  registerPaneSearch
} from './paneSearch'
import type { SearchToggles } from './SearchBar'
import { CloseIcon } from './Icon'

const DEFAULT_TOGGLES: SearchToggles = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  allPanes: false
}

/** Search decorations hardcoded to dark-theme hex values would be near
 * invisible in light mode, so derive them from the resolved theme mode
 * instead of a static constant. */
function getSearchOptions(mode: 'dark' | 'light', toggles: SearchToggles): ISearchOptions {
  return {
    decorations: SEARCH_COLORS[mode],
    caseSensitive: toggles.caseSensitive,
    wholeWord: toggles.wholeWord,
    regex: toggles.regex
  }
}

/** The addon throws on a malformed pattern, so validate before handing it
 * over and surface it in the bar rather than letting it blow up mid-type. */
function isInvalidRegex(query: string, toggles: SearchToggles): boolean {
  if (!toggles.regex || !query) return false
  try {
    new RegExp(query)
    return false
  } catch {
    return true
  }
}

interface Props {
  paneId: string
  shellKey: string
  initialCommand?: string
  /** Directory to start this pane's shell in. */
  cwd?: string
  /** Set when shellKey names a user-defined profile, which the main
   * process can't look up on its own. */
  customProfile?: ShellProfile
  visible: boolean
  focused: boolean
  /** Whether this pane's tab currently holds more than one pane. Drives
   * the per-pane close button (a single-pane tab is already closable via
   * the tab's own ×) and the search bar's "all panes" toggle. */
  isSplit: boolean
  settings: Settings
  onExit: () => void
  onTitleChange: (title: string) => void
  onNewTab: () => void
  onCloseTab: () => void
  onNextTab: () => void
  onPrevTab: () => void
  onSelectTabIndex: (index: number) => void
  onSplitRight: () => void
  onSplitDown: () => void
  onFocusAdjacent: (direction: 'left' | 'right' | 'up' | 'down') => void
  onZoom: (delta: number | 'reset') => void
  onOpenSettings?: () => void
  onShowShortcuts?: () => void
}

interface DropdownState {
  items: string[]
  selected: number
  x: number
  lineTop: number
  lineBottom: number
}

interface ContextMenuState {
  x: number
  y: number
  canCopy: boolean
}

/**
 * The cursor cell's box in pixels, relative to `wrapper` (the positioned
 * ancestor the dropdown is absolutely placed within). The dropdown needs the
 * full line box — not just a point — so it can sit clear of the line whether
 * it opens below or flips above it.
 *
 * Measures against xterm's own `.xterm-screen` element rather than our
 * container: the screen's box is exactly cols x rows cells, so dividing it
 * gives the true cell size with no drift across long lines, and its offset
 * accounts for the wrapper's padding automatically.
 */
function isRenderReady(term: Terminal | null): boolean {
  if (!term) return false
  try {
    const core = (
      term as unknown as {
        _core?: {
          _renderService?: {
            _renderer?: {
              value?: {
                dimensions?: {
                  css?: { cell?: { height?: number; width?: number } }
                  actualCellWidth?: number
                  actualCellHeight?: number
                }
              }
            }
          }
        }
      }
    )._core
    const renderer = core?._renderService?._renderer?.value
    if (!renderer) return false
    const dims = renderer.dimensions
    const cellH = dims?.css?.cell?.height ?? 0
    const cellW = dims?.css?.cell?.width ?? 0
    return cellH > 0 && cellW > 0
  } catch {
    return false
  }
}

function safeFit(fit: FitAddon | null, term: Terminal | null, container: HTMLElement | null): void {
  if (!fit || !term || !container) return
  if (!container.isConnected || container.clientWidth <= 0 || container.clientHeight <= 0) return
  if (!isRenderReady(term)) {
    requestAnimationFrame(() => {
      try {
        if (
          container.isConnected &&
          container.clientWidth > 0 &&
          container.clientHeight > 0 &&
          isRenderReady(term)
        ) {
          fit.fit()
        }
      } catch {
        // Suppress dimensions error on initial layout
      }
    })
    return
  }
  try {
    fit.fit()
  } catch {
    // Suppress errors when element dimensions are not ready or detached
  }
}

function safeFocus(term: Terminal | null, container: HTMLElement | null): void {
  if (!term || !container) return
  if (!container.isConnected || container.clientWidth <= 0 || container.clientHeight <= 0) return
  if (!isRenderReady(term)) {
    requestAnimationFrame(() => {
      try {
        if (
          container.isConnected &&
          container.clientWidth > 0 &&
          container.clientHeight > 0 &&
          isRenderReady(term)
        ) {
          term.focus()
        }
      } catch {
        // Suppress focus error before first render pass
      }
    })
    return
  }
  try {
    term.focus()
  } catch {
    // Suppress focus error
  }
}

function getCursorAnchor(
  term: Terminal,
  container: HTMLElement,
  wrapper: HTMLElement
): { x: number; lineTop: number; lineBottom: number } {
  const screen = container.querySelector('.xterm-screen') as HTMLElement | null
  const target = screen ?? container
  const targetRect = target.getBoundingClientRect()
  const wrapperRect = wrapper.getBoundingClientRect()

  const cellWidth = term.cols > 0 ? targetRect.width / term.cols : 9
  const cellHeight = term.rows > 0 ? targetRect.height / term.rows : 17
  const buf = term.buffer.active

  const offsetX = targetRect.left - wrapperRect.left
  const offsetY = targetRect.top - wrapperRect.top

  return {
    x: offsetX + buf.cursorX * cellWidth,
    lineTop: offsetY + buf.cursorY * cellHeight,
    lineBottom: offsetY + (buf.cursorY + 1) * cellHeight
  }
}

function extractCommandLine(term: Terminal): string {
  try {
    const buf = term.buffer.active
    const line = buf.getLine(buf.baseY + buf.cursorY)
    if (!line) return ''
    const fullText = line.translateToString(false).slice(0, buf.cursorX)
    const match = fullText.match(/(?:PS\s+[^>]*>|[^>%$#\n]+[>%$#])\s*(.*)$/)
    if (match) return match[1]
    return fullText.trimStart()
  } catch {
    return ''
  }
}

export default function TerminalView({
  paneId,
  shellKey,
  initialCommand,
  cwd,
  customProfile,
  visible,
  focused,
  isSplit,
  settings,
  onExit,
  onTitleChange,
  onNewTab,
  onCloseTab,
  onNextTab,
  onPrevTab,
  onSelectTabIndex,
  onSplitRight,
  onSplitDown,
  onFocusAdjacent,
  onZoom,
  onOpenSettings,
  onShowShortcuts
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<string | null>(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  const onTitleChangeRef = useRef(onTitleChange)
  onTitleChangeRef.current = onTitleChange
  const onNewTabRef = useRef(onNewTab)
  onNewTabRef.current = onNewTab
  const onCloseTabRef = useRef(onCloseTab)
  onCloseTabRef.current = onCloseTab
  const onNextTabRef = useRef(onNextTab)
  onNextTabRef.current = onNextTab
  const onPrevTabRef = useRef(onPrevTab)
  onPrevTabRef.current = onPrevTab
  const onSelectTabIndexRef = useRef(onSelectTabIndex)
  onSelectTabIndexRef.current = onSelectTabIndex
  const onSplitRightRef = useRef(onSplitRight)
  onSplitRightRef.current = onSplitRight
  const onSplitDownRef = useRef(onSplitDown)
  onSplitDownRef.current = onSplitDown
  const onFocusAdjacentRef = useRef(onFocusAdjacent)
  onFocusAdjacentRef.current = onFocusAdjacent
  const onZoomRef = useRef(onZoom)
  onZoomRef.current = onZoom
  const onOpenSettingsRef = useRef(onOpenSettings)
  onOpenSettingsRef.current = onOpenSettings
  const onShowShortcutsRef = useRef(onShowShortcuts)
  onShowShortcutsRef.current = onShowShortcuts

  const [dropdown, setDropdown] = useState<DropdownState | null>(null)
  const dropdownRef = useRef<DropdownState | null>(null)
  dropdownRef.current = dropdown

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [exitInfo, setExitInfo] = useState<{ code: number } | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchInfo, setMatchInfo] = useState({ index: -1, count: 0 })
  const [searchToggles, setSearchToggles] = useState<SearchToggles>(DEFAULT_TOGGLES)
  const searchRef = useRef<SearchAddon | null>(null)
  // The addon reports results asynchronously via onDidChangeResults; this
  // mirror lets the cross-pane coordinator read this pane's latest counts
  // synchronously, without waiting on a React render.
  const matchInfoRef = useRef({ index: -1, count: 0 })

  const acceptRef = useRef<(index: number) => void>(() => {})
  const markDesyncedRef = useRef<() => void>(() => {})

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: settings.cursorStyle,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      scrollback: settings.scrollback,
      theme: {
        ...TERMINAL_COLORS[resolveThemeMode(settings.themeMode)],
        cursor: settings.accentColor
      }
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    const webLinks = new WebLinksAddon((_event, uri) => {
      window.api.openExternal(uri)
    })
    term.loadAddon(fit)
    term.loadAddon(search)
    term.loadAddon(webLinks)
    searchRef.current = search
    if (container.isConnected) {
      term.open(container)
      requestAnimationFrame(() => {
        safeFit(fit, term, container)
        if (focused) safeFocus(term, container)
      })
    } else {
      requestAnimationFrame(() => {
        if (!disposed && container.isConnected) {
          term.open(container)
          requestAnimationFrame(() => {
            safeFit(fit, term, container)
            if (focused) safeFocus(term, container)
          })
        }
      })
    }

    termRef.current = term
    fitRef.current = fit

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true

      if (event.key === 'F1' || (event.ctrlKey && event.shiftKey && (event.key === '?' || event.key === '/'))) {
        onShowShortcutsRef.current?.()
        return false
      }

      if (event.altKey && !event.ctrlKey && !event.shiftKey) {
        if (event.key === 'ArrowLeft') {
          onFocusAdjacentRef.current('left')
          return false
        }
        if (event.key === 'ArrowRight') {
          onFocusAdjacentRef.current('right')
          return false
        }
        if (event.key === 'ArrowUp') {
          onFocusAdjacentRef.current('up')
          return false
        }
        if (event.key === 'ArrowDown') {
          onFocusAdjacentRef.current('down')
          return false
        }
        return true
      }

      if (!event.ctrlKey) return true
      const key = event.key.toLowerCase()

      if (key === 'k' && !event.shiftKey) {
        term.clear()
        return false
      }

      if (key === ',') {
        onOpenSettingsRef.current?.()
        return false
      }

      if (key === 'tab') {
        if (event.shiftKey) onPrevTabRef.current()
        else onNextTabRef.current()
        return false
      }

      // Font-size zoom (Ctrl+=/Ctrl+-/Ctrl+0) is checked before the
      // shift-only gate below since it's the standard shortcut everywhere
      // else (browsers, VS Code, Windows Terminal) and isn't bound to
      // anything shell-side, unlike bare Ctrl+C/Ctrl+V which this app
      // deliberately leaves alone in favor of the Ctrl+Shift+ variants.
      if (key === '=' || key === '+') {
        onZoomRef.current(1)
        return false
      }
      if (key === '-') {
        onZoomRef.current(-1)
        return false
      }
      if (key === '0') {
        onZoomRef.current('reset')
        return false
      }

      if (!event.shiftKey) return true

      switch (key) {
        case 'c': {
          const selection = term.getSelection()
          if (!selection) return true
          navigator.clipboard.writeText(selection)
          return false
        }
        case 'v':
          navigator.clipboard.readText().then((text) => {
            if (text && ptyIdRef.current) window.api.write(ptyIdRef.current, text)
          })
          // Pasted text never flows through onData's lineBuffer tracking,
          // so treat it the same as any other edit we can't see the shape of.
          markDesyncedRef.current()
          return false
        case 't':
          onNewTabRef.current()
          return false
        case 'w':
          onCloseTabRef.current()
          return false
        case 'f':
          setSearchOpen(true)
          return false
        case 'd':
          onSplitRightRef.current()
          return false
        case 'e':
          onSplitDownRef.current()
          return false
        default:
          if (event.code.startsWith('Digit')) {
            const digit = event.code.slice(5)
            if (digit >= '1' && digit <= '9') {
              onSelectTabIndexRef.current(Number(digit) - 1)
              return false
            }
          }
          return true
      }
    })

    const onTitle = term.onTitleChange((title) => {
      if (title) onTitleChangeRef.current(title)
    })

    const onSearchResults = search.onDidChangeResults(({ resultIndex, resultCount }) => {
      matchInfoRef.current = { index: resultIndex, count: resultCount }
      setMatchInfo({ index: resultIndex, count: resultCount })
    })

    // Exposes this pane's search to the cross-pane coordinator so an
    // "all panes" search can highlight here and step through these matches
    // even while the bar itself lives in a different pane.
    registerPaneSearch(paneId, {
      highlight: (query, opts) => {
        search.findNext(query, { ...opts, incremental: true })
      },
      findNext: (query, opts) => search.findNext(query, opts),
      findPrevious: (query, opts) => search.findPrevious(query, opts),
      clear: () => {
        search.clearDecorations()
        matchInfoRef.current = { index: -1, count: 0 }
      },
      getResults: () => matchInfoRef.current,
      open: () => setSearchOpen(true)
    })

    // Shells report their working directory with OSC 7; tracking it is
    // what lets a split or duplicate open where this pane actually is.
    const onCwd = term.parser.registerOscHandler(7, (data) => {
      registerPaneCwd(paneId, parseOsc7(data))
      return true
    })

    let disposed = false
    let exited = false
    let lineBuffer = ''
    setExitInfo(null)

    // Whether lineBuffer can actually be trusted to match the shell's real
    // input line. We only ever append/trim it ourselves for plain typing,
    // Enter, Backspace and Ctrl+C — ANY other line-editing gesture (arrow
    // keys, Home/End, Ctrl+U/W/K, shell history recall, shell-side tab
    // completion, a paste) can rewrite the shell's line in ways we have no
    // visibility into. Rather than guess at PSReadLine/cmd keybindings and
    // risk being wrong, we just stop trusting lineBuffer the moment any of
    // those happen, and stay untrusted until Enter/Ctrl+C gives us a known
    // (empty) baseline again. This is what makes acceptSuggestion's
    // backspace-count safe: it refuses to run at all while untrusted.
    let trusted = true

    const closeDropdown = (): void => setDropdown(null)
    markDesyncedRef.current = closeDropdown

    const inAltScreen = (): boolean => term.buffer.active.type === 'alternate'

    const syncDropdown = (overrideBuffer?: string): void => {
      if (inAltScreen()) {
        closeDropdown()
        return
      }
      const bufferToUse = overrideBuffer !== undefined ? overrideBuffer : (lineBuffer || extractCommandLine(term))
      const items = getSuggestions(shellKey, bufferToUse)
      if (items.length === 0) {
        closeDropdown()
        return
      }
      const wrapper = wrapperRef.current
      if (!wrapper) return
      const anchor = getCursorAnchor(term, container, wrapper)
      setDropdown({ items, selected: 0, ...anchor })
    }

    const acceptSuggestion = (index: number): void => {
      const items = dropdownRef.current?.items
      const chosen = items?.[index]
      if (!chosen || !ptyIdRef.current) return
      const currentInput = lineBuffer || extractCommandLine(term)
      const backspaces = '\x7f'.repeat(currentInput.length)
      window.api.write(ptyIdRef.current, backspaces + chosen)
      lineBuffer = chosen
      closeDropdown()
    }
    acceptRef.current = acceptSuggestion

    window.api
      .createSession(shellKey, term.cols, term.rows, {
        cwd,
        initialCommand,
        // Read at spawn time only, like the other settings this effect
        // consumes — toggling it later applies to newly opened panes.
        cwdTracking: settings.cwdTracking,
        custom: customProfile
      })
      .then((id) => {
        if (disposed) {
          window.api.dispose(id)
          return
        }
        ptyIdRef.current = id
        registerPanePty(paneId, id)
      })
      .catch((err: unknown) => {
        if (disposed) return
        const message = err instanceof Error ? err.message : String(err)
        term.writeln(`\r\n\x1b[31mFailed to start shell: ${message}\x1b[0m`)
      })

    const offData = window.api.onData((id, data) => {
      if (id !== ptyIdRef.current) return
      term.write(data, () => {
        if (lineBuffer) syncDropdown()
      })
    })
    const offExit = window.api.onExit((id, exitCode) => {
      if (id !== ptyIdRef.current) return
      // Don't remove the pane the instant its process dies — that takes
      // any error output with it before it can be read. Show what
      // happened and wait for the user to actually dismiss it.
      exited = true
      closeDropdown()
      setExitInfo({ code: exitCode })
    })

    // Belt-and-suspenders: close the dropdown the instant a full-screen app
    // (vim, htop, less, an agent CLI) takes over via the alternate screen
    // buffer, rather than only on the next keystroke.
    const onBufferChange = term.buffer.onBufferChange(() => {
      if (inAltScreen()) closeDropdown()
    })

    const onInput = term.onData((data) => {
      if (!ptyIdRef.current || exited) return
      const current = dropdownRef.current

      if (current && !inAltScreen()) {
        // Ctrl+Up/Down navigate the dropdown; plain Up/Down are left alone
        // so shell history recall is never stolen just because a
        // suggestion happens to be showing.
        if (data === '\x1b[1;5A') {
          setDropdown({ ...current, selected: (current.selected - 1 + current.items.length) % current.items.length })
          return
        }
        if (data === '\x1b[1;5B') {
          setDropdown({ ...current, selected: (current.selected + 1) % current.items.length })
          return
        }
        if (data === '\t') {
          acceptSuggestion(current.selected)
          return
        }
        if (data === '\x1b') {
          closeDropdown()
          return
        }
      }

      window.api.write(ptyIdRef.current, data)

      if (data === '\r' || data === '\n') {
        if (lineBuffer) commitToHistory(shellKey, lineBuffer)
        lineBuffer = ''
        closeDropdown()
        return
      }
      if (data === '\x03') {
        lineBuffer = ''
        closeDropdown()
        return
      }
      if (data === '\x7f' || data === '\b') {
        lineBuffer = lineBuffer.slice(0, -1)
        syncDropdown(lineBuffer)
        return
      }
      // Anything else we can't confidently model as plain text: arrows,
      // Home/End, Ctrl+U/W/K, shell-side tab completion, escape sequences.
      if (data === '\t' || data === '\x15' || data === '\x17' || data === '\x0b' || data.startsWith('\x1b')) {
        if (data.startsWith('\x1b')) {
          closeDropdown()
        }
        return
      }
      lineBuffer += data
      syncDropdown(lineBuffer)
    })

    const resizeObserver = new ResizeObserver(() => {
      safeFit(fit, term, container)
      if (ptyIdRef.current && term.cols > 0 && term.rows > 0) {
        window.api.resize(ptyIdRef.current, term.cols, term.rows)
      }
    })
    resizeObserver.observe(container)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      onInput.dispose()
      onTitle.dispose()
      onSearchResults.dispose()
      onBufferChange.dispose()
      onCwd.dispose()
      offData()
      offExit()
      registerPanePty(paneId, null)
      registerPaneSearch(paneId, null)
      registerPaneCwd(paneId, null)
      if (ptyIdRef.current) window.api.dispose(ptyIdRef.current)
      term.dispose()
    }
  }, [shellKey, paneId])

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const term = termRef.current
    if (!term) return

    const applyOptions = (): void => {
      try {
        if (term.options.fontFamily !== settings.fontFamily) term.options.fontFamily = settings.fontFamily
        if (term.options.fontSize !== settings.fontSize) term.options.fontSize = settings.fontSize
        if (term.options.cursorStyle !== settings.cursorStyle) term.options.cursorStyle = settings.cursorStyle
        if (term.options.scrollback !== settings.scrollback) term.options.scrollback = settings.scrollback
        term.options.theme = {
          ...TERMINAL_COLORS[resolveThemeMode(settings.themeMode)],
          cursor: settings.accentColor
        }
        safeFit(fitRef.current, term, containerRef.current)
        if (ptyIdRef.current && term.cols > 0 && term.rows > 0) {
          window.api.resize(ptyIdRef.current, term.cols, term.rows)
        }
      } catch {
        // Suppress options update before render service is fully ready
      }
    }

    if (!isRenderReady(term)) {
      requestAnimationFrame(applyOptions)
    } else {
      applyOptions()
    }
  }, [
    settings.fontFamily,
    settings.fontSize,
    settings.cursorStyle,
    settings.themeMode,
    settings.accentColor,
    settings.scrollback
  ])

  useEffect(() => {
    if (settings.themeMode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = (): void => {
      const term = termRef.current
      if (!term || !isRenderReady(term)) return
      try {
        term.options.theme = {
          ...TERMINAL_COLORS[resolveThemeMode(settings.themeMode)],
          cursor: settings.accentColor
        }
      } catch {
        // Suppress theme update error
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [settings])

  useEffect(() => {
    if (visible) {
      safeFit(fitRef.current, termRef.current, containerRef.current)
      safeFocus(termRef.current, containerRef.current)
      if (ptyIdRef.current && termRef.current && termRef.current.cols > 0 && termRef.current.rows > 0) {
        window.api.resize(ptyIdRef.current, termRef.current.cols, termRef.current.rows)
      }
    }
  }, [visible])

  useEffect(() => {
    if (visible && focused) safeFocus(termRef.current, containerRef.current)
  }, [focused, visible])

  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => setContextMenu(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', close)
    }
  }, [contextMenu])

  // Only dismiss the "process exited" overlay from user input while this
  // pane is actually the one on screen — a background tab whose shell died
  // shouldn't vanish just because the user is typing somewhere else.
  useEffect(() => {
    if (!exitInfo || !visible) return
    const close = (): void => onExitRef.current()
    window.addEventListener('keydown', close)
    window.addEventListener('mousedown', close)
    return () => {
      window.removeEventListener('keydown', close)
      window.removeEventListener('mousedown', close)
    }
  }, [exitInfo, visible])

  const handleCopy = (): void => {
    const term = termRef.current
    const selection = term?.getSelection()
    if (selection) navigator.clipboard.writeText(selection)
    setContextMenu(null)
  }

  const handlePaste = (): void => {
    navigator.clipboard.readText().then((text) => {
      if (text && ptyIdRef.current) window.api.write(ptyIdRef.current, text)
    })
    markDesyncedRef.current()
    setContextMenu(null)
  }

  const invalidRegex = isInvalidRegex(searchQuery, searchToggles)
  const searchOptions = getSearchOptions(resolveThemeMode(settings.themeMode), searchToggles)

  useEffect(() => {
    if (!searchOpen) return
    if (!searchQuery || invalidRegex) {
      searchRef.current?.clearDecorations()
      matchInfoRef.current = { index: -1, count: 0 }
      setMatchInfo({ index: -1, count: 0 })
      clearOtherPanes(paneId)
      return
    }
    searchRef.current?.findNext(searchQuery, { ...searchOptions, incremental: true })
    // Light up every other pane too, so "all panes" both shows matches
    // everywhere and gives each pane a count for the global tally.
    if (searchToggles.allPanes) highlightOtherPanes(paneId, searchQuery, searchOptions)
    else clearOtherPanes(paneId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchOpen, searchToggles, invalidRegex, paneId])

  const runSearch = (direction: 1 | -1): void => {
    if (!searchQuery || invalidRegex) return
    if (
      searchToggles.allPanes &&
      advanceAcrossPanes(paneId, direction, searchQuery, searchOptions)
    ) {
      return
    }
    if (direction === 1) searchRef.current?.findNext(searchQuery, searchOptions)
    else searchRef.current?.findPrevious(searchQuery, searchOptions)
  }

  const closeSearch = (): void => {
    searchRef.current?.clearDecorations()
    clearOtherPanes(paneId)
    setSearchOpen(false)
    setSearchQuery('')
    matchInfoRef.current = { index: -1, count: 0 }
    setMatchInfo({ index: -1, count: 0 })
    safeFocus(termRef.current, containerRef.current)
  }

  const [isDragOver, setIsDragOver] = useState(false)

  const handleExportLog = async (): Promise<void> => {
    const term = termRef.current
    if (!term) return
    const buf = term.buffer.active
    const lines: string[] = []
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i)
      if (line) lines.push(line.translateToString(true))
    }
    const content = lines.join('\n').trimEnd()
    await window.api.saveFile(content, `${shellKey}-session.log`)
  }

  const handleClear = (): void => {
    termRef.current?.clear()
  }

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0 && ptyIdRef.current) {
      const paths = Array.from(files).map((f) => {
        const p = (f as unknown as { path?: string }).path || f.name
        return p.includes(' ') ? `"${p}"` : p
      })
      window.api.write(ptyIdRef.current, paths.join(' '))
    }
  }

  const displayedMatches = searchToggles.allPanes ? globalResults(paneId, matchInfo) : matchInfo

  return (
    <div
      ref={wrapperRef}
      className={`terminal-container absolute inset-0 p-2 transition-all ${
        isDragOver ? 'ring-2 ring-inset ring-accent bg-accent-soft/30' : ''
      }`}
      style={{ display: visible ? 'block' : 'none' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        setContextMenu({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          canCopy: !!termRef.current?.hasSelection()
        })
      }}
    >
      <div ref={containerRef} className="h-full w-full" />
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/70 backdrop-blur-xs text-accent font-medium text-xs">
          Drop files to paste paths
        </div>
      )}
      {isSplit && (
        <button
          type="button"
          title="Close pane"
          className="absolute right-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-hover-strong hover:text-fg"
          onClick={() => onCloseTabRef.current()}
        >
          <CloseIcon size={10} />
        </button>
      )}
      {dropdown && (
        <SuggestionDropdown
          items={dropdown.items}
          selectedIndex={dropdown.selected}
          x={dropdown.x}
          lineTop={dropdown.lineTop}
          lineBottom={dropdown.lineBottom}
          onSelect={(i) => acceptRef.current(i)}
        />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canCopy={contextMenu.canCopy}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onSplitRight={() => {
            setContextMenu(null)
            onSplitRightRef.current()
          }}
          onSplitDown={() => {
            setContextMenu(null)
            onSplitDownRef.current()
          }}
          onClear={() => {
            setContextMenu(null)
            handleClear()
          }}
          onExportLog={() => {
            setContextMenu(null)
            handleExportLog()
          }}
          onClosePane={() => {
            setContextMenu(null)
            onCloseTabRef.current()
          }}
        />
      )}
      {searchOpen && (
        <SearchBar
          query={searchQuery}
          matchIndex={displayedMatches.index}
          matchCount={displayedMatches.count}
          toggles={searchToggles}
          canSearchAllPanes={isSplit}
          invalidRegex={invalidRegex}
          onQueryChange={setSearchQuery}
          onTogglesChange={setSearchToggles}
          onNext={() => runSearch(1)}
          onPrev={() => runSearch(-1)}
          onClose={closeSearch}
        />
      )}
      {exitInfo && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-hover-strong bg-hover/95 px-3 py-2 text-xs text-fg">
          <span>
            Process exited
            {exitInfo.code !== 0 && <span className="text-danger"> (code {exitInfo.code})</span>}
          </span>
          <button
            type="button"
            className="rounded px-2 py-1 text-[11px] text-muted hover:bg-hover-strong hover:text-fg"
            onClick={() => onExitRef.current()}
          >
            Close (any key)
          </button>
        </div>
      )}
    </div>
  )
}
