import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import webExtension from 'vite-plugin-web-extension'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    webExtension({
      manifest: './manifest.json',
      watchFilePaths: ['src/**/*', 'public/**/*', 'manifest.json'],
      skipManifestValidation: true
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
