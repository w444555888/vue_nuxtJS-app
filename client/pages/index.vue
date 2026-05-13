<template>
  <div class="home-container">
    <!-- Header -->
    <header class="hero">
      <div class="hero-content">
        <div class="hero-title">Mike Chat</div>
        <p class="hero-subtitle">即時通訊平台</p>
        <div class="hero-actions">
          <NuxtLink to="/login" class="btn btn-primary">開始聊天</NuxtLink>
          <NuxtLink to="/login" class="btn btn-secondary">註冊帳戶</NuxtLink>
        </div>
      </div>
    </header>

    <!-- Features -->
    <section class="features">
      <div class="section-title">功能特性</div>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">
            <MessageCircle :size="34" stroke-width="1.5" />
          </div>
          <div class="feature-title">即時消息</div>
          <p>秒級消息推送，暢享流暢聊天體驗</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <Users :size="34" stroke-width="1.5" />
          </div>
          <div class="feature-title">群聊支持</div>
          <p>創建群聊，與多人同步討論</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <Lock :size="34" stroke-width="1.5" />
          </div>
          <div class="feature-title">隱私保護</div>
          <p>端到端加密，保障您的隱私</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <Zap :size="34" stroke-width="1.5" />
          </div>
          <div class="feature-title">高效可靠</div>
          <p>99.9% 可用性，穩定服務保障</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <Share2 :size="34" stroke-width="1.5" />
          </div>
          <div class="feature-title">文件分享</div>
          <p>輕松共享文件和媒體內容</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <Search :size="34" stroke-width="1.5" />
          </div>
          <div class="feature-title">消息搜索</div>
          <p>快速搜索歷史消息和記錄</p>
        </div>
      </div>
    </section>

    <!-- Call to Action -->
    <section class="cta">
      <div class="cta-content">
        <div class="cta-title">準備好開始了嗎？</div>
        <p>加入數百萬用戶，開啟您的聊天之旅</p>
        <NuxtLink to="/login" class="btn btn-primary btn-large">立即開始</NuxtLink>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <p>&copy; 2025 Mike Chat. All rights reserved.</p>
    </footer>
  </div>
</template>


<script setup lang="ts">
    import { MessageCircle, Users, Lock, Zap, Share2, Search } from 'lucide-vue-next'
</script>


<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.home-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #f0f4f8 100%);
  display: flex;
  flex-direction: column;
}

/* Hero Section */
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4rem 2rem;
  text-align: center;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-content {
  max-width: 600px;
  animation: fadeInDown 0.8s ease-out;
}

.hero-title {
  font-size: 2.8rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  letter-spacing: -1px;
}

.hero-subtitle {
  font-size: 1rem;
  margin-bottom: 2rem;
  opacity: 0.95;
  font-weight: 300;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* Button Styles */
.btn {
  display: inline-block;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
  cursor: pointer;
  border: 2px solid transparent;
  font-size: 1rem;
}

.btn-primary {
  background: white;
  color: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;

  border-color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
}

.btn-secondary {
  background: transparent;
  color: white;
  border-color: white;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.btn-large {
  padding: 1rem 3rem;
  font-size: 1.1rem;
}

/* Features Section */
.features {
  padding: 3.5rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.section-title {
  font-size: 2rem;
  color: #1f2937;
  margin-bottom: 3rem;
  text-align: center;
  font-weight: 700;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border-top: 4px solid linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

.feature-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.feature-title {
  color: #1f2937;
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.feature-card p {
  color: #6b7280;
  font-size: 0.95rem;
  line-height: 1.6;
}

/* CTA Section */
.cta {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 3rem 2rem;
  text-align: center;
  margin-top: 3rem;
}

.cta-content {
  max-width: 600px;
  margin: 0 auto;
}

.cta-title {
  font-size: 1.8rem;
  margin-bottom: 1rem;
  font-weight: 700;
}

.cta p {
  font-size: 0.95rem;
  margin-bottom: 2rem;
  opacity: 0.95;
}

/* Footer */
.footer {
  background: #1f2937;
  color: #9ca3af;
  text-align: center;
  padding: 2rem;
  font-size: 0.9rem;
  margin-top: auto;
}

/* Animations */
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .hero-title {
    font-size: 2.5rem;
  }

  .hero-subtitle {
    font-size: 1rem;
  }

  .hero-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }

  .features h2,
  .cta h2 {
    font-size: 2rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
