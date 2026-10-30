# iOS 真模拟器验证结果

## 结论：跑通了，而且是真模拟器，不是浏览器模拟

GitHub Actions 的 macOS runner 自带 iOS Simulator。
CI 里启动模拟器、装 App、跑起来、截图，**全程零成本、零第三方账号**。

| 项 | 值 |
|---|---|
| 运行环境 | macOS 14 runner，iPhone 15 模拟器（iOS 17+） |
| 耗时 | 约 4-5 分钟 |
| 花费 | 0 元（公有仓库免费） |
| 需要 Apple 账号 | 否（模拟器构建不签名） |
| 需要 Appetize 等第三方 | 否 |

---

## 最终画面

截图见 `shots/shot-2-loaded.png`，内容：

```
状态栏（时间/灵动岛/信号/电量）   <- 完整可见，未被遮挡
─────────────────────────────
[客] 在线客服                    <- 顶栏，在状态栏下方
     ● 在线客服
─────────────────────────────
       已连接客服，请描述您遇到的问题




[充值没到账] [账号被封] [游戏闪退]
─────────────────────────────
[图] 请描述您遇到的问题...    [发送]
─────────────────────────────
        ──────                  <- Home 指示条
```

---

## 这套验证抓到 2 个真 bug（都是浏览器测不出来的）

### Bug 1：`env(safe-area-inset-*)` 在 WKWebView 里返回 0

**现象**：顶栏被状态栏和灵动岛压住，「在线客服」和「7:04」重叠。

**怎么定位的**：在页面里注入探针，把 `env()` 的真实值打到屏幕上截图读。

```
SAFE top=0px bottom=0px
innerH=852 screenH=852
dpr=3 ua_iPhone=true
```

**根因**：Capacitor 的 WKWebView 不向页面暴露安全区，`env()` 恒为 0。
CSS 层面无解，必须 JS 兜底。

**修法**：`web/src/shared/safearea.js`
- 先读 `env()`，非 0 直接用
- 是 0 且是 iPhone，按机型补值（刘海机 47px / 老机型 20px）
- 写回 CSS 变量 `--safe-t` / `--safe-b`

### Bug 2：`height: 48px` + `padding-top` 被 border-box 吃掉

**现象**：加了 `padding-top: 47px` 之后没效果。

**根因**：全局 `box-sizing: border-box`，`height: 48px` 里包含 padding，
47px 的 padding 把内容区挤成 1px。

**修法**：`.topbar` 的 `height` 改成 `min-height`。

```css
.topbar {
  min-height: 48px;      /* 原来是 height: 48px */
  padding-top: var(--safe-t);
}
```

### 还有一个纯属我的计算错误

第一版兜底逻辑写成 `screen.height / devicePixelRatio`。
实测 `screenH=852`、`dpr=3`，算出 284，误判成「非刘海机型」只补了 20px。

**WKWebView 里 `screen.width/height` 已经是 CSS 点，不能再除 dpr。**

---

## 完整链路（全自动）

```
git push
  -> GitHub Actions 起 macos-14
  -> 构建前端（Vue3/Vite）
  -> 同步进 Capacitor iOS 工程
  -> pod install
  -> xcodebuild -sdk iphonesimulator（不签名）
  -> 起本地模拟后端（托管前端 + 假接口）
  -> xcrun simctl boot / install / launch
  -> 等页面加载
  -> xcrun simctl io screenshot
  -> 发 Release（截图和包都能免登录下载）
```

---

## 模拟后端（ci-mock-server.py）

CI 连不到内网真后端，所以写了一个最小实现，行为和真后端一致：

| 接口 | 作用 |
|---|---|
| `GET /chat` `/desk` | 静态页面（含 `.html` 后缀映射） |
| `POST /v1/embed/session` | URL 参数换会话凭证 |
| `POST /v1/inbound/<ch>` | 收消息，返回 clarify 回复 |

验证过：换会话 -> 发消息 -> 收到中文回复，链路完整。

---

## 和 Appetize 方案的对比

| | GitHub 模拟器（本方案） | Appetize |
|---|---|---|
| 需要注册账号 | **否** | 是 |
| 需要 API token | **否** | 是 |
| 花费 | 0 | 0（30 分钟/月） |
| 能看到的 | 截图 | 可交互的真机画面 |
| 能点按钮 | 否（只截图） | 是 |
| 适合 | **自动化回归、每次 push 都验** | 人工点一遍 |

**两者互补**：CI 每次 push 自动截图防回归；要人工点按钮时再用 Appetize。

---

## 局限（诚实说）

| 项 | 说明 |
|---|---|
| 不能模拟点击 | `simctl` 只支持截图，交互要 Appium/idb |
| 不测真实键盘 | 模拟器软件键盘和真机不同 |
| 不测性能 | 云端串流测不出帧率 |
| 不是真机 | 真机验收仍需 Mac + 账号 |

**但「页面在 iOS 上渲染对不对、布局有没有被状态栏压住」这类问题，这套完全够用——事实上已经抓出 2 个真 bug。**