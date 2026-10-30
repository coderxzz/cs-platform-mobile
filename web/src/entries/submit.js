import { createApp, h } from 'vue'
import SubmitView from '@/views/player/SubmitView.vue'
import { configureApi } from '@/shared/api'
import '@/styles/base.css'

/**
 * 玩家工单提交页。
 *
 * 和聊天页一样：**不需要登录**，身份来自 URL 参数。
 * 和客服后台完全分开 —— 不同入口、不同凭证、不同构建产物。
 */
configureApi({
  getToken: () => localStorage.getItem('cs_embed_session') || ''
})

createApp({ render: () => h(SubmitView) }).mount('#app')
