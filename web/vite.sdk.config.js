import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// JSSDK 构建：产出一个 IIFE，宿主页面引一个 script 就能嵌入聊天窗。
// 和 HTML 版的区别：HTML 版独占一个页面，SDK 版是注入到别人的页面里。
export default defineConfig({
  build: {
    outDir: 'dist/sdk',
    lib: {
      entry: resolve(__dirname, 'src/sdk/index.js'),
      name: 'CsSdk',
      formats: ['iife'],
      fileName: () => 'cs-sdk.js'
    },
    rollupOptions: {
      output: { extend: true }
    },
    // SDK 要内联样式，不能依赖外部 css 文件
    cssCodeSplit: false
  }
})
