import { generateId } from '@/lib/utils'
import type { Id } from '@cv/convex/_generated/dataModel'
import type { WindowMessage } from '@cv/convex/model/chat/queries'
import { useSyncExternalStore } from 'react'

type MessageUpload = {
  message: WindowMessage
  attachmentId?: Id<'attachments'>
}

const prefix = 'optimistic:'
const empty: MessageUpload[] = []
const uploadsBySession = new Map<Id<'sessions'>, MessageUpload[]>()
const listeners = new Set<() => void>()

export function createOptimisticMessageId() {
  return `${prefix}${generateId()}` as Id<'messages'>
}

export function isOptimisticMessageId(id: string) {
  return id.startsWith(prefix)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function update(sessionId: Id<'sessions'>, uploads: MessageUpload[]) {
  if (uploads.length > 0) uploadsBySession.set(sessionId, uploads)
  else uploadsBySession.delete(sessionId)
  listeners.forEach((listener) => listener())
}

export function showMessageUpload(message: WindowMessage) {
  const { sessionId } = message
  const upload: MessageUpload = { message }
  update(sessionId, [...(uploadsBySession.get(sessionId) ?? empty), upload])

  return {
    matchAttachment(attachmentId: Id<'attachments'>) {
      const uploads = uploadsBySession.get(sessionId) ?? empty
      update(
        sessionId,
        uploads.map((item) =>
          item.message === message ? { message, attachmentId } : item,
        ),
      )
    },
    finish() {
      const uploads = uploadsBySession.get(sessionId) ?? empty
      update(
        sessionId,
        uploads.filter((item) => item.message !== message),
      )
    },
  }
}

export function useMessageUploads(sessionId: Id<'sessions'> | null) {
  return useSyncExternalStore(
    subscribe,
    () => (sessionId ? (uploadsBySession.get(sessionId) ?? empty) : empty),
    () => empty,
  )
}

/** Shows each upload until the optimistic mutation or its server row appears. */
export function appendMessageUploads(
  page: WindowMessage[],
  uploads: MessageUpload[],
) {
  if (uploads.length === 0) return page

  const visible = uploads.filter(
    ({ message, attachmentId }) =>
      !page.some(
        (row) =>
          row._id === message._id ||
          (attachmentId && hasAttachment(row, attachmentId)),
      ),
  )
  return visible.length > 0
    ? [...page, ...visible.map(({ message }) => message)]
    : page
}

function hasAttachment(
  message: WindowMessage,
  attachmentId: Id<'attachments'>,
) {
  return message.segments.some(({ parts }) =>
    parts.some(
      (part) =>
        part !== null &&
        typeof part === 'object' &&
        'attachmentId' in part &&
        part.attachmentId === attachmentId,
    ),
  )
}
