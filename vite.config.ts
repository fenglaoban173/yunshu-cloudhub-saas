import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  // 相对路径产物：同一份构建既能跑在本地根路径，也能直接部署到
  // GitHub Pages（https://<user>.github.io/<repo>/）或任意子目录。
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5273,
    host: '127.0.0.1',
  },
})
