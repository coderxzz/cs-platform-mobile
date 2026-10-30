import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import AdminView from '@/views/admin/AdminView.vue'
import { configureApi } from '@/shared/api'
import { token, clearSession, hasPermissionDirective } from '@/shared/auth'
import '@/styles/base.css'
import { applySafeArea } from '@/shared/safearea'

// env(safe-area-inset-*) 在某些 WebView 容器里返回 0，这里兜底
applySafeArea()

configureApi({
  getToken: () => token.value,
  onUnauthorized: () => { clearSession(); location.href = '/login' }
})

const router = createRouter({
  history: createWebHistory('/manage'),
  routes: [{ path: '/:p(.*)*', component: AdminView }]
})

const app = createApp(AdminView)
app.use(createPinia())
app.use(router)
app.directive('hasPermission', hasPermissionDirective)
app.mount('#app')