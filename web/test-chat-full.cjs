/**
 * 聊天页完整测试。
 *
 * 覆盖：加载 / 会话 / 多机型布局 / 发消息边界 / AI 回复 / 快捷问题 / 滚动 / 性能
 * 引擎：Chromium（桌面）+ WebKit（iOS 同款）
 */
const { chromium, webkit, devices } = require('playwright')
const https = require('http')

const BASE = process.env.CS_BASE || 'http://127.0.0.1:8000'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
// HEADED=1 会弹出真实浏览器窗口，能肉眼看到每一步操作
const HEADED = process.env.HEADED === '1'
const SLOW = parseInt(process.env.SLOW || '250', 10)

let pass = 0, fail = 0
const fails = []
function ck(name, cond, detail) {
  if (cond) { pass++; console.log('  [PASS] ' + name + (detail !== undefined ? ' :: ' + String(detail).slice(0, 70) : '')) }
  else { fail++; fails.push(name); console.log('  [FAIL] ' + name + (detail !== undefined ? ' :: ' + String(detail).slice(0, 90) : '')) }
}

function get(path) {
  return new Promise((res, rej) => {
    https.get(BASE + path, r => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { res(d) } })
    }).on('error', rej)
  })
}

async function signUrl(role) {
  const d = await get('/v1/embed/sign?app_id=app_aa5f6f3147144a1ca9f3&role_id=' + role)
  // 接口返回的可能是完整 URL，也可能只有路径，两种都兼容
  return d.url.indexOf('http') === 0 ? d.url : BASE + d.url;
}

async function chatUrl(role) {
  const u = await signUrl(role)
  return u.replace('/embed?', '/chat?')
}

/* ---------- 在页面上跑一组交互断言 ---------- */
async function pageChecks(page, label) {
  console.log('');
  console.log('=== ' + label + ' ===')

  ck('Vue 挂载', await page.locator('.app-shell').count() > 0)
  ck('标题是「在线客服」', (await page.locator('.topbar h1').innerText().catch(() => '')) === '在线客服')
  ck('输入框存在', await page.locator('.chat-input').count() === 1)
  ck('发送按钮存在', await page.locator('.send-btn').count() === 1)
  ck('快捷问题有三个', await page.locator('.chip').count() === 3, await page.locator('.chip').count())
  ck('图片按钮存在', await page.locator('.icon-btn').count() >= 1)

  const vp = await page.evaluate(() => ({
    w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
    shellW: document.querySelector('.app-shell').getBoundingClientRect().width,
    font: getComputedStyle(document.querySelector('.chat-input')).fontSize,
    safeT: getComputedStyle(document.documentElement).getPropertyValue('--safe-t').trim()
  }))
  ck('输入框字号 >= 16px（防聚焦放大）', parseFloat(vp.font) >= 16, vp.font)
  ck('容器宽度不超过 480 或铺满', vp.shellW <= 481, vp.shellW)
  ck('安全区变量已定义', vp.safeT !== '', vp.safeT)

  // 会话
  const tok = await page.evaluate(() => localStorage.getItem('cs_embed_session') || '')
  ck('拿到 es_ 会话凭证', tok.indexOf('es_') === 0, tok.slice(0, 12))

  // 正常发消息
  const before = await page.locator('.msg-row').count()
  await page.locator('.chat-input').fill('测试：我的充值没到账')
  await page.locator('.send-btn').click()
  await page.waitForTimeout(15000)
  const after = await page.locator('.msg-row').count()
  ck('发消息后行数增加', after > before, before + ' -> ' + after)
  const bubbles = await page.locator('.bubble').allInnerTexts()
  ck('自己的消息显示', bubbles.some(b => b.indexOf('测试：我的充值没到账') >= 0))
  const sys = await page.locator('.sys').allInnerTexts()
  const others = bubbles.filter(b => b.indexOf('测试：我的充值没到账') < 0)
  ck('收到回应（AI 气泡或转人工提示）', others.length > 0 || sys.some(s => s.indexOf('转接') >= 0),
     others.length ? String(others[0]).slice(0, 50) : sys.join(' / ').slice(0, 50))
}

(async () => {
  /* ========== 1. Chromium 桌面 ========== */
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: !HEADED,
    slowMo: HEADED ? SLOW : 0,
    args: HEADED ? ['--start-maximized'] : []
  })
  if (HEADED) console.log('>>> 浏览器窗口已弹出，你可以在屏幕上看到它的操作 <<<')

  // 1.1 加载与会话
  console.log('=== 1. 加载与会话 ===')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  const t0 = Date.now()
  const url = await chatUrl('t' + Date.now().toString().slice(-6))
  await page.goto(url, { waitUntil: 'networkidle' })
  const loadMs = Date.now() - t0
  await page.waitForTimeout(2500)
  ck('首屏加载 < 5000ms', loadMs < 5000, loadMs + 'ms')
  ck('无 JS 异常', errs.length === 0, errs.slice(0, 2).join(' | '))

  // 1.2 无效签名
  const bad = await browser.newContext()
  const badPage = await bad.newPage()
  await badPage.goto(BASE + '/chat?app_id=x&role_id=1&ts=1&sign=deadbeef', { waitUntil: 'networkidle' })
  await badPage.waitForTimeout(2500)
  const badText = await badPage.locator('body').innerText()
  ck('★ 无效签名被拒', badText.indexOf('连接失败') >= 0 || badText.indexOf('缺') >= 0, badText.slice(0, 50))
  const badTok = await badPage.evaluate(() => localStorage.getItem('cs_embed_session') || '')
  ck('★ 无效签名拿不到凭证', badTok === '', badTok)
  await bad.close()

  // 1.3 多机型布局
  console.log('');
  console.log('=== 2. 多机型布局 ===')
  const sizes = [
    { n: 'iPhone SE 375x667', w: 375, h: 667, dpr: 2 },
    { n: 'iPhone 15 393x852', w: 393, h: 852, dpr: 3 },
    { n: '小屏 320x568', w: 320, h: 568, dpr: 2 },
    { n: '安卓 360x800', w: 360, h: 800, dpr: 2.75 },
    { n: '桌面 1920x1080', w: 1920, h: 1080, dpr: 1 }
  ]
  for (const s of sizes) {
    const c = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr })
    const p = await c.newPage()
    await p.goto(BASE + '/chat', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(800)
    const m = await p.evaluate(() => {
      const el = document.querySelector('.app-shell')
      const r = el ? el.getBoundingClientRect() : { width: 0, left: 0 }
      return { shellW: r.width, left: r.left, overflowX: document.documentElement.scrollWidth > innerWidth }
    })
    if (s.w > 560) {
      ck('★ ' + s.n + ' 限宽 480', Math.abs(m.shellW - 480) < 3, m.shellW)
      ck('★ ' + s.n + ' 水平居中', Math.abs(m.left - (s.w - 480) / 2) < 5, m.left)
    } else {
      ck('★ ' + s.n + ' 铺满宽度', Math.abs(m.shellW - s.w) < 4, m.shellW)
    }
    ck('★ ' + s.n + ' 无横向溢出', !m.overflowX)
    await c.close()
  }

  // 1.4 输入边界
  console.log('');
  console.log('=== 3. 输入边界 ===')
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const p2 = await c2.newPage()
  await p2.goto(await chatUrl('e' + Date.now().toString().slice(-6)), { waitUntil: 'networkidle' })
  await p2.waitForTimeout(2000)

  const rows0 = await p2.locator('.msg-row').count()

  // 空消息：按钮应该是 disabled（这是正确设计，不是靠点击后判断）
  const emptyDisabled = await p2.locator('.send-btn').isDisabled()
  ck('★ 空输入时发送按钮禁用', emptyDisabled, emptyDisabled)

  // 纯空格：应该也保持禁用
  await p2.locator('.chat-input').fill('    ')
  await p2.waitForTimeout(400)
  const spaceDisabled = await p2.locator('.send-btn').isDisabled()
  ck('★ 纯空格时发送按钮仍禁用', spaceDisabled, spaceDisabled)
  ck('纯空格不会产生消息', await p2.locator('.msg-row').count() === rows0)

  // XSS
  await p2.locator('.chat-input').fill('<img src=x onerror=alert(1)>')
  await p2.locator('.send-btn').click()
  await p2.waitForTimeout(1500)
  const xss = await p2.evaluate(() => ({ imgs: document.querySelectorAll('.bubble img').length }))
  ck('★ XSS 不执行（未注入 img 标签）', xss.imgs === 0, xss.imgs)
  const hasText = await p2.locator('.bubble', { hasText: '<img' }).count()
  ck('★ XSS 作为纯文本显示', hasText > 0, hasText)

  // emoji + 特殊字符
  await p2.locator('.chat-input').fill('😀<>&"\' 测试')
  await p2.locator('.send-btn').click()
  await p2.waitForTimeout(1500)
  const emojiOk = await p2.locator('.bubble', { hasText: '😀' }).count()
  ck('emoji 和特殊字符正常显示', emojiOk > 0, emojiOk)

  // 超长
  const long = 'A'.repeat(2000)
  await p2.locator('.chat-input').fill(long)
  await p2.locator('.send-btn').click()
  await p2.waitForTimeout(2000)
  const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)
  ck('★ 超长文本不撑破布局', !overflow)

  // 快捷问题
  console.log('');
  console.log('=== 4. 快捷问题 ===')
  const c3 = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const p3 = await c3.newPage()
  await p3.goto(await chatUrl('q' + Date.now().toString().slice(-6)), { waitUntil: 'networkidle' })
  await p3.waitForTimeout(2000)
  const chips = await p3.locator('.chip').allInnerTexts()
  ck('三个快捷问题文案正确', chips.length === 3 && chips.indexOf('充值没到账') >= 0, chips.join('/'))
  const r0 = await p3.locator('.msg-row').count()
  await p3.locator('.chip').first().click()
  await p3.waitForTimeout(1500)
  ck('点快捷问题会发出消息', await p3.locator('.msg-row').count() > r0)
  ck('发出后快捷问题区消失', await p3.locator('.quick-asks').count() === 0)

  // 滚动
  console.log('');
  console.log('=== 5. 滚动行为 ===')
  const scrollInfo = await p3.evaluate(() => {
    const el = document.querySelector('.msg-scroll')
    if (!el) return { ok: false }
    return { ok: true, atBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 60 }
  })
  ck('消息区存在且可用', scrollInfo.ok)
  ck('新消息后自动滚到底部', scrollInfo.atBottom)

  await browser.close()

  /* ========== 2. WebKit（iOS 同款引擎） ========== */
  console.log('');
  console.log('=== 6. WebKit / iOS 引擎 ===')
  const wk = await webkit.launch({ headless: !HEADED, slowMo: HEADED ? SLOW : 0 })
  if (HEADED) console.log('>>> WebKit 窗口（iOS 同款引擎）也已弹出 <<<')
  const iCtx = await wk.newContext({ ...devices['iPhone 13'] })
  const iP = await iCtx.newPage()
  const iErrs = []
  iP.on('pageerror', e => iErrs.push(e.message))
  await iP.goto(await chatUrl('i' + Date.now().toString().slice(-6)), { waitUntil: 'networkidle' })
  await iP.waitForTimeout(2500)
  await pageChecks(iP, 'iPhone 13 / WebKit');
  ck('★ WebKit 无 JS 异常', iErrs.length === 0, iErrs.slice(0, 2).join(' | '))
  await wk.close()

  console.log('');
  console.log('-'.repeat(60))
  console.log('RESULT  passed=' + pass + '  failed=' + fail)
  if (fails.length) { console.log('失败项:'); fails.forEach(f => console.log('  - ' + f)) }
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('崩溃:', e.message); process.exit(2) })