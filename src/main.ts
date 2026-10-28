import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './styles/global.css'
import './styles/antd.css'
import App from './App.vue'
import router from './router'
import { themeConfig } from './theme'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Antd)
app.config.globalProperties.$theme = themeConfig

// 全局错误兜底：避免单个组件渲染异常导致整页白屏无提示
app.config.errorHandler = (err, instance, info) => {
  const type = (instance as unknown as { type?: { name?: string; __name?: string } } | null)?.type
  console.error(`[CloudHub] ${info} @ ${type?.name ?? type?.__name ?? 'unknown'}`, err)
}

app.mount('#app')
