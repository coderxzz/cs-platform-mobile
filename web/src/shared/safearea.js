/**
 * 安全区兜底。
 *
 * 为什么需要：实测发现 Capacitor 的 WKWebView 里 env(safe-area-inset-*) 返回 0，
 * 但 WebView 是全屏的，结果顶栏被状态栏/灵动岛压住（有截图为证）。
 * 这是容器的问题，纯 CSS 修不了，只能用 JS 兜底。
 *
 * 策略：
 *   1. 先用探针读 env() 的真实值
 *   2. 非 0 -> 直接用（安卓 WebView、Safari、较新的 iOS 都正常）
 *   3. 是 0 且是 iPhone -> 按机型给经验值
 *   4. 写回 CSS 变量 --safe-t / --safe-b
 */

const NOTCH_TOP = 47   // iPhone X 及之后的刘海/灵动岛机型
const NOTCH_BOTTOM = 34
const OLD_TOP = 20     // iPhone 8 及之前

function readEnv() {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;' +
    'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const t = parseFloat(cs.paddingTop) || 0
  const b = parseFloat(cs.paddingBottom) || 0
  probe.remove()
  return { t, b }
}

function guessIPhone() {
  const ua = navigator.userAgent || ''
  if (!/iPhone|iPod/.test(ua)) return null
  // iPhone 15 是 393x852，除以 dpr 后长边 852
  const longSide = Math.max(window.screen.width, window.screen.height) / (window.devicePixelRatio || 1)
  const notched = longSide >= 812
  return {
    t: notched ? NOTCH_TOP : OLD_TOP,
    b: notched ? NOTCH_BOTTOM : 0
  }
}

export function applySafeArea() {
  const root = document.documentElement
  let { t, b } = readEnv()

  if (t === 0 && b === 0) {
    const guess = guessIPhone()
    if (guess) {
      t = guess.t
      b = guess.b
      // 留个标记，方便排查时确认走的是兜底
      root.dataset.safeFallback = '1'
    }
  }

  if (t > 0) root.style.setProperty('--safe-t', t + 'px')
  if (b > 0) root.style.setProperty('--safe-b', b + 'px')
  return { t, b }
}

export default applySafeArea
