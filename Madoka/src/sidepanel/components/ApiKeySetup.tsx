/**
 * 登录页：首次使用或未配置 API Key 时，由用户自行填写通义千问 API Key
 */

import { useState } from 'react'
import { saveConfig } from '../../shared/messaging'

export function ApiKeySetup() {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setError('')

    const trimmedKey = apiKey.trim()

    if (!trimmedKey) {
      setError('请输入 API Key')
      return
    }

    if (!trimmedKey.startsWith('sk-')) {
      setError('API Key 格式不正确，应以 sk- 开头')
      return
    }

    if (trimmedKey.length < 20) {
      setError('API Key 长度不正确')
      return
    }

    setIsSaving(true)

    try {
      const result = await saveConfig({ apiKey: trimmedKey })
      if (result.success) {
        // 保存成功，刷新页面以重新加载配置
        window.location.reload()
      } else {
        setError('保存失败，请重试')
        setIsSaving(false)
      }
    } catch (e) {
      console.error('[ApiKeySetup] 保存失败:', e)
      setError('保存失败，请重试')
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-[var(--bg-primary)]">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            登录 Madoka
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            请使用您的通义千问 API Key 登录以使用 AI 功能
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 space-y-4 border border-[var(--border-primary)]">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              填写 API Key
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              请前往阿里云控制台获取 API Key 并粘贴到下方
            </p>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
              autoFocus
            />
            {error && (
              <div className="text-sm text-red-500">
                {error}
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-2.5 px-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '登录中...' : '登录'}
          </button>

          {/* Help Link */}
          <div className="text-center">
            <a
              href="https://dashscope.console.aliyun.com/apiKey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--accent-primary)] hover:underline"
            >
              如何获取 API Key？
            </a>
          </div>
        </div>

        {/* Tips */}
        <div className="text-xs text-[var(--text-tertiary)] space-y-1">
          <p>• API Key 仅存储在您的浏览器本地</p>
          <p>• 您可在设置中修改或清除 API Key（退出登录）</p>
        </div>
      </div>
    </div>
  )
}
