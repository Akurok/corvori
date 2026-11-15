import type { ButtonProps, ButtonVariant } from '@/components/ui/button'
import { motion } from 'framer-motion'
import * as React from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

const RIPPLE_PADDING = 0

interface Ripple {
  id: string
  x: number
  y: number
  diameter: number
  shouldFade: boolean
}

export type RippleOptions = {
  variant?: ButtonProps['variant']
  rippleVariant?: ButtonProps['variant']
  rippleDuration?: number
  fadeDuration?: number
  zIndex?: number
}

/**
 * Adds a ripple effect to an element. Note that you need to either
 * `isolate` the parent or raise the zIndex to avoid ripples being rendered
 * behind other elements. Also don't forget `overflow-hidden` and `relative`
 * on the parent or the ripples will leak out.
 * @returns The ripples to render that you can then put inside the parent component.
 */
export function useRipples(
  target: React.RefObject<HTMLElement | null> | HTMLElement | null,
  {
    variant,
    rippleVariant,
    rippleDuration = 350,
    fadeDuration = 500,
    zIndex = -1,
  }: RippleOptions = {},
) {
  const [isHovered, setHovered] = useState(false)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const rippleId = useId()
  const rippleCountRef = useRef(0)
  const activeRipplesRef = useRef<Map<number, string>>(new Map())

  const color = useMemo(
    () => backgroundFor(rippleVariant || variant, isHovered),
    [variant, rippleVariant, isHovered],
  )

  const handlePointerEnter = useCallback((event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      setHovered(true)
    }
  }, [])

  const fadeRipple = useCallback(
    (rippleId: string) => {
      setRipples((prev) =>
        prev.map((r) => (r.id === rippleId ? { ...r, shouldFade: true } : r)),
      )

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== rippleId))
      }, fadeDuration)
    },
    [fadeDuration],
  )

  const startRipple = useCallback(
    (event: PointerEvent) => {
      const clientX = event.clientX
      const clientY = event.clientY

      const element = event.currentTarget as HTMLElement
      if (!element) return

      const ignored =
        event.target instanceof Element
          ? event.target.closest('[data-ripple-ignore]')
          : null
      if (ignored && ignored !== element && element.contains(ignored)) return

      const rect = element.getBoundingClientRect()
      const x = clientX - rect.left - element.clientLeft
      const y = clientY - rect.top - element.clientTop
      const w = rect.width + RIPPLE_PADDING
      const h = rect.height + RIPPLE_PADDING

      const corners = [
        [0, 0],
        [w, 0],
        [0, h],
        [w, h],
      ] as const

      const distances = corners.map(([cx, cy]) =>
        Math.sqrt((cx - x) ** 2 + (cy - y) ** 2),
      )

      const diameter = Math.max(...distances) * 2

      const newRipple: Ripple = {
        id: `${rippleId}-${rippleCountRef.current++}`,
        x,
        y,
        diameter,
        shouldFade: false,
      }

      setRipples((prev) => [...prev, newRipple])
      return newRipple.id
    },
    [rippleId],
  )

  useEffect(() => {
    const el =
      target instanceof HTMLElement
        ? target
        : (target as React.RefObject<HTMLElement | null>)?.current
    if (!el) return

    return bindRippleEvents(el, {
      activeRipples: activeRipplesRef.current,
      handlePointerEnter,
      startRipple,
      fadeRipple,
      clearHover: () => setHovered(false),
    })
  }, [target, handlePointerEnter, startRipple, fadeRipple])

  return ripples.map((ripple) =>
    React.createElement(motion.span, {
      key: ripple.id,
      className: `pointer-events-none absolute rounded-full`,
      style: {
        left: ripple.x - ripple.diameter / 2,
        top: ripple.y - ripple.diameter / 2,
        width: ripple.diameter,
        height: ripple.diameter,
        background: color,
        filter: 'blur(12px)',
        zIndex,
      },
      initial: {
        scale: 0,
        opacity: 1,
      },
      animate: {
        scale: 1,
        opacity: ripple.shouldFade ? 0 : 0.5,
      },
      transition: {
        scale: {
          duration: rippleDuration / 1000,
          ease: [0.25, 1, 0.8, 1],
        },
        opacity: {
          duration: ripple.shouldFade
            ? fadeDuration / 1000
            : rippleDuration / 1000,
          ease: 'easeOut',
        },
      },
    }),
  )
}

type RippleEvents = {
  activeRipples: Map<number, string>
  handlePointerEnter: (event: PointerEvent) => void
  startRipple: (event: PointerEvent) => string | undefined
  fadeRipple: (rippleId: string) => void
  clearHover: () => void
}

function bindRippleEvents(element: HTMLElement, events: RippleEvents) {
  const { activeRipples, fadeRipple, clearHover } = events
  let stopWatching: (() => void) | undefined

  function endPress({ pointerId }: PointerEvent) {
    const rippleId = activeRipples.get(pointerId)
    if (rippleId === undefined) return

    activeRipples.delete(pointerId)
    fadeRipple(rippleId)
    if (activeRipples.size === 0) stopWatchingPresses()
  }

  function interruptPresses() {
    clearHover()
    for (const rippleId of activeRipples.values()) fadeRipple(rippleId)
    activeRipples.clear()
    stopWatchingPresses()
  }

  function stopWatchingPresses() {
    stopWatching?.()
    stopWatching = undefined
  }

  function watchPresses() {
    if (activeRipples.size > 0) {
      stopWatching ??= watchRippleReleases(element, endPress, interruptPresses)
    }
  }

  const listeners = new AbortController()
  const options = { signal: listeners.signal }
  element.addEventListener('pointerenter', events.handlePointerEnter, options)
  element.addEventListener(
    'pointerleave',
    (event) => {
      clearHover()
      endPress(event)
    },
    options,
  )
  element.addEventListener(
    'pointerdown',
    (event) => {
      endPress(event)
      const rippleId = events.startRipple(event)
      if (rippleId === undefined) return

      activeRipples.set(event.pointerId, rippleId)
      watchPresses()
    },
    options,
  )
  watchPresses()

  return () => {
    listeners.abort()
    stopWatchingPresses()
  }
}

function watchRippleReleases(
  element: HTMLElement,
  endPress: (event: PointerEvent) => void,
  interruptPresses: () => void,
) {
  const document = element.ownerDocument
  const view = document.defaultView
  const listeners = new AbortController()
  const options = { capture: true, passive: true, signal: listeners.signal }

  view?.addEventListener('pointerup', endPress, options)
  view?.addEventListener('pointercancel', endPress, options)
  // A new press with the same pointer supersedes a missed release.
  view?.addEventListener('pointerdown', endPress, options)
  view?.addEventListener(
    'pointermove',
    (event) => {
      if (event.buttons === 0) endPress(event)
    },
    options,
  )
  view?.addEventListener('blur', interruptPresses, { signal: listeners.signal })
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) interruptPresses()
    },
    { signal: listeners.signal },
  )

  return () => listeners.abort()
}

function backgroundFor(variant?: ButtonVariant, isHovered?: boolean): string {
  switch (variant) {
    case 'primary':
    case undefined:
      return 'color-mix(in srgb, var(--on-primary) 30%, transparent)'
    case 'secondary':
      return 'color-mix(in srgb, var(--on-secondary) 30%, transparent)'
    case 'tertiary':
      return 'color-mix(in srgb, var(--on-tertiary) 30%, transparent)'
    case 'destructive':
      return 'color-mix(in srgb, var(--on-error-container) 30%, transparent)'
    case 'ghost':
      return isHovered
        ? 'color-mix(in srgb, var(--on-secondary) 30%, transparent)'
        : 'color-mix(in srgb, var(--primary) 30%, transparent)'
    default: // surface, outline, input, link, stealth
      return 'color-mix(in srgb, var(--primary) 30%, transparent)'
  }
}
