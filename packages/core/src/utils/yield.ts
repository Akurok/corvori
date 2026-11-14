import { YIELD_TOOL_NAME } from '../const'
import type { DeclinedYieldToolOutput, YieldToolInput } from '../types'

export const YIELD_TOOL_PART_TYPE = `tool-${YIELD_TOOL_NAME}` as const

/** Model-facing result used when the user stops a turn during a yield request. */
export const ABORTED_YIELD_TOOL_OUTPUT: DeclinedYieldToolOutput = {
  accepted: false,
  reason: 'The user stopped this turn before the request was accepted.',
}

export type PendingYieldPart = {
  type: typeof YIELD_TOOL_PART_TYPE
  toolCallId: string
  state: 'input-available'
  input: YieldToolInput
}

/** Narrows a persisted AI SDK part to an unsettled yield call. */
export function isPendingYieldPart(part: unknown): part is PendingYieldPart {
  const typed = part as Partial<PendingYieldPart>
  return (
    typed?.type === YIELD_TOOL_PART_TYPE &&
    typed.state === 'input-available' &&
    typeof typed.toolCallId === 'string'
  )
}

/** Whether a provider step still contains an unsettled yield call. */
export function hasPendingYield(parts: readonly unknown[]): boolean {
  return parts.some(isPendingYieldPart)
}

/** Settles pending yield calls with a model-facing result. */
export function settleYieldParts<T>(
  parts: readonly T[],
  output: DeclinedYieldToolOutput,
): T[] {
  return parts.map((part) =>
    isPendingYieldPart(part)
      ? ({ ...part, state: 'output-available', output } as T)
      : part,
  )
}

/** Gracefully settles a pending yield when its turn is stopped by the user. */
export function settleAbortedYieldParts<T>(parts: readonly T[]): T[] {
  return settleYieldParts(parts, ABORTED_YIELD_TOOL_OUTPUT)
}

/** Fails pending yield calls, leaving the turn free to continue. */
export function failYieldParts<T>(parts: readonly T[], errorText: string): T[] {
  return parts.map((part) =>
    isPendingYieldPart(part)
      ? ({ ...part, state: 'output-error', errorText } as T)
      : part,
  )
}
