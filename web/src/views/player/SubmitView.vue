<template>
  <div class="app-shell">
    <header class="topbar">
      <h1>{{ title }}</h1>
      <span class="sub">{{ tab === 'form' ? '提交问题' : '我的工单' }}</span>
    </header>

    <div class="tabs">
      <button class="chip" :class="{ active: tab === 'form' }" @click="tab = 'form'">提交问题</button>
      <button class="chip" :class="{ active: tab === 'list' }" @click="tab = 'list'; loadMine()">
        我的工单<em v-if="mine.length">{{ mine.length }}</em>
      </button>
    </div>

    <div class="scroll">
      <!-- ---------- 提交表单 ---------- -->
      <template v-if="tab === 'form'">
        <div v-if="!ready" class="empty">{{ errMsg || '正在连接…' }}</div>

        <template v-else>
          <div class="form">
            <div class="field">
              <label>问题类型</label>
              <select v-model="form.type" class="select">
                <option value="">请选择</option>
                <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>

            <div class="field">
              <label>一句话说明</label>
              <input v-model="form.title" class="input" maxlength="60"
                     placeholder="例如：更新后一直卡在加载界面" />
            </div>

            <div class="field">
              <label>详细描述</label>
              <textarea v-model="form.content" class="textarea" maxlength="2000"
                        placeholder="什么时候开始的、做了什么操作、有没有报错提示…"></textarea>
              <div class="counter">{{ Array.from(form.content).length }}/2000</div>
            </div>

            <div class="field">
              <label>相关截图（可选）</label>
              <div class="uploader">
                <div v-for="(u, i) in form.images" :key="i" class="thumb">
                  <img :src="u" />
                  <button class="del" @click="form.images.splice(i, 1)">×</button>
                </div>
                <button v-if="form.images.length < 3" class="add-img" @click="pickImage">＋</button>
              </div>
            </div>

            <p v-if="err" class="err">{{ err }}</p>

            <button class="btn full" :disabled="!canSubmit || sending" @click="submit">
              {{ sending ? '提交中…' : '提交' }}
            </button>

            <p class="tip">提交后客服会尽快处理，可在「我的工单」查看进度</p>
          </div>
        </template>
      </template>

      <!-- ---------- 我的工单 ---------- -->
      <template v-else>
        <div v-if="loadingMine" class="loading">加载中…</div>
        <div v-else-if="!mine.length" class="empty">还没有提交过工单</div>

        <div v-for="t in mine" :key="t.id" class="ticket" @click="expand = expand === t.id ? '' : t.id">
          <div class="row1">
            <span :class="['tag', 'st-' + t.status_internal]">
              {{ STATUS_LABEL[t.status_internal] || t.status_internal }}
            </span>
            <span class="title">{{ t.ticket_title }}</span>
            <span class="time">{{ timeAgo(t.create_time || t.created_at) }}</span>
          </div>
          <div v-if="expand === t.id" class="detail">
            <p class="content">{{ t.ticket_content }}</p>
            <div v-if="t.replies && t.replies.length" class="replies">
              <div v-for="r in t.replies" :key="r.id" class="reply">
                <span class="who">{{ r.is_customer_reply ? '我' : '客服' }}</span>
                <span class="txt">{{ r.reply_content }}</span>
              </div>
            </div>
            <p v-else class="dim">客服还没回复</p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '@/shared/api'
import { timeAgo, truncateByCodepoint, STATUS_LABEL } from '@/shared/format'

const props = defineProps({
  title: { type: String, default: '提交问题' }
})

const tab = ref('form')
const ready = ref(false)
const errMsg = ref('')
const err = ref('')
const sending = ref(false)
const loadingMine = ref(false)
const mine = ref([])
const expand = ref('')
const roleId = ref('')

const types = ['充值问题', '账号问题', '道具/奖励', '闪退/卡顿', '活动问题', '其他']

const form = ref({ type: '', title: '', content: '', images: [] })

const canSubmit = computed(() =>
  form.value.type && form.value.title.trim() && form.value.content.trim())

function playerToken() {
  return localStorage.getItem('cs_embed_session') || ''
}

async function pickImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const f = input.files && input.files[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { err.value = '图片不能超过 5MB'; return }
    const fd = new FormData()
    fd.append('file', f)
    try {
      const up = await api.upload('/v1/upload', fd)
      form.value.images.push('/data/uploads/' + up.stored)
    } catch (e) {
      err.value = '上传失败：' + (e.message || '')
    }
  }
  input.click()
}

async function submit() {
  if (!canSubmit.value || sending.value) return
  sending.value = true
  err.value = ''
  try {
    const body = {
      partner_id: roleId.value,
      role_id: roleId.value,
      title: '[' + form.value.type + '] ' + truncateByCodepoint(form.value.title, 60),
      content: truncateByCodepoint(form.value.content, 2000),
      level: 1
    }
    if (form.value.images.length) body.file_list = form.value.images.join(',')
    await api.post('/v1/tickets', body)
    form.value = { type: '', title: '', content: '', images: [] }
    tab.value = 'list'
    await loadMine()
  } catch (e) {
    err.value = e.status === 401 ? '登录已失效，请重新从游戏内打开' : ('提交失败：' + (e.message || ''))
  } finally {
    sending.value = false
  }
}

async function loadMine() {
  loadingMine.value = true
  try {
    const d = await api.get('/v1/tickets?page=1&page_size=20&role_id=' +
                            encodeURIComponent(roleId.value))
    mine.value = d.items || []
  } catch { mine.value = [] } finally { loadingMine.value = false }
}

onMounted(async () => {
  const q = new URLSearchParams(location.search)
  roleId.value = q.get('role_id') || localStorage.getItem('cs_role_id') || ''

  // 和聊天页同一套：用 URL 里的签名换会话凭证，不需要登录
  try {
    if (q.get('app_id')) {
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
      ready.value = true
    } else if (playerToken()) {
      ready.value = true
    } else {
      errMsg.value = '缺少访问凭证，请从游戏内打开'
    }
  } catch (e) {
    errMsg.value = e.status === 401 ? '链接已过期，请从游戏内重新打开' : ('连接失败：' + (e.message || ''))
  }
})
</script>

<style scoped>
.tabs { display: flex; gap: 8px; padding: 8px 12px; background: #fff;
  border-bottom: 1px solid var(--line); }
.chip { flex: 1; border: 0; background: #f2f3f5; color: var(--fg-2); border-radius: 14px;
  padding: 7px 12px; font-size: 13px; font-family: inherit; }
.chip.active { background: var(--accent); color: #fff; }
.chip em { font-style: normal; margin-left: 4px; }

.form { padding: 14px; }
.counter { text-align: right; font-size: 11px; color: var(--dim); margin-top: 4px; }
.uploader { display: flex; gap: 8px; flex-wrap: wrap; }
.thumb { position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb .del { position: absolute; top: 0; right: 0; width: 18px; height: 18px;
  border: 0; background: rgba(0,0,0,.6); color: #fff; font-size: 12px; line-height: 1; }
.add-img { width: 64px; height: 64px; border: 1px dashed var(--line); background: #fff;
  border-radius: 8px; font-size: 22px; color: var(--dim); font-family: inherit; }
.btn.full { width: 100%; margin-top: 6px; }
.err { color: var(--danger); font-size: 13px; margin: 0 0 10px; }
.tip { color: var(--dim); font-size: 12px; text-align: center; margin: 10px 0 0; }

.ticket { background: #fff; padding: 12px 14px; border-bottom: 1px solid var(--line); }
.row1 { display: flex; align-items: center; gap: 6px; }
.title { font-size: 14px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.time { font-size: 11px; color: var(--dim); }
.detail { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
.content { margin: 0 0 8px; font-size: 13px; color: var(--fg-2); white-space: pre-wrap; }
.replies { display: flex; flex-direction: column; gap: 6px; }
.reply { font-size: 13px; background: #f7f8fa; border-radius: 8px; padding: 8px 10px; }
.reply .who { color: var(--accent); font-size: 12px; display: block; margin-bottom: 2px; }
.dim { color: var(--dim); font-size: 12px; }
</style>
