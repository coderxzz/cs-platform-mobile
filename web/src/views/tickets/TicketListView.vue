<template>
  <div class="app-shell">
    <header class="topbar">
      <h1>工单</h1>
      <span class="sub">{{ total }} 条</span>
    </header>

    <div class="filters">
      <button v-for="f in filters" :key="f.key" class="chip"
              :class="{ active: status === f.key }" @click="setStatus(f.key)">{{ f.label }}</button>
    </div>

    <div class="searchbar">
      <input v-model="q" class="input" placeholder="搜索标题/内容" @keyup.enter="load" />
    </div>

    <div class="scroll">
      <div v-if="loading && !list.length" class="loading">加载中…</div>
      <div v-else-if="!list.length" class="empty">没有工单</div>

      <div v-for="t in list" :key="t.id" class="ticket" @click="$router.push('/ticket/' + t.id)">
        <div class="row1">
          <span :class="['tag', 'p' + (t.priority === 3 ? '-urgent' : t.priority === 2 ? '-high' : '-low')]">
            {{ PRIORITY_LABEL[t.priority] || '低' }}
          </span>
          <span class="title">{{ t.ticket_title || '(无标题)' }}</span>
        </div>
        <div class="row2">
          <span :class="['tag', 'st-' + t.status_internal]">{{ STATUS_LABEL[t.status_internal] || t.status_internal }}</span>
          <span v-if="t.source" class="tag src">{{ t.source === 'api' || t.source === 'sobot' ? '智齿' : '自研' }}</span>
          <span class="user">{{ t.user_nick || t.partnerid || t.contact_id || '—' }}</span>
          <span class="time">{{ timeAgo(t.create_time || t.created_at) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/shared/api'
import { timeAgo, PRIORITY_LABEL, STATUS_LABEL } from '@/shared/format'

const list = ref([])
const total = ref(0)
const loading = ref(true)
const status = ref('')
const q = ref('')

const filters = [
  { key: '', label: '全部' },
  { key: 'new', label: '待受理' },
  { key: 'processing', label: '处理中' },
  { key: 'resolved', label: '已解决' }
]

function setStatus(k) { status.value = k; load() }

async function load() {
  loading.value = true
  try {
    let url = '/v1/tickets?page=1&page_size=30'
    if (status.value) url += '&status_internal=' + status.value
    if (q.value.trim()) url += '&q=' + encodeURIComponent(q.value.trim())
    const d = await api.get(url)
    list.value = d.items || []
    total.value = d.total || list.value.length
  } catch { list.value = [] } finally { loading.value = false }
}

onMounted(load)
</script>

<style scoped>
.filters { display: flex; gap: 8px; padding: 8px 12px; background: #fff;
  border-bottom: 1px solid var(--line); overflow-x: auto; }
.filters::-webkit-scrollbar { height: 0; }
.chip { flex: 0 0 auto; border: 0; background: #f2f3f5; color: var(--fg-2);
  border-radius: 14px; padding: 5px 12px; font-size: 13px; font-family: inherit; }
.chip.active { background: var(--accent); color: #fff; }
.searchbar { padding: 8px 12px; background: #fff; border-bottom: 1px solid var(--line); }
.ticket { background: #fff; padding: 12px 14px; border-bottom: 1px solid var(--line); }
.row1 { display: flex; align-items: center; gap: 6px; }
.title { font-size: 14px; font-weight: 500; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.row2 { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 11px; }
.user { color: var(--fg-2); }
.time { margin-left: auto; color: var(--dim); }
</style>
