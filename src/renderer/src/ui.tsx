import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, ChevronUpIcon } from './Icon'
import { useClampToViewport } from './useClampToViewport'

const CONTROL_BASE =
  'rounded-md border border-hover-strong bg-hover text-xs text-fg outline-none transition-colors'

export interface SelectOption {
  value: string
  label: string
  icon?: ReactNode
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  minWidth?: number
}

/** Custom dropdown — replaces native <select> so it matches app styling and never renders an OS-drawn list. */
export function Select({ value, options, onChange, minWidth = 150 }: SelectProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState({ left: 0, top: 0, width: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useLayoutEffect(() => {
    if (!open) return
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) setAnchor({ left: rect.left, top: rect.bottom + 4, width: rect.width })
  }, [open])

  useClampToViewport(popupRef, open, [anchor])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || popupRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        style={{ minWidth }}
        className={`${CONTROL_BASE} flex items-center justify-between gap-2 px-2 py-1.5 hover:border-accent-line ${
          open ? 'border-accent-line' : ''
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.icon}
          {selected?.label ?? value}
        </span>
        <ChevronDownIcon size={11} className="shrink-0 text-muted" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[60] overflow-hidden rounded-md border border-hover-strong bg-titlebar py-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
            style={{ left: anchor.left, top: anchor.top, minWidth: Math.max(anchor.width, minWidth) }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`flex w-full items-center gap-2 whitespace-nowrap px-2.5 py-1.5 text-left text-xs ${
                  option.value === value
                    ? 'bg-accent-soft text-bright'
                    : 'text-fg hover:bg-hover-strong'
                }`}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}

interface NumberInputProps {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}

/** Number field with custom steppers — avoids the browser's default spinner arrows. */
export function NumberInput({ value, min, max, onChange }: NumberInputProps): JSX.Element {
  const clamp = (n: number): number => {
    if (min !== undefined && n < min) return min
    if (max !== undefined && n > max) return max
    return n
  }

  return (
    <div className={`${CONTROL_BASE} flex items-stretch overflow-hidden focus-within:border-accent-line`}>
      <input
        value={value}
        inputMode="numeric"
        className="w-12 bg-transparent px-2 py-1.5 text-right text-xs text-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onChange={(e) => {
          const next = Number(e.target.value)
          if (!Number.isNaN(next)) onChange(clamp(next))
        }}
      />
      <div className="flex flex-col border-l border-hover-strong">
        <button
          type="button"
          className="flex h-1/2 items-center justify-center px-1 text-muted hover:bg-accent-soft hover:text-accent"
          onClick={() => onChange(clamp(value + 1))}
        >
          <ChevronUpIcon size={9} />
        </button>
        <button
          type="button"
          className="flex h-1/2 items-center justify-center px-1 text-muted hover:bg-accent-soft hover:text-accent"
          onClick={() => onChange(clamp(value - 1))}
        >
          <ChevronDownIcon size={9} />
        </button>
      </div>
    </div>
  )
}

interface SegmentedControlProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange
}: SegmentedControlProps<T>): JSX.Element {
  return (
    <div className="flex overflow-hidden rounded-md border border-hover-strong">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`px-2.5 py-1 text-[11px] transition-colors ${
            value === option.value
              ? 'bg-accent text-white'
              : 'bg-hover text-muted hover:bg-hover-strong hover:text-fg'
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface TextInputProps {
  value: string
  placeholder?: string
  onChange: (value: string) => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  className?: string
}

export function TextInput({
  value,
  placeholder,
  onChange,
  onBlur,
  onKeyDown,
  className
}: TextInputProps): JSX.Element {
  return (
    <input
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      className={`${CONTROL_BASE} px-2 py-1.5 placeholder:text-muted focus:border-accent-line ${className ?? ''}`}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  )
}
