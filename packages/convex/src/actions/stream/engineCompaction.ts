'use node'

import type { ModelMessage, ToolResultOutput } from '@ai-sdk/provider-utils'
import { usableContextWindow } from '@cv/core/discovered-model'
import type { ToolSet } from 'ai'

import { internal } from '../../_generated/api'
import type { ActionCtx } from '../../_generated/server'
import { estimateTokens } from '../../model/context'
import { canCheckCompactionThreshold } from '../../model/stream/historyBoundary'
import type { SessionTools } from '../../model/tool/sessionTools'
import type { StreamCommand, StreamExecutionArgs } from '../../types'

type RequestToEstimate = {
  systemPrompt?: string
  messages: ModelMessage[]
  tools: ToolSet
  toolRuntime?: SessionTools
}

type Setup = RequestToEstimate & {
  stream: { command: StreamCommand }
  modelId?: string
  contextWindow?: number
  evalResult?: { dirty: boolean; environment: Record<string, unknown> }
}

export async function compactBeforeDispatch(
  ctx: ActionCtx,
  execution: StreamExecutionArgs,
  setup: Setup,
) {
  if (!canCheckCompactionThreshold(setup.stream.command)) return false
  const contextWindow = usableContextWindow(setup.contextWindow)
  if (!contextWindow || !setup.modelId) return false
  if (!(await reachesCompactionThreshold(setup, contextWindow))) return false

  return ctx.runMutation(internal.streams._compactAtThreshold, {
    ...execution,
    modelId: setup.modelId,
    contextWindow,
    environment: setup.evalResult?.dirty
      ? setup.evalResult.environment
      : undefined,
  })
}

/** Estimates input as prepared, including the tool definitions sent by dispatch. */
export async function reachesCompactionThreshold(
  request: RequestToEstimate,
  contextWindow: number,
) {
  const threshold = Math.ceil(contextWindow * 0.9)
  let tokens = await estimateTokens(request.systemPrompt ?? '')
  for (const message of request.messages) {
    if (tokens >= threshold) return true
    tokens +=
      5 + (await estimateTokens(messageText(message, request.toolRuntime)))
  }
  if (tokens >= threshold) return true

  const { toolDefinitions } = await import('../../model/tool/definitions')
  const tools =
    request.toolRuntime?.wireDefinitions ??
    (await toolDefinitions(request.tools))
  for (const { name, description, inputSchema } of tools) {
    tokens += await estimateTokens(
      `${name}\n${description ?? ''}\n${inputSchema}`,
    )
    if (tokens >= threshold) return true
  }
  return false
}

function messageText(message: ModelMessage, runtime?: SessionTools) {
  if (typeof message.content === 'string') return message.content
  return message.content
    .map((part) => {
      switch (part.type) {
        case 'text':
        case 'reasoning':
          return part.text
        case 'file':
          return inlineFileText(part.data)
        case 'tool-call': {
          const wire = runtime?.wireCalls.get(part.toolCallId)
          return JSON.stringify({
            name: wire?.name ?? part.toolName,
            input: wire ? wire.input : part.input,
          })
        }
        case 'tool-result': {
          const name =
            runtime?.wireCalls.get(part.toolCallId)?.name ?? part.toolName
          return `${name}\n${toolOutputText(part.output)}`
        }
        default:
          return ''
      }
    })
    .join('\n')
}

function toolOutputText(output: ToolResultOutput) {
  switch (output.type) {
    case 'text':
    case 'error-text':
      return output.value
    case 'json':
    case 'error-json':
      return JSON.stringify(output.value)
    case 'execution-denied':
      return output.reason ?? ''
    case 'content':
      return output.value
        .map((part) => {
          if (part.type === 'text') return part.text
          if (part.type === 'file') return inlineFileText(part.data)
          return ''
        })
        .join('\n')
  }
}

function inlineFileText(data: unknown) {
  if (
    data &&
    typeof data === 'object' &&
    'type' in data &&
    data.type === 'text' &&
    'text' in data
  ) {
    return typeof data.text === 'string' ? data.text : ''
  }
  return ''
}
