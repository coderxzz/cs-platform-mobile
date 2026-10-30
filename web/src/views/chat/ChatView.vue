<template>
  <div class="app-shell chat-shell">
    <!-- 顶栏：标题 + 在线状态。智齿的 H5 也是这个结构 -->
    <header class="topbar">
      <div class="brand">
        <div class="logo">客</div>
        <div>
          <h1>{{ title }}</h1>
          <div class="sub">
            <span class="dot" :class="online ? 'on' : 'off'"></span>
            {{ online ? '在线客服' : '离线留言' }}
          </div>
        </div>
      </div>
    </header>

    <!-- 消息区 -->
    <div ref="listEl" class="scroll msg-scroll" @scroll="onScroll">
      <div v-if="loadingHistory" class="loading">加载中…</div>
      <div v-else-if="!hasMore && messages.length" class="no-more">— 没有更多了 —</div>

      <div v-for="(m, i) in messages" :key="m.key" class="msg-row" :class="m.mine ? 'me' : 'bot'">
        <!-- 系统消息居中 -->
        <div v-if="m.type === 'system'" class="sys">{{ m.text }}</div>

        <template v-else>
          <div v-if="!m.mine" class="ava">客</div>
          <div class="bubble-wrap">
            <div class="bubble" :class="{ img: m.type === 'image' }">
              <img v-if="m.type === 'image'" :src="m.url" @click="preview(m.url)" />
              <template v-else>{{ m.text }}</template>
            </div>
            <div class="meta">
              <span v-if="m.state === 'sending'">发送中</span>
              <span v-else-if="m.state === 'failed'" class="fail" @click="retry(m)">发送失败，点击重试</span>
              <span v-else>{{ clock(m.ts) }}</span>
            </div>
          </div>
          <div v-if="m.mine" class="ava me-ava">我</div>
        </template>
      </div>

      <div v-if="typing" class="typing">客服正在输入…</div>
    </div>

    <!-- 快捷问题（智齿也有这个，降低用户表达成本） -->
    <div v-if="quickAsks.length && messages.length <= 1" class="quick-asks">
      <button v-for="q in quickAsks" :key="q" class="chip" @click="send(q)">{{ q }}</button>
    </div>

    <!-- 输入栏 -->
    <footer class="inputbar">
      <button class="icon-btn" title="发送图片" @click="pickImage">图</button>
      <textarea
        ref="inputEl"
        v-model="draft"
        class="chat-input"
        rows="1"
        :placeholder="placeholder"
        @input="autoGrow"
        @compositionstart="composing = true"
        @compositionend="onCompositionEnd"
        @keydown.enter.exact.prevent="onEnter"
      ></textarea>
      <button class="btn send-btn" :disabled="!draft.trim()" @click="send()">发送</button>
    </footer>

    <!-- 图片预览 -->
    <div v-if="previewUrl" class="preview-mask" @click="previewUrl = ''">
      <img :src="previewUrl" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { api } from '@/shared/api'
import { clock, truncateByCodepoint } from '@/shared/format'
import { createChannel } from '@/shared/realtime'

const props = defineProps({
  // SDK 模式下由宿主页面传进来
  session: { type: String, default: '' },
  title: { type: String, default: '在线客服' },
  quickAsks: { type: Array, default: () => ['充值没到账', '账号被封', '游戏闪退'] }
})

const messages = ref([])
const draft = ref('')
const previewUrl = ref('')
const loadingHistory = ref(false)
const hasMore = ref(true)
const online = ref(true)
const typing = ref(false)
const composing = ref(false)

const listEl = ref(null)
const inputEl = ref(null)
let channel = null
let convId = ''
let channelId = ''
let seq = 0

const placeholder = computed(() =>
  online.value ? '请描述您遇到的问题…' : '客服不在线，留言稍后回复')

function key(m) { return m.key || ('m' + (++seq)) }

function push(m) {
  // 注意：必须返回数组里的那个元素（Vue 的响应式代理）。
  // 之前 push 的是一个新对象，调用方还拿着原始普通对象改 state，
  // 不会触发重渲染 —— 表现就是消息永远停在「发送中」。
  messages.value.push({ key: key(m), ts: Date.now(), ...m })
  scrollToBottom()
  return messages.value[messages.value.length - 1]
}

function sys(text) { push({ type: 'system', text }) }

function scrollToBottom() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

/** 中文输入法拼音未上屏时不发送 */
function onCompositionEnd() {
  composing.value = false
}

function onEnter() {
  if (composing.value) return
  send()
}

function autoGrow() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 96) + 'px'
}

async function send(text) {
  const t = truncateByCodepoint(text !== undefined ? text : draft.value, 2000).trim()
  if (!t) return
  draft.value = ''
  autoGrow()

  const local = push({ mine: true, text: t, state: 'sending' })

  if (!channelId) {
    local.state = 'failed'
    sys('连接尚未就绪，请稍后重试')
    return
  }

  try {
    const res = await api.post('/v1/inbound/' + encodeURIComponent(channelId), {
      payload: {
        partnerId: roleId(),
        cid: convId || ('c' + Date.now()),
        msgId: 'w' + Date.now() + Math.random().toString(36).slice(2, 6),
        content: t
      }
    })
    local.state = 'sent'
    if (res && res.conversation_id) convId = res.conversation_id

    const reply = res && res.render && res.render.ret_message
    if (reply) push({ mine: false, text: reply })
    if (res && res.action === 'handoff') sys('已为您转接人工客服')
  } catch (e) {
    local.state = 'failed'
    if (e.status === 401) sys('登录已失效，请重新打开')
    else sys('发送失败：' + (e.message || '网络异常'))
  }
}

function retry(m) {
  m.state = 'sending'
  send(m.text)
}

function roleId() {
  const u = new URLSearchParams(location.search)
  return u.get('role_id') || localStorage.getItem('cs_role_id') || 'guest'
}

async function pickImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const f = input.files && input.files[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { sys('图片不能超过 5MB'); return }
    const fd = new FormData()
    fd.append('file', f)
    try {
      const up = await api.upload('/v1/upload', fd)
      if (convId) {
        await api.post('/v1/conversations/' + convId + '/images', {
          url: '/data/uploads/' + up.stored, caption: ''
        })
      }
      push({ mine: true, type: 'image', url: '/data/uploads/' + up.stored })
    } catch (e) {
      sys('上传失败：' + (e.message || '未知错误'))
    }
  }
  input.click()
}

function preview(url) { previewUrl.value = url }

async function loadHistory() {
  if (!convId || loadingHistory.value || !hasMore.value) return
  loadingHistory.value = true
  const el = listEl.value
  const prevH = el ? el.scrollHeight : 0
  try {
    const d = await api.get('/v1/conversations/' + convId + '/messages/page?limit=20')
    const arr = (d.messages || []).filter(m => m.content_type !== 'note')
    if (!arr.length || !d.has_more) hasMore.value = false
    const mapped = arr.map(m => ({
      key: 'h' + m.id, mine: m.sender_type === 'contact',
      text: m.content, ts: Date.parse(m.created_at) || Date.now(),
      type: m.content_type === 'image' ? 'image' : 'text',
      url: m.content_type === 'image' ? (m.content || '') : ''
    }))
    messages.value = mapped.concat(messages.value)
    await nextTick()
    if (el) el.scrollTop = el.scrollHeight - prevH
  } catch {
    hasMore.value = false
  } finally {
    loadingHistory.value = false
  }
}

function onScroll() {
  const el = listEl.value
  if (el && el.scrollTop < 40) loadHistory()
}

onMounted(async () => {
  // 初始化：交换会话凭证 → 拿到 channel_id
  try {
    const q = new URLSearchParams(location.search)
    if (props.session) {
      // SDK 模式：宿主页面已经换好凭证
      channelId = q.get('channel') || localStorage.getItem('cs_channel') || ''
    } else if (q.get('app_id')) {
      const s = await api.post('/v1/embed/session', {
        app_id: q.get('app_id'),
        role_id: q.get('role_id') || '',
        ts: q.get('ts') || '',
        sign: q.get('sign') || ''
      })
      if (s.session) {
        localStorage.setItem('cs_embed_session', s.session)
        localStorage.setItem('cs_role_id', q.get('role_id') || '')
      }
      channelId = s.channel_id || ''
      localStorage.setItem('cs_channel', channelId)
      convId = s.conversation_id || ''
    }
  } catch (e) {
    sys('连接失败：' + (e.message || '请从游戏内重新打开'))
    online.value = false
  }

  // ★ 只有真拿到频道才算连上。
  //   之前无条件显示"已连接"，没有凭证时也在骗用户说连上了。
  if (!channelId) {
    online.value = false
    if (!messages.value.length) {
      sys('尚未连接：请从游戏内打开客服窗口，或联系客服获取链接')
    }
  } else if (!messages.value.length) {
    sys('已连接客服，请描述您遇到的问题')
  }

  // 有会话就轮询拉新消息（AI 回复、人工回复都靠它）
  if (convId) {
    channel = createChannel(
      () => api.get('/v1/conversations/' + convId + '/messages/page?limit=20'),
      {
        interval: 3000,
        onData: (d) => {
          const known = new Set(messages.value.map(m => m.key))
          ;(d.messages || []).forEach(m => {
            const k = 'h' + m.id
            if (known.has(k)) return
            if (m.sender_type === 'contact') return   // 自己发的已经本地加过了
            push({
              key: k, mine: false, text: m.content,
              ts: Date.parse(m.created_at) || Date.now()
            })
          })
        }
      }
    )
    channel.start()
  }
})

onBeforeUnmount(() => { if (channel) channel.stop() })
</script>

<style scoped>
.chat-shell { background: var(--bg); }

.brand { display: flex; align-items: center; gap: 10px; flex: 1; }
.logo {
  width: 32px; height: 32px; border-radius: 8px; background: var(--accent);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 14px;
}
.dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; }
.dot.on { background: var(--ok); }
.dot.off { background: var(--dim); }

.msg-scroll { padding: 12px 12px 4px; }
.no-more { text-align: center; color: var(--dim); font-size: 12px; padding: 8px 0; }

.msg-row { display: flex; gap: 8px; margin-bottom: 14px; align-items: flex-start; }
.msg-row.me { justify-content: flex-end; }
.msg-row .ava {
  flex: 0 0 30px; width: 30px; height: 30px; border-radius: 6px;
  background: #fff; color: var(--accent); border: 1px solid var(--line);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600;
}
.msg-row .me-ava { background: var(--accent); color: #fff; border-color: var(--accent); }

.bubble-wrap { max-width: 72%; }
.bubble {
  padding: 9px 12px; border-radius: 10px; background: #fff;
  word-break: break-word; white-space: pre-wrap; font-size: 14px; line-height: 1.45;
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
}
.msg-row.me .bubble { background: var(--accent); color: #fff; }
.bubble.img { padding: 3px; background: #fff; }
.bubble.img img { max-width: 180px; max-height: 180px; border-radius: 8px; display: block; }

.meta { font-size: 11px; color: var(--dim); margin-top: 3px; }
.msg-row.me .meta { text-align: right; }
.meta .fail { color: var(--danger); }

.sys { width: 100%; text-align: center; color: var(--dim); font-size: 12px; padding: 4px 20px; }

.typing { color: var(--dim); font-size: 12px; padding: 0 12px 10px; }

.quick-asks { display: flex; gap: 8px; padding: 0 12px 8px; overflow-x: auto; }
.quick-asks::-webkit-scrollbar { height: 0; }
.chip {
  flex: 0 0 auto; border: 1px solid var(--line); background: #fff;
  color: var(--fg-2); border-radius: 14px; padding: 5px 12px; font-size: 13px;
  font-family: inherit;
}
.chip:active { background: var(--accent-2); }

.inputbar {
  flex: 0 0 auto; display: flex; align-items: flex-end; gap: 8px;
  padding: 8px 12px calc(8px + var(--safe-b));
  background: var(--panel); border-top: 1px solid var(--line);
}
.icon-btn {
  flex: 0 0 34px; width: 34px; height: 34px; border-radius: 8px;
  border: 1px solid var(--line); background: #fff; color: var(--fg-2);
  font-size: 13px; font-family: inherit;
}
.chat-input {
  flex: 1 1 auto; border: 1px solid var(--line); border-radius: 18px;
  padding: 8px 14px; font: inherit; font-size: 16px; line-height: 1.4;
  resize: none; max-height: 96px; outline: none; background: #fff;
}
.chat-input:focus { border-color: var(--accent); }
.send-btn { flex: 0 0 auto; border-radius: 18px; padding: 8px 16px; }

.preview-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,.92);
  display: flex; align-items: center; justify-content: center; z-index: 99;
}
.preview-mask img { max-width: 96%; max-height: 96%; object-fit: contain; }
</style>
