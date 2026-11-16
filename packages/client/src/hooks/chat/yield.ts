import { api } from '@cv/convex/_generated/api'
import type { Id } from '@cv/convex/_generated/dataModel'
import { useMutation } from 'convex/react'
import { useMemo } from 'react'

import { useActiveSession } from './session'
import { useStreamYield } from './stream'

/** The pending yield request for one tool call, with the actions people can take. */
export function useYieldRequest(toolCallId: string) {
  const sessionId = useActiveSession()?._id
  const pending = useStreamYield()
  const accept = useMutation(api.chat.acceptYield)
  const pause = useMutation(api.chat.pauseYield)
  const cancel = useMutation(api.chat.cancelYield)
  const request = pending?.toolCallId === toolCallId ? pending : undefined

  const actions = useMemo(() => {
    if (!sessionId) return null
    const args = { sessionId, toolCallId }
    return {
      accept: (agentId?: Id<'agents'>) => accept({ ...args, agentId }),
      pause: () => pause(args),
      cancel: () => cancel(args),
    }
  }, [sessionId, toolCallId, accept, pause, cancel])

  return { request, actions }
}
