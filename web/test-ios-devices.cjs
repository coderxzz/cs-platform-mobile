/**
 * iOS 关键机型测试：iPhone X / iPhone 12 / iPhone 15（灵动岛）
 *
 * 重点看：安全区、文字错位、元素遮挡、布局溢出
 * 每种机型都截图，便于肉眼复核。
 */
const { chromium } = require('playwright')
const http = require('http')
const fs = require('fs')
const path = require('path')

const BASE = 'http://127.0.0.1:8000'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = process.env.SHOT_DIR || path.join(__dirname, '..', '机型截图')

let pass = 0, fail = 0
const fails = []
function ck(name, cond, detail) {
  if (cond) { pass++; console.log('    [PASS] ' + name + (detail !== undefined ? ' :: ' + String(detail).slice(0, 60) : '')) }
  else { fail++; fails.push(name); console.log('    [FAIL] ' + name + (detail !== undefined ? ' :: ' + String(detail).slice(0, 80) : '')) }
}

function get(p) {
  return new Promise((res, rej) => {
    http.get(BASE + p, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej)
  })
}

// 各机型的真实参数（宽 x 高 都是 CSS 点）
const DEVICES = [
  {
    name: 'iPhone X', w: 375, h: 812, dpr: 3,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    safeTop: 44, safeBottom: 34, tier: '刘海(X/XS/11Pro)'
  },
  {
    name: 'iPhone 12', w: 390, h: 844, dpr: 3,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    safeTop: 47, safeBottom: 34, tier: '刘海(12/13/14)'
  },
  {
    name: 'iPhone 15', w: 393, h: 852, dpr: 3,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    safeTop: 59, safeBottom: 34, tier: '灵动岛'
  }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })

  for (const d of DEVICES) {
    console.log('');
    console.log('=== ' + d.name + ' (' + d.w + 'x' + d.h + ' @' + d.dpr + 'x, 预期安全区 ' + d.safeTop + '/' + d.safeBottom + ') ===')

    const ctx = await browser.newContext({
      viewport: { width: d.w, height: d.h },
      deviceScaleFactor: d.dpr,
      userAgent: d.ua,
      isMobile: true,
      hasTouch: true
    })
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', e => errs.push(e.message))

    const sg = await get('/v1/embed/sign?app_id=app_aa5f6f3147144a1ca9f3&role_id=m' + Date.now().toString().slice(-6))
    const url = (sg.url.indexOf('http') === 0 ? sg.url : BASE + sg.url).replace('/embed?', '/chat?')
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)

    // ---- 安全区 ----
    const safe = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement)
      const topbar = document.querySelector('.topbar')
      return {
        safeT: parseFloat(cs.getPropertyValue('--safe-t')) || 0,
        safeB: parseFloat(cs.getPropertyValue('--safe-b')) || 0,
        fallback: document.documentElement.dataset.safeFallback || '',
        topbarTop: topbar ? topbar.getBoundingClientRect().top : -1,
        topbarH: topbar ? topbar.getBoundingClientRect().height : -1
      }
    })
    ck('安全区顶部 = ' + d.safeTop, Math.abs(safe.safeT - d.safeTop) < 1, safe.safeT + ' (兜底档: ' + safe.fallback + ')')
    ck('安全区底部 = ' + d.safeBottom, Math.abs(safe.safeB - d.safeBottom) < 1, safe.safeB)
    ck('★ 顶栏从 y=0 开始（内容不被状态栏压）', safe.topbarTop === 0, safe.topbarTop)
    ck('★ 顶栏高度 = 48 + 安全区', Math.abs(safe.topbarH - (48 + d.safeTop)) < 2, safe.topbarH)

    // ---- 文字错位 / 遮挡 ----
    const layout = await page.evaluate(() => {
      const r = el => el ? el.getBoundingClientRect() : null
      const title = r(document.querySelector('.topbar h1'))
      const sub = r(document.querySelector('.topbar .sub'))
      const ava = r(document.querySelector('.topbar .ava'));
      const input = r(document.querySelector('.chat-input'))
      const send = r(document.querySelector('.send-btn'))
      const scrollEl = document.querySelector('.msg-scroll')
      const sc = r(scrollEl)
      return {
        title, sub, ava, input, send, sc,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        scrollOverflowY: scrollEl ? scrollEl.scrollHeight - scrollEl.clientHeight : 0,
        inputInView: input ? input.bottom <= innerHeight + 1 && input.top >= 0 : false,
        sendInView: send ? send.right <= innerWidth + 1 && send.bottom <= innerHeight + 1 : false,
        titleClipped: title ? title.right > innerWidth : false,
        subOverlapTitle: (title && sub) ? (sub.top < title.bottom - 1) : false
      }
    })
    ck('★ 无横向溢出', layout.overflowX <= 1, layout.overflowX + 'px')
    ck('★ 标题不超出屏幕', !layout.titleClipped)
    ck('★ 副标题不与标题重叠', !layout.subOverlapTitle)
    ck('★ 输入框完整可见', layout.inputInView)
    ck('★ 发送按钮完整可见', layout.sendInView)
    ck('★ 输入框在发送按钮左侧', layout.input.right <= layout.send.left + 1,
       Math.round(layout.input.right) + ' <= ' + Math.round(layout.send.left))
    ck('★ 消息区在输入栏上方', layout.sc.bottom <= layout.input.top + 1)
    ck('★ 顶栏元素都在安全区内', layout.title.top >= d.safeTop - 1,
       Math.round(layout.title.top) + ' >= ' + d.safeTop)

    // ---- 中文不换行错位 ----
    const cjk = await page.evaluate(() => {
      const el = document.querySelector('.topbar h1')
      const cs = getComputedStyle(el)
      return { lines: Math.round(el.getBoundingClientRect().height / parseFloat(cs.lineHeight || cs.fontSize)),
               text: el.innerText }
    })
    ck('★ 标题单行显示', cjk.lines <= 1, cjk.text + ' (' + cjk.lines + '行)')

    // ---- 发消息 ----
    await page.locator('.chat-input').fill('机型测试：充值没到账')
    await page.locator('.send-btn').click()
    await page.waitForTimeout(18000)
    const bubbles = await page.locator('.bubble').allInnerTexts()
    ck('★ 能发消息并收到回复', bubbles.length >= 2, bubbles.length + ' 条')
    // 之前有个 bug：消息永远停在「发送中」，因为改的是副本不是响应式代理
    const stillSending = await page.locator('.meta', { hasText: '发送中' }).count()
    ck('★ 不能停在发送中', stillSending === 0, stillSending)
    const afterScroll = await page.evaluate(() => {
      const el = document.querySelector('.msg-scroll')
      return el ? (el.scrollHeight - el.scrollTop - el.clientHeight < 80) : false
    })
    ck('★ 收到回复后自动滚到底', afterScroll)

    // ---- 输入框聚焦后布局是否塌 ----
    await page.locator('.chat-input').click()
    await page.waitForTimeout(600)
    const focused = await page.evaluate(() => {
      const i = document.querySelector('.chat-input').getBoundingClientRect()
      const s = document.querySelector('.send-btn').getBoundingClientRect()
      return { sameLine: Math.abs((i.top + i.height / 2) - (s.top + s.height / 2)) < 3,
               inputBottom: i.bottom }
    })
    ck('★ 聚焦后输入框与按钮仍对齐', focused.sameLine)
    ck('★ 聚焦后输入框不跑出屏幕', focused.inputBottom <= d.h + 1, focused.inputBottom)

    ck('无 JS 异常', errs.length === 0, errs.slice(0, 1).join(''))

    const f = path.join(OUT, d.name.replace(/ /g, '-') + '.png')
    await page.screenshot({ path: f, fullPage: false })
    console.log('    截图: ' + f)

    await ctx.close()
  }

  await browser.close()
  console.log('');
  console.log('-'.repeat(60))
  console.log('RESULT  passed=' + pass + '  failed=' + fail)
  if (fails.length) { console.log('失败项:'); fails.forEach(f => console.log('  - ' + f)) }
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('崩溃:', e.message); process.exit(2) })