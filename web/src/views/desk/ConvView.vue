<template>
  <div class="app-shell">
    <header class="topbar">
      <button class="back" @click="$router.back()">‹</button>
      <div class="head">
        <h1>{{ conv.user_nick || conv.role_id || '会话' }}</h1>
        <div class="sub">
          <span :class="['tag', 'p' + (conv.priority === 3 ? '-urgent' : conv.priority === 2 ? '-high' : '-low')]">
            {{ PRIORITY_LABEL[conv.priority] || '低' }}
          </span>
          <span :class="['tag', 'st-' + conv.status]">{{ STATUS_LABEL[conv.status] || conv.status }}</span>
          <span v-if="conv.source" class="tag src">{{ conv.source === 'sobot' ? '智齿' : '自研' }}</span>
        </div>
      </div>
      <button class="menu" @click="showActions = true">⋯</button>
    </header>

    <div ref="listEl" class="scroll msgs">
      <div v-for="m in messages" :key="m.id" class="msg" :class="m.mine ? 'me' : 'bot'">
        <div v-if="m.private" class="note">
          <span class="note-tag">内部备注</span>
          <div>{{ m.content }}</div>
        </div>
        <template v-else>
          <div class="bubble" :class="{ img: m.content_type === 'image' }">
            <img v-if="m.content_type === 'image'" :src="m.content" />
            <template v-else>{{ m.content }}</template>
          </div>
          <div class="meta">{{ clock(m.created_at) }}</div>
        </template>
      </div>
      <div v-if="!messages.length" class="empty">暂无消息</div>
    </div>

    <!-- 快捷回复 -->
    <div v-if="quickReplies.length" class="quick">
      <button v-for="q in quickReplies.slice(0, 6)" :key="q.id" class="chip"
              @click="draft = q.content">{{ q.title }}</button>
    </div>

    <footer class="inputbar">
      <button class="icon-btn" :class="{ on: isNote }" @click="isNote = !isNote"
              :title="isNote ? '内部备注（玩家看不到）' : '回复玩家'">
        {{ isNote ? '备' : '回' }}
      </button>
      <textarea v-model="draft" class="chat-input" rows="1"
                :placeholder="isNote ? '写内部备注，玩家看不到…' : '输入回复…'"
                @compositionstart="composing = true"
                @compositionend="composing = false"
                @keydown.enter.exact.prevent="send"></textarea>
      <button class="btn send-btn" :disabled="!draft.trim()" @click="send">发送</button>
    </footer>

    <!-- 操作面板 -->
    <div v-if="showActions" class="sheet-mask" @click.self="showActions = false">
      <div class="sheet">
        <h3>会话操作</h3>
        <button class="act" v-hasPermission="'conv:claim'" @click="claim">抢单</button>
        <button class="act" v-hasPermission="'conv:transfer'" @click="transfer">转接</button>
        <button class="act" @click="toTicket">转工单</button>
        <button class="act" v-hasPermission="'ticket:priority'" @click="setPriority">
          调整优先级（当前：{{ PRIORITY_LABEL[conv.priority] || '低' }}）
        </button>
        <button class="act danger" @click="close">结束会话</button>
        <button class="act ghost" @click="showActions = false">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/shared/api'
import { clock, PRIORITY_LABEL, STATUS_LABEL } from '@/shared/format'
import { createChannel } from '@/shared/realtime'
import { hasPermissionDirective } from '@/shared/auth'

// Vue3 <script setup> 里局部指令必须命名为 vXxx 才会被识别
const vHasPermission = hasPermissionDirective
const route = useRoute()
const router = useRouter()

const conv = ref({})
const messages = ref([])
const quickReplies = ref([])
const draft = ref('')
const isNote = ref(false)
const showActions = ref(false)
const composing = ref(false)
const listEl = ref(null)
let channel = null

const id = route.params.id

function scrollBottom() {
  nextTick(() => { if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight })
}

async function loadConv() {
  try { conv.value = (await api.get('/v1/conversations/' + id)) || {} } catch { /* 忽略 */ }
}

async function loadMessages() {
  try {
    const d = await api.get('/v1/conversations/' + id + '/messages/page?limit=50')
    const arr = (d.messages || []).map(m => ({
      id: m.id,
      mine: m.sender_type !== 'contact',
      private: !!m.private,
      content: m.content,
      content_type: m.content_type,
      created_at: m.created_at
    }))
    const changed = JSON.stringify(arr) !== JSON.stringify(messages.value)
    if (changed) {
      messages.value = arr
      if (arr.length) scrollBottom()
    }
  } catch { /* 忽略 */ }
}

async function loadQuick() {
  try {
    const d = await api.get('/v1/desk/quick-replies')
    quickReplies.value = d.items || []
  } catch { /* 忽略 */ }
}

async function send() {
  const t = draft.value.trim()
  if (!t || composing.value) return
  draft.value = ''
  try {
    if (isNote.value) {
      await api.post('/v1/desk/conversations/' + id + '/notes', { content: t })
    } else {
      await api.post('/v1/conversations/' + id + '/human-reply', { content: t })
    }
    await loadMessages()
  } catch (e) {
    alert('发送失败：' + (e.message || '未知错误'))
  }
}

async function claim() {
  try {
    await api.post('/v1/desk/conversations/' + id + '/claim',
                   { agent_id: (JSON.parse(localStorage.getItem('cs_user') || '{}').id) || 'me' })
    showActions.value = false
    await loadConv()
  } catch (e) { alert(e.status === 409 ? '已被别人接走' : '操作失败') }
}

async function transfer() {
  const to = prompt('转接给谁？（输入客服 ID）')
  if (!to) return
  try {
    await api.post('/v1/desk/conversations/' + id + '/transfer', { to_agent: to })
    showActions.value = false
    await loadConv()
  } catch { alert('转接失败') }
}

async function setPriority() {
  const v = prompt('优先级：0=低 1=中 2=高 3=紧急')
  if (v === null) return
  try {
    await api.put('/v1/conversations/' + id, { priority: Number(v) })
    showActions.value = false
    await loadConv()
  } catch { alert('设置失败') }
}

async function toTicket() {
  try {
    const d = await api.post('/v1/conversations/' + id + '/to-ticket', {})
    showActions.value = false
    alert('已生成工单 ' + (d.ticket_code || d.ticket_id || ''))
  } catch { alert('转工单失败') }
}

async function close() {
  if (!confirm('结束这个会话？')) return
  try {
    await api.post('/v1/conversations/' + id + '/resolve', {})
    router.back()
  } catch { alert('操作失败') }
}

onMounted(async () => {
  await Promise.all([loadConv(), loadMessages(), loadQuick()])
  channel = createChannel(
    () => api.get('/v1/conversations/' + id + '/messages/page?limit=50'),
    { interval: 3000, onData: () => { loadMessages(); loadConv() } }
  )
  channel.start()
})

onBeforeUnmount(() => { if (channel) channel.stop() })
</script>

<style scoped>
.back, .menu { background: none; border: 0; font-size: 22px; color: var(--fg);
  width: 32px; height: 32px; flex: 0 0 auto; }
.head { flex: 1 1 auto; min-width: 0; }
.head h1 { font-size: 15px; margin: 0; }
.head .sub { display: flex; gap: 4px; margin-top: 2px; }

.msgs { padding: 12px; }
.msg { margin-bottom: 12px; display: flex; flex-direction: column; }
.msg.me { align-items: flex-end; }
.bubble { max-width: 76%; padding: 9px 12px; border-radius: 10px; background: #fff;
  word-break: break-word; white-space: pre-wrap; }
.msg.me .bubble { background: var(--accent); color: #fff; }
.bubble.img { padding: 3px; }
.bubble.img img { max-width: 180px; border-radius: 8px; display: block; }
.meta { font-size: 11px; color: var(--dim); margin-top: 3px; }

.note { background: #fff7e8; border: 1px dashed var(--warn); border-radius: 8px;
  padding: 8px 10px; max-width: 80%; font-size: 13px; color: #8a5300; }
.note-tag { font-size: 11px; font-weight: 600; display: block; margin-bottom: 3px; }

.quick { display: flex; gap: 8px; padding: 6px 12px; overflow-x: auto; background: #fff;
  border-top: 1px solid var(--line); }
.quick::-webkit-scrollbar { height: 0; }
.chip { flex: 0 0 auto; border: 1px solid var(--line); background: #fff;
  border-radius: 14px; padding: 4px 10px; font-size: 12px; font-family: inherit; color: var(--fg-2); }

.inputbar { flex: 0 0 auto; display: flex; align-items: flex-end; gap: 8px;
  padding: 8px 12px calc(8px + var(--safe-b)); background: #fff; border-top: 1px solid var(--line); }
.icon-btn { flex: 0 0 34px; height: 34px; border-radius: 8px; border: 1px solid var(--line);
  background: #fff; font-size: 13px; font-family: inherit; color: var(--fg-2); }
.icon-btn.on { background: var(--warn); color: #fff; border-color: var(--warn); }
.chat-input { flex: 1 1 auto; border: 1px solid var(--line); border-radius: 18px;
  padding: 8px 14px; font: inherit; font-size: 16px; resize: none; max-height: 96px; outline: none; }
.chat-input:focus { border-color: var(--accent); }
.send-btn { border-radius: 18px; padding: 8px 16px; }

.sheet-mask { position: fixed; inset: 0; background: rgba(0,0,0,.4);
  display: flex; align-items: flex-end; z-index: 50; }
.sheet { width: 100%; background: #fff; border-radius: 14px 14px 0 0;
  padding: 16px 16px calc(16px + var(--safe-b)); max-width: 480px; margin: 0 auto; }
.sheet h3 { margin: 0 0 12px; font-size: 15px; }
.act { display: block; width: 100%; text-align: left; border: 0; background: #f7f8fa;
  border-radius: 10px; padding: 13px 14px; margin-bottom: 8px; font: inherit; color: var(--fg); }
.act.danger { color: var(--danger); }
.act.ghost { background: transparent; text-align: center; color: var(--dim); }
</style>
