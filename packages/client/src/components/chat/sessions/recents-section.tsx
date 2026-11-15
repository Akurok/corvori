import { Collapsible } from '@/components/ui/collapsible'
import { SessionGroupQuery } from '@/hooks/chat/sessions'
import { cn } from '@/lib/utils'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { type ReactNode, useId } from 'react'

type RecentsSectionProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  children: ReactNode
}

/** Dropping a chat from another section here clears its folder and pin. */
export function RecentsSection({
  open,
  onOpenChange,
  pending,
  children,
}: RecentsSectionProps) {
  const id = useId()
  const drag = useDndContext().active?.data.current
  const { setNodeRef, isOver } = useDroppable({
    id: 'drop:recents',
    data: { groupKey: 'recents' },
    disabled:
      pending || drag?.kind !== 'session' || drag.groupKey === 'recents',
  })

  return (
    <div
      ref={setNodeRef}
      data-session-section="recents"
      className={cn(
        'relative isolate rounded-md',
        isOver &&
          'bg-primary/15 after:border-primary after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:border',
      )}
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <Collapsible.HoverTrigger divider aria-controls={id}>
          Recents
        </Collapsible.HoverTrigger>
        <SessionGroupQuery groupKey="recents" />
        <Collapsible.Content id={id} className="gap-0 p-0" unmountOnClose>
          {children}
        </Collapsible.Content>
      </Collapsible>
    </div>
  )
}
