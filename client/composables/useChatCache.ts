import Dexie, { type Table } from 'dexie'

const ROOM_MESSAGE_RETENTION_LIMIT = 500
const PRIVATE_MESSAGE_RETENTION_LIMIT = 500

interface CachedRoomMessage {
  id: number
  seq?: number
  roomId: number
  content?: string
  imageUrl?: string
  replyToMessageId?: number | null
  replyPreview?: any
  userId?: number
  username?: string
  avatar?: string
  createdAt?: string
}

interface CachedPrivateMessage {
  id: number
  seq?: number
  conversationId: string
  content?: string
  imageUrl?: string
  replyToMessageId?: number | null
  replyPreview?: any
  senderId?: number
  senderName?: string
  senderAvatar?: string
  receiverId?: number
  isRead?: boolean
  createdAt?: string
}

interface SyncState {
  key: string
  lastSeq: number
  updatedAt: number
}

class ChatCacheDb extends Dexie {
  roomMessages!: Table<CachedRoomMessage, number>
  privateMessages!: Table<CachedPrivateMessage, number>
  syncStates!: Table<SyncState, string>

  constructor() {
    super('chat_cache_v1')
    this.version(1).stores({
      roomMessages: 'id, roomId, seq, createdAt',
      privateMessages: 'id, conversationId, seq, createdAt',
      syncStates: 'key, updatedAt'
    })
  }
}

const db = import.meta.client ? new ChatCacheDb() : null

const isCacheReady = () => Boolean(db)

const toPositiveInt = (value: unknown) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const seqOrId = (item: { seq?: number; id: number }) => {
  return Number(item.seq ?? item.id ?? 0)
}

const bySeqThenId = <T extends { id: number; seq?: number }>(a: T, b: T) => {
  const seqDiff = seqOrId(a) - seqOrId(b)
  if (seqDiff !== 0) {
    return seqDiff
  }

  return a.id - b.id
}

const maxSeq = (items: Array<{ id: number; seq?: number }>) => {
  return items.reduce((maxValue, item) => {
    const value = seqOrId(item)
    return value > maxValue ? value : maxValue
  }, 0)
}

const setSyncState = async (key: string, lastSeq: number) => {
  if (!db || !Number.isInteger(lastSeq) || lastSeq <= 0) {
    return
  }

  const existing = await db.syncStates.get(key)
  const safeLastSeq = Math.max(existing?.lastSeq ?? 0, lastSeq)

  await db.syncStates.put({
    key,
    lastSeq: safeLastSeq,
    updatedAt: Date.now()
  })
}

const getSyncState = async (key: string) => {
  if (!db) {
    return 0
  }

  const row = await db.syncStates.get(key)
  return row?.lastSeq ?? 0
}

const buildPrivateConversationId = (userIdA: number, userIdB: number) => {
  const a = Number(userIdA)
  const b = Number(userIdB)
  return `private_${Math.min(a, b)}_${Math.max(a, b)}`
}

const pruneOldRoomMessages = async (roomId: number, limit: number = ROOM_MESSAGE_RETENTION_LIMIT) => {
  if (!db || !Number.isInteger(limit) || limit <= 0) {
    return
  }

  const parsedRoomId = toPositiveInt(roomId)
  if (!parsedRoomId) {
    return
  }

  const rows = await db.roomMessages.where('roomId').equals(parsedRoomId).toArray()
  if (rows.length <= limit) {
    return
  }

  const deleteRows = rows.sort(bySeqThenId).slice(0, rows.length - limit)
  const deleteIds = deleteRows.map((item: CachedRoomMessage) => item.id)

  if (deleteIds.length > 0) {
    await db.roomMessages.bulkDelete(deleteIds)
  }
}

const pruneOldPrivateMessages = async (
  currentUserId: number,
  friendId: number,
  limit: number = PRIVATE_MESSAGE_RETENTION_LIMIT
) => {
  if (!db || !Number.isInteger(limit) || limit <= 0) {
    return
  }

  const conversationId = buildPrivateConversationId(currentUserId, friendId)
  const rows = await db.privateMessages.where('conversationId').equals(conversationId).toArray()
  if (rows.length <= limit) {
    return
  }

  const deleteRows = rows.sort(bySeqThenId).slice(0, rows.length - limit)
  const deleteIds = deleteRows.map((item: CachedPrivateMessage) => item.id)

  if (deleteIds.length > 0) {
    await db.privateMessages.bulkDelete(deleteIds)
  }
}

export const useChatCache = () => {
  const getRoomMessages = async (roomId: number) => {
    if (!db) {
      return [] as CachedRoomMessage[]
    }

    const parsedRoomId = toPositiveInt(roomId)
    if (!parsedRoomId) {
      return [] as CachedRoomMessage[]
    }

    const rows = await db.roomMessages.where('roomId').equals(parsedRoomId).toArray()
    return rows.sort(bySeqThenId)
  }

  const upsertRoomMessages = async (roomId: number, messages: any[]) => {
    if (!db || !Array.isArray(messages) || messages.length === 0) {
      return
    }

    const parsedRoomId = toPositiveInt(roomId)
    if (!parsedRoomId) {
      return
    }

    const normalized = messages
      .map((messageItem) => {
        const messageId = toPositiveInt(messageItem?.id)
        if (!messageId) {
          return null
        }

        return {
          ...messageItem,
          id: messageId,
          seq: Number(messageItem?.seq ?? messageId),
          roomId: toPositiveInt(messageItem?.roomId) || parsedRoomId
        } as CachedRoomMessage
      })
      .filter(Boolean) as CachedRoomMessage[]

    if (normalized.length === 0) {
      return
    }

    await db.roomMessages.bulkPut(normalized)
    await setSyncState(`room:${parsedRoomId}`, maxSeq(normalized))
    await pruneOldRoomMessages(parsedRoomId)
  }

  const putRoomMessage = async (roomId: number, messageItem: any) => {
    await upsertRoomMessages(roomId, [messageItem])
  }

  const updateRoomMessage = async (roomId: number, messageId: number, patch: Partial<CachedRoomMessage>) => {
    if (!db) {
      return
    }

    const parsedRoomId = toPositiveInt(roomId)
    const parsedMessageId = toPositiveInt(messageId)
    if (!parsedRoomId || !parsedMessageId) {
      return
    }

    const existing = await db.roomMessages.get(parsedMessageId)
    if (!existing || existing.roomId !== parsedRoomId) {
      return
    }

    await db.roomMessages.update(parsedMessageId, patch)
  }

  const deleteRoomMessage = async (roomId: number, messageId: number) => {
    if (!db) {
      return
    }

    const parsedRoomId = toPositiveInt(roomId)
    const parsedMessageId = toPositiveInt(messageId)
    if (!parsedRoomId || !parsedMessageId) {
      return
    }

    const existing = await db.roomMessages.get(parsedMessageId)
    if (!existing || existing.roomId !== parsedRoomId) {
      return
    }

    await db.roomMessages.delete(parsedMessageId)
  }

  const getPrivateMessages = async (currentUserId: number, friendId: number) => {
    if (!db) {
      return [] as CachedPrivateMessage[]
    }

    const conversationId = buildPrivateConversationId(currentUserId, friendId)
    const rows = await db.privateMessages.where('conversationId').equals(conversationId).toArray()
    return rows.sort(bySeqThenId)
  }

  const upsertPrivateMessages = async (currentUserId: number, friendId: number, messages: any[]) => {
    if (!db || !Array.isArray(messages) || messages.length === 0) {
      return
    }

    const conversationId = buildPrivateConversationId(currentUserId, friendId)
    const normalized = messages
      .map((messageItem) => {
        const messageId = toPositiveInt(messageItem?.id)
        if (!messageId) {
          return null
        }

        return {
          ...messageItem,
          id: messageId,
          seq: Number(messageItem?.seq ?? messageId),
          conversationId
        } as CachedPrivateMessage
      })
      .filter(Boolean) as CachedPrivateMessage[]

    if (normalized.length === 0) {
      return
    }

    await db.privateMessages.bulkPut(normalized)
    await setSyncState(`private:${conversationId}`, maxSeq(normalized))
    await pruneOldPrivateMessages(currentUserId, friendId)
  }

  const putPrivateMessage = async (currentUserId: number, friendId: number, messageItem: any) => {
    await upsertPrivateMessages(currentUserId, friendId, [messageItem])
  }

  const updatePrivateMessage = async (
    currentUserId: number,
    friendId: number,
    messageId: number,
    patch: Partial<CachedPrivateMessage>
  ) => {
    if (!db) {
      return
    }

    const parsedMessageId = toPositiveInt(messageId)
    if (!parsedMessageId) {
      return
    }

    const conversationId = buildPrivateConversationId(currentUserId, friendId)
    const existing = await db.privateMessages.get(parsedMessageId)
    if (!existing || existing.conversationId !== conversationId) {
      return
    }

    await db.privateMessages.update(parsedMessageId, patch)
  }

  const deletePrivateMessage = async (currentUserId: number, friendId: number, messageId: number) => {
    if (!db) {
      return
    }

    const parsedMessageId = toPositiveInt(messageId)
    if (!parsedMessageId) {
      return
    }

    const conversationId = buildPrivateConversationId(currentUserId, friendId)
    const existing = await db.privateMessages.get(parsedMessageId)
    if (!existing || existing.conversationId !== conversationId) {
      return
    }

    await db.privateMessages.delete(parsedMessageId)
  }

  const getRoomLastSeq = async (roomId: number) => {
    const parsedRoomId = toPositiveInt(roomId)
    if (!parsedRoomId) {
      return 0
    }

    return getSyncState(`room:${parsedRoomId}`)
  }

  const getPrivateLastSeq = async (currentUserId: number, friendId: number) => {
    const conversationId = buildPrivateConversationId(currentUserId, friendId)
    return getSyncState(`private:${conversationId}`)
  }

  const clearAll = async () => {
    if (!db) {
      return
    }

    await db.transaction('rw', db.roomMessages, db.privateMessages, db.syncStates, async () => {
      await db.roomMessages.clear()
      await db.privateMessages.clear()
      await db.syncStates.clear()
    })
  }

  return {
    isCacheReady,
    ROOM_MESSAGE_RETENTION_LIMIT,
    PRIVATE_MESSAGE_RETENTION_LIMIT,
    buildPrivateConversationId,
    getRoomMessages,
    upsertRoomMessages,
    putRoomMessage,
    updateRoomMessage,
    deleteRoomMessage,
    getPrivateMessages,
    upsertPrivateMessages,
    putPrivateMessage,
    updatePrivateMessage,
    deletePrivateMessage,
    pruneOldRoomMessages,
    pruneOldPrivateMessages,
    getRoomLastSeq,
    getPrivateLastSeq,
    clearAll
  }
}
