<template>
  <div class="app-shell">
    <header class="topbar">
      <h1>客服管理</h1>
      <span class="sub">{{ tab === 'users' ? '客服账号' : tab === 'roles' ? '角色权限' : '接入应用' }}</span>
    </header>

    <div class="tabs">
      <button class="chip" :class="{ active: tab === 'users' }" @click="tab = 'users'">客服</button>
      <button class="chip" :class="{ active: tab === 'roles' }" @click="tab = 'roles'">角色</button>
      <button class="chip" :class="{ active: tab === 'apps' }" @click="tab = 'apps'">应用</button>
    </div>

    <div class="scroll">
      <!-- ---------- 客服账号 ---------- -->
      <template v-if="tab === 'users'">
        <div class="toolbar">
          <button class="btn sm" v-hasPermission="'user:create'" @click="newUser">新增客服</button>
        </div>
        <div v-for="u in users" :key="u.id" class="list-item">
          <div class="avatar">{{ (u.display_name || u.email || '?')[0] }}</div>
          <div class="body">
            <div class="row1">
              <span class="name">{{ u.display_name || u.email }}</span>
              <span v-if="!u.enabled" class="tag" style="background:#ffece8;color:#f53f3f">已停用</span>
              <span class="time">{{ u.role_name || '未分配角色' }}</span>
            </div>
            <div class="preview">{{ u.email }} · {{ presenceLabel(u.presence) }}</div>
          </div>
        </div>
        <div v-if="!users.length" class="empty">还没有客服账号</div>
      </template>

      <!-- ---------- 角色与权限 ---------- -->
      <template v-else-if="tab === 'roles'">
        <div class="role-list">
          <button v-for="r in roles" :key="r.id" class="role"
                  :class="{ active: currentRole && currentRole.id === r.id }"
                  @click="pickRole(r)">
            {{ r.name }}<em>{{ r.user_count || 0 }}</em>
          </button>
        </div>

        <div v-if="currentRole" class="perm-box">
          <h3>{{ currentRole.name }} 的权限</h3>
          <p class="hint">权限串格式：模块:动作（和 Shiro 的 @RequiresPermissions 一致）</p>

          <div v-for="group in permGroups" :key="group.module" class="perm-group">
            <label class="group-head">
              <input type="checkbox"
                     :checked="group.allChecked"
                     @change="toggleGroup(group, $event.target.checked)" />
              <strong>{{ group.module }}</strong>
            </label>
            <div class="perm-items">
              <label v-for="p in group.items" :key="p" class="perm-item">
                <input type="checkbox" :value="p" v-model="checkedPerms" />
                <span>{{ p }}</span>
              </label>
            </div>
          </div>

          <button class="btn full" :disabled="saving" @click="savePerms">
            {{ saving ? '保存中…' : '保存权限' }}
          </button>
        </div>
      </template>

      <!-- ---------- 接入应用 ---------- -->
      <template v-else>
        <div class="toolbar">
          <button class="btn sm" v-hasPermission="'app:create'" @click="newApp">注册应用</button>
        </div>
        <div v-for="a in apps" :key="a.app_id" class="list-item">
          <div class="avatar">应</div>
          <div class="body">
            <div class="row1">
              <span class="name">{{ a.name }}</span>
              <span class="time">{{ a.app_id }}</span>
            </div>
            <div class="preview">
              渠道：{{ a.channel_id || '未绑定' }}
              <span :style="{ color: a.enabled ? '#00b42a' : '#86909c' }">
                · {{ a.enabled ? '启用' : '停用' }}
              </span>
            </div>
          </div>
        </div>
        <div v-if="!apps.length" class="empty">还没有接入应用</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '@/shared/api'

const tab = ref('users')
const users = ref([])
const roles = ref([])
const apps = ref([])
const currentRole = ref(null)
const checkedPerms = ref([])
const allPerms = ref([])
const saving = ref(false)

const TENANT = localStorage.getItem('cs_tenant') || 'game_senling'

/** 把 'ticket:read' 按模块分组 */
const permGroups = computed(() => {
  const map = {}
  allPerms.value.forEach(p => {
    const [mod] = p.split(':')
    ;(map[mod] = map[mod] || []).push(p)
  })
  return Object.keys(map).sort().map(mod => {
    const items = map[mod].sort()
    return {
      module: mod,
      items,
      get allChecked() { return items.every(i => checkedPerms.value.includes(i)) }
    }
  })
})

function presenceLabel(p) {
  return { online: '在线', busy: '忙碌', away: '离开', offline: '离线' }[p] || '离线'
}

async function loadUsers() {
  try { users.value = (await api.get('/v1/admin/users?tenant_id=' + TENANT)).items || [] }
  catch { users.value = [] }
}

async function loadRoles() {
  try { roles.value = (await api.get('/v1/admin/roles?tenant_id=' + TENANT)).items || [] }
  catch { roles.value = [] }
}

async function loadPerms() {
  try { allPerms.value = (await api.get('/v1/admin/permissions')).items || [] }
  catch { allPerms.value = [] }
}

async function loadApps() {
  try { apps.value = (await api.get('/v1/apps?tenant_id=' + TENANT)).items || [] }
  catch { apps.value = [] }
}

function pickRole(r) {
  currentRole.value = r
  checkedPerms.value = [...(r.permissions || [])]
}

function toggleGroup(group, on) {
  const set = new Set(checkedPerms.value)
  group.items.forEach(p => on ? set.add(p) : set.delete(p))
  checkedPerms.value = [...set]
}

async function savePerms() {
  if (!currentRole.value) return
  saving.value = true
  try {
    await api.put('/v1/admin/roles/' + currentRole.value.id + '/permissions',
                  { permissions: checkedPerms.value })
    alert('已保存')
  } catch (e) { alert('保存失败：' + (e.message || '')) }
  finally { saving.value = false }
}

function newUser() {
  const email = prompt('新客服账号（邮箱）')
  if (!email) return
  const name = prompt('显示名') || email
  api.post('/v1/admin/users?tenant_id=' + TENANT, { email, display_name: name })
    .then(loadUsers).catch(e => alert('创建失败：' + (e.message || '')))
}

function newApp() {
  const name = prompt('应用名称（如：森灵王-安卓）')
  if (!name) return
  api.post('/v1/apps?tenant_id=' + TENANT + '&name=' + encodeURIComponent(name), {})
    .then(d => {
      alert('已创建\n\napp_id: ' + d.app_id + '\napp_secret: ' + d.app_secret +
            '\n\nsecret 只显示这一次，请立即保存。')
      loadApps()
    }).catch(e => alert('创建失败：' + (e.message || '')))
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadRoles(), loadPerms(), loadApps()])
})
</script>

<style scoped>
.tabs { display: flex; gap: 8px; padding: 8px 12px; background: #fff;
  border-bottom: 1px solid var(--line); }
.chip { flex: 1; border: 0; background: #f2f3f5; color: var(--fg-2); border-radius: 14px;
  padding: 6px 12px; font-size: 13px; font-family: inherit; }
.chip.active { background: var(--accent); color: #fff; }
.toolbar { padding: 10px 12px; background: #fff; border-bottom: 1px solid var(--line); }

.role-list { display: flex; gap: 8px; padding: 10px 12px; overflow-x: auto; background: #fff; }
.role-list::-webkit-scrollbar { height: 0; }
.role { flex: 0 0 auto; border: 1px solid var(--line); background: #fff; border-radius: 8px;
  padding: 8px 12px; font: inherit; font-size: 13px; color: var(--fg); }
.role.active { border-color: var(--accent); color: var(--accent); background: var(--accent-2); }
.role em { font-style: normal; margin-left: 6px; color: var(--dim); font-size: 11px; }

.perm-box { background: #fff; padding: 14px; }
.perm-box h3 { margin: 0 0 4px; font-size: 15px; }
.hint { margin: 0 0 14px; font-size: 12px; color: var(--dim); }
.perm-group { margin-bottom: 14px; }
.group-head { display: flex; align-items: center; gap: 8px; font-size: 13px;
  padding: 6px 0; border-bottom: 1px solid var(--line); }
.perm-items { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 0 0 22px; }
.perm-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--fg-2); }
.btn.full { width: 100%; margin-top: 8px; }
</style>
