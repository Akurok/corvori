import { usePageShrink } from '@/hooks/chat/page-shrink'
import { useSessionPageReveal } from '@/hooks/chat/session-page-reveal'
import type { SessionGroupPage } from '@/hooks/chat/sessions'
import type { GroupRow } from '@/lib/chat/session-groups'
import type { ReactNode } from 'react'

export type SessionPageControls = {
  loadMore: () => void
  showLess?: () => void
  revealing: boolean
}

export type SessionRowRenderer = (
  row: GroupRow,
  controls?: SessionPageControls,
) => ReactNode

type SessionPageProps = {
  groupKey: string
  rows: GroupRow[]
  page?: SessionGroupPage
  disabled: boolean
  renderRow: SessionRowRenderer
  children?: ReactNode
  branchIds?: string[]
  animate?: boolean
}

/** Keeps existing rows mounted while appended rows are revealed as one block. */
export function SessionPage({
  groupKey,
  rows,
  page,
  disabled,
  renderRow,
  children,
  branchIds = [],
  animate = true,
}: SessionPageProps) {
  const sessions = rows.filter((row) => row.kind === 'session')
  const footer = rows.find((row) => row.kind === 'footer')

  const { ref, contentRef, loadMore, revealing } = useSessionPageReveal({
    ids: [...branchIds, ...sessions.map((row) => row.id)],
    page,
    disabled: disabled || !animate,
  })

  const { showLess, shrinking } = usePageShrink({
    ref,
    groupKey,
    entryCount: branchIds.length + sessions.length,
    shrinkCount: page?.shrinkCount,
    onShowLess: page?.showLess,
    disabled: disabled || revealing,
  })

  return (
    <>
      <div
        ref={ref}
        data-session-page={groupKey}
        className="data-page-shrinking:overflow-clip"
      >
        <div ref={contentRef}>
          {children}
          {sessions.map((row) => (
            <div key={row.id} data-page-entry={groupKey}>
              {renderRow(row)}
            </div>
          ))}
          {footer && (
            <div
              data-slot="session-page-footer"
              data-page-footer={groupKey}
              className="[overflow-anchor:none]"
            >
              {renderRow(footer, {
                loadMore,
                showLess,
                revealing: revealing || shrinking,
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
