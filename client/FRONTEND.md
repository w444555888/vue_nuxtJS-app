# Nuxt 4 聊天室应用 

**Nuxt 4 + Vue 3 + Socket.io**

---

## 项目结构

```
client/
├─ stores/                     # Pinia 状态管理
│  ├─ auth.ts                 # 認證狀態
│  └─ chat.ts                 # 聊天状态
│
├─ composables/               # 组合式函数
│  ├─ useApi.ts              # API 请求封装
│  ├─ useSocket.ts           # Socket.io 连接
│  ├─ useAuthService.ts      # 認證服務
│  └─ useChatService.ts      # 聊天服务
│
├─ components/                # Vue 组件
│  ├─ ChatSidebar.vue        # 聊天室列表侧栏
│  ├─ ChatHeader.vue         # 聊天室头部
│  ├─ ChatMessageList.vue    # 消息列表
│  └─ ChatInputBox.vue       # 消息输入框
│
├─ layouts/                    # 布局
│  └─ chat.vue               # 聊天布局
│
├─ pages/                      # 頁面
│  ├─ login.vue              # 登入/註冊頁
│  └─ chat/
│      ├─ index.vue          # 聊天首頁
│      └─ [id].vue           # 聊天室詳情頁
│
├─ middleware/                 # 中間件
│  └─ auth.ts                # 認證檢查
│
├─ assets/
│  └─ styles/
│      └─ global.css         # 全域樣式
│
├─ nuxt.config.ts            # Nuxt 配置
├─ package.json              # 依賴管理
├─ .env                      # 環境變數
└─ README.md                 # 本文件
```

---

## 技術棧

| 技術 | 版本 | 說明 |
|------|------|------|
| **Nuxt** | ^4.4.5 | Vue 3 框架 |
| **Vue** | ^3.5.34 | 前端框架 |
| **Pinia** | 最新 | 狀態管理 |
| **Socket.io** | ^4.8.x | 實時通信 |
| **Ant Design Vue** | ^4.2.6 | UI 元件庫 |
| **Tailwind CSS** | ^4.3.0 | 樣式框架 |
| **TypeScript** | ^6.0.3 | 類型檢查 |

---

