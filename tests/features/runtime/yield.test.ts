/// <reference types="bun-types" />
import {
  acceptYield,
  cancelYield,
  expireYield,
  pauseYield,
} from '@cv/convex/model/chat/yieldTurn'
import { _finalizeStopped } from '@cv/convex/model/stream/lifecycle'
import { requestYield } from '@cv/convex/model/stream/yieldRequest'
import { resolveToolManifest } from '@cv/convex/model/tool/manifest'
import { describe, expect, test } from 'bun:test'
import { type Row, fakeCtx } from '~/tests/helpers/stream-lifecycle'

const AGENTS = [
  { _id: 'agent_bob', name: 'Bob' },
  { _id: 'agent_alice', name: 'Alice' },
  { _id: 'agent_carol', name: 'Carol' },
]

const yieldPart = (name: string) => ({
  type: 'tool-yield',
  toolCallId: 'yield_1',
  state: 'input-available',
  input: { name },
})

type Fixture = {
  phase: 'streaming' | 'awaiting_input' | 'stopping'
  name?: string
  /** Scheduled acceptance time; omit for a paused request. */
  fireAt?: number
  linked?: string[]
}

/** A session where Bob's turn holds one yield call. */
function fixture({ phase, name = 'Alice', fireAt, linked }: Fixture) {
  const parked = phase === 'awaiting_input'
  const stream: Row = {
    _id: 'stream_1',
    _creationTime: 1,
    sessionId: 'session_1',
    agentId: 'agent_bob',
    invokedBy: 'user_1',
    command: { kind: 'invoke' },
    attempt: 0,
    leaseExpiresAt: Date.now() + 60_000,
    state: {
      phase,
      processingMessageId: 'message_1',
      processingContentId: 'content_1',
      ...(parked && {
        yield: {
          toolCallId: 'yield_1',
          targetAgentId: 'agent_alice',
          ...(fireAt && { fireAt, jobId: 'job_countdown' }),
        },
      }),
    },
  }
  const session: Row = {
    _id: 'session_1',
    ownerId: 'user_1',
    activeAgentId: 'agent_bob',
  }
  const content: Row = {
    _id: 'content_1',
    version: 1,
    segmentIndex: 0,
    parts: [yieldPart(name)],
  }
  const agents = AGENTS.map((agent) => ({ ...agent, tools: ['yield'] }))
  const base = fakeCtx({
    docs: [
      stream,
      session,
      { _id: 'message_1', _creationTime: 2, selectedVersion: 1 },
      { _id: 'user_1', role: 'user' },
      ...agents,
    ],
    contents: [content],
    settings: { _id: 'settings_1', displayName: 'Ada' },
  })

  const links = (linked ?? AGENTS.map((agent) => agent._id)).map((agentId) => ({
    _id: `link_${agentId}`,
    sessionId: 'session_1',
    agentId,
  }))
  const cancelled: string[] = []
  const ctx = withSessionTables(base, { stream, links, cancelled })
  return { ...base, ctx, stream, session, content, cancelled }
}

type SessionTables = { stream: Row; links: Row[]; cancelled: string[] }

/** Adds the membership, link and stream lookups the shared fake leaves empty. */
function withSessionTables(
  base: ReturnType<typeof fakeCtx>,
  { stream, links, cancelled }: SessionTables,
) {
  const inner = base.ctx as unknown as {
    db: { query: (table: string) => Record<string, unknown> }
    scheduler: Record<string, unknown>
  }
  const query = inner.db.query
  const tables: Record<string, Record<string, () => Promise<unknown>>> = {
    sessionAgents: {
      collect: async () => links,
      unique: async () => links[0] ?? null,
    },
    userSessions: {
      unique: async () => ({ _id: 'membership_1', role: 'member' }),
    },
    streams: {
      first: async () => (base.deletes.includes(stream._id) ? null : stream),
    },
  }

  inner.db.query = (table: string) => {
    const chain = query(table)
    return tables[table]
      ? { ...chain, withIndex: () => ({ ...chain, ...tables[table] }) }
      : chain
  }
  inner.scheduler.runAt = async (...args: unknown[]) => {
    base.scheduled.push({ args })
    return `job_${base.scheduled.length}`
  }
  inner.scheduler.cancel = async (jobId: string) => {
    cancelled.push(jobId)
  }
  return Object.assign(inner, { userId: 'user_2' }) as never
}

const args = { sessionId: 'session_1' as never, toolCallId: 'yield_1' }

const nextTurns = (inserts: ReturnType<typeof fakeCtx>['inserts']) =>
  inserts.filter(({ table }) => table === 'streams').map((row) => row.fields)

describe('yield request', () => {
  test('is absent from sub-agent sessions', () => {
    const manifest = (parent: boolean) =>
      resolveToolManifest({
        agent: { tools: ['yield'] } as never,
        invoker: { role: 'user' } as never,
        session: {
          _id: 'session_1',
          ...(parent && { parent: { sessionId: 'parent' } }),
        } as never,
        resources: { settings: null, mcpServers: [] },
        spawnableAgents: [],
      })

    expect(manifest(false).names).toContain('yield')
    expect(manifest(true).names).not.toContain('yield')
  })

  test('parks the turn on a linked agent and schedules its acceptance', async () => {
    const { ctx, stream, session, content, scheduled } = fixture({
      phase: 'streaming',
      name: ' alice ',
    })

    const outcome = await requestYield(ctx, {
      stream: stream as never,
      session: session as never,
      row: content as never,
      parts: content.parts as unknown[],
    })

    expect(outcome.parked).toBe(true)
    expect(stream.state).toMatchObject({
      phase: 'awaiting_input',
      yield: { toolCallId: 'yield_1', targetAgentId: 'agent_alice' },
    })
    expect(scheduled).toHaveLength(1)
  })

  test.each([
    ['an unknown agent', 'Dave'],
    ['the yielding agent itself', 'Bob'],
  ])('fails a request for %s so the turn continues', async (_case, name) => {
    const { ctx, stream, session, content, scheduled } = fixture({
      phase: 'streaming',
      name,
    })

    const outcome = await requestYield(ctx, {
      stream: stream as never,
      session: session as never,
      row: content as never,
      parts: content.parts as unknown[],
    })

    expect(outcome.parked).toBe(false)
    expect(outcome.parts[0]).toMatchObject({ state: 'output-error' })
    expect((stream.state as Row).phase).toBe('streaming')
    expect(scheduled).toHaveLength(0)
  })
})

describe('yield resolution', () => {
  test('the countdown hands the turn to the requested agent', async () => {
    const { ctx, session, content, deletes, inserts, cancelled } = fixture({
      phase: 'awaiting_input',
      fireAt: Date.now(),
    })

    await expireYield(ctx, {
      streamId: 'stream_1' as never,
      toolCallId: 'yield_1',
    })

    expect((content.parts as unknown[])[0]).toMatchObject({
      state: 'output-available',
      output: { accepted: true, agent: 'Alice' },
    })
    expect(session.activeAgentId).toBe('agent_alice')
    expect(deletes).toContain('stream_1')
    expect(nextTurns(inserts)).toEqual([
      expect.objectContaining({ agentId: 'agent_alice', invokedBy: 'user_1' }),
    ])
    // The running countdown must not cancel itself and its scheduled work
    expect(cancelled).toEqual([])
  })

  test('a member can stop the countdown and pick another agent', async () => {
    const { ctx, stream, session, content, inserts, cancelled } = fixture({
      phase: 'awaiting_input',
      fireAt: Date.now() + 5000,
    })

    await pauseYield(ctx, args)
    expect(cancelled).toEqual(['job_countdown'])
    expect((stream.state as Row).yield).toEqual({
      toolCallId: 'yield_1',
      targetAgentId: 'agent_alice',
    })

    // A countdown that already fired finds the request paused
    await expireYield(ctx, {
      streamId: 'stream_1' as never,
      toolCallId: 'yield_1',
    })
    expect(session.activeAgentId).toBe('agent_bob')

    await acceptYield(ctx, { ...args, agentId: 'agent_carol' as never })
    expect((content.parts as unknown[])[0]).toMatchObject({
      output: { accepted: true, agent: 'Carol' },
    })
    expect(session.activeAgentId).toBe('agent_carol')
    expect(nextTurns(inserts)).toEqual([
      expect.objectContaining({ agentId: 'agent_carol', invokedBy: 'user_2' }),
    ])
  })

  test('rejects picking an agent that is not linked', async () => {
    const { ctx, session } = fixture({
      phase: 'awaiting_input',
      fireAt: Date.now() + 5000,
      linked: ['agent_bob', 'agent_alice'],
    })

    await expect(
      acceptYield(ctx, { ...args, agentId: 'agent_carol' as never }),
    ).rejects.toThrow('Agent is not available')
    expect(session.activeAgentId).toBe('agent_bob')
  })

  test('cancelling ends the turn without switching agents', async () => {
    const { ctx, session, content, deletes, inserts, cancelled } = fixture({
      phase: 'awaiting_input',
      fireAt: Date.now() + 5000,
    })

    await cancelYield(ctx, args)

    expect((content.parts as unknown[])[0]).toMatchObject({
      state: 'output-available',
      output: { accepted: false, reason: 'Ada cancelled this request.' },
    })
    expect(cancelled).toEqual(['job_countdown'])
    expect(session.activeAgentId).toBe('agent_bob')
    expect(deletes).toContain('stream_1')
    expect(nextTurns(inserts)).toEqual([])

    await expect(cancelYield(ctx, args)).rejects.toThrow(
      'No yield request is pending',
    )
  })

  test('resumes the turn when the requested agent left before the countdown ended', async () => {
    const { ctx, stream, session, content } = fixture({
      phase: 'awaiting_input',
      fireAt: Date.now(),
      linked: ['agent_bob'],
    })

    await expireYield(ctx, {
      streamId: 'stream_1' as never,
      toolCallId: 'yield_1',
    })

    expect((content.parts as unknown[])[0]).toMatchObject({
      state: 'output-error',
    })
    expect(session.activeAgentId).toBe('agent_bob')
    expect((stream.state as Row).phase).toBe('pending')
  })

  test('stopping the turn settles the request as declined', async () => {
    const { ctx, patches } = fixture({ phase: 'stopping' })

    await _finalizeStopped(ctx, { streamId: 'stream_1' as never })

    const sealed = patches.find(
      ({ id, patch }) => id === 'content_1' && Array.isArray(patch.parts),
    )
    expect((sealed?.patch.parts as unknown[])[0]).toMatchObject({
      state: 'output-available',
      output: { accepted: false },
    })
  })
})
