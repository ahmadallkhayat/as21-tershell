import { useEffect, type RefObject } from 'react'

/**
 * Lets a horizontally overflowing strip be panned by dragging it with the
 * mouse, so it needs no visible scrollbar. Dragging past a few pixels also
 * swallows the click that would otherwise follow, so panning the tab strip
 * never activates whichever tab the drag happened to start on.
 */
export function useDragScroll(ref: RefObject<HTMLElement>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let startX = 0
    let startScroll = 0
    let dragging = false
    let panned = false

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0) return
      dragging = true
      panned = false
      startX = e.clientX
      startScroll = el.scrollLeft
    }

    const onPointerMove = (e: PointerEvent): void => {
      if (!dragging) return
      const dx = e.clientX - startX
      if (!panned) {
        // Stay inert until the pointer clearly means to pan rather than click.
        if (Math.abs(dx) < 4) return
        panned = true
        el.setPointerCapture(e.pointerId)
        el.classList.add('dragging')
      }
      el.scrollLeft = startScroll - dx
    }

    const onPointerEnd = (e: PointerEvent): void => {
      if (!dragging) return
      dragging = false
      el.classList.remove('dragging')
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }

    // Capture phase: intercept the click before it reaches a tab. `panned` is
    // reset on the next pointerdown, so a drag that ends without a click can
    // never swallow a later one.
    const onClick = (e: MouseEvent): void => {
      if (!panned) return
      e.stopPropagation()
      e.preventDefault()
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerEnd)
    el.addEventListener('pointercancel', onPointerEnd)
    el.addEventListener('click', onClick, true)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerEnd)
      el.removeEventListener('pointercancel', onPointerEnd)
      el.removeEventListener('click', onClick, true)
    }
  }, [ref])
}
