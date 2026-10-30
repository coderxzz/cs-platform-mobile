<template>
  <div class="app-shell login-shell">
    <div class="login-box">
      <div class="logo">客</div>
      <h1>客服平台</h1>

      <div class="field">
        <label>账号</label>
        <input v-model="account" class="input" autocomplete="username" placeholder="邮箱或工号" />
      </div>
      <div class="field">
        <label>密码</label>
        <input v-model="password" class="input" type="password"
               autocomplete="current-password" placeholder="密码" @keyup.enter="submit" />
      </div>

      <p v-if="error" class="err">{{ error }}</p>

      <button class="btn full" :disabled="!canSubmit || loading" @click="submit">
        {{ loading ? '登录中…' : '登录' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/shared/api'
import { setSession } from '@/shared/auth'

const router = useRouter()
const account = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const canSubmit = computed(() => account.value.trim() && password.value)

async function submit() {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const d = await api.post('/v1/auth/login', {
      account: account.value.trim(),
      password: password.value
    })
    setSession(d.token, d.user)
    router.push('/')
  } catch (e) {
    error.value = e.status === 401 ? '账号或密码不正确' : (e.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-shell { display: flex; align-items: center; justify-content: center; }
.login-box { width: 100%; max-width: 340px; padding: 0 24px; text-align: center; }
.logo { width: 56px; height: 56px; border-radius: 14px; background: var(--accent);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 600; margin: 0 auto 14px; }
h1 { font-size: 20px; margin: 0 0 28px; }
.field { text-align: left; }
.btn.full { width: 100%; margin-top: 8px; }
.err { color: var(--danger); font-size: 13px; text-align: left; margin: 0 0 10px; }
</style>
