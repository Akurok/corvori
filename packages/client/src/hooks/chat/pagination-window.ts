import type { PaginationMetadata } from '@/lib/chat/message-store'
import { useCallback, useState } from 'react'

export const FOLDER_PAGE_SIZE = 5
export const RECENTS_PAGE_SIZE = 10
export const PAGE_STEP = 20

type PaginationOptions = {
  initialSize: number
  loaded: number
  status: PaginationMetadata['status']
  loadMore: (count: number) => void
}

/** Shrinks the visible list while keeping its loaded pages subscribed. */
export function usePaginationWindow({
  initialSize,
  loaded,
  status,
  loadMore,
}: PaginationOptions) {
  const [limit, setLimit] = useState(initialSize)
  const visible = Math.min(limit, loaded)
  const canShowLess = limit > initialSize
  const smallerLimit = Math.max(initialSize, limit - PAGE_STEP)

  const showMore = useCallback(
    (count: number) => {
      const next = limit + count
      if (status === 'Exhausted' && loaded <= limit) return
      if (status === 'LoadingMore' || status === 'LoadingFirstPage') return
      if (status === 'CanLoadMore' && next > loaded) loadMore(next - loaded)
      setLimit(next)
    },
    [limit, status, loaded, loadMore],
  )

  const showLess = useCallback(
    () => setLimit((current) => Math.max(initialSize, current - PAGE_STEP)),
    [initialSize],
  )

  const reset = useCallback(() => setLimit(initialSize), [initialSize])

  return {
    visible,
    shrinkCount: Math.max(0, visible - smallerLimit),
    status: status === 'Exhausted' && visible < loaded ? 'CanLoadMore' : status,
    showMore,
    showLess: canShowLess ? showLess : undefined,
    reset,
  }
}
