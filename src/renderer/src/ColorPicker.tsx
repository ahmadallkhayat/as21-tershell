import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ACCENT_PRESETS } from './settings'
import { useClampToViewport } from './useClampToViewport'
import { TextInput } from './ui'

interface Props {
  value: string
  onChange: (hex: string) => void
}

const PICKER_SATURATION = 72
const PICKER_LIGHTNESS = 60

function hslToHex(h: number, s: number, l: number): string {
  const sf = s / 100
  const lf = l / 100
  const k = (n: number): number => (n + h / 30) % 12
  const a = sf * Math.min(lf, 1 - lf)
  const f = (n: number): number => lf - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = (x: number): string =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

function hexToHue(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const r = parseInt(m[1].slice(0, 2), 16) / 255
  const g = parseInt(m[1].slice(2, 4), 16) / 255
  const b = parseInt(m[1].slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(hex)
}

export default function ColorPicker({ value, onChange }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [hexDraft, setHexDraft] = useState(value)
  const [anchor, setAnchor] = useState({ left: 0, top: 0 })
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => setHexDraft(value), [value])

  useLayoutEffect(() => {
    if (!open) return
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) setAnchor({ left: rect.left, top: rect.bottom + 6 })
  }, [open])

  useClampToViewport(popupRef, open, [anchor])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || popupRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const hue = hexToHue(value)

  const setHueFromClientX = (clientX: number): void => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onChange(hslToHex(ratio * 360, PICKER_SATURATION, PICKER_LIGHTNESS))
  }

  const commitHexDraft = (): void => {
    if (isValidHex(hexDraft)) onChange(hexDraft)
    else setHexDraft(value)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="flex items-center gap-2 rounded-md border border-hover-strong bg-hover px-2 py-1.5 hover:border-accent-line"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="h-5 w-5 shrink-0 rounded-full border border-hover-strong"
          style={{ backgroundColor: value }}
        />
        <span className="text-xs text-fg">{value}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[60] w-56 rounded-lg border border-hover-strong bg-titlebar p-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
            style={{ left: anchor.left, top: anchor.top }}
          >
            <div className="mb-3 grid grid-cols-5 gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  title={preset}
                  className={`h-6 w-6 rounded-full border-2 ${
                    preset.toLowerCase() === value.toLowerCase()
                      ? 'border-bright'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset }}
                  onClick={() => onChange(preset)}
                />
              ))}
            </div>

            <div
              ref={trackRef}
              className="relative mb-3 h-3 cursor-pointer rounded-full"
              style={{
                background:
                  'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
              }}
              onPointerDown={(e) => {
                draggingRef.current = true
                e.currentTarget.setPointerCapture(e.pointerId)
                setHueFromClientX(e.clientX)
              }}
              onPointerMove={(e) => {
                if (draggingRef.current) setHueFromClientX(e.clientX)
              }}
              onPointerUp={(e) => {
                draggingRef.current = false
                e.currentTarget.releasePointerCapture(e.pointerId)
              }}
            >
              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  backgroundColor: hslToHex(hue, PICKER_SATURATION, PICKER_LIGHTNESS)
                }}
              />
            </div>

            <TextInput
              value={hexDraft}
              onChange={setHexDraft}
              onBlur={commitHexDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitHexDraft()
              }}
              className="w-full"
            />
          </div>,
          document.body
        )}
    </>
  )
}
