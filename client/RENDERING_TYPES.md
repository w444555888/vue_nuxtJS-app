# Nuxt 4 渲染模式實現指南

## 概述

| 模式 | 說明 | 適用場景 |
|------|------|--------|
| **CSR** | 客戶端渲染 | 儀表板、聊天室、管理介面、SEO 不重要的頁面 |
| **SSR** | 伺服器端渲染 | 新聞網站、SNS 時間軸、庫存資訊、SEO 重要頁面 |
| **SSG** | 靜態生成 | 公司簡介、使用條款、文件站、靜態內容 |
| **ISR** | 增量靜態再生 | 商品頁、天氣預報、定期更新的內容 |
| **PPR** | 部分預渲染 | 混合靜態+動態內容（文章+留言、商品+庫存） |

---

## 1. CSR（客戶端渲染）

**完全在瀏覽器中渲染，適合實時互動應用**

### 設定
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,  // 禁用 SSR
})
```

### 優缺點
首屏加載快速（只需下載 JS）  
適合高度互動的應用  
SEO 不友好  
JS bundle 較大  

### 你的聊天應用
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,  // 聊天頁面用 CSR
  modules: ['@pinia/nuxt'],
})
```

---

## 2. SSR（伺服器端渲染）

**在伺服器上渲染，再發送 HTML 給客戶端**

### 設定
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: true,  // 啟用 SSR（預設值）
})
```

### 優缺點
優秀的 SEO  
更好的首屏加載體驗  
動態內容實時更新  
伺服器負載較高  
部署複雜度增加  

### 你的登入頁面
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: true,
  routeRules: {
    '/login': { ssr: true },  // 登入頁啟用 SSR
  }
})
```

---

## 3. SSG（靜態生成）

**構建時預生成所有靜態 HTML，最快速度**

### 實現方式
```bash
# 1. 構建並生成靜態文件
npx nuxi generate

### 設定
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: true,
  routes: [
    '/about',
    '/terms',
    '/privacy',
  ]
})
```

### 優缺點
極快的速度  
無需伺服器  
零伺服器成本  
必須重新構建才能更新  
不適合動態內容  

### 使用場景
```typescript
// 公司簡介、使用條款、文件站
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },           // 首頁
    '/about': { prerender: true },      // 關於我們
    '/terms': { prerender: true },      // 使用條款
    '/privacy': { prerender: true },    // 隱私政策
  }
})
```

---

## 4. ISR（增量靜態再生）

**靜態生成 + 背景重新驗證，適合定期更新的內容**

### 設定
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    // 商品頁面：靜態生成 + 3600 秒後重新驗證
    '/products/**': { swr: 3600 },
  }
})
```

### 優缺點
速度快（快取命中時）  
支持自動更新  
SEO 友好  
降低伺服器負載  
首次更新有延遲  
需要伺服器支持（不能用靜態主機）  

---

## 5. PPR（部分預渲染）

**同一頁面既有靜態內容又有動態內容，Nuxt 4 內置支持**
### 設定
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: false,
  },
})
```


---

## 快速決策表

| 你的頁面 | 推薦模式 | 設定 |
|--------|--------|------|
| `/login` 登入 | **SSR** | `ssr: true` |
| `/chat/**` 聊天 | **CSR** 或 **PPR** | `ssr: false` 或 ISR + 動態部分 |
| `/products` 商品 | **ISR** | `swr: 600` |
| `/about` 關於 | **SSG** | `prerender: true` |
| `/admin` 後台 | **CSR** | `ssr: false` |
| `/articles/**` 文章 | **PPR** | 靜態 + 留言動態 |

---

## 完整配置範例

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: true,  // 全局啟用 SSR
  routeRules: {
    // 頁面級別設定
    '/': { cache: { maxAge: 60 * 10 } },           // 首頁：10 分鐘快取
    '/login': { ssr: true },                        // 登入頁：SSR
    '/chat/**': { ssr: false, cache: false },      // 聊天頁：CSR，無快取
    '/products/**': { swr: 600 },                  // 商品：ISR，10 分鐘更新
    '/articles/**': { swr: 3600 },                 // 文章：ISR，1 小時更新
    '/about': { prerender: true },                 // 關於頁：SSG
    '/terms': { prerender: true },                 // 條款頁：SSG
    '/api/**': { cache: false },                   // API：不快取
  },
  
  experimental: {
    payloadExtraction: false,  // Nuxt 4，啟用 PPR
  },
  
  modules: ['@pinia/nuxt'],
})
```


