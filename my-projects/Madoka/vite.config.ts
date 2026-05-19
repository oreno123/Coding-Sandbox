/// <reference types="node" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json'
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

// 递归复制目录的辅助函数
function copyDirSync(src: string, dest: string) {
  if (!existsSync(src)) return
  
  mkdirSync(dest, { recursive: true })
  const entries = readdirSync(src)
  
  for (const entry of entries) {
    const srcPath = join(src, entry)
    const destPath = join(dest, entry)
    const stat = statSync(srcPath)
    
    if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    {
      name: 'copy-viewer-config',
      closeBundle() {
        // 确保 viewer-config.js 被复制到 dist
        const src = resolve(__dirname, 'public/pdfjs/web/viewer-config.js')
        const dest = resolve(__dirname, 'dist/public/pdfjs/web/viewer-config.js')
        try {
          mkdirSync(resolve(__dirname, 'dist/public/pdfjs/web'), { recursive: true })
          copyFileSync(src, dest)
          console.log('✓ viewer-config.js copied to dist')
        } catch (e) {
          console.error('Failed to copy viewer-config.js:', e)
        }

        // 复制 locale 语言目录到正确的位置
        const localeSrc = resolve(__dirname, 'dist/pdfjs/web/locale')
        const localeDest = resolve(__dirname, 'dist/public/pdfjs/web/locale')
        try {
          if (existsSync(localeSrc)) {
            // 使用递归复制函数
            copyDirSync(localeSrc, localeDest)
            console.log('✓ locale directories copied to dist/public/pdfjs/web/locale')
          }
        } catch (e) {
          console.error('Failed to copy locale directories:', e)
        }
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
})
