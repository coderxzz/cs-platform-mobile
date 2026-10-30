/**
 * 登录态与权限。
 *
 * 权限串沿用参考项目的约定：`模块:动作`（如 ticket:read、ticket:assign）。
 * 和 Shiro 的 @RequiresPermissions 同一套写法，方便对照。
 */
import { ref, computed } from 'vue'

const TOKEN_KEY = 'cs_token'
const USER_KEY = 'cs_user'

export const token = ref(localStorage.getItem(TOKEN_KEY) || '')
export const user = ref(safeParse(localStorage.getItem(USER_KEY)) || null)

function safeParse(s) {
  try { return s ? JSON.parse(s) : null } catch { return null }
}

export function setSession(t, u) {
  token.value = t || ''
  user.value = u || null
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
  else localStorage.removeItem(USER_KEY)
}

export function clearSession() { setSession('', null) }

export const permissions = computed(() => (user.value && user.value.permissions) || [])

/** 是否有某个权限。支持 'ticket:read' 或 ['a','b']（任一） */
export function hasPermission(need) {
  const list = permissions.value
  if (!list.length) return false
  if (Array.isArray(need)) return need.some(n => list.includes(n))
  return list.includes(need)
}

/** 是否拥有全部权限 */
export function hasAllPermissions(need) {
  const list = permissions.value
  const arr = Array.isArray(need) ? need : [need]
  return arr.every(n => list.includes(n))
}

/**
 * v-hasPermission 指令。
 * 参考项目的做法是没权限就 removeChild；这里做同样的事，
 * 但用 Vue3 的指令签名。
 *
 * 用法：<button v-hasPermission="'ticket:assign'">指派</button>
 */
export const hasPermissionDirective = {
  mounted(el, binding) {
    if (!hasPermission(binding.value)) {
      el.parentNode && el.parentNode.removeChild(el)
    }
  }
}
