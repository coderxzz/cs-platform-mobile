/**
 * 客服 JSSDK
 *
 * 和 HTML 版的区别：
 *   HTML 版独占一个页面（iframe src 指过去）。
 *   SDK 版是注入到宿主页面里的，宿主只需要引一个 script。
 *
 * 设计约束：
 *   · 不依赖任何框架（不能要求宿主也装 Vue）
 *   · 不污染宿主全局（只暴露一个 CsSdk）
 *   · 样式全部内联/带前缀，不能让宿主 CSS 影响聊天窗
 *   · 大屏下聊天窗居中，四周遮罩
 *
 * 用法：
 *   <script src="https://cdn/cs-sdk.js"></script>
 *   <script>
 *     CsSdk.init({ appId: 'xxx', roleId: '123', sign: '...', ts: '...' })
 *     CsSdk.open()
 *   </script>
 */
import sdkCss from './sdk.css?inline'

const PREFIX = 'cs-sdk'

let state = {
  appId: '',
  roleId: '',
  ts: '',
  sign: '',
  apiBase: '',
  title: '在线客服',
  onReady: null
}

let hostEl = null
let iframeEl = null

function ensureStyle() {
  if (document.getElementById(PREFIX + '-style')) return
  const s = document.createElement('style')
  s.id = PREFIX + '-style'
  s.textContent = sdkCss
  document.head.appendChild(s)
}

function buildUrl() {
  const q = new URLSearchParams({
    app_id: state.appId,
    role_id: state.roleId,
    ts: state.ts,
    sign: state.sign
  })
  const base = state.apiBase || (location.origin + '/chat.html')
  return base + (base.includes('?') ? '&' : '?') + q.toString()
}

function mount() {
  ensureStyle()

  hostEl = document.createElement('div')
  hostEl.className = PREFIX + '-host'
  hostEl.setAttribute('aria-hidden', 'false')

  const panel = document.createElement('div')
  panel.className = PREFIX + '-panel'

  const bar = document.createElement('div')
  bar.className = PREFIX + '-bar'

  const title = document.createElement('span')
  title.className = PREFIX + '-title'
  title.textContent = state.title

  const close = document.createElement('button')
  close.className = PREFIX + '-close'
  close.textContent = '×'
  close.onclick = () => api.close()

  bar.appendChild(title)
  bar.appendChild(close)

  iframeEl = document.createElement('iframe')
  iframeEl.className = PREFIX + '-frame'
  iframeEl.src = buildUrl()
  iframeEl.setAttribute('allow', 'clipboard-write')
  iframeEl.onload = () => { if (state.onReady) state.onReady() }

  panel.appendChild(bar)
  panel.appendChild(iframeEl)
  hostEl.appendChild(panel)
  hostEl.addEventListener('click', (e) => { if (e.target === hostEl) api.close() })

  document.body.appendChild(hostEl)
}

const api = {
  /**
   * 初始化。参数由游戏服务端生成（sign 不能在前端算）。
   */
  init(opts = {}) {
    state = { ...state, ...opts }
    return api
  },

  open() {
    if (!state.appId || !state.sign) {
      console.error('[cs-sdk] 缺少 appId 或 sign')
      return
    }
    if (!hostEl) mount()
    else hostEl.style.display = 'flex'
  },

  close() {
    if (hostEl) hostEl.style.display = 'none'
  },

  destroy() {
    if (hostEl && hostEl.parentNode) hostEl.parentNode.removeChild(hostEl)
    hostEl = null
    iframeEl = null
  },

  isOpen() {
    return !!hostEl && hostEl.style.display !== 'none'
  }
}

// 暴露单个全局变量，不污染其他
if (typeof window !== 'undefined') {
  window.CsSdk = api
}

export default api
