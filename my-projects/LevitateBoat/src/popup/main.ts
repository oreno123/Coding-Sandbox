import { createApp } from 'vue'
import App from './App.vue'
import '@/styles/index.css'
import { initializeTheme } from '@/styles/theme'

async function init() {
  try {
    await initializeTheme()
  } catch {
    /* ignore */
  }
  try {
    createApp(App).mount('#app')
  } catch (e) {
    document.body.innerHTML = `
      <div style="padding:16px;font-family:sans-serif;color:#333;">
        <p><strong>Levitate Boat 加载失败</strong></p>
        <p>请刷新侧边栏或重新加载扩展。若仍空白，请打开扩展管理页查看报错。</p>
        <pre style="font-size:12px;background:#f0f0f0;padding:8px;overflow:auto;">${(e as Error).message}</pre>
      </div>
    `
  }
}

init()
