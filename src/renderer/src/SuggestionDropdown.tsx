import { useLayoutEffect, useRef, useState } from 'react'

interface Props {
  items: string[]
  selectedIndex: number
  /** Cursor column position, relative to the positioned wrapper. */
  x: number
  /** Top edge of the cursor's line, relative to the positioned wrapper. */
  lineTop: number
  /** Bottom edge of the cursor's line, relative to the positioned wrapper. */
  lineBottom: number
  onSelect: (index: number) => void
}

/** Clearance between the cursor's line and the box, in either direction. */
const GAP = 12
/** Minimum breathing room kept between the box and the wrapper's edges. */
const EDGE_MARGIN = 8

export default function SuggestionDropdown({
  items,
  selectedIndex,
  x,
  lineTop,
  lineBottom,
  onSelect
}: Props): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const wrapper = el?.offsetParent as HTMLElement | null
    if (!el || !wrapper) return

    const { width, height } = el.getBoundingClientRect()
    const availableWidth = wrapper.clientWidth
    const availableHeight = wrapper.clientHeight

    // Prefer below the line; flip above when it wouldn't fit, so the box
    // never lands on top of the text being typed.
    const belowTop = lineBottom + GAP
    const aboveTop = lineTop - GAP - height
    const fitsBelow = belowTop + height <= availableHeight - EDGE_MARGIN
    const fitsAbove = aboveTop >= EDGE_MARGIN

    let top: number
    if (fitsBelow) top = belowTop
    else if (fitsAbove) top = aboveTop
    else top = Math.max(EDGE_MARGIN, availableHeight - EDGE_MARGIN - height)

    // Horizontally: track the cursor, but pull back inside the wrapper.
    const left = Math.max(
      EDGE_MARGIN,
      Math.min(x, availableWidth - EDGE_MARGIN - width)
    )

    setPlacement({ left, top })
  }, [x, lineTop, lineBottom, items])

  if (items.length === 0) return null

  return (
    <div
      ref={ref}
      className="absolute z-20 max-w-[min(420px,calc(100%-16px))] min-w-[220px] overflow-hidden rounded-md border border-hover-strong bg-hover py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{
        left: placement?.left ?? x,
        top: placement?.top ?? lineBottom + GAP,
        visibility: placement ? 'visible' : 'hidden'
      }}
    >
      {items.map((item, i) => (
        <div
          key={item}
          className={`cursor-pointer truncate border-l-2 px-3 py-1.5 font-mono text-xs ${
            i === selectedIndex
              ? 'border-accent bg-accent-soft text-bright'
              : 'border-transparent text-fg hover:bg-hover-strong'
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
