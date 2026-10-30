import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { createDeskRouter } from '@/router'
import { configureApi } from '@/shared/api'
import { token, clearSession } from '@/shared/auth'
import { hasPermissionDirective } from '@/shared/auth'
import '@/styles/base.css'
import { applySafeArea } from '@/shared/safearea'

// env(safe-area-inset-*) 在某些 WebView 容器里返回 0，这里兜底
applySafeArea()

// 接口层从这里拿 token，组件里不需要关心鉴权
configureApi({
  getToken: () => token.value,
  onUnauthorized: () => { clearSession(); location.href = '/login' }
})

const app = createApp(App)
app.use(createPinia())
app.use(createDeskRouter())
app.directive('hasPermission', hasPermissionDirective)
app.mount('#app')