import { useSessionDragScroll } from '@/hooks/chat/session-drag-scroll'
import type { ReactNode, RefObject } from 'react'

type SessionListScrollAreaProps = {
  children: ReactNode
  ref: RefObject<HTMLDivElement | null>
}

/** Scrolls folders and sessions without accepting background drops. */
export function SessionListScrollArea({
  children,
  ref,
}: SessionListScrollAreaProps) {
  useSessionDragScroll(ref)

  return (
    <div
      ref={ref}
      data-slot="session-list-scroll-area"
      className="min-h-0 flex-1 overflow-y-auto px-2 [overflow-anchor:none]"
    >
      {children}
    </div>
  )
}
