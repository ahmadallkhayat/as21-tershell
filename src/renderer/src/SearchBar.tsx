import { useEffect, useRef } from 'react'
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from './Icon'

export interface SearchToggles {
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  allPanes: boolean
}

interface Props {
  query: string
  matchIndex: number
  matchCount: number
  toggles: SearchToggles
  /** False when this tab has a single pane, in which case an "all panes"
   * toggle would be meaningless. */
  canSearchAllPanes: boolean
  invalidRegex: boolean
  onQueryChange: (query: string) => void
  onTogglesChange: (toggles: SearchToggles) => void
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

function ToggleButton({
  active,
  label,
  title,
  onClick
}: {
  active: boolean
  label: string
  title: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      className={`flex h-5 shrink-0 items-center rounded px-1.5 font-mono text-[10px] ${
        active ? 'bg-accent text-accent-contrast' : 'text-muted hover:bg-hover-strong hover:text-fg'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default function SearchBar({
  query,
  matchIndex,
  matchCount,
  toggles,
  canSearchAllPanes,
  invalidRegex,
  onQueryChange,
  onTogglesChange,
  onNext,
  onPrev,
  onClose
}: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const toggle = (key: keyof SearchToggles) => (): void =>
    onTogglesChange({ ...toggles, [key]: !toggles[key] })

  return (
    <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border border-hover-strong bg-hover px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <input
        ref={inputRef}
        value={query}
        placeholder="Find"
        className={`w-40 bg-transparent text-xs outline-none placeholder:text-muted ${
          invalidRegex ? 'text-danger' : 'text-fg'
        }`}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) onPrev()
            else onNext()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
      />

      <ToggleButton active={toggles.caseSensitive} label="Aa" title="Match case" onClick={toggle('caseSensitive')} />
      <ToggleButton active={toggles.wholeWord} label="ab" title="Match whole word" onClick={toggle('wholeWord')} />
      <ToggleButton active={toggles.regex} label=".*" title="Use regular expression" onClick={toggle('regex')} />
      {canSearchAllPanes && (
        <ToggleButton
          active={toggles.allPanes}
          label="⊞"
          title="Search all panes in this tab"
          onClick={toggle('allPanes')}
        />
      )}

      {query && (
        <span className={`shrink-0 text-[10px] ${invalidRegex ? 'text-danger' : 'text-muted'}`}>
          {invalidRegex ? 'bad regex' : matchCount > 0 ? `${matchIndex + 1}/${matchCount}` : '0/0'}
        </span>
      )}
      <button
        type="button"
        title="Previous match (Shift+Enter)"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-hover-strong hover:text-fg"
        onClick={onPrev}
      >
        <ChevronUpIcon size={10} />
      </button>
      <button
        type="button"
        title="Next match (Enter)"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-hover-strong hover:text-fg"
        onClick={onNext}
      >
        <ChevronDownIcon size={10} />
      </button>
      <button
        type="button"
        title="Close (Esc)"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-hover-strong hover:text-fg"
        onClick={onClose}
      >
        <CloseIcon size={10} />
      </button>
    </div>
  )
}
