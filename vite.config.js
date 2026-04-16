import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * 部署在子路径（如 Nginx location /nei_erp/）时，必须设置资源根路径，否则 CSS/JS/favicon 会 404。
 * 方式一：在项目根创建 .env.production，写入 VITE_BASE_PATH=/nei_erp/
 * 方式二：构建命令传参：npm run build -- --base /nei_erp/
 * 注意：子路径须以 / 开头且以 / 结尾，例如 /nei_erp/
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const raw = (env.VITE_BASE_PATH || '').trim()
  const base =
    raw && raw !== '/'
      ? raw.endsWith('/')
        ? raw
        : `${raw}/`
      : '/'

  return {
    base,
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      open: true,
    },
  }
})
