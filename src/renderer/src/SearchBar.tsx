import { useEffect, useRef } from 'react'
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from './Icon'

interface Props {
  query: string
  matchIndex: number
  matchCount: number
  onQueryChange: (query: string) => void
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

export default function SearchBar({
  query,
  matchIndex,
  matchCount,
  onQueryChange,
  onNext,
  onPrev,
  onClose
}: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border border-hover-strong bg-hover px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <input
        ref={inputRef}
        value={query}
        placeholder="Find"
        className="w-40 bg-transparent text-xs text-fg outline-none placeholder:text-muted"
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
      {query && (
        <span className="shrink-0 text-[10px] text-muted">
          {matchCount > 0 ? `${matchIndex + 1}/${matchCount}` : '0/0'}
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
