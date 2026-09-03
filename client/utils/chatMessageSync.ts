export interface SequencedMessage {
  id?: number
  seq?: number
}

export const getLastMessageSeq = (messages: readonly SequencedMessage[]) => {
  return messages.reduce((maxSeq, item) => {
    const seqValue = Number(item.seq ?? item.id ?? 0)
    return seqValue > maxSeq ? seqValue : maxSeq
  }, 0)
}

export const normalizeMessageSnapshot = <T extends SequencedMessage>(rawMessages: readonly T[]) => {
  return [...rawMessages]
    .sort((a, b) => (a.id || 0) - (b.id || 0))
    .map((item) => ({
      ...item,
      seq: Number(item.seq ?? item.id)
    }))
}
