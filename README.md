# 客服平台 · 移动端壳工程

安卓 / iOS 两个原生壳，用 WebView 加载客服聊天页。

## 这个仓库是干什么的

公司客服平台的**移动端包装层**。业务逻辑和界面在 Web 层，这里只负责：

- 安卓：一个 Activity + WebView
- iOS：Capacitor 壳 + WKWebView
- CI：云端 macOS 编译出 iOS 包（Windows 上没有 Xcode）

## 目录

```
web/            Vue3 前端（聊天 / 工单 / 客服台）
app-android/    安卓壳（源码，APK 和签名文件不在此仓库）
app-ios/        iOS 壳（Capacitor 工程 + 调研文档）
.github/        CI 工作流
```

## 为什么 iOS 需要云端编译

Windows 上没有 Xcode，无法编译 iOS。三条路：

| 方案 | 说明 |
|---|---|
| **GitHub Actions**（本仓库已配） | 公有仓库标准 runner 免费，跑 `macos-14` 出模拟器包 |
| Codemagic | 需要付费开发者证书才能云签名 |
| 真机 Mac | 最直接 |

## 两条 iOS 构建流水线

| 工作流 | 产出 | 要签名吗 | 用途 |
|---|---|---|---|
| `build-ios-simulator.yml` | `.app` 模拟器包 | **不要** | 上传 Appetize.io 在浏览器里测 |
| `build-ios-device.yml` | `.ipa` 真机包 | 要（Apple 账号） | 装真机 |

**模拟器构建不签名**——所以不需要 Apple ID、不需要开发者账号、不需要 iPhone。
这是本项目验证 iOS 兼容性的主路径。

## 安卓

源码在 `app-android/`，用 SDK build-tools 手工打包（不依赖 Gradle）：

```bash
# 需要 ANDROID_HOME 指向 Android SDK
aapt2 link -I $ANDROID_HOME/platforms/android-36/android.jar \
  --manifest AndroidManifest.xml -o build/base.apk --java build/gen
javac -source 8 -target 8 -bootclasspath $ANDROID_HOME/platforms/android-36/android.jar \
  -d build/classes $(find java build/gen -name "*.java")
d8 --lib $ANDROID_HOME/platforms/android-36/android.jar --output build/dex \
  $(find build/classes -name "*.class") --min-api 21
# 打 zip + zipalign + apksigner
```

## 前端

```bash
cd web
npm install
npm run build        # 出 dist/html（4 个页面）+ dist/sdk（JSSDK）
npm run dev          # 开发模式，接口代理到 localhost:8000
```

## 两端测试

```bash
# 安卓：连上模拟器/真机后跑（走 CDP）
cd web && node test-android.cjs

# iOS：WebKit 引擎级验证（不需要 Mac）
cd web && node test-ios.cjs
```

## 后端不在此仓库

后端是独立服务，单独部署。这个仓库只包含移动端壳和 Web 前端。
