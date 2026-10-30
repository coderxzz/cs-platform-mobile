<template>
  <div class="app-shell">
    <header class="topbar">
      <button class="back" @click="$router.back()">‹</button>
      <h1>工单详情</h1>
    </header>

    <div class="scroll">
      <div v-if="loading" class="loading">加载中…</div>
      <template v-else>

        <section class="card">
          <h2>{{ t.ticket_title || '(无标题)' }}</h2>
          <div class="meta">
            <span :class="['tag', 'p' + (t.priority === 3 ? '-urgent' : t.priority === 2 ? '-high' : '-low')]">
              {{ PRIORITY_LABEL[t.priority] || '低' }}
            </span>
            <span :class="['tag', 'st-' + t.status_internal]">
              {{ STATUS_LABEL[t.status_internal] || t.status_internal }}
            </span>
            <span v-if="t.source" class="tag src">
              {{ (t.source === 'api' || t.source === 'sobot') ? '智齿' : '自研' }}
            </span>
          </div>
          <p class="content">{{ t.ticket_content || '(无内容)' }}</p>
        </section>

        <section class="card">
          <h3>属性</h3>
          <dl>
            <dt>玩家</dt><dd>{{ t.user_nick || t.partnerid || '—' }}</dd>
            <dt>角色ID</dt><dd>{{ t.role_id || t.partnerid || '—' }}</dd>
            <dt>处理人</dt><dd>{{ t.assignee_id || '未分配' }}</dd>
            <dt>创建</dt><dd>{{ t.create_time || t.created_at || '—' }}</dd>
            <dt v-if="t.sla_due_at">SLA 到期</dt><dd v-if="t.sla_due_at">{{ t.sla_due_at }}</dd>
            <dt v-if="t.ticketid">智齿单号</dt><dd v-if="t.ticketid">{{ t.ticketid }}</dd>
          </dl>
        </section>

        <section class="card">
          <h3>回复记录</h3>
          <div v-if="!replies.length" class="dim">暂无回复</div>
          <div v-for="r in replies" :key="r.id" class="reply">
            <div class="who">{{ r.is_customer_reply ? '玩家' : '客服' }}</div>
            <div class="txt">{{ r.reply_content }}</div>
          </div>
        </section>

        <section v-if="hasPermission('ticket:reply')" class="card">
          <h3>回复</h3>
          <textarea v-model="draft" class="textarea" placeholder="输入回复内容…"></textarea>
          <div class="ops">
            <label class="check">
              <input type="checkbox" v-model="isNote" /> 内部备注（玩家看不到）
            </label>
            <button class="btn" :disabled="!draft.trim() || sending" @click="reply">
              {{ sending ? '发送中…' : (t.ticketid ? '回复并同步智齿' : '回复') }}
            </button>
          </div>
        </section>

        <section v-if="hasPermission('ticket:assign')" class="card">
          <h3>操作</h3>
          <button class="btn ghost full" @click="assign">指派给…</button>
          <button v-if="hasPermission('ticket:priority')" class="btn ghost full" @click="setPriority">
            调整优先级
          </button>
          <button class="btn ghost full" @click="changeStatus">修改状态</button>
        </section>

      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/shared/api'
import { hasPermission } from '@/shared/auth'
import { PRIORITY_LABEL, STATUS_LABEL } from '@/shared/format'

const route = useRoute()
const t = ref({})
const replies = ref([])
const loading = ref(true)
const draft = ref('')
const isNote = ref(false)
const sending = ref(false)
const id = route.params.id

async function load() {
  loading.value = true
  try {
    const d = await api.get('/v1/tickets/' + id)
    t.value = d.ticket || d
    replies.value = d.replies || []
  } catch { t.value = {} } finally { loading.value = false }
}

async function reply() {
  const text = draft.value.trim()
  if (!text) return
  sending.value = true
  try {
    await api.post('/v1/tickets/' + id + '/replies', { content: text, is_customer_reply: false })
    draft.value = ''
    await load()
  } catch (e) {
    alert('回复失败：' + (e.message || '未知错误'))
  } finally { sending.value = false }
}

async function assign() {
  const to = prompt('指派给（客服 ID）')
  if (!to) return
  try { await api.post('/v1/tickets/' + id + '/assign', { assignee_id: to }); await load() }
  catch { alert('指派失败') }
}

async function setPriority() {
  const v = prompt('优先级：0=低 1=中 2=高 3=紧急')
  if (v === null) return
  try { await api.put('/v1/tickets/' + id, { priority: Number(v) }); await load() }
  catch { alert('设置失败') }
}

async function changeStatus() {
  const v = prompt('状态：new / processing / waiting_user / resolved / closed')
  if (!v) return
  try { await api.put('/v1/tickets/' + id, { status_internal: v }); await load() }
  catch { alert('修改失败') }
}

onMounted(load)
</script>

<style scoped>
.back { background: none; border: 0; font-size: 22px; width: 32px; }
.card { background: #fff; margin-bottom: 10px; padding: 14px; }
.card h2 { font-size: 16px; margin: 0 0 10px; }
.card h3 { font-size: 14px; margin: 0 0 10px; color: var(--fg-2); }
.meta { display: flex; gap: 6px; margin-bottom: 10px; }
.content { margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
dl { margin: 0; display: grid; grid-template-columns: 76px 1fr; gap: 8px 10px; font-size: 13px; }
dt { color: var(--dim); }
dd { margin: 0; word-break: break-all; }
.dim { color: var(--dim); font-size: 13px; }
.reply { border-left: 2px solid var(--line); padding-left: 10px; margin-bottom: 10px; }
.reply .who { font-size: 12px; color: var(--dim); margin-bottom: 2px; }
.reply .txt { font-size: 13px; white-space: pre-wrap; }
.ops { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.check { font-size: 13px; color: var(--fg-2); display: flex; align-items: center; gap: 4px; }
.check + .btn { margin-left: auto; }
.btn.full { width: 100%; margin-bottom: 8px; }
</style>
