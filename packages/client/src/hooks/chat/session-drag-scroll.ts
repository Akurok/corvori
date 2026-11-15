import { useDndContext } from '@dnd-kit/core'
import { type RefObject, useEffect } from 'react'

/** Keeps the sidebar scrolling while a mouse drag is held in either edge band. */
export function useSessionDragScroll(ref: RefObject<HTMLDivElement | null>) {
  const { active, activatorEvent } = useDndContext()

  useEffect(() => {
    const viewport = ref.current
    if (!active || !viewport || !(activatorEvent instanceof MouseEvent)) return

    let pointer = activatorEvent
    let frame: number | undefined
    let previousTime: number | undefined

    const tick = (time: number) => {
      frame = undefined
      const speed = scrollSpeed(viewport, pointer)
      if (speed === 0) {
        previousTime = undefined
        return
      }
      const elapsed =
        previousTime === undefined ? 16 : Math.min(32, time - previousTime)
      previousTime = time
      const before = viewport.scrollTop
      const distance = Math.max(1, (Math.abs(speed) * elapsed) / 1000)
      viewport.scrollBy({
        top: Math.sign(speed) * distance,
        behavior: 'instant',
      })
      if (viewport.scrollTop !== before) {
        frame = requestAnimationFrame(tick)
      } else {
        previousTime = undefined
      }
    }

    function move(event: MouseEvent) {
      pointer = event
      frame ??= requestAnimationFrame(tick)
    }

    const doc = viewport.ownerDocument
    doc.addEventListener('mousemove', move, true)
    move(activatorEvent)
    return () => {
      doc.removeEventListener('mousemove', move, true)
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [active, activatorEvent, ref])
}

function scrollSpeed(viewport: HTMLElement, pointer: MouseEvent) {
  const { top, bottom, left, right, height } = viewport.getBoundingClientRect()
  if (pointer.clientX < left || pointer.clientX > right) return 0

  const y = pointer.clientY
  if (y < top || y > bottom || height === 0) return 0

  const edge = Math.min(height / 4, 144)
  const towardTop = (top + edge - y) / edge
  const towardBottom = (y - bottom + edge) / edge
  if (towardTop > 0) return -(120 + towardTop * 840)
  if (towardBottom > 0) return 120 + towardBottom * 840
  return 0
}
