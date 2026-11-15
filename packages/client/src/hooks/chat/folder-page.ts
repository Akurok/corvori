import { api } from '@cv/convex/_generated/api'
import { usePaginatedQuery } from 'convex-helpers/react/cache/hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  FOLDER_PAGE_SIZE,
  PAGE_STEP,
  RECENTS_PAGE_SIZE,
} from './pagination-window'
import type { SessionGroupPage } from './sessions'

type FolderPageOptions = {
  groupKey: string
  search: string
  showHidden: boolean
}

type FolderPageSnapshot = Pick<SessionGroupPage, 'results' | 'folders'>

/** Coordinates folder-first pages and flat session lists. */
export function useFolderPage({
  groupKey,
  search,
  showHidden,
}: FolderPageOptions): SessionGroupPage {
  const isSearch = groupKey === 'search'
  const flatList = isSearch || groupKey === 'recents'
  const [budget, setBudget] = useState(FOLDER_PAGE_SIZE)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [snapshot, setSnapshot] = useState<FolderPageSnapshot | null>(null)

  const {
    results: folderResults,
    status: folderStatus,
    loadMore: loadFolders,
  } = usePaginatedQuery(
    api.sessionFolders.page,
    flatList ? 'skip' : { groupKey },
    { initialNumItems: FOLDER_PAGE_SIZE },
  )

  const folderItems = useMemo(
    () => folderResults.slice(0, budget),
    [folderResults, budget],
  )
  const foldersDone = folderStatus === 'Exhausted'
  const sessionBudget = isSearch
    ? PAGE_STEP
    : flatList
      ? RECENTS_PAGE_SIZE
      : Math.max(0, budget - folderItems.length)
  const needSessions = flatList || (foldersDone && sessionBudget > 0)

  const sessions = usePaginatedQuery(
    api.sessions.list,
    needSessions
      ? {
          groupKey: isSearch ? undefined : groupKey,
          search: search || undefined,
          showHidden: showHidden || undefined,
        }
      : 'skip',
    { initialNumItems: Math.max(1, sessionBudget) },
  )

  const {
    results: sessionResults,
    status: sessionStatus,
    loadMore: loadSessions,
  } = sessions

  useEffect(() => {
    if (
      !flatList &&
      folderStatus === 'CanLoadMore' &&
      folderResults.length < budget
    ) {
      loadFolders(budget - folderResults.length)
    }
  }, [flatList, folderStatus, folderResults.length, loadFolders, budget])

  useEffect(() => {
    if (
      !flatList &&
      needSessions &&
      sessionStatus === 'CanLoadMore' &&
      sessionResults.length < sessionBudget
    ) {
      loadSessions(sessionBudget - sessionResults.length)
    }
  }, [
    flatList,
    needSessions,
    sessionStatus,
    sessionResults.length,
    loadSessions,
    sessionBudget,
  ])

  const loadingFolders =
    !flatList && folderResults.length < budget && !foldersDone
  const loadingSessions =
    needSessions &&
    sessionResults.length < sessionBudget &&
    sessionStatus !== 'Exhausted'
  const loading = loadingFolders || loadingSessions
  const moreSessions = needSessions && sessionStatus !== 'Exhausted'
  const status = loading
    ? hasLoaded
      ? 'LoadingMore'
      : 'LoadingFirstPage'
    : !foldersDone || moreSessions
      ? 'CanLoadMore'
      : 'Exhausted'

  const loadMore = useCallback(
    (count: number) => {
      if (loading) return
      setSnapshot({
        results: sessionResults.slice(0, sessionBudget),
        folders: folderItems,
      })
      setBudget((current) => current + count)
    },
    [loading, sessionResults, sessionBudget, folderItems],
  )

  const results = useMemo(
    () => sessionResults.slice(0, sessionBudget),
    [sessionResults, sessionBudget],
  )

  if (flatList) return sessions
  if (!hasLoaded && !loading) setHasLoaded(true)
  if (snapshot && !loading) setSnapshot(null)
  if (snapshot && loading)
    return { ...snapshot, status: 'LoadingMore', loadMore }

  return {
    results,
    folders: folderItems,
    status,
    loadMore,
    sessionsDeferred: !needSessions,
  }
}
