<template>
  <router-view v-slot="{ Component }">
    <component :is="Component" />
  </router-view>
  <nav v-if="showTabs" class="tabbar">
    <router-link to="/" class="tab" :class="{ on: $route.name === 'desk' || $route.name === 'conv' }">
      <span>会话</span>
    </router-link>
    <router-link to="/tickets" class="tab" :class="{ on: $route.name === 'tickets' || $route.name === 'ticket' }">
      <span>工单</span>
    </router-link>
    <a class="tab" @click="logout"><span>退出</span></a>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clearSession } from '@/shared/auth'

const route = useRoute()
const router = useRouter()

// 登录页和会话详情页不显示底部导航（详情页有自己的输入栏）
const showTabs = computed(() => !['login', 'conv'].includes(route.name))

function logout() {
  clearSession()
  router.push('/login')
}
</script>

<style>
.tabbar {
  flex: 0 0 auto;
  display: flex;
  background: #fff;
  border-top: 1px solid var(--line);
  padding-bottom: var(--safe-b);
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 12px;
  color: var(--dim);
  text-decoration: none;
}
.tab.on { color: var(--accent); }
</style>
