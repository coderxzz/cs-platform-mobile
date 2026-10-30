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
 *   3. 是 0 且是 iPhone -> 按屏幕长边分档给经验值
 *   4. 写回 CSS 变量 --safe-t / --safe-b
 */

// 按屏幕长边（CSS 点）分档。数据来自各机型实际安全区。
// 长边 812 = iPhone X / XS / 11 Pro（刘海）
// 长边 844 = iPhone 12 / 13 / 14（刘海）
// 长边 852+ = iPhone 14 Pro / 15 / 16（灵动岛）
// 长边 < 812 = iPhone SE / 8 等（非全面屏）
const TIERS = [
  { min: 852, t: 59, b: 34, name: '灵动岛' },
  { min: 844, t: 47, b: 34, name: '刘海(12/13/14)' },
  { min: 812, t: 44, b: 34, name: '刘海(X/XS/11Pro)' },
  { min: 0, t: 20, b: 0, name: '非全面屏' }
]

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

export function guessIPhone() {
  const ua = navigator.userAgent || ''
  if (!/iPhone|iPod/.test(ua)) return null
  // 注意：WKWebView 里 screen.width/height 已经是 CSS 点（不是设备像素），
  // 实测 iPhone 15 返回 393x852、dpr=3。再除 dpr 会算成 284，误判成非刘海机型。
  const longSide = Math.max(window.screen.width, window.screen.height)
  const tier = TIERS.find(x => longSide >= x.min) || TIERS[TIERS.length - 1]
  return { t: tier.t, b: tier.b, tier: tier.name, longSide }
}

export function applySafeArea() {
  const root = document.documentElement
  let { t, b } = readEnv()
  let source = 'env'

  if (t === 0 && b === 0) {
    const guess = guessIPhone()
    if (guess) {
      t = guess.t
      b = guess.b
      source = 'guess:' + guess.tier
      root.dataset.safeFallback = guess.tier
    }
  }

  if (t > 0) root.style.setProperty('--safe-t', t + 'px')
  if (b > 0) root.style.setProperty('--safe-b', b + 'px')
  return { t, b, source }
}

export default applySafeArea
