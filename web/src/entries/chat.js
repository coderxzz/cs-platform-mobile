import { createApp, h } from 'vue'
import ChatView from '@/views/chat/ChatView.vue'
import { configureApi } from '@/shared/api'
import '@/styles/base.css'
import { applySafeArea } from '@/shared/safearea'

// env(safe-area-inset-*) 在某些 WebView 容器里返回 0，这里兜底
applySafeArea()

// 玩家端不需要路由和登录，只有一个聊天窗
configureApi({
  getToken: () => localStorage.getItem('cs_embed_session') || ''
})

// 组件自己带 .app-shell 外壳，这里不要再包一层
// （之前包了两层，导致大屏居中的宽度被算错）
createApp({ render: () => h(ChatView) }).mount('#app')