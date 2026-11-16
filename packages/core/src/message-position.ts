export type MessageIdentity = {
  _id: string
  _creationTime: number
}

export type MessagePlacement = {
  anchor: MessageIdentity
  kind: 'contextNote' | 'compactionChip'
}

/** Encodes the full timestamp and breaks ties by message ID. */
function chronologicalKey({ _creationTime, _id }: MessageIdentity) {
  const time = new DataView(new ArrayBuffer(8))
  time.setFloat64(0, _creationTime)
  return `${time.getBigUint64(0).toString(16).padStart(16, '0')}!${_id}!`
}

/** Places related notes and then the compaction chip directly before an anchor. */
export function messagePosition(
  message: MessageIdentity,
  placement?: MessagePlacement,
): string {
  const key = chronologicalKey(message)
  if (!placement) return `${key}2`

  const slot = placement.kind === 'contextNote' ? '0' : '1'
  return `${chronologicalKey(placement.anchor)}${slot}!${key}`
}
