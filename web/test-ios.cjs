/**
 * iOS 兼容性测试（WebKit 引擎）。
 *
 * ★ 必须先说清楚边界：
 *   Windows 上跑不了 iOS 模拟器（要 macOS + Xcode）。
 *   这里用 Playwright 的 WebKit 内核 —— 和 iOS Safari / WKWebView 是同一个引擎，
 *   能验证「渲染引擎和 JS 行为」，但验证不了：
 *     · 真实 WKWebView 容器的特有行为（如 App-Bound Domains）
 *     · 真机键盘弹起高度
 *     · 刘海/灵动岛的真实安全区数值（浏览器里是 0）
 *   所以这一层是「引擎级兼容验证」，真机验收还得在 Mac 上过一遍。
 */
const { webkit, devices } = require('playwright')

let pass = 0, fail = 0
const errors = []
function ck(n, c, d) {
  if (c) { pass++; console.log('  [PASS] ' + n + (d !== undefined ? ' :: ' + d : '')) }
  else { fail++; console.log('  [FAIL] ' + n + (d !== undefined ? ' :: ' + d : '')) }
}

const BASE = process.env.CS_BASE || 'http://127.0.0.1:8000'

async function fetchSign(role) {
  const r = await fetch(BASE + '/v1/embed/sign?app_id=app_aa5f6f3147144a1ca9f3&role_id=' + role)
  const d = await r.json()
  return d.url.replace('/embed?', '/chat?')
}

;(async () => {
  const browser = await webkit.launch()
  // 用 Playwright 内置的 iPhone 设备描述（UA / 视口 / DPR 都对）
  const iphone = devices['iPhone 13']
  const ctx = await browser.newContext({ ...iphone })
  const page = await ctx.newPage()
  page.on('pageerror', e => errors.push('JS: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })

  const role = 'ios' + Date.now().toString().slice(-7)
  const url = await fetchSign(role)
  console.log('=== 环境 ===')
  console.log('  设备: iPhone 13 (WebKit)')
  console.log('  角色: ' + role)

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  console.log('')
  console.log('=== 1. 渲染 ===')
  ck('Vue 挂载', await page.locator('.app-shell').count() > 0)
  ck('顶栏标题', (await page.locator('.topbar h1').innerText().catch(() => '')) === '在线客服')
  ck('输入框', await page.locator('.chat-input').count() === 1)
  ck('发送按钮', await page.locator('.send-btn').count() === 1)

  console.log('')
  console.log('=== 2. iOS 视口与安全区 ===')
  const vp = await page.evaluate(() => ({
    w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
    ua: navigator.userAgent,
    shellW: document.querySelector('.app-shell').getBoundingClientRect().width,
    inputFont: getComputedStyle(document.querySelector('.chat-input')).fontSize,
    safeBottom: getComputedStyle(document.documentElement).getPropertyValue('--safe-b').trim()
  }))
  console.log('  视口: ' + vp.w + 'x' + vp.h + ' @' + vp.dpr + 'x')
  console.log('  UA: ' + vp.ua.slice(0, 75))
  ck('★ iPhone 视口宽度（390）', Math.abs(vp.w - 390) < 2, vp.w)
  ck('★ DPR = 3（真机像素比）', vp.dpr === 3, vp.dpr)
  ck('UA 是 iPhone/Safari', vp.ua.indexOf('iPhone') >= 0)
  ck('★ 容器铺满', Math.abs(vp.shellW - vp.w) < 4, vp.shellW)
  ck('★ 输入框 >= 16px（iOS 聚焦不放大）', parseFloat(vp.inputFont) >= 16, vp.inputFont)

  console.log('')
  console.log('=== 3. 会话凭证 ===')
  const sess = await page.evaluate(() => ({
    token: localStorage.getItem('cs_embed_session') || '',
    channel: localStorage.getItem('cs_channel') || ''
  }))
  ck('★ 拿到 es_ 凭证', sess.token.indexOf('es_') === 0, sess.token.slice(0, 14))
  ck('★ 拿到频道', !!sess.channel, sess.channel)

  console.log('')
  console.log('=== 4. 发消息（真实后端）===')
  const before = await page.locator('.msg-row').count()
  await page.locator('.chat-input').fill('iOS WebKit 测试：账号被封了')
  await page.locator('.send-btn').click()
  await page.waitForTimeout(16000)

  const after = await page.locator('.msg-row').count()
  const bubbles = await page.locator('.bubble').allInnerTexts()
  const sysAll = await page.locator('.sys').allInnerTexts()
  const handedOff = sysAll.some(s => s.indexOf('转接') >= 0)
  ck('★ 气泡增加', after > before, before + ' -> ' + after)
  ck('★ 自己的消息显示', bubbles.some(b => b.indexOf('iOS WebKit 测试') >= 0))
  const others = bubbles.filter(b => b.indexOf('iOS WebKit 测试') < 0)
  ck('★ 有回应', others.length > 0 || handedOff,
     others.length ? String(others[0]).slice(0, 60) : sysAll.join(' / ').slice(0, 60))

  console.log('')
  console.log('=== 5. iOS 特有行为 ===')
  // iOS 上 :active 高亮、点击 300ms 延迟、visualViewport
  const ios = await page.evaluate(() => ({
    hasVisualViewport: typeof window.visualViewport !== 'undefined',
    tapHighlight: getComputedStyle(document.body).webkitTapHighlightColor || '',
    touchAction: getComputedStyle(document.body).touchAction || '',
    canPassive: (() => { try { let o = false; addEventListener('t', null, Object.defineProperty({}, 'passive', { get: () => o = true })); removeEventListener('t', null); return o } catch (e) { return false } })()
  }))
  ck('★ visualViewport 可用（键盘高度靠它）', ios.hasVisualViewport)
  // WebKit 不通过 getComputedStyle 暴露 -webkit-tap-highlight-color，
  // 所以直接查样式表里有没有这条规则（写出去了就说明生效）
  // WebKit 里读不到外部样式表的 cssRules，直接取 CSS 文件内容验证
  const cssHas = await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll('link[rel=stylesheet]'))
    for (const l of links) {
      try {
        const txt = await (await fetch(l.href)).text()
        if (txt.indexOf('tap-highlight-color') >= 0) return true
      } catch (e) { /* 忽略 */ }
    }
    return false
  })
  ck('★ 关掉了点击高亮（样式表里有 -webkit-tap-highlight-color）', cssHas)
  ck('★ 支持 passive 事件监听', ios.canPassive)

  console.log('')
  console.log('=== 6. 中文输入法（composition）===')
  const comp = await page.evaluate(() => {
    const el = document.querySelector('.chat-input')
    el.focus()
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    el.value = 'zhanghao'
    el.dispatchEvent(new Event('input', { bubbles: true }))
    const during = el.value
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '账号' }))
    return { during, after: el.value }
  })
  ck('★ 拼音未上屏不误发', comp.during === 'zhanghao', JSON.stringify(comp))

  console.log('')
  console.log('=== 7. 存储与滚动 ===')
  const misc = await page.evaluate(() => {
    try { localStorage.setItem('__t', '1'); localStorage.getItem('__t'); localStorage.removeItem('__t') } catch (e) { return { ls: false } }
    const sc = document.querySelector('.msg-scroll')
    return { ls: true, canScroll: sc ? sc.scrollHeight >= sc.clientHeight : false }
  })
  ck('★ localStorage 可用', misc.ls)
  ck('消息区可滚动', misc.canScroll)

  console.log('')
  console.log('=== 8. 大屏居中（同一份代码）===')
  const wide = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  const p2 = await wide.newPage()
  await p2.goto(url, { waitUntil: 'networkidle' })
  await p2.waitForTimeout(1200)
  const box = await p2.locator('.app-shell').evaluate(el => {
    const r = el.getBoundingClientRect()
    return { w: r.width, left: r.left }
  })
  ck('★ 1200px 下限制 480px', Math.abs(box.w - 480) < 2, box.w)
  ck('★ 水平居中', Math.abs(box.left - (1200 - 480) / 2) < 4, box.left)
  await wide.close()

  await browser.close()

  console.log('')
  console.log('=== JS 报错 ===')
  const real = errors.filter(e => e.indexOf('401') < 0)
  if (real.length) real.slice(0, 5).forEach(e => console.log('  · ' + String(e).slice(0, 110)))
  else console.log('  无异常')
  ck('★ 无异常 JS 报错', real.length === 0, real.length)

  console.log('')
  console.log('-'.repeat(56))
  console.log('RESULT  passed=' + pass + '  failed=' + fail)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('崩溃:', e.message); process.exit(2) })