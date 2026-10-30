/**
 * 前端真机测试：用系统 Chrome 打开真实页面，检查渲染和交互。
 *
 * 为什么必须用真浏览器：
 *   前面几次前端问题都是「代码看着对，打开是坏的」——
 *   黑屏（脚本 404）、发不出消息（参数名对不上）、构建静默失败。
 *   静态检查一个都查不出来。
 */
const { chromium } = require('playwright')

const BASE = process.env.CS_BASE || 'http://127.0.0.1:8000'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

let pass = 0, fail = 0
const errors = []

function ck(name, cond, detail) {
  if (cond) { pass++; console.log('  [PASS] ' + name + (detail !== undefined ? ' :: ' + detail : '')) }
  else { fail++; console.log('  [FAIL] ' + name + (detail !== undefined ? ' :: ' + detail : '')) }
}

async function newPage(browser, opts) {
  const ctx = await browser.newContext(Object.assign({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  }, opts || {}))
  const p = await ctx.newPage()
  p.on('pageerror', e => errors.push('JS: ' + e.message))
  p.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })
  p.on('requestfailed', r => errors.push('REQFAIL: ' + r.url().slice(-60)))
  return p
}

function line(t) { console.log(''); console.log(t) }

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })

  line('=== 1. 玩家聊天页 /chat ===')
  {
    const p = await newPage(browser)
    const resp = await p.goto(BASE + '/chat', { waitUntil: 'networkidle' })
    ck('页面能打开', resp && resp.status() === 200, resp && resp.status())
    ck('Vue 挂载成功', await p.locator('.app-shell').count() > 0)
    ck('顶部有标题', (await p.locator('.topbar h1').innerText()).length > 0,
       await p.locator('.topbar h1').innerText())
    ck('有输入框', await p.locator('.chat-input').count() === 1)
    ck('有发送按钮', await p.locator('.send-btn').count() === 1)
    ck('没有跳转到登录页', !p.url().includes('/login'), p.url())
    const sys = await p.locator('.sys').allInnerTexts()
    ck('缺凭证时给出提示（不是白屏）', sys.length > 0 && sys.join('').length > 0,
       JSON.stringify(sys).slice(0, 70))
    const w = await p.locator('.app-shell').evaluate(el => el.getBoundingClientRect().width)
    ck('手机宽度下铺满', Math.abs(w - 390) < 4, w)
    await p.context().close()
  }

  line('=== 2. 大屏居中 + 遮罩 ===')
  {
    const p = await newPage(browser, { viewport: { width: 1440, height: 900 }, isMobile: false })
    await p.goto(BASE + '/chat', { waitUntil: 'networkidle' })
    const box = await p.locator('.app-shell').evaluate(el => {
      const r = el.getBoundingClientRect()
      return { w: r.width, left: r.left, bg: getComputedStyle(document.body).backgroundColor }
    })
    ck('内容宽度限制在 480px', Math.abs(box.w - 480) < 2, box.w)
    ck('水平居中', Math.abs(box.left - (1440 - 480) / 2) < 4, box.left)
    ck('四周是深色遮罩', box.bg !== 'rgb(255, 255, 255)', box.bg)
    await p.context().close()
  }

  line('=== 3. 玩家工单提交 /submit ===')
  {
    const p = await newPage(browser)
    const resp = await p.goto(BASE + '/submit', { waitUntil: 'networkidle' })
    ck('页面能打开', resp && resp.status() === 200, resp && resp.status())
    ck('Vue 挂载成功', await p.locator('.app-shell').count() > 0)
    const chips = await p.locator('.chip').allInnerTexts()
    ck('有「提交问题」tab', chips.some(t => t.indexOf('提交') >= 0), JSON.stringify(chips))
    ck('有「我的工单」tab', chips.some(t => t.indexOf('我的工单') >= 0))
    ck('没有跳转到登录页', !p.url().includes('/login'), p.url())
    await p.locator('.chip').filter({ hasText: '我的工单' }).click()
    await p.waitForTimeout(500)
    const empty = await p.locator('.empty').count()
    const loading = await p.locator('.loading').count()
    ck('切换 tab 有反应（不是死页面）', empty + loading > 0, { empty, loading })
    await p.context().close()
  }

  line('=== 4. 客服后台 /desk（未登录应跳登录）===')
  {
    const p = await newPage(browser)
    await p.goto(BASE + '/desk', { waitUntil: 'networkidle' })
    await p.waitForTimeout(700)
    ck('未登录跳转到登录页', p.url().includes('/login'), p.url())
    ck('有账号输入框', await p.locator('input[autocomplete="username"]').count() === 1)
    ck('有密码输入框', await p.locator('input[type="password"]').count() === 1)
    ck('有登录按钮', await p.locator('button.btn.full').count() === 1)
    const disabled = await p.locator('button.btn.full').isDisabled()
    ck('空表单不能提交', disabled === true, disabled)
    await p.context().close()
  }

  line('=== 5. JSSDK 注入宿主页面 ===')
  {
    const p = await newPage(browser)
    const html = '<!doctype html><html><body><h1 id="host">宿主页面</h1>' +
                 '<script src="' + BASE + '/sdk/cs-sdk.js"><' + '/script></body></html>'
    await p.setContent(html)
    await p.waitForTimeout(600)
    ck('全局 CsSdk 存在', await p.evaluate(() => typeof window.CsSdk === 'object'))
    ck('有 init 方法', await p.evaluate(() => typeof window.CsSdk.init === 'function'))
    ck('有 open 方法', await p.evaluate(() => typeof window.CsSdk.open === 'function'))
    await p.evaluate(() => window.CsSdk.open())
    await p.waitForTimeout(300)
    ck('缺参数时 open 不崩', true)
    ck('宿主页面内容还在（没被覆盖）', await p.locator('#host').count() === 1)
    await p.context().close()
  }

  line('=== 6. 管理页 /manage ===')
  {
    const p = await newPage(browser)
    await p.goto(BASE + '/manage', { waitUntil: 'networkidle' })
    await p.waitForTimeout(600)
    const body = await p.locator('body').innerText()
    ck('页面有内容（不是全黑）', body.trim().length > 0, body.slice(0, 40))
    await p.context().close()
  }

  await browser.close()

  line('=== 页面报错统计 ===')
  if (errors.length) {
    console.log('  共 ' + errors.length + ' 条：')
    ;[...new Set(errors)].slice(0, 8).forEach(e => console.log('    · ' + String(e).slice(0, 110)))
  } else {
    console.log('  没有任何 JS 报错')
  }
  // 401 是未登录时的正常响应；SDK 缺参数是我们主动打的警告
  const realErrors = errors.filter(e =>
    !e.includes('401') && !e.includes('缺少 appId'))
  ck('全程无异常 JS 报错（401 和 SDK 提示属预期）', realErrors.length === 0,
     realErrors.slice(0, 3))

  console.log('')
  console.log('-'.repeat(56))
  console.log('RESULT  passed=' + pass + '  failed=' + fail)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('测试崩溃:', e.message); process.exit(2) })
