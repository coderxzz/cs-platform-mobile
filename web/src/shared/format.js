/** 展示层的小工具，纯函数，不依赖任何框架。 */

export function timeAgo(ts) {
  if (!ts) return ''
  const t = typeof ts === 'number' ? ts : Date.parse(ts)
  if (!t) return String(ts)
  const d = Date.now() - t
  if (d < 60e3) return '刚刚'
  if (d < 3600e3) return Math.floor(d / 60e3) + ' 分钟前'
  if (d < 86400e3) return Math.floor(d / 3600e3) + ' 小时前'
  return new Date(t).toLocaleDateString('zh-CN')
}

export function clock(ts) {
  if (!ts) return ''
  const t = typeof ts === 'number' ? ts : Date.parse(ts)
  if (!t) return ''
  const d = new Date(t)
  return String(d.getHours()).padStart(2, '0') + ':' +
         String(d.getMinutes()).padStart(2, '0')
}

/** 按码点截断，别把 emoji 切一半 */
export function truncateByCodepoint(s, max) {
  const arr = Array.from(String(s || ''))
  return arr.length > max ? arr.slice(0, max).join('') : String(s || '')
}

export const PRIORITY_LABEL = { 0: '低', 1: '中', 2: '高', 3: '紧急' }
export const PRIORITY_CLASS = { 0: 'p-low', 1: 'p-mid', 2: 'p-high', 3: 'p-urgent' }

export const STATUS_LABEL = {
  new: '待受理', processing: '处理中', waiting_user: '待客户',
  resolved: '已解决', closed: '已关闭'
}
