import type { Id } from '@cv/convex/_generated/dataModel'
import { messagesWindow } from '@cv/convex/model/chat/queries'
import { messagePosition } from '@cv/core/message-position'
import { expect, test } from 'bun:test'
import { skillsDatabase } from '~/tests/helpers/skills-db'

async function fixture() {
  const { ctx, db } = skillsDatabase()
  const sessionId = (await db.insert('sessions', {
    ownerId: ctx.userId,
  })) as Id<'sessions'>
  await db.insert('userSessions', { sessionId, userId: ctx.userId })
  const ids: Id<'messages'>[] = []
  for (let i = 1; i <= 3; i++) {
    const id = await db.insert('messages', {
      sessionId,
      _creationTime: i,
      selectedVersion: 1,
    })
    await db.patch(id, {
      position: messagePosition({ _id: id, _creationTime: i }),
    })
    ids.push(id as Id<'messages'>)
    for (let segmentIndex = 0; segmentIndex < 2; segmentIndex++) {
      await db.insert('messageContents', {
        sessionId,
        messageId: id,
        version: 1,
        segmentIndex,
        parts: [{ type: 'text', text: `${i}:${segmentIndex}` }],
      })
    }
  }
  return { ctx, db, sessionId, ids }
}

test('exclusive older anchors retain hasNewer even when the excluded message is the newest', async () => {
  const { ctx, sessionId, ids } = await fixture()
  const result = await messagesWindow(ctx, {
    sessionId,
    anchor: { position: messagePosition({ _id: ids[2], _creationTime: 3 }) },
    anchorInclusive: false,
    anchorSegment: 0,
    direction: 'older',
    limit: 1,
  })
  expect(result.page.map((message) => message._id)).toEqual([ids[1]])
  expect(result.page[0].segments).toHaveLength(2)
  expect(result.hasOlder).toBe(true)
  expect(result.hasNewer).toBe(true)
  expect(result.atTail).toBe(false)
})

test('anchors remain inclusive by default and earlier-segment bounds preserve continuation flags', async () => {
  const { ctx, sessionId, ids } = await fixture()
  const result = await messagesWindow(ctx, {
    sessionId,
    anchor: { messageId: ids[2] },
    anchorSegment: 0,
    direction: 'older',
    limit: 1,
  })
  expect(result.page.map((message) => message._id)).toEqual([ids[2]])
  expect(
    result.page[0].segments.map((segment) => segment.segmentIndex),
  ).toEqual([0])
  expect(result.hasNewer).toBe(true)
  expect(result.hasOlder).toBe(true)
})

test('exclusive newer anchors count the excluded oldest message as older history', async () => {
  const { ctx, sessionId, ids } = await fixture()
  const result = await messagesWindow(ctx, {
    sessionId,
    anchor: { messageId: ids[0] },
    anchorInclusive: false,
    direction: 'newer',
    limit: 10,
  })
  expect(result.page.map((message) => message._id)).toEqual([ids[1], ids[2]])
  expect(result.hasOlder).toBe(true)
  expect(result.hasNewer).toBe(false)
})

test('pages across the chip and summary in both directions using persisted positions', async () => {
  const {
    ctx,
    db,
    sessionId,
    ids: [summaryId, queuedId, chipId],
  } = await fixture()
  const summary = { _id: summaryId, _creationTime: 1 }
  const chip = { _id: chipId, _creationTime: 3 }
  const position = messagePosition(chip, {
    anchor: summary,
    kind: 'compactionChip',
  })
  await db.patch(chipId, { position, type: 'command', hidden: true })
  const older = await messagesWindow(ctx, {
    sessionId,
    anchor: { messageId: summaryId },
    anchorInclusive: false,
    direction: 'older',
    limit: 1,
  })
  expect(older.page.map((message) => message._id)).toEqual([chipId])
  const newer = await messagesWindow(ctx, {
    sessionId,
    anchor: { position },
    anchorInclusive: false,
    direction: 'newer',
    limit: 2,
  })
  expect(newer.page.map((message) => message._id)).toEqual([
    summaryId,
    queuedId,
  ])
})

test('keeps tied messages and multiple notes in deterministic transcript order', () => {
  const identity = (_id: string, _creationTime: number) => ({
    _id,
    _creationTime,
  })
  const anchor = identity('anchor', 1.5)
  const placements = [
    ['unrelated', messagePosition(identity('unrelated', 1.5))],
    ['summary', messagePosition(anchor)],
    [
      'second note',
      messagePosition(identity('note-b', 2), { anchor, kind: 'contextNote' }),
    ],
    [
      'chip',
      messagePosition(identity('chip', 2), { anchor, kind: 'compactionChip' }),
    ],
    [
      'first note',
      messagePosition(identity('note-a', 2), { anchor, kind: 'contextNote' }),
    ],
    ['previous', messagePosition(identity('previous', 1.25))],
  ]
  const ordered = placements.sort(([, a], [, b]) => (a < b ? -1 : 1))
  expect(ordered.map(([label]) => label)).toEqual([
    'previous',
    'first note',
    'second note',
    'chip',
    'summary',
    'unrelated',
  ])
})
