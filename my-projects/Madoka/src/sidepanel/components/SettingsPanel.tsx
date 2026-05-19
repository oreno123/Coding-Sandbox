/**
 * SettingsPanel Component
 * Settings configuration panel
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useChatContext } from "../context/ChatContext";
import { useSettings } from "../hooks/useSettings";
import { usePromptTemplates } from "../hooks/usePromptTemplates";
import { variants } from "../styles/animations";
import { ThemeSelector } from "./common/ThemeToggle";
import { PromptTemplateManager } from "./composer/PromptTemplateManager";
import { MCPSettings } from "./MCPSettings";
import { saveConfig } from "../../shared/messaging";
import { ConfigPanel } from "./memory/ConfigPanel";
import { UserProfilePanel } from "./memory/UserProfilePanel";
import { MemoryLibraryPanel } from "./memory/MemoryLibraryPanel";

const FONT_OPTIONS = [
  { value: 'system', label: '系统默认' },
  { value: 'sans', label: '无衬线体 (Sans-serif)' },
  { value: 'serif', label: '衬线体 (Serif)' },
  { value: 'mono', label: '等宽字体 (Monospace)' },
] as const
type FontOption = typeof
FONT_OPTIONS[number]['value']
const FONT_SIZE_OPTIONS = [
  {
    label: "小",
    value: "small",
    fontSize: "12px",
  },
  {
    label: "中",
    value: "medium",
    fontSize: "16px",
  },
  {
    label: "大",
    value: "large",
    fontSize: "20px",
  },
] as const
type FontSizeOption = typeof
FONT_SIZE_OPTIONS[number]['value']

type SettingsMemoryPage =
  | "general"
  | "memoryCfg"
  | "memoryProfile"
  | "memoryLibrary";

export function SettingsPanel() {
  const { setView } = useChatContext();
  const [memoryPage, setMemoryPage] = useState<SettingsMemoryPage>("general");
  const { config, loading, saving, saveStatus, updateConfig, save } =
    useSettings();
  const [selectedFont,setSelectedFont] = useState<FontOption>('system')
  const [selectedFontSize,setSelectedFontSize] = useState<FontSizeOption>('medium')
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  const [apiKeyEditing, setApiKeyEditing] = useState("")
  const [apiKeyShowMask, setApiKeyShowMask] = useState(true)
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<"idle" | "success" | "error">("idle")
  const [apiKeyError, setApiKeyError] = useState("")

  // 提示词模板管理
  const {
    templates,
    activeTemplate,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    duplicateTemplate,
  } = usePromptTemplates()

  // 应用字体到页面
  const applyFont = (font: FontOption, size: FontSizeOption) => {
    const fontMap = {
      system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      sans: 'Arial, Helvetica, "Microsoft YaHei", "PingFang SC", sans-serif',
      serif: 'Georgia, "Times New Roman", "SimSun", "Songti SC", serif',
      mono: 'Consolas, Monaco, "Courier New", "Microsoft YaHei Mono", monospace'
    }
    
    const sizeMap: Record<FontSizeOption, string> = {
      small: '14px',
      medium: '16px',
      large: '18px',
    }
    
    // 字体应用到 body，字号应用到 html 根元素（使 rem 单位生效，包括 AI 输出）
    document.body.style.fontFamily = fontMap[font]
    document.documentElement.style.fontSize = sizeMap[size] ?? '16px'
  }
  // 加载已保存的字体设置
  useEffect(() => {
    const loadFontSettings = async () => {
      try {
        const result = await chrome.storage.local.get(['fontFamily', 'fontSize'])
        const font = (result.fontFamily as FontOption) || 'system'
        const size = (result.fontSize as FontSizeOption) || 'medium'
        
        setSelectedFont(font)
        setSelectedFontSize(size)
        applyFont(font, size)
      } catch (error) {
        console.log('加载字体设置失败:', error)
      }
    }
    
    loadFontSettings()
  }, []) // 空数组表示只在组件加载时执行一次
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--bg-primary)]">
        <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
   
  return (
    <motion.div
      className="h-full min-h-0 bg-[var(--bg-primary)] flex flex-col"
      variants={variants.settingsPanel}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <motion.button
          className="p-2 -ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          onClick={() => setView("chat")}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </motion.button>
        <span className="font-semibold text-[var(--text-primary)] shrink-0">
          设置
        </span>
      </header>

      {/* 111 记忆模式：分栏 */}
      <div className="px-3 pt-2 pb-1 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] flex flex-wrap gap-1">
        {(
          [
            ["general", "常规"],
            ["memoryCfg", "记忆配置"],
            ["memoryProfile", "用户画像"],
            ["memoryLibrary", "记忆库"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMemoryPage(id)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              memoryPage === id
                ? "bg-[var(--accent-primary)] text-white"
                : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {memoryPage === "memoryCfg" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ConfigPanel
            onSwitchToMemoryTab={() => setMemoryPage("memoryLibrary")}
          />
        </div>
      )}

      {memoryPage === "memoryProfile" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <UserProfilePanel />
        </div>
      )}

      {memoryPage === "memoryLibrary" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MemoryLibraryPanel />
        </div>
      )}

      {/* Settings content */}
      {memoryPage === "general" && (
      <div className="flex-1 overflow-y-auto p-4 space-y-6 hide-scrollbar">
        {/* API / 登录 */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            API / 登录
          </h3>
          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] space-y-3">
            <div className="text-sm text-[var(--text-primary)]">
              {config.apiKey
                ? `已配置 ${apiKeyShowMask ? "sk-" + config.apiKey.slice(3, 7) + "****" : config.apiKey}`
                : "未配置"}
            </div>
            {config.apiKey && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setApiKeyShowMask((v) => !v)}
                  className="text-xs text-[var(--accent-primary)] hover:underline"
                >
                  {apiKeyShowMask ? "显示" : "隐藏"}
                </button>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs text-[var(--text-muted)]">修改 API Key</label>
              <input
                type="password"
                value={apiKeyEditing}
                onChange={(e) => {
                  setApiKeyEditing(e.target.value)
                  setApiKeyError("")
                  setApiKeySaveStatus("idle")
                }}
                placeholder="留空则不修改；输入新 Key 后点击保存"
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
              {apiKeyError && (
                <div className="text-xs text-red-500">{apiKeyError}</div>
              )}
              {apiKeySaveStatus === "success" && (
                <div className="text-xs text-green-600 dark:text-green-400">已保存</div>
              )}
              {apiKeySaveStatus === "error" && (
                <div className="text-xs text-red-500">保存失败</div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!apiKeyEditing.trim() || saving}
                  onClick={async () => {
                    const trimmed = apiKeyEditing.trim()
                    if (!trimmed) return
                    if (!trimmed.startsWith("sk-") || trimmed.length < 20) {
                      setApiKeyError("格式错误：应以 sk- 开头且长度足够")
                      return
                    }
                    setApiKeyError("")
                    const res = await saveConfig({ apiKey: trimmed })
                    if (res.success) {
                      updateConfig("apiKey", trimmed)
                      setApiKeyEditing("")
                      setApiKeySaveStatus("success")
                      setTimeout(() => setApiKeySaveStatus("idle"), 2000)
                    } else {
                      setApiKeySaveStatus("error")
                    }
                  }}
                  className="px-3 py-1.5 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存 Key
                </button>
              </div>
            </div>
            {config.apiKey && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("确定要清除 API Key 并退出登录吗？")) return
                  const res = await saveConfig({ apiKey: "" })
                  if (res.success) window.location.reload()
                }}
                className="text-sm text-[var(--text-muted)] hover:text-red-500"
              >
                清除并退出登录
              </button>
            )}
            <a
              href="https://dashscope.console.aliyun.com/apiKey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent-primary)] hover:underline block"
            >
              如何获取 API Key？
            </a>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Appearance
          </h3>

          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
            <div className="text-sm text-[var(--text-primary)] mb-2">Theme</div>
            <div className="text-xs text-[var(--text-muted)] mb-3">
              Choose your preferred color theme
            </div>
            <ThemeSelector />
          </div>
        </section>
        {/* Font Settings */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            字体设置
          </h3>

          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] space-y-4">
            {/* 字体类型选择 */}
            <div className="space-y-2">
              <label className="text-sm text-[var(--text-primary)]">
                字体类型
              </label>
              <select
                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                value={selectedFont}
                onChange={(e) => {
                  const newFont = e.target.value as FontOption
                  setSelectedFont(newFont)
                  chrome.storage.local.set({ fontFamily: newFont })
                  applyFont(newFont, selectedFontSize)
                }}
              >
                {FONT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 字体大小选择 */}
            <div className="space-y-2">
              <label className="text-sm text-[var(--text-primary)]">
                字体大小
              </label>
              <select
                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                value={selectedFontSize}
                onChange={(e) => {
                  const newSize = e.target.value as FontSizeOption
                  setSelectedFontSize(newSize)
                  chrome.storage.local.set({ fontSize: newSize })
                  applyFont(selectedFont, newSize)
                }}
              >
                {FONT_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
        {/* Search Settings */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Search Settings
          </h3>

          {/* Default search engine */}
          <div className="space-y-2">
            <label className="text-sm text-[var(--text-primary)]">
              Default Search Engine
            </label>
            <div className="flex gap-2">
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  config.searchEngine === "bing"
                    ? "bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-md shadow-[var(--accent-primary)]/20"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]"
                }`}
                onClick={() => updateConfig("searchEngine", "bing")}
              >
                Bing
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  config.searchEngine === "google"
                    ? "bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-md shadow-[var(--accent-primary)]/20"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]"
                }`}
                onClick={() => updateConfig("searchEngine", "google")}
              >
                Google
              </button>
            </div>
          </div>

          {/* Multi-round search rounds */}
          <div className="space-y-2 mt-4">
            <label className="text-sm text-[var(--text-primary)]">
              Multi-round Search Rounds
            </label>
            <select
              className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
              value={config.defaultSearchRounds}
              onChange={(e) =>
                updateConfig("defaultSearchRounds", parseInt(e.target.value))
              }
            >
              <option value={1}>1 轮（单轮）</option>
              <option value={2}>2 轮</option>
              <option value={3}>3 轮（默认）</option>
            </select>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              越多轮数获取结果越全面，但耗时更久
            </div>
          </div>
        </section>

        {/* MCP 服务 */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            MCP 服务
          </h3>
          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
            <MCPSettings />
          </div>
        </section>

        {/* Prompt Templates */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            提示词模板
          </h3>

          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-[var(--text-primary)]">
                  当前模板
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {activeTemplate?.name || "默认模板"}
                </div>
              </div>
              <motion.button
                className="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-xs font-medium rounded-lg"
                onClick={() => setTemplateManagerOpen(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                管理模板
              </motion.button>
            </div>
          </div>
        </section>
      </div>
      )}

      {/* Save button */}
      {memoryPage === "general" && (
      <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <motion.button
          className="w-full py-2.5 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white text-sm font-semibold rounded-xl disabled:opacity-50 gradient-flow"
          onClick={save}
          disabled={saving}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </motion.button>

        {/* Status message */}
        {saveStatus !== "idle" && (
          <motion.div
            className={`mt-2 text-center text-xs ${
              saveStatus === "success"
                ? "text-[var(--accent-success)]"
                : "text-[var(--accent-danger)]"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {saveStatus === "success" ? "✓ Settings saved" : "✕ Failed to save"}
          </motion.div>
        )}
      </div>
      )}

      {/* 模板管理面板 */}
      <PromptTemplateManager
        isOpen={templateManagerOpen}
        templates={templates}
        activeTemplateId={activeTemplate.id}
        onClose={() => setTemplateManagerOpen(false)}
        onSelect={async (id) => {
          await setDefaultTemplate(id);
        }}
        onAdd={async (name, content) => {
          return await addTemplate(name, content);
        }}
        onUpdate={async (id, updates) => {
          await updateTemplate(id, updates);
        }}
        onDelete={async (id) => {
          await deleteTemplate(id);
        }}
        onDuplicate={async (id) => {
          await duplicateTemplate(id);
        }}
      />
    </motion.div>
  );
}
