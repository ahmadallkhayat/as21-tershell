import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon, type ISearchOptions } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { commitToHistory, getSuggestions } from './suggestions'
import SuggestionDropdown from './SuggestionDropdown'
import ContextMenu from './ContextMenu'
import SearchBar from './SearchBar'
import { resolveThemeMode, SEARCH_COLORS, TERMINAL_COLORS, type Settings } from './settings'
import { registerPanePty } from './paneProcess'
import { CloseIcon } from './Icon'

/** Search decorations hardcoded to dark-theme hex values would be near
 * invisible in light mode, so derive them from the resolved theme mode
 * instead of a static constant. */
function getSearchOptions(mode: 'dark' | 'light'): ISearchOptions {
  return { decorations: SEARCH_COLORS[mode] }
}

interface Props {
  paneId: string
  shellKey: string
  initialCommand?: string
  visible: boolean
  focused: boolean
  /** Show a per-pane close button — only meaningful once a tab has more
   * than one pane, since a single-pane tab is already closable via the
   * tab's own ×. */
  showCloseButton: boolean
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

export default function TerminalView({
  paneId,
  shellKey,
  initialCommand,
  visible,
  focused,
  showCloseButton,
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
  onZoom
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

  const [dropdown, setDropdown] = useState<DropdownState | null>(null)
  const dropdownRef = useRef<DropdownState | null>(null)
  dropdownRef.current = dropdown

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [exitInfo, setExitInfo] = useState<{ code: number } | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchInfo, setMatchInfo] = useState({ index: -1, count: 0 })
  const searchRef = useRef<SearchAddon | null>(null)

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
    term.loadAddon(fit)
    term.loadAddon(search)
    searchRef.current = search
    term.open(container)
    fit.fit()

    termRef.current = term
    fitRef.current = fit

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true

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
      setMatchInfo({ index: resultIndex, count: resultCount })
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
    let suggestionsPending = false

    const inAltScreen = (): boolean => term.buffer.active.type === 'alternate'

    const syncDropdown = (): void => {
      suggestionsPending = false
      if (!trusted || inAltScreen()) {
        closeDropdown()
        return
      }
      const items = getSuggestions(shellKey, lineBuffer)
      if (items.length === 0) {
        closeDropdown()
        return
      }
      const wrapper = wrapperRef.current
      if (!wrapper) return
      const anchor = getCursorAnchor(term, container, wrapper)
      setDropdown({ items, selected: 0, ...anchor })
    }

    // Cursor position only reflects reality after the pty echoes the
    // keystroke back and xterm renders it, so defer positioning to that
    // point rather than computing it synchronously on keypress.
    const requestSync = (): void => {
      suggestionsPending = true
    }

    const markDesynced = (): void => {
      trusted = false
      closeDropdown()
    }
    markDesyncedRef.current = markDesynced

    const acceptSuggestion = (index: number): void => {
      if (!trusted) return
      const items = dropdownRef.current?.items
      const chosen = items?.[index]
      if (!chosen || !ptyIdRef.current) return
      const backspaces = '\x7f'.repeat(lineBuffer.length)
      window.api.write(ptyIdRef.current, backspaces + chosen)
      lineBuffer = chosen
      closeDropdown()
    }
    acceptRef.current = acceptSuggestion

    window.api
      .createSession(shellKey, term.cols, term.rows, initialCommand)
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
        if (suggestionsPending) syncDropdown()
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
        if (trusted) commitToHistory(shellKey, lineBuffer)
        lineBuffer = ''
        trusted = true
        closeDropdown()
        return
      }
      if (data === '\x03') {
        lineBuffer = ''
        trusted = true
        closeDropdown()
        return
      }
      if (data === '\x7f' || data === '\b') {
        if (trusted) {
          lineBuffer = lineBuffer.slice(0, -1)
          requestSync()
        }
        return
      }
      // Anything else we can't confidently model as plain text: arrows,
      // Home/End, Ctrl+U/W/K, shell-side tab completion, escape sequences
      // in general (including pasted bracketed-paste content).
      if (data === '\t' || data === '\x15' || data === '\x17' || data === '\x0b' || data.startsWith('\x1b')) {
        markDesynced()
        return
      }
      if (!trusted) return
      lineBuffer += data
      requestSync()
    })

    const resizeObserver = new ResizeObserver(() => {
      fit.fit()
      if (ptyIdRef.current) window.api.resize(ptyIdRef.current, term.cols, term.rows)
    })
    resizeObserver.observe(container)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      onInput.dispose()
      onTitle.dispose()
      onSearchResults.dispose()
      onBufferChange.dispose()
      offData()
      offExit()
      registerPanePty(paneId, null)
      if (ptyIdRef.current) window.api.dispose(ptyIdRef.current)
      term.dispose()
    }
  }, [shellKey, paneId])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    // Assign only the specific fields we want — term.options is a proxy
    // where reassigning readonly fields like cols/rows throws, so spreading
    // the whole current options object back in (which includes those) is
    // not safe here.
    term.options.fontFamily = settings.fontFamily
    term.options.fontSize = settings.fontSize
    term.options.cursorStyle = settings.cursorStyle
    term.options.scrollback = settings.scrollback
    term.options.theme = {
      ...TERMINAL_COLORS[resolveThemeMode(settings.themeMode)],
      cursor: settings.accentColor
    }
    fitRef.current?.fit()
    if (ptyIdRef.current) window.api.resize(ptyIdRef.current, term.cols, term.rows)
    // Only the fields actually read above belong in the dependency array —
    // settings.defaultShell (or any other future field) changing shouldn't
    // re-fit and re-resize every open terminal for no visible reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!term) return
      term.options.theme = {
        ...TERMINAL_COLORS[resolveThemeMode(settings.themeMode)],
        cursor: settings.accentColor
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [settings])

  useEffect(() => {
    if (visible) {
      fitRef.current?.fit()
      termRef.current?.focus()
      if (ptyIdRef.current && termRef.current) {
        window.api.resize(ptyIdRef.current, termRef.current.cols, termRef.current.rows)
      }
    }
  }, [visible])

  useEffect(() => {
    if (visible && focused) termRef.current?.focus()
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

  useEffect(() => {
    if (!searchOpen) return
    if (!searchQuery) {
      searchRef.current?.clearDecorations()
      setMatchInfo({ index: -1, count: 0 })
      return
    }
    searchRef.current?.findNext(searchQuery, {
      ...getSearchOptions(resolveThemeMode(settings.themeMode)),
      incremental: true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchOpen])

  const closeSearch = (): void => {
    searchRef.current?.clearDecorations()
    setSearchOpen(false)
    setSearchQuery('')
    setMatchInfo({ index: -1, count: 0 })
    termRef.current?.focus()
  }

  return (
    <div
      ref={wrapperRef}
      className="terminal-container absolute inset-0 p-2"
      style={{ display: visible ? 'block' : 'none' }}
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
      {showCloseButton && (
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
          onClosePane={() => {
            setContextMenu(null)
            onCloseTabRef.current()
          }}
        />
      )}
      {searchOpen && (
        <SearchBar
          query={searchQuery}
          matchIndex={matchInfo.index}
          matchCount={matchInfo.count}
          onQueryChange={setSearchQuery}
          onNext={() =>
            searchQuery &&
            searchRef.current?.findNext(searchQuery, getSearchOptions(resolveThemeMode(settings.themeMode)))
          }
          onPrev={() =>
            searchQuery &&
            searchRef.current?.findPrevious(searchQuery, getSearchOptions(resolveThemeMode(settings.themeMode)))
          }
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
