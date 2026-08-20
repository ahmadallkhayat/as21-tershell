import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { searchBarVariants } from './motion'
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
      className={`flex h-5 shrink-0 items-center justify-center rounded px-1.5 font-mono text-[10px] transition-all ${
        active
          ? 'bg-accent text-accent-contrast font-bold shadow-xs'
          : 'text-muted hover:bg-hover hover:text-bright'
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
    <motion.div
      variants={searchBarVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded-lg border border-line/90 bg-titlebar/95 px-2.5 py-1.5 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
    >
      <input
        ref={inputRef}
        value={query}
        placeholder="Find in terminal…"
        className={`w-44 bg-transparent text-xs outline-none placeholder:text-muted/70 ${
          invalidRegex ? 'text-danger font-medium' : 'text-bright'
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

      <div className="flex items-center gap-0.5 border-l border-line/60 pl-1.5">
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
      </div>

      {query && (
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
            invalidRegex
              ? 'border-danger/40 bg-danger/10 text-danger'
              : 'border-line/60 bg-surface/50 text-muted'
          }`}
        >
          {invalidRegex ? 'Bad regex' : matchCount > 0 ? `${matchIndex + 1}/${matchCount}` : '0/0'}
        </span>
      )}

      <div className="flex items-center gap-0.5 border-l border-line/60 pl-1">
        <button
          type="button"
          title="Previous match (Shift+Enter)"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-bright"
          onClick={onPrev}
        >
          <ChevronUpIcon size={10} />
        </button>
        <button
          type="button"
          title="Next match (Enter)"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-bright"
          onClick={onNext}
        >
          <ChevronDownIcon size={10} />
        </button>
        <button
          type="button"
          title="Close (Esc)"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-danger"
          onClick={onClose}
        >
          <CloseIcon size={10} />
        </button>
      </div>
    </motion.div>
  )
}
