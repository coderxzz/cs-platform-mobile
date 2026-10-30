/**
 * 唯一的 HTTP 出口。
 *
 * 为什么要集中在一个文件：
 *   分散在几十个组件里 fetch，改一个地址要改几十处，
 *   鉴权头也会漏加。所有请求必须过这里。
 *
 * 和后端的耦合点只有这个文件 —— 后端换实现，只改这里。
 */

const BASE = (typeof import.meta !== 'undefined' && import.meta.env
  && import.meta.env.VITE_API_BASE) || ''

let tokenGetter = () => ''
let onUnauthorized = () => {}

/** 由外层注入取 token 的方式（工作台用 localStorage，SDK 用内存） */
export function configureApi(opts = {}) {
  if (opts.getToken) tokenGetter = opts.getToken
  if (opts.onUnauthorized) onUnauthorized = opts.onUnauthorized
}

export class ApiError extends Error {
  constructor(status, body, path) {
    super((body && body.detail) || ('HTTP ' + status))
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.path = path
  }
}

async function request(method, path, { body, headers, raw } = {}) {
  const h = { ...(headers || {}) }
  if (body !== undefined && !raw) h['Content-Type'] = 'application/json'

  // ★ 两种凭证走不同的头，不能混：
  //   玩家会话凭证（es_ 开头）→ X-API-Key
  //   客服登录 token          → Authorization: Bearer
  //   后端 auth() 只认 X-API-Key，塞错地方就是 401。
  const token = tokenGetter()
  if (token) {
    if (token.indexOf('es_') === 0) h['X-API-Key'] = token
    else h['Authorization'] = 'Bearer ' + token
  }

  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: raw ? body : (body === undefined ? undefined : JSON.stringify(body))
  })

  let data = null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    try { data = await res.json() } catch { data = null }
  }

  if (res.status === 401) {
    onUnauthorized()
    throw new ApiError(401, data, path)
  }
  if (!res.ok) throw new ApiError(res.status, data, path)
  return data
}

export const api = {
  get: (p, o) => request('GET', p, o),
  post: (p, b, o) => request('POST', p, { ...(o || {}), body: b }),
  put: (p, b, o) => request('PUT', p, { ...(o || {}), body: b }),
  del: (p, o) => request('DELETE', p, o),
  upload: (p, formData) => request('POST', p, { body: formData, raw: true })
}
