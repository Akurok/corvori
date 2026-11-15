import { useReducedMotion } from 'motion/react'
import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

type PageShrinkOptions = {
  ref: RefObject<HTMLDivElement | null>
  groupKey: string
  entryCount: number
  shrinkCount?: number
  onShowLess?: () => void
  disabled?: boolean
}

type Shrink = {
  element: HTMLDivElement
  animation: Animation
  count: number
  commit?: () => void
}

/** Clips the outgoing rows before committing the smaller page. */
export function usePageShrink({
  ref,
  groupKey,
  entryCount,
  shrinkCount = 0,
  onShowLess,
  disabled,
}: PageShrinkOptions) {
  const [shrinking, setShrinking] = useState(false)
  const running = useRef<Shrink | null>(null)
  const reducedMotion = useReducedMotion()

  const reset = useCallback(() => {
    const active = running.current
    if (!active) return
    active.animation.cancel()
    delete active.element.dataset.pageShrinking
    running.current = null
  }, [])

  useLayoutEffect(() => reset, [reset])

  useLayoutEffect(() => {
    const active = running.current
    if (
      !active?.commit ||
      (!disabled && !reducedMotion && entryCount === active.count)
    )
      return
    active.commit()
    reset()
    setShrinking(false)
  }, [disabled, reducedMotion, entryCount, reset])

  function showLess() {
    if (!onShowLess || running.current) return
    const element = ref.current
    if (
      !element ||
      disabled ||
      reducedMotion ||
      !shrinkCount ||
      !element.animate
    ) {
      onShowLess()
      return
    }

    const sizes = getShrinkHeights(element, groupKey, shrinkCount)
    if (!sizes) {
      onShowLess()
      return
    }

    const { height, remaining } = sizes
    element.dataset.pageShrinking = ''

    const animation = element.animate(
      [{ height: `${height}px` }, { height: `${remaining}px` }],
      { duration: 200, easing: 'ease-in', fill: 'forwards' },
    )

    running.current = {
      element,
      animation,
      count: entryCount,
      commit: onShowLess,
    }

    setShrinking(true)

    animation.onfinish = () => {
      const active = running.current
      if (!active || active.animation !== animation) return
      const commit = active.commit
      active.commit = undefined
      commit?.()
      // Let ancestor folders measure the new page before releasing the height.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (running.current?.animation !== animation) return
          reset()
          setShrinking(false)
        })
      })
    }
  }

  return { showLess: onShowLess ? showLess : undefined, shrinking }
}

function getShrinkHeights(
  element: HTMLElement,
  groupKey: string,
  shrinkCount: number,
) {
  const entries = element.querySelectorAll(
    `[data-page-entry="${CSS.escape(groupKey)}"]`,
  )
  const first = entries[entries.length - shrinkCount]
  const last = entries[entries.length - 1]
  if (!first || !last) return

  const height = element.getBoundingClientRect().height
  const removed =
    last.getBoundingClientRect().bottom - first.getBoundingClientRect().top
  if (removed > 0 && removed <= height)
    return { height, remaining: height - removed }
}
