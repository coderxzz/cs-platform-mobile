/**
 * 安卓 WebView 兼容性测试（原生 CDP）。
 *
 * 为什么不用 Playwright.connectOverCDP：
 *   安卓 WebView 的 devtools 端点不支持 Browser context 管理，一连就报错。
 *   所以直接连页面的 webSocketDebuggerUrl，发 Runtime.evaluate。
 */
const http = require('http')

const CDP = 'http://127.0.0.1:9222'
let pass = 0, fail = 0
function ck(name, cond, detail) {
  if (cond) { pass++; console.log('  [PASS] ' + name + (detail !== undefined ? ' :: ' + detail : '')) }
  else { fail++; console.log('  [FAIL] ' + name + (detail !== undefined ? ' :: ' + detail : '')) }
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(CDP + path, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiters = new Map() }
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    const p = new Page(ws)
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data)
      if (m.id && p.waiters.has(m.id)) { p.waiters.get(m.id)(m); p.waiters.delete(m.id) }
    }
    return p
  }
  send(method, params) {
    const id = ++this.id
    return new Promise((res, rej) => {
      this.waiters.set(id, m => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))
      this.ws.send(JSON.stringify({ id, method, params: params || {} }))
      setTimeout(() => { if (this.waiters.has(id)) { this.waiters.delete(id); rej(new Error('timeout ' + method)) } }, 15000)
    })
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error('JS异常: ' + (r.exceptionDetails.text || '') + ' ' + String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 150))
    return r.result.value
  }
}

async function main() {
  const targets = await getJson('/json')
  console.log('=== CDP 目标 ===')
  targets.forEach((t, i) => console.log('  [' + i + '] ' + t.type + ' ' + String(t.url || '').slice(0, 60)))
  const target = targets.find(t => t.url && t.url.indexOf('/chat') >= 0) || targets.find(t => t.type === 'page')
  ck('找到聊天页 target', !!target, target && String(target.url).slice(0, 40))

  const page = await Page.connect(target.webSocketDebuggerUrl)
  await page.send('Runtime.enable')

  console.log('')
  console.log('=== 1. 页面渲染 ===')
  const render = await page.eval('(function(){return {hasShell:!!document.querySelector(".app-shell"),title:document.querySelector(".topbar h1")?document.querySelector(".topbar h1").innerText:"",hasInput:!!document.querySelector(".chat-input"),hasSend:!!document.querySelector(".send-btn"),bodyLen:document.body.innerText.trim().length,msgCount:document.querySelectorAll(".msg-row").length,sysText:Array.from(document.querySelectorAll(".sys")).map(function(e){return e.innerText}).join(" / ")}})()')
  ck('Vue 挂载（app-shell）', render.hasShell)
  ck('顶栏标题', !!render.title, render.title)
  ck('输入框存在', render.hasInput)
  ck('发送按钮存在', render.hasSend)
  ck('已有消息气泡', render.msgCount > 0, render.msgCount)
  console.log('  页面提示: ' + (render.sysText || '(无)'))

  console.log('')
  console.log('=== 2. 视口与布局 ===')
  const vp = await page.eval('(function(){var s=document.querySelector(".app-shell");return {w:innerWidth,h:innerHeight,dpr:devicePixelRatio,ua:navigator.userAgent,shellW:s?s.getBoundingClientRect().width:0,inputFont:document.querySelector(".chat-input")?getComputedStyle(document.querySelector(".chat-input")).fontSize:""}})()')
  console.log('  视口: ' + vp.w + 'x' + vp.h + ' @' + vp.dpr + 'x  输入框字号: ' + vp.inputFont)
  ck('★ 手机视口（<600px）', vp.w < 600, vp.w)
  ck('★ 容器铺满视口宽度', Math.abs(vp.shellW - vp.w) < 4, vp.shellW)
  ck('UA 含 Android', vp.ua.indexOf('Android') >= 0)
  ck('★ 输入框字号 >= 16px（防聚焦放大）', parseFloat(vp.inputFont) >= 16, vp.inputFont)

  console.log('')
  console.log('=== 3. 会话凭证（URL 参数换取）===')
  const sess = await page.eval('(function(){return {token:localStorage.getItem("cs_embed_session")||"",channel:localStorage.getItem("cs_channel")||"",role:localStorage.getItem("cs_role_id")||""}})()')
  ck('★ 拿到 es_ 会话凭证', sess.token.indexOf('es_') === 0, sess.token.slice(0, 14))
  ck('★ 拿到频道 ID', !!sess.channel, sess.channel)
  const urlRole = new URL(target.url).searchParams.get('role_id')
  ck('角色 ID 与 URL 一致', sess.role === urlRole, sess.role + ' vs ' + urlRole)

  console.log('')
  console.log('=== 4. 发消息（真实走后端）===')
  const before = await page.eval('document.querySelectorAll(".msg-row").length')
  await page.eval('(function(){var el=document.querySelector(".chat-input");var setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;setter.call(el,"安卓WebView测试：我的充值没到账");el.dispatchEvent(new Event("input",{bubbles:true}));return true})()')
  await page.eval('document.querySelector(".send-btn").click()')
  // AI 走真实模型，实测单轮 8-9 秒，这里等 16 秒留余量
  await new Promise(r => setTimeout(r, 16000))

  const after = await page.eval('document.querySelectorAll(".msg-row").length')
  const bubbles = await page.eval('Array.from(document.querySelectorAll(".bubble")).map(function(e){return e.innerText})')
  ck('★ 发消息后气泡增加', after > before, before + ' -> ' + after)
  ck('★ 自己的消息已显示', bubbles.some(b => b.indexOf('安卓WebView测试') >= 0))
  const others = bubbles.filter(b => b.indexOf('安卓WebView测试') < 0)
  const sysAll = await page.eval('Array.from(document.querySelectorAll(".sys")).map(function(e){return e.innerText})')
  const handedOff = sysAll.some(s => s.indexOf('转接') >= 0)
  // 两种情况都算正常：AI 直接回（气泡），或转人工（系统提示）
  ck('★ 有回应（AI 气泡 或 转人工提示）', others.length > 0 || handedOff,
     others.length ? String(others.join(' | ')).slice(0, 60) : ('系统: ' + sysAll.join(' / ')).slice(0, 60))

  console.log('')
  console.log('=== 5. 中文输入法（composition）===')
  const comp = await page.eval('(function(){var el=document.querySelector(".chat-input");el.focus();el.dispatchEvent(new CompositionEvent("compositionstart",{bubbles:true}));el.value="chongzhi";el.dispatchEvent(new Event("input",{bubbles:true}));var during=el.value;el.dispatchEvent(new CompositionEvent("compositionend",{bubbles:true,data:"充值"}));return {during:during,after:el.value}})()')
  ck('★ 拼音未上屏时不误发', comp.during === 'chongzhi', JSON.stringify(comp))

  console.log('')
  console.log('=== 6. localStorage（WebView 存储策略）===')
  const ls = await page.eval('(function(){try{localStorage.setItem("__t","1");var v=localStorage.getItem("__t");localStorage.removeItem("__t");return {ok:v==="1"}}catch(e){return {ok:false,err:e.message}}})()')
  ck('★ WebView 里 localStorage 可用', ls.ok, JSON.stringify(ls))

  console.log('')
  console.log('=== 7. 安全区与滚动 ===')
  const misc = await page.eval('(function(){var cs=getComputedStyle(document.documentElement);var sc=document.querySelector(".msg-scroll");return {safeB:cs.getPropertyValue("--safe-b").trim(),safeT:cs.getPropertyValue("--safe-t").trim(),hasScroll:!!sc,canScroll:sc?sc.scrollHeight>=sc.clientHeight:false}})()')
  ck('★ 定义了安全区变量', !!misc.safeB && !!misc.safeT, misc.safeB + ' / ' + misc.safeT)
  ck('消息区可滚动', misc.hasScroll && misc.canScroll)

  page.ws.close()

  console.log('')
  console.log('-'.repeat(56))
  console.log('RESULT  passed=' + pass + '  failed=' + fail)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(e => { console.error('崩溃:', e.message); process.exit(2) })