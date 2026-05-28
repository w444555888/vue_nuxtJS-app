# 聊天系統技術文檔

## 目錄
- [架構設計](#架構設計)
- [私聊功能](#私聊功能)
- [群組聊天](#群組聊天)
- [核心機制](#核心機制)
- [前端使用指南](#前端使用指南)
- [後端實現](#後端實現)
- [故障排除](#故障排除)

---

## 架構設計

### 整體架構

本聊天系統採用 **Snapshot + Event Streaming（快照 + 事件流）** 混合架構：

```
┌─────────────────────────────────────────┐
│         前端 (Nuxt 3 + Vue 3)           │
│  ┌─────────────────────────────────────┐│
│  │     Socket.IO 客戶端                ││
│  │  (實時消息、ACK、重連恢復)           ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │     HTTP Client                     ││
│  │  (初始快照、REST API)               ││
│  └─────────────────────────────────────┘│
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
   HTTP REST      WebSocket
   (Snapshot)    (Real-time)
       │                │
   ┌───▼────────────────▼──────┐
   │   後端 (Node.js + Express) │
   │  ┌──────────────────────┐ │
   │  │  Socket.IO Server    │ │
   │  │  - send_message      │ │
   │  │  - join_room         │ │
   │  │  - 消息恢復          │ │
   │  └──────────────────────┘ │
   │  ┌──────────────────────┐ │
   │  │  REST Routes         │ │
   │  │  - GET /messages     │ │
   │  │  - POST /messages    │ │
   │  └──────────────────────┘ │
   └─────────┬──────────────────┘
             │
        ┌────▼─────┐
        │ PostgreSQL│
        │ Database  │
        └───────────┘
```

### 關鍵特性

| 特性 | 說明 |
|------|------|
| **初始快照** | 使用 HTTP GET 獲取歷史消息 |
| **實時更新** | 通過 WebSocket 接收新消息 |
| **自動恢復** | 斷線後上傳 lastSeq，獲取遺失消息 |
| **消息去重** | 前端使用 Set<id> 防止重複 |
| **ACK 確認** | Socket 回調確認消息已保存 |

---

## 私聊功能

### 概述

私聊是一對一的直接對話，只有兩個用戶可以看到。

### 技術流程

#### 1. 初始化私聊

```typescript
// 前端：PrivateChat.vue

const loadMessages = async () => {
  // 第一步：HTTP 獲取歷史消息（快照）
  const result = await chatService.fetchPrivateMessages(props.friend.id)
  messages.value = sortedMessages

  // 第二步：加入 Socket 房間（帶上 lastSeq）
  socket.joinPrivateChatWithSeq(
    props.currentUserId,
    props.friend.id,
    getLastSeq()  // 取最新消息的 seq
  )

  // 第三步：標記為已讀
  await chatService.markPrivateAsRead(props.friend.id)
}
```

```
時間線：
┌──────────────────────────────────────────────────┐
│ 用戶點開私聊                                       │
└──────────────────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │ 1. HTTP GET /messages  │ (異步)
        │    獲取歷史消息         │
        │    返回所有過往消息     │
        └─────────┬─────────────┘
                  ↓
    ┌─────────────────────────────────┐
    │ 2. Socket join_private_chat      │
    │    發送 lastSeq（最新消息 ID）  │
    │    後端發送遺失消息              │
    └─────────────┬───────────────────┘
                  ↓
      ┌───────────────────────┐
      │ 3. markPrivateAsRead   │
      │    標記已讀消息        │
      └───────────────────────┘
```

#### 2. 發送私聊消息

```typescript
// 前端

const sendMessage = async () => {
  const content = messageContent.value.trim()

  // 發送 + 等待 ACK（8秒超時）
  const result = await socket.sendPrivateMessage(
    props.currentUserId,
    props.friend.id,
    content
  )

  if (result?.success) {
    messageContent.value = ''  // 清空輸入
  } else {
    message.error(result?.message || '發送失敗')
  }
}
```

```javascript
// 後端：socket.js

socket.on('send_private_message', async (data, ack) => {
  const { friendId, content } = data
  
  // 1. 驗證好友關係
  const isFriend = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId1: authenticatedUserId, userId2: Number(friendId) },
        { userId1: Number(friendId), userId2: authenticatedUserId }
      ]
    }
  })
  
  if (!isFriend) {
    ack({ success: false, message: '該用戶不是你的好友' })
    return
  }

  // 2. 保存到資料庫
  const message = await prisma.privateMessage.create({
    data: {
      content,
      senderId: authenticatedUserId,
      receiverId: friendId,
      isRead: false
    },
    include: { sender: {...}, receiver: {...} }
  })

  // 3. 構建對話 ID
  const conversationId = buildPrivateConversationId(
    authenticatedUserId,
    friendId
  )

  // 4. 廣播給雙方
  io.to(conversationId).emit('receive_private_message', {
    id: message.id,
    seq: message.id,
    senderId: message.sender.id,
    receiverId: message.receiver.id,
    content: message.content,
    createdAt: message.createdAt,
    eventType: 'private_message_created'
  })

  // 5. 發送 ACK 確認
  ack({ success: true, event: {...} })
})
```

#### 3. 消息流程圖

```
發送端                    後端                    接收端
  │                      │                      │
  ├─ sendPrivateMessage──→ │                      │
  │   (等待 ACK)          │                      │
  │                      ├─ 驗證好友關係         │
  │                      ├─ 保存到 DB            │
  │                      │                      │
  │                      ├─ receive_private─────→ │
  │                      │  _message (廣播)      │ (監聽)
  │                      │                      │
  │    ack ←─────────────┤                      │
  │   成功回應            │                      │
  │                      │                      │
  └─ 清空輸入框          │                      └─ 顯示新消息
```

### 對話 ID 規則

```typescript
const buildPrivateConversationId = (userIdA, userIdB) => {
  return `private_${Math.min(userIdA, userIdB)}_${Math.max(userIdA, userIdB)}`
}

// 例：用戶 1 和用戶 2 的對話 ID
// → private_1_2 (無論誰發起，ID 都相同)
```

這確保雙方的 Socket 加入同一個房間，能互相看到消息。

### 前端 API

#### joinPrivateChatWithSeq

```typescript
socket.joinPrivateChatWithSeq(
  userId: number,
  friendId: number,
  lastSeq: number = 0  // 上次最新消息的 ID
)
```

**用途**：加入私聊房間，觸發後端查詢遺失消息

#### sendPrivateMessage

```typescript
const result = await socket.sendPrivateMessage(
  userId: number,
  friendId: number,
  content: string
)
// 返回：{ success: boolean, message?: string, event?: Message }
```

**用途**：發送私聊消息，等待後端 ACK

#### markPrivateAsRead

```typescript
await socket.markPrivateAsRead(userId: number, friendId: number)
```

**用途**：標記來自 friendId 的所有未讀消息為已讀

### 數據庫表結構

```sql
-- 好友關係表
CREATE TABLE "Friend" (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId1 INT NOT NULL,  -- 發起者
  userId2 INT NOT NULL,  -- 接收者
  status VARCHAR(20),    -- 'pending' | 'accepted'
  createdAt TIMESTAMP,
  UNIQUE(userId1, userId2),
  FOREIGN KEY(userId1) REFERENCES "User"(id),
  FOREIGN KEY(userId2) REFERENCES "User"(id)
);

-- 私聊消息表
CREATE TABLE "PrivateMessage" (
  id INT PRIMARY KEY AUTO_INCREMENT,
  senderId INT NOT NULL,
  receiverId INT NOT NULL,
  content TEXT NOT NULL,
  isRead BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(senderId) REFERENCES "User"(id),
  FOREIGN KEY(receiverId) REFERENCES "User"(id),
  INDEX(senderId, receiverId),  -- 查詢對話時快速定位
  INDEX(createdAt)
);
```

---

## 群組聊天

### 概述

群組聊天是多人對話，有成員管理、權限控制。

### 技術流程

#### 1. 加入聊天室

```typescript
// 前端：ChatRoom.vue

const joinRoomWithRecovery = () => {
  // 計算最新消息 seq
  const lastSeq = getLastSeq()
  
  socket.joinRoom(
    props.currentUserId,
    props.room.id,
    lastSeq
  )
}
```

```javascript
// 後端

socket.on('join_room', async (data) => {
  const { roomId, lastSeq } = data

  // 1. 驗證成員身份
  const member = await prisma.chatRoomMember.findUnique({
    where: {
      userId_roomId: {
        userId: authenticatedUserId,
        roomId
      }
    }
  })

  if (!member) {
    socket.emit('error', { message: '你不是此聊天室的成員' })
    return
  }

  // 2. 加入 Socket 房間
  socket.join(`room_${roomId}`)
  onlineUsers.set(socket.id, { userId: authenticatedUserId, roomId })

  // 3. 補償遺失的消息
  if (Number.isInteger(lastSeq) && lastSeq > 0) {
    const missedMessages = await prisma.message.findMany({
      where: {
        roomId,
        id: { gt: lastSeq }  // ID > lastSeq 的消息
      },
      include: { user: {...} },
      orderBy: { id: 'asc' }
    })

    if (missedMessages.length > 0) {
      socket.emit('room_missed_messages', 
        missedMessages.map(formatRoomMessageEvent)
      )
    }
  }

  // 4. 通知其他成員
  io.to(`room_${roomId}`).emit('user_joined', {
    userId: authenticatedUserId,
    roomId,
    message: `使用者 ${authenticatedUserId} 進入聊天室`
  })
})
```

#### 2. 發送群組消息

```typescript
// 前端

const handleSendMessage = async () => {
  const content = messageContent.value.trim()

  // 等待 ACK 確認保存
  const result = await socket.sendMessage(
    props.currentUserId,
    props.room.id,
    content
  )

  if (result?.success) {
    messageContent.value = ''  // 只在成功時清空
  } else {
    message.error(result?.message || '發送失敗')
  }
}
```

```javascript
// 後端

socket.on('send_message', async (data, ack) => {
  const { roomId, content } = data

  // 1. 驗證是否為成員
  const member = await prisma.chatRoomMember.findUnique({
    where: {
      userId_roomId: { userId: authenticatedUserId, roomId }
    }
  })

  if (!member) {
    ack({ success: false, message: '你不是此聊天室的成員' })
    return
  }

  // 2. 保存消息
  const message = await prisma.message.create({
    data: {
      content: content.trim(),
      userId: authenticatedUserId,
      roomId
    },
    include: { user: {...} }
  })

  // 3. 廣播給所有成員
  io.to(`room_${roomId}`).emit('receive_message', 
    formatRoomMessageEvent(message)
  )

  // 4. 發送 ACK
  ack({ success: true, event: formatRoomMessageEvent(message) })
})
```

#### 3. 編輯消息

```typescript
// 前端：ChatRoom.vue

const submitEdit = async () => {
  const result = await socket.updateMessage(
    props.room.id,
    editingMessageId,
    editContent
  )

  if (result?.success) {
    editingMessageId = null
    editContent = ''
  }
}
```

```javascript
// 後端

socket.on('update_message', async (data, ack) => {
  const { roomId, messageId, content } = data

  // 驗證消息擁有權
  const message = await prisma.message.findUnique({
    where: { id: messageId }
  })

  if (message.userId !== authenticatedUserId) {
    ack({ success: false, message: '只能編輯自己的消息' })
    return
  }

  // 更新消息
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: content.trim() },
    include: { user: {...} }
  })

  // 廣播更新事件
  io.to(`room_${roomId}`).emit('message_updated', {
    id: updated.id,
    seq: updated.id,
    roomId,
    content: updated.content,
    eventType: 'message_updated'
  })

  ack({ success: true, event: {...} })
})
```

#### 4. 刪除消息

```typescript
// 前端

const deleteMessage = async (messageId: number) => {
  const result = await socket.deleteMessage(props.room.id, messageId)
  if (result?.success) {
    // 本地刪除已在監聽器中處理
  }
}
```

#### 5. 消息流程圖

```
群組成員 A          後端           群組成員 B、C、D
  │               │               │
  ├─ join_room──→  │               │
  │ (lastSeq=100)  │               │
  │               ├─ 查詢 id>100    │
  │               │  的消息       │
  │               │               │
  │  missed msg ←─┤               │
  │ (101-105)      │               │
  │               │               │
  ├─ send_msg────→ │               │
  │               ├─ create       │
  │               │               │
  │               ├─ receive_msg─→├─ receive_msg─→│
  │               │  (廣播所有)    │              │
  │               │               │
  │    ack ←──────┤               │
  │   確認保存     │               │
  │               │               │
  └─ UI 清空      │               └─ 顯示新消息
```

### 數據庫表結構

```sql
-- 聊天室表
CREATE TABLE "ChatRoom" (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  creatorId INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(creatorId) REFERENCES "User"(id)
);

-- 聊天室成員表
CREATE TABLE "ChatRoomMember" (
  userId INT NOT NULL,
  roomId INT NOT NULL,
  joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(userId, roomId),
  FOREIGN KEY(userId) REFERENCES "User"(id),
  FOREIGN KEY(roomId) REFERENCES "ChatRoom"(id)
);

-- 群組消息表
CREATE TABLE "Message" (
  id INT PRIMARY KEY AUTO_INCREMENT,
  roomId INT NOT NULL,
  userId INT NOT NULL,
  content TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(roomId) REFERENCES "ChatRoom"(id),
  FOREIGN KEY(userId) REFERENCES "User"(id),
  INDEX(roomId, createdAt),  -- 查詢房間消息時快速定位
  INDEX(createdAt)
};
```

---

## 核心機制

### 1. ACK 確認機制

**目的**：確保消息已成功保存到數據庫

```typescript
// 前端：useSocket.ts

const emitWithAck = <T = any>(
  event: string,
  payload: any,
  timeoutMs = 8000
): Promise<T> => {
  return new Promise((resolve, reject) => {
    if (!socketRef.value) {
      reject(new Error('Socket 尚未連接'))
      return
    }

    let finished = false
    
    // 設置超時（8秒內未收到回應則失敗）
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true
        reject(new Error(`${event} ACK 超時`))
      }
    }, 8000)

    // 發送事件，並定義回調函數
    socketRef.value.emit(event, payload, (response: T) => {
      if (finished) return  // 防止雙重執行

      finished = true
      clearTimeout(timer)
      resolve(response)  // 返回後端回應
    })
  })
}
```

**時間序列**：

```
前端                          後端
  │                            │
  ├─ emit(data, callback)────→ │
  │                            ├─ 保存 DB
  │                            │
  │                            ├─ callback(ack)
  │                     ←──────┤
  │ 收到 ack                   │
  │ 繼續執行                   │
  │                            │
  └─ 超過 8秒                  │
    自動失敗                   │
```

### 2. 消息去重

**目的**：防止同一消息被插入多次

```typescript
// 前端：PrivateChat.vue

const messageIdSet = ref<Set<number>>(new Set())

const applyPrivateMessage = (data: any) => {
  // 檢查是否屬於此對話
  if (!(
    (data.senderId === props.friend.id && data.receiverId === props.currentUserId) ||
    (data.senderId === props.currentUserId && data.receiverId === props.friend.id)
  )) {
    return
  }

  const messageId = Number(data?.id)
  
  // 檢查 Set 中是否已存在（O(1) 查詢）
  if (messageIdSet.value.has(messageId)) {
    return  // 已存在，直接跳過
  }

  // 新消息，加入 Set 並顯示
  messageIdSet.value.add(messageId)
  messages.value.push({...data})
}
```

**應用場景**：

```
快照消息 (HTTP)  事件流消息 (WebSocket)
    ↓                    ↓
  消息 1-100          消息 100-110
    ↓                    ↓
  ┌────────────────────────────┐
  │    messageIdSet 去重        │
  │  { 1, 2, ..., 100, ...110} │
  └────────────────────────────┘
  
結果：不重複，顯示 1-110 的所有消息
```

### 3. 重連恢復

**流程**：

```typescript
// 前端：ChatRoom.vue

const getLastSeq = () => {
  // 取最新消息的 ID 作為序列號
  return messages.value.reduce((max, msg) => {
    return Math.max(max, msg.seq ?? msg.id ?? 0)
  }, 0)
}

const joinRoomWithRecovery = () => {
  socket.joinRoom(
    props.currentUserId,
    props.room.id,
    getLastSeq()  // ← 傳遞最新 seq
  )
}

// 監聽遺失消息
socket.onRoomMissedMessages((missedMsgs: any[]) => {
  missedMsgs.forEach(msg => applyCreatedMessage(msg))
})

// 監聽重連
socket.onConnect(() => {
  joinRoomWithRecovery()  // ← 自動重連並恢復
})
```

**時間軸**：

```
時間 ────────────────────────────────────────────

用戶連接               發送消息 1-10              斷線
  │                        │                      │
  ├─ join_room(0)──────────┤                      │
  │  接收消息 1-10          │                      │
  │                        │                      ├─ 網路斷開
  │                        │                      │
  │                        │      (後台繼續發消息)  │
  │                        │      消息 11-15      │
  │                        │                      │
重連 (5秒後)                                        │
  │                                               │
  ├─ join_room(10) ◄──────────────────────────────┤
  │  後端查詢 id>10 的消息 (11-15)                  │
  │                                               │
  │◄───── room_missed_messages(11-15) ────────────┤
  │
  └─ 顯示完整的 1-15 消息
```

### 4. Socket Token 管理

**問題**：同一瀏覽器多個用戶登入，舊的 socket 連接被新用戶複用

**解決方案**：

```typescript
// useSocket.ts

let lastTokenRef: string | null = null

const initSocket = () => {
  const currentToken = authStore.token

  // 檢測 token 變化（登出或切換帳號）
  if (socketRef.value && lastTokenRef && lastTokenRef !== currentToken) {
    console.log('[Socket] Token 變化，重新連接...')
    socketRef.value.disconnect()  // 斷開舊連接
    socketRef.value = null
  }

  if (socketRef.value) return  // 連接已存在

  // 創建新連接
  socketRef.value = io(socketUrl, {
    auth: { token: currentToken }  // 使用新 token
  })

  lastTokenRef = currentToken  // 記錄當前 token
}
```

**登出時的清理**：

```typescript
// useAuthService.ts

const logout = () => {
  const socket = useSocket()
  socket.disconnectSocket()  // ← 立即斷開
  
  authStore.clearAuth()
  router.push('/login')
}
```

---

## 前端使用指南

### 初始化 Socket

```typescript
// pages/chat/index.vue

onMounted(() => {
  socket.initSocket()  // 初始化連接
  
  if (authStore.user?.id) {
    socket.setUserId(authStore.user.id)  // 設置用戶 ID
  }
})
```

### 使用私聊

#### 步驟 1：加載歷史消息

```typescript
const loadMessages = async () => {
  // 從 HTTP 獲取歷史消息
  const result = await chatService.fetchPrivateMessages(friendId)
  messages.value = result.data.messages
}
```

#### 步驟 2：加入 Socket 房間

```typescript
const joinPrivateWithRecovery = () => {
  const lastSeq = getLastSeq()
  socket.joinPrivateChatWithSeq(currentUserId, friendId, lastSeq)
}
```

#### 步驟 3：設置監聽器

```typescript
const setupMessageListener = () => {
  socket.onReceivePrivateMessage((data) => {
    applyPrivateMessage(data)  // 去重插入
  })

  socket.onPrivateMissedMessages((missedMsgs) => {
    missedMsgs.forEach(msg => applyPrivateMessage(msg))
  })
}
```

#### 步驟 4：發送消息

```typescript
const sendMessage = async () => {
  const result = await socket.sendPrivateMessage(
    currentUserId,
    friendId,
    content
  )

  if (result?.success) {
    messageContent = ''  // 清空輸入
  }
}
```

#### 步驟 5：清理

```typescript
onUnmounted(() => {
  socket.leavePrivateChat(friendId)
  socket.offReceivePrivateMessage(messageListener)
  // ... 移除其他監聽器
})
```

### 使用群組聊天

```typescript
// components/ChatRoom.vue

// 1. 加載初始消息
const loadMessages = async () => {
  const result = await chatService.fetchRoomMessages(roomId)
  messages.value = result.data.messages
}

// 2. 加入房間並恢復
const joinRoomWithRecovery = () => {
  const lastSeq = getLastSeq()
  socket.joinRoom(currentUserId, roomId, lastSeq)
}

// 3. 監聽新消息
const setupRoomListener = () => {
  socket.onReceiveMessage((data) => {
    applyCreatedMessage(data)  // 去重插入
  })

  socket.onRoomMissedMessages((missedMsgs) => {
    missedMsgs.forEach(msg => applyCreatedMessage(msg))
  })
}

// 4. 發送消息
const handleSendMessage = async () => {
  const result = await socket.sendMessage(currentUserId, roomId, content)
  if (result?.success) {
    messageContent = ''
  }
}

// 5. 編輯消息
const submitEdit = async () => {
  const result = await socket.updateMessage(roomId, messageId, newContent)
  if (result?.success) {
    editingMessageId = null
  }
}

// 6. 刪除消息
const deleteMessage = async (messageId: number) => {
  const result = await socket.deleteMessage(roomId, messageId)
  // 監聽器會自動刪除
}

// 7. 離開房間
onUnmounted(() => {
  socket.leaveRoom(roomId)
  // ... 移除所有監聽器
})
```

### 完整 Composable 示例

```typescript
// composables/useChatService.ts

export const useChatService = () => {
  const { get, post, patch, delete: del } = useHttpClient()

  // 私聊相關
  const fetchPrivateMessages = async (friendId: number) => {
    return get(`/api/chat/private/${friendId}`)
  }

  const fetchPrivateConversations = async () => {
    return get('/api/chat/private-conversations')
  }

  const markPrivateAsRead = async (friendId: number) => {
    return post(`/api/chat/private/${friendId}/mark-read`)
  }

  // 群組相關
  const fetchRoomMessages = async (roomId: number) => {
    return get(`/api/chat/rooms/${roomId}/messages`)
  }

  const fetchRooms = async () => {
    return get('/api/chat/rooms')
  }

  // ... 更多方法
}
```

---

## 後端實現

### Socket.IO 中間件

```javascript
// src/index.js

io.use((socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token
    const token = authToken || socket.handshake.headers?.authorization?.split(' ')[1]

    if (!token) {
      return next(new Error('未授權：缺少 token'))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.user = {
      id: decoded.id,
      username: decoded.username
    }
    
    return next()
  } catch (error) {
    return next(new Error(`身份驗證失敗: ${error.message}`))
  }
})

socketHandler(io)
```

### 事件處理器

**send_message**
```javascript
socket.on('send_message', async (data, ack) => {
  // 1. 驗證成員身份
  // 2. 驗證內容
  // 3. 保存到 DB
  // 4. 廣播消息
  // 5. 發送 ACK
})
```

**join_room**
```javascript
socket.on('join_room', async (data) => {
  // 1. 驗證成員身份
  // 2. 加入 Socket 房間
  // 3. 查詢遺失消息（如果有 lastSeq）
  // 4. 廣播用戶加入事件
})
```

### REST 路由

```javascript
// src/routes/chat.js

// 獲取房間消息
router.get('/rooms/:roomId/messages', verifyToken, async (req, res) => {
  const messages = await getRoomMessages(req.user.id, roomId)
  return successResponse(res, { messages })
})

// 發送消息（REST 備用方案）
router.post('/rooms/:roomId/messages', verifyToken, async (req, res) => {
  const message = await sendRoomMessage(req.user.id, roomId, req.body.content)
  
  // 同時廣播 WebSocket 事件
  const io = req.app.get('io')
  io.to(`room_${roomId}`).emit('receive_message', {...})
})
```

---

## 故障排除

### 問題：消息重複

**原因**：快照消息和事件流消息被重複計算

**解決**：確保前端使用 `messageIdSet` 去重

```typescript
if (messageIdSet.value.has(messageId)) {
  return  // 跳過已存在的消息
}
```

### 問題：私聊提示「不是你的好友」

**原因**：
1. Token 過期，socket 連接被複用（舊用戶身份）
2. 好友關係未建立或被刪除

**解決**：
1. 檢查 `useAuthService.ts` 登出是否調用 `disconnectSocket()`
2. 驗證 `Friend` 表中是否存在記錄

```sql
SELECT * FROM "Friend" 
WHERE (userId1 = ? AND userId2 = ?) 
   OR (userId1 = ? AND userId2 = ?)
```

### 問題：消息未送達

**原因**：ACK 超時或連接斷開

**解決**：
1. 檢查後端日誌是否有錯誤
2. 增加 ACK 超時時間

```typescript
const result = await emitWithAck(
  'send_private_message',
  { friendId, content },
  12000  // 改為 12 秒
)
```

### 問題：斷線後消息不恢復

**原因**：未傳遞 `lastSeq` 參數

**解決**：確保 `joinRoom` 或 `joinPrivateChatWithSeq` 傳遞了 seq

```typescript
socket.joinPrivateChatWithSeq(
  currentUserId,
  friendId,
  getLastSeq()  // ← 不能省略
)
```

### 問題：性能卡頓

**原因**：消息數量過多，rendering 耗時

**解決**：
1. 分頁加載舊消息
2. 使用虛擬列表 (virtual scroller)
3. 限制顯示的消息數量

```typescript
const visibleMessages = computed(() => {
  return messages.value.slice(-100)  // 只顯示最近 100 條
})
```

---

## 常用命令

### 後端測試

```bash
# 重啟後端
cd backend
npm start

# 查看日誌
tail -f logs/app.log
```

### 前端測試

```bash
# 開發模式
cd client
npm run dev

# 生產構建
npm run build
```

### 數據庫查詢

```sql
-- 查看未讀消息
SELECT * FROM "PrivateMessage" 
WHERE receiverId = ? AND isRead = false;

-- 查看聊天室成員
SELECT u.username FROM "ChatRoomMember" crm
JOIN "User" u ON u.id = crm.userId
WHERE crm.roomId = ?;

-- 查看消息歷史
SELECT * FROM "Message" 
WHERE roomId = ? 
ORDER BY id DESC 
LIMIT 50;
```

---

## 總結

| 功能 | 技術 | 優點 |
|------|------|------|
| **初始化** | HTTP 快照 | 快速加載歷史數據 |
| **實時更新** | WebSocket 事件 | 低延遲，即時同步 |
| **消息確認** | ACK 回調 | 確保消息保存 |
| **去重** | Set<id> | O(1) 查詢，無重複 |
| **自動恢復** | lastSeq 追蹤 | 斷線自動補償 |
| **Token 管理** | Token 變化檢測 | 多用戶切換無沖突 |

