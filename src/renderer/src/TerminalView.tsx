import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon, type ISearchOptions } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { commitToHistory, getSuggestions, loadHistory } from './suggestions'
import SuggestionDropdown from './SuggestionDropdown'
import ContextMenu from './ContextMenu'
import SearchBar from './SearchBar'
import { resolveThemeMode, TERMINAL_COLORS, type Settings } from './settings'

const SEARCH_OPTIONS: ISearchOptions = {
  decorations: {
    matchBackground: '#2a2e42',
    matchBorder: '#7c6cff',
    matchOverviewRuler: '#7c6cff',
    activeMatchBackground: '#7c6cff',
    activeMatchBorder: '#f4f5fc',
    activeMatchColorOverviewRuler: '#f4f5fc'
  }
}

interface Props {
  shellKey: string
  initialCommand?: string
  visible: boolean
  focused: boolean
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
  onFocusAdjacent: (direction: 1 | -1) => void
}

interface DropdownState {
  items: string[]
  selected: number
  x: number
  y: number
}

interface ContextMenuState {
  x: number
  y: number
  canCopy: boolean
}

function getCellSize(term: Terminal, container: HTMLElement): { width: number; height: number } {
  const rect = container.getBoundingClientRect()
  return {
    width: term.cols > 0 ? rect.width / term.cols : 9,
    height: term.rows > 0 ? rect.height / term.rows : 17
  }
}

function getCursorPixelPos(term: Terminal, container: HTMLElement): { x: number; y: number } {
  const { width, height } = getCellSize(term, container)
  const buf = term.buffer.active
  return { x: buf.cursorX * width, y: (buf.cursorY + 1) * height + 10 }
}

export default function TerminalView({
  shellKey,
  initialCommand,
  visible,
  focused,
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
  onFocusAdjacent
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
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

  const [dropdown, setDropdown] = useState<DropdownState | null>(null)
  const dropdownRef = useRef<DropdownState | null>(null)
  dropdownRef.current = dropdown

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchInfo, setMatchInfo] = useState({ index: -1, count: 0 })
  const searchRef = useRef<SearchAddon | null>(null)

  const acceptRef = useRef<(index: number) => void>(() => {})

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: settings.cursorStyle,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
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
          onFocusAdjacentRef.current(-1)
          return false
        }
        if (event.key === 'ArrowRight') {
          onFocusAdjacentRef.current(1)
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
    let lineBuffer = ''
    let history = loadHistory()

    const closeDropdown = (): void => setDropdown(null)
    let suggestionsPending = false

    const syncDropdown = (): void => {
      suggestionsPending = false
      const items = getSuggestions(lineBuffer, history)
      if (items.length === 0) {
        closeDropdown()
        return
      }
      const pos = getCursorPixelPos(term, container)
      setDropdown({ items, selected: 0, x: pos.x, y: pos.y })
    }

    // Cursor position only reflects reality after the pty echoes the
    // keystroke back and xterm renders it, so defer positioning to that
    // point rather than computing it synchronously on keypress.
    const requestSync = (): void => {
      suggestionsPending = true
    }

    const acceptSuggestion = (index: number): void => {
      const items = dropdownRef.current?.items
      const chosen = items?.[index]
      if (!chosen || !ptyIdRef.current) return
      const backspaces = '\x7f'.repeat(lineBuffer.length)
      window.api.write(ptyIdRef.current, backspaces + chosen)
      lineBuffer = chosen
      closeDropdown()
    }
    acceptRef.current = acceptSuggestion

    window.api.createSession(shellKey, term.cols, term.rows).then((id) => {
      if (disposed) {
        window.api.dispose(id)
        return
      }
      ptyIdRef.current = id
      if (initialCommand) {
        window.api.write(id, `${initialCommand}\r`)
      }
    })

    const offData = window.api.onData((id, data) => {
      if (id !== ptyIdRef.current) return
      term.write(data, () => {
        if (suggestionsPending) syncDropdown()
      })
    })
    const offExit = window.api.onExit((id) => {
      if (id === ptyIdRef.current) onExitRef.current()
    })

    const onInput = term.onData((data) => {
      if (!ptyIdRef.current) return
      const current = dropdownRef.current

      if (current) {
        if (data === '\x1b[A') {
          setDropdown({ ...current, selected: (current.selected - 1 + current.items.length) % current.items.length })
          return
        }
        if (data === '\x1b[B') {
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
        history = commitToHistory(history, lineBuffer)
        lineBuffer = ''
        closeDropdown()
        return
      }
      if (data === '\x7f' || data === '\b') {
        lineBuffer = lineBuffer.slice(0, -1)
        requestSync()
        return
      }
      if (data === '\x03') {
        lineBuffer = ''
        closeDropdown()
        return
      }
      if (data === '\t' || data.startsWith('\x1b')) {
        closeDropdown()
        return
      }
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
      offData()
      offExit()
      if (ptyIdRef.current) window.api.dispose(ptyIdRef.current)
      term.dispose()
    }
  }, [shellKey])

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
    term.options.theme = {
      ...TERMINAL_COLORS[resolveThemeMode(settings.themeMode)],
      cursor: settings.accentColor
    }
    fitRef.current?.fit()
    if (ptyIdRef.current) window.api.resize(ptyIdRef.current, term.cols, term.rows)
  }, [settings])

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
    setContextMenu(null)
  }

  useEffect(() => {
    if (!searchOpen) return
    if (!searchQuery) {
      searchRef.current?.clearDecorations()
      setMatchInfo({ index: -1, count: 0 })
      return
    }
    searchRef.current?.findNext(searchQuery, { ...SEARCH_OPTIONS, incremental: true })
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
      {dropdown && (
        <SuggestionDropdown
          items={dropdown.items}
          selectedIndex={dropdown.selected}
          x={dropdown.x}
          y={dropdown.y}
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
          onNext={() => searchQuery && searchRef.current?.findNext(searchQuery, SEARCH_OPTIONS)}
          onPrev={() => searchQuery && searchRef.current?.findPrevious(searchQuery, SEARCH_OPTIONS)}
          onClose={closeSearch}
        />
      )}
    </div>
  )
}
