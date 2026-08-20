import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Nudges a floating/absolutely-positioned element back inside the window
 * viewport whenever it would overflow any edge, via a transform offset
 * applied on top of its normal CSS position. Use on every popover/dropdown/
 * context-menu so none of them can ever push the page into a scroll state
 * or render partly off-screen, regardless of where their anchor happens to
 * sit.
 */
export function useClampToViewport(ref: RefObject<HTMLElement>, active: boolean, deps: unknown[]): void {
  // Bumped on window resize/maximize while active, to force the clamp
  // below to re-run — otherwise a popup clamped at open time stays at that
  // stale offset (or drifts off-screen) if the window is resized while it
  // is still open.
  const [resizeTick, setResizeTick] = useState(0)

  useLayoutEffect(() => {
    if (!active) return
    const onResize = (): void => setResizeTick((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !active) return

    el.style.transform = ''
    const rect = el.getBoundingClientRect()
    const margin = 8

    let dx = 0
    if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right
    if (rect.left + dx < margin) dx = margin - rect.left

    let dy = 0
    if (rect.bottom > window.innerHeight - margin) dy = window.innerHeight - margin - rect.bottom
    if (rect.top + dy < margin) dy = margin - rect.top

    if (dx || dy) el.style.transform = `translate(${dx}px, ${dy}px)`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, resizeTick, ...deps])
}
