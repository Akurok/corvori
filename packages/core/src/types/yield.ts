/** Input for the yield tool. */
export type YieldToolInput = {
  /** Name of the agent who should respond next. */
  name: string
}

/** Result returned when the requested agent takes the next turn. */
export type AcceptedYieldToolOutput = {
  accepted: true
  /** Agent who responds next, which people may have changed. */
  agent: string
}

/** Result returned when nobody takes over the turn. */
export type DeclinedYieldToolOutput = {
  accepted: false
  reason: string
}

export type YieldToolOutput = AcceptedYieldToolOutput | DeclinedYieldToolOutput
