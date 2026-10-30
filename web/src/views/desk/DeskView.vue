<template>
  <div class="app-shell">
    <header class="topbar">
      <h1>客服工作台</h1>
      <span class="sub" :class="{ live: connected }">{{ connected ? '实时' : '离线' }}</span>
    </header>

    <!-- 顶部筛选 -->
    <div class="filters">
      <button
        v-for="f in filters" :key="f.key"
        class="chip" :class="{ active: status === f.key }"
        @click="setFilter(f.key)"
      >{{ f.label }}<em v-if="f.count">{{ f.count }}</em></button>
    </div>

    <!-- 会话列表 -->
    <div class="scroll">
      <div v-if="loading && !list.length" class="loading">加载中…</div>
      <div v-else-if="!list.length" class="empty">暂无会话</div>

      <div
        v-for="c in list" :key="c.id"
        class="conv" :class="{ urgent: c.priority === 3, active: current && current.id === c.id }"
        @click="open(c)"
      >
        <div class="ava">{{ initial(c) }}</div>
        <div class="body">
          <div class="row1">
            <span class="name">{{ c.user_nick || c.role_id || '游客' }}</span>
            <span v-if="c.priority === 3" class="tag p-urgent">紧急</span>
            <span v-else-if="c.priority === 2" class="tag p-high">高</span>
            <span class="time">{{ timeAgo(c.last_at) }}</span>
          </div>
          <div class="preview">{{ c.last_text || '(无消息)' }}</div>
          <div class="row2">
            <span v-if="c.unread" class="badge">{{ c.unread }}</span>
            <span v-if="c.assignee_id" class="assignee">{{ c.assignee_id }}</span>
            <span v-else class="unassigned">未分配</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/shared/api'
import { timeAgo } from '@/shared/format'
import { createChannel } from '@/shared/realtime'

const router = useRouter()
const list = ref([])
const loading = ref(true)
const connected = ref(false)
const status = ref('')
const current = ref(null)

const filters = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待接入' },
  { key: 'open', label: '进行中' },
  { key: 'urgent', label: '加急' }
]

let channel = null

function initial(c) {
  const s = c.user_nick || c.role_id || '游'
  return Array.from(String(s))[0] || '游'
}

function setFilter(k) {
  status.value = k
  load()
}

async function load() {
  try {
    let url = '/v1/desk/conversations?page=1&page_size=50'
    if (status.value === 'urgent') url += '&priority=3'
    else if (status.value) url += '&status=' + status.value
    const d = await api.get(url)
    list.value = d.items || []
    connected.value = true
  } catch (e) {
    if (e.status === 401) router.push('/login')
    connected.value = false
  } finally {
    loading.value = false
  }
}

function open(c) {
  current.value = c
  router.push('/conv/' + c.id)
}

onMounted(() => {
  load()
  channel = createChannel(() => api.get('/v1/desk/conversations?page=1&page_size=50'), {
    interval: 3000,
    onData: (d) => { list.value = d.items || []; connected.value = true },
    onError: () => { connected.value = false }
  })
  channel.start()
})

onBeforeUnmount(() => { if (channel) channel.stop() })
</script>

<style scoped>
.filters {
  flex: 0 0 auto; display: flex; gap: 8px; padding: 8px 12px;
  background: var(--panel); border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.filters::-webkit-scrollbar { height: 0; }
.chip {
  flex: 0 0 auto; border: 0; background: #f2f3f5; color: var(--fg-2);
  border-radius: 14px; padding: 5px 12px; font-size: 13px; font-family: inherit;
}
.chip.active { background: var(--accent); color: #fff; }
.chip em { font-style: normal; margin-left: 4px; opacity: .8; }

.conv { display: flex; gap: 10px; padding: 12px 14px; background: #fff;
  border-bottom: 1px solid var(--line); }
.conv.active { background: var(--accent-2); }
.conv.urgent { border-left: 3px solid var(--danger); }
.ava { flex: 0 0 36px; width: 36px; height: 36px; border-radius: 50%;
  background: var(--accent-2); color: var(--accent); display: flex;
  align-items: center; justify-content: center; font-weight: 600; font-size: 13px; }
.body { flex: 1 1 auto; min-width: 0; }
.row1 { display: flex; align-items: center; gap: 6px; }
.name { font-weight: 600; font-size: 14px; }
.time { margin-left: auto; font-size: 11px; color: var(--dim); }
.preview { margin-top: 3px; font-size: 13px; color: var(--fg-2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row2 { margin-top: 4px; display: flex; align-items: center; gap: 6px; font-size: 11px; }
.badge { background: var(--danger); color: #fff; border-radius: 8px;
  padding: 0 5px; min-width: 16px; text-align: center; }
.assignee { color: var(--fg-2); }
.unassigned { color: var(--warn); }
.live { color: var(--ok); }
</style>
