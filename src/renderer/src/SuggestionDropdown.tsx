import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { suggestionDropdownVariants } from './motion'

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
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 280, height: 180 })

  useLayoutEffect(() => {
    const el = ref.current
    if (el) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height })
      }
    }
  }, [items])

  if (items.length === 0) return null

  const el = ref.current
  const wrapper = (el?.closest('.terminal-container') || el?.parentElement) as HTMLElement | null
  const availableWidth = wrapper?.clientWidth || window.innerWidth
  const availableHeight = wrapper?.clientHeight || window.innerHeight

  const belowTop = lineBottom + GAP
  const aboveTop = lineTop - GAP - size.height
  const fitsBelow = belowTop + size.height <= availableHeight - EDGE_MARGIN
  const fitsAbove = aboveTop >= EDGE_MARGIN

  let top: number
  if (fitsBelow) top = belowTop
  else if (fitsAbove) top = aboveTop
  else top = Math.max(EDGE_MARGIN, availableHeight - EDGE_MARGIN - size.height)

  const left = Math.max(
    EDGE_MARGIN,
    Math.min(x, availableWidth - EDGE_MARGIN - size.width)
  )

  return (
    <motion.div
      ref={ref}
      role="listbox"
      variants={suggestionDropdownVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute z-50 max-w-[min(460px,calc(100%-16px))] min-w-[240px] overflow-hidden rounded-lg border border-line/90 bg-titlebar/98 p-1 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.65)] [-webkit-app-region:no-drag]"
      style={{
        left,
        top
      }}
    >
      <div className="max-h-56 overflow-y-auto scroll-custom space-y-0.5">
        {items.map((item, i) => (
          <div
            key={item}
            role="option"
            aria-selected={i === selectedIndex}
            className={`flex items-center gap-2 cursor-pointer truncate rounded-md px-2.5 py-1.5 font-mono text-xs transition-colors [-webkit-app-region:no-drag] ${
              i === selectedIndex
                ? 'bg-accent-soft text-bright font-medium ring-1 ring-accent/30'
                : 'text-fg hover:bg-hover hover:text-bright'
            }`}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSelect(i)
            }}
          >
            <span className="shrink-0 text-[10px] text-muted">›</span>
            <span className="truncate">{item}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-line/50 px-2 pt-1 text-[9px] text-muted">
        <span>Tab to accept</span>
        <span>Esc to dismiss</span>
      </div>
    </motion.div>
  )
}
