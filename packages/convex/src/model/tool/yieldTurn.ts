import { TOOL_DESCRIPTIONS } from '@cv/core/types'

const MAX_AGENT_NAME_CHARS = 200

/** Builds the client-executed tool that hands the next turn to another agent. */
export async function createYieldTool() {
  const [{ tool }, { z }] = await Promise.all([import('ai'), import('zod')])

  return tool({
    description: TOOL_DESCRIPTIONS.yield,
    inputSchema: z.object({
      name: z.string().trim().min(1).max(MAX_AGENT_NAME_CHARS),
    }),
    outputSchema: z.union([
      z.object({ accepted: z.literal(true), agent: z.string() }),
      z.object({ accepted: z.literal(false), reason: z.string() }),
    ]),
  })
}
