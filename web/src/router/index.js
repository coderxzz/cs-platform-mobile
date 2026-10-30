import { createRouter, createWebHistory } from 'vue-router'
import { token } from '@/shared/auth'

/**
 * 路由按入口分开。
 *
 * 为什么不共用一张路由表：
 *   玩家端（chat）和客服端（desk/admin）是两套权限模型，
 *   混在一起容易出现「玩家能访问客服路由」的低级问题。
 */
const routes = [
  // ---- 客服端 ----
  { path: '/login', name: 'login', component: () => import('@/views/login/LoginView.vue'), meta: { public: true } },
  { path: '/', name: 'desk', component: () => import('@/views/desk/DeskView.vue') },
  { path: '/conv/:id', name: 'conv', component: () => import('@/views/desk/ConvView.vue') },
  { path: '/tickets', name: 'tickets', component: () => import('@/views/tickets/TicketListView.vue') },
  { path: '/ticket/:id', name: 'ticket', component: () => import('@/views/tickets/TicketDetailView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export function createDeskRouter(base = '/') {
  const router = createRouter({
    history: createWebHistory(base),
    routes
  })

  // 未登录跳登录页
  router.beforeEach((to) => {
    if (to.meta && to.meta.public) return true
    if (!token.value) return { name: 'login', query: { redirect: to.fullPath } }
    return true
  })

  return router
}
