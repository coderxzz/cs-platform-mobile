# iOS 出包方案调研（Windows 环境）

> 调研时间：2026-10-30
> 目的：找出在 Windows 上完成 **构建 + 装到真机 + 实测** 的可行路径
> 结论先行：**有解，而且不需要买 Mac**，但需要一台真 iPhone。

---

## 一、先把问题拆开

「在 Windows 上做 iOS」其实是三件不同的事，难度完全不同：

| # | 要做的事 | Windows 能不能做 |
|---|---|---|
| 1 | **编译出 .app / .ipa** | ❌ 必须 macOS（Xcode 工具链只有 Mac 版） |
| 2 | **签名** | 🟡 有工具能在 Windows 上签（用你的 Apple ID） |
| 3 | **装到真机并运行** | ✅ 能，Sideloadly / AltStore 这类工具就是干这个的 |

**关键洞察**：第 1 步是唯一的硬墙，但它是可以「租」的——云端 macOS。
第 2、3 步反而在 Windows 上早有成熟方案。

所以完整链路是：

```
Windows 写代码 → 云端 macOS 编译 → 下载 ipa → Windows 上签名侧载 → 真 iPhone 实测
```

---

## 二、第 1 步：在哪编译（三选一）

### A. Expo EAS Build（最省事）

| 项 | 情况 |
|---|---|
| 做什么 | 云端 macOS 编译，Windows 上一条命令提交 |
| 免费额度 | 有免费档（每月有限次数，超出排队慢） |
| 前提 | 项目用 Expo / React Native |
| **对我们的问题** | **不适用**——我们是 Capacitor + 原生 WebView 壳，不是 RN 项目 |

> Expo 官方博客标题就是「You don't need a Mac to develop iOS apps」，
> 还提供云端 iOS 模拟器。但它绑定 Expo 技术栈。

### B. Codemagic（最通用）

| 项 | 情况 |
|---|---|
| 做什么 | 云端 macOS CI，支持 Capacitor / Cordova / Flutter / 原生 |
| 免费额度 | 每月 500 分钟 macOS 构建 |
| 前提 | 有 Apple 开发者账号（要签名证书） |
| **适配度** | **高**——Capacitor 项目直接能跑 |

官方有专文《How to develop and distribute iOS apps without Mac》，就是讲这个场景。

### C. GitHub Actions macOS Runner（最可控）

| 项 | 情况 |
|---|---|
| 做什么 | 自己写 workflow，跑在 `macos-14` runner 上 |
| 费用 | 公开仓库免费；私有仓库 macOS 约 $0.08/分钟 |
| 前提 | GitHub 仓库 + 签名证书 |
| **适配度** | **高**——我已经把 workflow 写好了 |

**注意**：本机现在 `github.com` 访问不通（返回 000），这条路要先解决网络。

---

## 三、第 2+3 步：Windows 上签名并装到真机（这才是关键发现）

### Sideloadly（Windows 原生工具）

| 项 | 情况 |
|---|---|
| 跑在哪 | **Windows 原生**，不需要 Mac |
| 做什么 | 把 .ipa 用你的 Apple ID 重签，然后通过 USB 装进 iPhone |
| 需要什么 | 一个 Apple ID（**免费账号就行**）+ 一台 iPhone + iTunes 驱动 |
| 限制 | 免费账号签的证书 **7 天过期**，到期要重签一次 |
| 付费账号 | 证书 1 年有效，可注册 100 台设备 |

### AltStore（同类方案）

同样是「用免费 Apple ID 侧载」，可以在 iPhone 上自签续期。

### 这意味着什么

**你不需要 $99 的开发者账号就能在真机上测试。**
免费 Apple ID + Sideloadly 就能装，只是每 7 天要重签一次。

正式发布/上架才需要付费账号。

---

## 四、那些「看起来能行但其实不行」的方案

我逐个查过，列出来免得再走弯路：

| 方案 | 为什么不行 |
|---|---|
| **Darling**（Linux 上跑 macOS 程序） | 项目长期未完成，跑不了 Xcode。不能用于构建 |
| **osxcross**（交叉编译） | 能编出二进制，但需要 Apple 的 SDK（要 Mac 才能合法下载），且签名绕不开 |
| **Hackintosh 虚拟机** | 需要 macOS 镜像（本机没有），QEMU 无硬件加速极慢，Apple EULA 也不允许非苹果硬件 |
| **Xamarin / MAUI** | 编译阶段仍要连一台 Mac 作构建主机 |
| **Flutter** | 同上，`flutter build ios` 必须 macOS |
| **PWABuilder** | 能生成 Xcode 工程，但最终还是要 Mac 编译 |
| **BrowserStack** | 有真机云，但那是**测试**用的，不能给你出包 |

**共同点**：凡是「生成工程」的工具都能在 Windows 跑，凡是「编译成 ipa」的都绕不开 macOS。

---

## 五、推荐路线（按成本排序）

### 路线 1：Codemagic + Sideloadly（推荐，几乎零成本）

| 步骤 | 在哪做 | 成本 |
|---|---|---|
| 1. 上传工程到 Codemagic | Windows | 免费 500 分钟/月 |
| 2. 云端 macOS 编译出 ipa | 云端 | 免费额度内 |
| 3. 下载 ipa | Windows | — |
| 4. Sideloadly 签名装进 iPhone | Windows + USB | 免费 Apple ID |
| 5. 真机实测 | iPhone | — |

**没有 Mac，没有 $99 账号，能跑通。** 代价是每 7 天重签一次。

### 路线 2：GitHub Actions + Sideloadly

和路线 1 一样，只是用 GitHub 的 macOS runner 代替 Codemagic。
**前提**：先解决本机访问 GitHub 的网络问题。

### 路线 3：租云 Mac（最省心）

MacinCloud / MacStadium，按月付费，远程桌面进 macOS 直接用 Xcode。
适合「要频繁调试 iOS」的场景。

---

## 六、还缺什么（要你确认的）

| # | 事项 | 为什么必须 |
|---|---|---|
| 1 | **一台真 iPhone** | 无 Mac 方案绕不开真机；模拟器只能在 macOS 上跑 |
| 2 | 一个 Apple ID | 免费即可侧载，付费才能长期有效 |
| 3 | 决定用 Codemagic 还是 GitHub Actions | 取决于网络能不能通 GitHub |
| 4 | 如果是付费开发者账号，要 D-U-N-S 编号 | 公司账号申请要 1-2 周 |

---

## 七、对本项目的具体建议

**工程侧我已经准备好了**（`app-ios/` 里的 Xcode 工程 + CI workflow）。

下一步只需要：

1. 你给我一个 Codemagic 账号（或 GitHub 仓库），我把 workflow 配上去
2. 你有一台 iPhone，我用 Sideloadly 走一遍装包流程
3. 装上去之后，两端（安卓已通 + iOS）的兼容性验证就完整了

**如果这两样都没有**，iOS 这边只能停在「工程就绪 + 引擎级验证」，真机验收等条件具备再做。
---

## 八、本机网络实测（能不能用这些云服务）

| 服务 | 可达性 | 说明 |
|---|---|---|
| codemagic.io | **301**（可达） | 会跳转，正常 |
| expo.dev | **200** | 可达 |
| github.com | **200** | 可达（之前偶发 000，现在通） |
| api.github.com | **200** | 可达 |
| sideloadly.io | **200** | 可达 |

**结论：云构建 + Windows 侧载这条路，网络上是通的，不是纸上谈兵。**

## 九、Codemagic 官方支持 Capacitor（关键验证）

查到 Codemagic 官方文档有专门章节 **「Ionic Capacitor apps」**，
说明我们的技术栈是它的一等公民，不用自己拼 Xcode 命令。

已经把配置写好了：`app-ios/codemagic.yaml`

```
workflows:
  ios-capacitor:
    instance_type: mac_mini_m2        # M2 机器，构建快
    environment:
      node: 20
      xcode: latest
      ios_signing:
        distribution_type: development
        bundle_identifier: com.cokutau.csapp
    scripts:
      - 构建前端 (npm run build)
      - 同步进 iOS 工程 (npx cap sync ios)
      - pod install
      - 设置签名 (xcode-project use-profiles)
      - 编译打包 (xcode-project build-ipa)
    artifacts:
      - build/ios/ipa/*.ipa
```

**需要你在 Codemagic 后台配的东西**：

| 项 | 从哪来 |
|---|---|
| App Store Connect API Key | Apple 开发者后台 → Users and Access → Keys |
| 或 签名证书 + 描述文件 | Xcode 导出 .p12 + .mobileprovision |
| Bundle ID | com.cokutau.csapp（已配好） |

**云构建签名必须用付费开发者账号的证书**——免费 Apple ID 只能在本地用 Sideloadly 签。

## 十、修正：两条路线成本不同

重新梳理后，有个重要区别：

| 路线 | 构建 | 签名 | 需要付费账号？ | 需要 Mac？ |
|---|---|---|---|---|
| **Codemagic → Sideloadly** | 云端 | Windows 本地用免费 Apple ID | ❌ 不需要 | ❌ 不需要 |
| **Codemagic 云签名直接出 ipa** | 云端 | 云端 | ✅ 需要（$99） | ❌ 不需要 |
| 本地 Mac | 本地 | 本地 | ✅ 需要（真机一年期）或 免费（7天） | ✅ 需要 |

**最省钱的一条**：Codemagic 构建**不签名**的 ipa → 下载 → Sideloadly 用免费 Apple ID 签 → 装真机。
每 7 天重签一次，零成本。

**要正式发布/长期用**：还是得有 $99 账号。

## 十一、下一步要你提供的

| # | 需要什么 | 用在哪 |
|---|---|---|
| 1 | **一台 iPhone**（哪怕旧的） | 无 Mac 方案绕不开真机 |
| 2 | Codemagic 账号（可用 GitHub 登录） | 云端编译 |
| 3 | 或 GitHub 仓库（如果要走 Actions） | 备用云构建 |
| 4 | Apple ID（免费即可） | Sideloadly 签名 |

**这四样里最关键是 iPhone。** 没有真机，iOS 这块只能停在工程就绪。
---

# 第二轮调研：那四样能不能绕过？

## 结论：**能，而且只剩一样（而且是免费的）**

| # | 原来缺的 | 能否绕过 | 绕法 |
|---|---|---|---|
| 1 | 一台 iPhone | ✅ **能绕过** | Appetize.io —— 浏览器里跑 iOS 模拟器 |
| 2 | Codemagic 账号 | ✅ **能绕过** | GitHub Actions 公有仓库，免费无限 |
| 3 | GitHub 仓库 | ❌ **绕不开**（但免费） | 这是唯一剩下的门槛 |
| 4 | Apple ID | ✅ **能绕过** | 模拟器构建**不需要签名**，所以不需要 Apple ID |

**关键突破口：模拟器构建不签名。**

## 为什么模拟器构建不需要签名

iOS 有两类构建产物：

| 类型 | 命令 | 要不要签名 | 跑在哪 |
|---|---|---|---|
| **真机包 .ipa** | `-sdk iphoneos` | **必须签名**（要 Apple 账号） | 真 iPhone |
| **模拟器包 .app** | `-sdk iphonesimulator` | **不需要** | macOS 模拟器 |

模拟器是 macOS 上的一个进程，不做代码校验，所以不签名也能跑。

Appetize.io 提供的正是「云端 macOS + 模拟器 + 浏览器串流」，
它的官方文档明确写：

> Appetize currently only supports iOS Simulator builds (.app).
> AppStore distribution device builds (.ipa) are not currently supported.

**换句话说：它要的就是那个不需要签名的东西。**

## 三方证据链

### 1. GitHub Actions 公有仓库免费（官方文档原文）

> The use of standard GitHub-hosted runners is free: **In public repositories**

`macos-14` 是标准 runner，所以 macOS 构建在公有仓库里**免费且不限时长**。

### 2. Appetize 只吃模拟器包（官方文档原文）

> Appetize requires a .zip or .tar.gz file containing your compressed .app bundle.
> Appetize currently only supports iOS Simulator builds (.app).

### 3. Appetize 免费额度

| 档位 | 额度 |
|---|---|
| Free | **30 分钟/月**，每月重置 |
| 付费 | 500 分钟起，超出 $0.06/分钟 |

30 分钟够做完整的真机级验证（点几下、发几条消息、看渲染）。

## 完整链路（零成本）

```
Windows 写代码
   ↓  push 到公有 GitHub 仓库
GitHub Actions (macos-14) 跑 xcodebuild -sdk iphonesimulator
   ↓  产出 cs-app-simulator.zip（不签名）
下载 artifact 到 Windows
   ↓  上传到 appetize.io
浏览器里出现一台 iPhone，直接用鼠标点
```

**没有一个环节需要 Mac、iPhone 或 Apple 账号。**

## 这条路验证不了什么（诚实说）

| 项 | 为什么验不了 |
|---|---|
| 真实 WKWebView 容器行为 | 模拟器里也是 WKWebView，但和真机有细微差异（如 App-Bound Domains） |
| 真实键盘弹起高度 | 模拟器用软件键盘，高度和真机不同 |
| 真实安全区数值 | 模拟器的刘海/灵动岛是模拟的 |
| 性能表现 | 云端串流，测不出真机帧率 |
| 上架审核规则 | 只有走 App Store 才知道 |

**但对我们这次要验的「聊天页在 iOS 上能不能正常用」，足够了。**

## 和真机方案的对比

| | 模拟器方案（本轮找到） | 真机方案（上一轮） |
|---|---|---|
| 需要 iPhone | ❌ | ✅ |
| 需要 Apple ID | ❌ | ✅（免费即可） |
| 需要付费账号 | ❌ | ❌（7天重签） |
| 成本 | **0** | 0（但有硬件门槛） |
| 验证真实度 | 中（模拟器） | 高（真机） |
| 迭代速度 | 快（改完 push 就行） | 慢（每次要重签） |

**建议：先用模拟器方案跑通，真机验收等有设备再做。**

## 交付

| 文件 | 作用 |
|---|---|
| `.github-workflow-build-ios-simulator.yml` | GitHub Actions：编译模拟器包并上传 artifact |
| `codemagic.yaml` | Codemagic 备用（如果要云签名出 ipa） |
| `.github-workflow-build-ios.yml` | GitHub Actions：真机 ipa（要签名证书） |

## 现在只剩一件事要你配合

**给我一个 GitHub 账号，建一个 public 仓库，把代码推上去。**

这是唯一绕不开的——因为免费 macOS 编译机只有公有仓库才有。

如果代码不方便公开，两个折中：

| 方案 | 做法 | 代价 |
|---|---|---|
| 只公开壳工程 | 建一个只放 `app-ios/` 和 `web/` 的 public 仓库，不含后端 | 需要拆分代码 |
| 用私有仓库 + 付费 | 私有仓库 macOS 约 $0.08/分钟 | 一次构建约 $0.5 |
