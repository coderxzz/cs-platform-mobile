# iOS 出包：实测结果与操作步骤

## 一、已经跑通的事实

**GitHub Actions 在免费的 macOS runner 上成功编译出了 iOS 包。**

| 项 | 结果 |
|---|---|
| 仓库 | https://github.com/coderxzz/cs-platform-mobile |
| 运行 | #40999814814，commit b701a65 |
| 状态 | **success**（13 个步骤全过） |
| 产物 | ios-simulator-app，**1,535,599 字节**（约 1.5 MB） |
| 耗时 | **约 2 分钟** |
| 花费 | **0 元**（公有仓库免费） |

这条链路已经实测可用，不是理论方案。

---

## 二、修复过程中发现的 4 个真问题

这些问题只有真跑 CI 才会暴露：

| # | 问题 | 现象 | 修法 |
|---|---|---|---|
| 1 | app-ios/ios/ 没提交 | cap sync 找不到 iOS 平台 | 补上工程目录（排除 Pods/build） |
| 2 | **没有共享 scheme** | xcodebuild -scheme App 找不到 | 手写 App.xcscheme（含 target UUID） |
| 3 | **空 workspace 提交进去了** | -workspace App.xcworkspace 无效 | 删掉，让 pod install 生成 |
| 4 | **缺 index.html** | cap sync 报 must contain an index.html | 补启动页，CI 里拷成 index.html |

**第 4 个是最终卡住的那个**——前端构建产物是 chat/desk/admin/submit 四个页面，Capacitor 必须要有 index.html 作入口。

---

## 三、你现在要做的（两步）

### 第一步：下载产物

打开（需要登录 GitHub）：

```
https://github.com/coderxzz/cs-platform-mobile/actions/runs/40999814814
```

页面底部 **Artifacts** → 点 **ios-simulator-app** 下载。得到一个 zip，里面是 App.app。

> 命令行下载会返回 401，必须用浏览器（已登录状态）。

### 第二步：上传到 Appetize

1. 打开 https://appetize.io
2. 注册（免费档：**每月 30 分钟**）
3. 点 Upload，选刚才那个 zip
4. 选一台 iPhone（推荐 iPhone 14 / 15）
5. 点 Run

**浏览器里会出现一台 iPhone，鼠标直接点就能操作。**

---

## 四、进去之后怎么验

启动页会显示「正在连接客服…」——这是正常的，因为没带身份参数。

### 办法 A：带参数打开（验聊天）

在 Appetize 的应用设置里找到 Launch URL，填：

```
chat.html?app_id=app_aa5f6f3147144a1ca9f3&role_id=999001&ts=<时间戳>&sign=<签名>
```

签名从后端拿：

```bash
curl "http://<你的后端>/v1/embed/sign?app_id=app_aa5f6f3147144a1ca9f3&role_id=999001"
```

### 办法 B：先验证壳本身

不带参数也能验证这四点：

| 能验什么 | 说明 |
|---|---|
| App 能启动 | 不闪退 |
| 启动页渲染 | 文字、转圈动画、深色底 |
| 安全区适配 | 刘海/灵动岛不遮挡内容 |
| 字体渲染 | 中文不出方块 |

---

## 五、这条路验证不了什么

| 项 | 为什么 |
|---|---|
| 真实 WKWebView 容器行为 | 模拟器的 WebView 和真机有细微差异 |
| 真实键盘弹起高度 | 模拟器用软件键盘 |
| 真实安全区数值 | 刘海是模拟的 |
| 性能表现 | 云端串流，测不出帧率 |
| 上架审核 | 要真走 App Store 才知道 |

**但「聊天页在 iOS 上能不能用」这件事，够了。**

---

## 六、CI 配置要点

```yaml
runs-on: macos-14          # 标准 runner，公有仓库免费

# 关键：必须不签名，否则要 Apple 账号
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -sdk iphonesimulator \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build
```

**三个 CODE_SIGN 参数缺一不可**，少一个就会去找证书然后失败。

---

## 七、如果需要真机包（.ipa）

真机 workflow 已移到 ci-optional/build-ios-device.yml，**不会自动触发**。

它需要：

| 项 | 从哪来 |
|---|---|
| Apple 开发者账号 | $99/年 |
| 签名证书 .p12 | Xcode 导出 |
| 描述文件 .mobileprovision | Apple 开发者后台 |
| Team ID | 开发者后台 |

没有这些，那个 workflow 一定失败——所以放在 ci-optional/ 里当备查。

---

## 八、时间线（实际发生的）

| 时间 | 事件 |
|---|---|
| 推第一版 | CI 失败：找不到 iOS 平台 |
| 补 ios/ 目录 | CI 失败：找不到 scheme |
| 补 scheme + 删空 workspace | CI 失败：缺 index.html |
| 补 index.html | **CI 成功，产出 1.5 MB 包** |

**失败 5 次，第 6 次成功。每次都是真问题，不是配置猜错。**