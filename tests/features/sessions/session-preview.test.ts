import type { Id } from '@cv/convex/_generated/dataModel'
import { messagePreview, syncActivity } from '@cv/convex/model/messages'
import { expect, test } from 'bun:test'
import { skillsDatabase } from '~/tests/helpers/skills-db'

test('session activity stores readable previews from the original text parts', async () => {
  const { ctx, rows } = skillsDatabase()
  const sessionId = 'session' as Id<'sessions'>
  rows('sessions').push({ _id: sessionId })

  await syncActivity(ctx, sessionId, [
    { type: 'text', text: `\`\`\`ts\n${'code\n'.repeat(40)}\`\`\`` },
    { type: 'reasoning', text: 'Ignore this.' },
    {
      type: 'text',
      text: '# **Move** the `task` tool\n\n> See [details](https://example.com).',
    },
  ])
  await syncActivity(ctx, sessionId, [
    { type: 'text', text: '*The changes are ready.*\n- [x] Tests passed' },
  ])

  expect(await ctx.db.get(sessionId)).toMatchObject({
    firstMessagePreview: 'Move the task tool See details.',
    lastMessagePreview: 'The changes are ready. Tests passed',
  })
})

test('code-only previews keep the code and omit the fence', () => {
  expect(
    messagePreview([{ type: 'text', text: '~~~sh\nprintf "%s" foo_bar\n~~~' }]),
  ).toBe('printf "%s" foo_bar')
})
