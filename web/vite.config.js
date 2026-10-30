import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

// 多入口构建：同一个工程产出三个独立页面。
// 为什么不用单页 + 路由：客服工作台和玩家聊天窗是两个完全不同的东西，
//   分开打包，玩家端不会把客服台的代码也下载下去。
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  build: {
    outDir: 'dist/html',
    rollupOptions: {
      input: {
        desk: resolve(__dirname, 'desk.html'),
        chat: resolve(__dirname, 'chat.html'),
        submit: resolve(__dirname, 'submit.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  },
  server: {
    port: 5180,
    proxy: {
      // 开发时把接口转发到后端，前端代码里不写死地址
      '/v1': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000'
    }
  }
})
