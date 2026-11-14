import { Combobox, RippleButton } from '@/components/ui'
import { useChatMessage, useLinkedAgents } from '@/hooks/chat'
import { useYieldRequest } from '@/hooks/chat/yield'
import { useCountdown } from '@/hooks/countdown'
import type { SourceMessagePart } from '@/lib/chat/combine'
import type { Id } from '@cv/convex/_generated/dataModel'
import type { YieldToolInput, YieldToolOutput } from '@cv/core/types'
import { useMemo, useState } from 'react'

import { AgentCombobox, type AgentItem } from '../../sessions/agent-combobox'
import type { ToolRendererProps } from './tool-part-block'
import { ToolShell } from './tool-shell'

/** Renders a hand-off request with its confirmation, or how it was settled. */
export function YieldBlock(props: ToolRendererProps) {
  const { part } = props
  const messageId =
    (part as SourceMessagePart).sourceMessageId ?? props.messageId
  const { request, actions } = useYieldRequest(part.toolCallId)

  if (request && actions && part.state === 'input-available') {
    return (
      <YieldConfirmation
        messageId={messageId}
        requestedName={(part.input as YieldToolInput | undefined)?.name}
        targetAgentId={request.targetAgentId}
        fireAt={request.fireAt}
        actions={actions}
      />
    )
  }

  const output =
    part.state === 'output-available'
      ? (part.output as YieldToolOutput | undefined)
      : undefined

  return (
    <ToolShell
      data-slot="yield-block"
      {...props}
      label={
        <span className="text-foreground font-medium">
          {settledLabel(output)}
        </span>
      }
    >
      {output?.accepted === false && (
        <p className="text-muted-foreground text-xs">{output.reason}</p>
      )}
    </ToolShell>
  )
}

function settledLabel(output: YieldToolOutput | undefined) {
  if (!output) return 'Hand off turn'
  return output.accepted
    ? `Handed the turn to ${output.agent}`
    : 'Hand-off cancelled'
}

type YieldConfirmationProps = {
  messageId: string
  requestedName?: string
  targetAgentId: Id<'agents'>
  /** Unset once someone stopped the countdown. */
  fireAt?: number
  actions: NonNullable<ReturnType<typeof useYieldRequest>['actions']>
}

/** The one-off confirmation any member can change or cancel. */
function YieldConfirmation({
  messageId,
  requestedName,
  targetAgentId,
  fireAt,
  actions,
}: YieldConfirmationProps) {
  const { agentId, messageMeta } = useChatMessage(messageId)
  const linked = useLinkedAgents()
  const remaining = useCountdown(fireAt)
  const [pickerOpen, setPickerOpen] = useState(false)

  const candidates = useMemo<AgentItem[]>(
    () =>
      linked
        .filter((agent) => agent._id !== agentId)
        .map(({ _id, name, avatarId }) => ({ id: _id, name, avatarId })),
    [linked, agentId],
  )
  const target = candidates.find((agent) => agent.id === targetAgentId)
  const requester = messageMeta?.senderName ?? 'The agent'

  const openPicker = (open: boolean) => {
    setPickerOpen(open)
    if (open && fireAt) void actions.pause()
  }

  return (
    <div
      data-slot="yield-block"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
    >
      <span className="min-w-0">
        {requester} is requesting {target?.name ?? requestedName} to respond
        next…
      </span>
      <div className="flex items-center gap-2">
        <AgentCombobox
          agents={candidates}
          open={pickerOpen}
          onOpenChange={openPicker}
          onValueChange={(next) => void actions.accept(next as Id<'agents'>)}
          emptyLabel="No other agents in this session."
          trigger={
            <Combobox.Trigger variant="surface" size="sm" className="w-fit">
              Change
            </Combobox.Trigger>
          }
        />
        <RippleButton
          variant="stealth"
          size="sm"
          onClick={() => void actions.cancel()}
        >
          Cancel
        </RippleButton>
        {fireAt !== undefined && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {Math.ceil(remaining / 1000)}s
          </span>
        )}
      </div>
    </div>
  )
}
