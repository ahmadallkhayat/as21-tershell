interface Props {
  items: string[]
  selectedIndex: number
  x: number
  y: number
  onSelect: (index: number) => void
}

export default function SuggestionDropdown({ items, selectedIndex, x, y, onSelect }: Props): JSX.Element | null {
  if (items.length === 0) return null

  return (
    <div
      className="absolute z-20 min-w-[220px] overflow-hidden rounded-md border border-hover-strong bg-hover shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <div
          key={item}
          className={`cursor-pointer whitespace-nowrap border-l-2 px-2.5 py-1.5 font-mono text-xs ${
            i === selectedIndex
              ? 'border-accent bg-hover-strong text-bright'
              : 'border-transparent text-fg'
          }`}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(i)
          }}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
