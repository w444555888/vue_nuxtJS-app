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

  // 初始化 IndexedDB schema 與索引。
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


/**
 * 內部方法  
 * @internal
 * @function toPositiveInt
 * @function seqOrId
 * @function bySeqThenId
 * @function maxSeq
 * @function setSyncState
 * @function getSyncState
 * @function buildPrivateConversationId
 * @function pruneOldRoomMessages
 * @function pruneOldPrivateMessages
 */

// 將任意輸入轉為正整數，不合法時回傳 null。
const toPositiveInt = (value: unknown) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}


// 取訊息排序基準：優先 seq，缺少時退回 id。
const seqOrId = (item: { seq?: number; id: number }) => {
  return Number(item.seq ?? item.id ?? 0)
}


// 依 seq 再依 id 進行穩定排序。
const bySeqThenId = <T extends { id: number; seq?: number }>(a: T, b: T) => {
  const seqDiff = seqOrId(a) - seqOrId(b)
  if (seqDiff !== 0) {
    return seqDiff
  }

  return a.id - b.id
}


// 取得一批訊息中的最大 seq 值。
const maxSeq = (items: Array<{ id: number; seq?: number }>) => {
  return items.reduce((maxValue, item) => {
    const value = seqOrId(item)
    return value > maxValue ? value : maxValue
  }, 0)
}


// 寫入同步游標，並防止 lastSeq 回退。
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


// 讀取同步游標，找不到時回傳 0。
const getSyncState = async (key: string) => {
  if (!db) {
    return 0
  }

  const row = await db.syncStates.get(key)
  return row?.lastSeq ?? 0
}


// 產生私聊固定會話 ID，確保雙方順序一致。
const buildPrivateConversationId = (userIdA: number, userIdB: number) => {
  const a = Number(userIdA)
  const b = Number(userIdB)
  return `private_${Math.min(a, b)}_${Math.max(a, b)}`
}

// 清理群聊舊訊息，只保留最近 limit 筆。
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

// 清理私聊舊訊息，只保留最近 limit 筆。
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



// 提供聊天快取相關的讀寫 API。
export const useChatCache = () => {
  // 讀取指定房間訊息並依序排序。
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

  // 批次新增或覆蓋房間訊息，並更新同步游標與保留上限。
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

  // 單筆寫入房間訊息（包裝成 upsert 批次流程）。
  const putRoomMessage = async (roomId: number, messageItem: any) => {
    await upsertRoomMessages(roomId, [messageItem])
  }

  // 更新指定房間中的單筆訊息欄位。
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

  // 刪除指定房間中的單筆訊息。
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

  // 讀取指定私聊會話訊息並依序排序。
  const getPrivateMessages = async (currentUserId: number, friendId: number) => {
    if (!db) {
      return [] as CachedPrivateMessage[]
    }

    const conversationId = buildPrivateConversationId(currentUserId, friendId)
    const rows = await db.privateMessages.where('conversationId').equals(conversationId).toArray()
    return rows.sort(bySeqThenId)
  }

  // 批次新增或覆蓋私聊訊息，並更新同步游標與保留上限。
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

  // 單筆寫入私聊訊息（包裝成 upsert 批次流程）。
  const putPrivateMessage = async (currentUserId: number, friendId: number, messageItem: any) => {
    await upsertPrivateMessages(currentUserId, friendId, [messageItem])
  }

  // 更新指定私聊中的單筆訊息欄位。
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

  // 刪除指定私聊中的單筆訊息。
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

  // 目前未被外部呼叫，預留給未來重連補償流程使用。
  const getRoomLastSeq = async (roomId: number) => {
    const parsedRoomId = toPositiveInt(roomId)
    if (!parsedRoomId) {
      return 0
    }

    return getSyncState(`room:${parsedRoomId}`)
  }

  // 目前未被外部呼叫，預留給未來重連補償流程使用。
  const getPrivateLastSeq = async (currentUserId: number, friendId: number) => {
    const conversationId = buildPrivateConversationId(currentUserId, friendId)
    return getSyncState(`private:${conversationId}`)
  }

  // 以交易方式清空所有快取與游標資料。
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
    clearAll
  }
}
