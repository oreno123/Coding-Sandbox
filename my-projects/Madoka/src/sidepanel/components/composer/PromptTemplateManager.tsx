/**
 * PromptTemplateManager Component
 * 全屏系统指令管理界面 - Google AI Studio 风格
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PromptTemplate } from '../../../shared/prompt-templates'

interface PromptTemplateManagerProps {
  isOpen: boolean
  templates: PromptTemplate[]
  activeTemplateId: string
  onClose: () => void
  onSelect: (id: string) => void
  onAdd: (name: string, content: string) => Promise<PromptTemplate | void>
  onUpdate: (id: string, updates: { name?: string; content?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
}

export function PromptTemplateManager({
  isOpen,
  templates,
  activeTemplateId,
  onClose,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onDuplicate,
}: PromptTemplateManagerProps) {
  // 当前选中编辑的模板
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(activeTemplateId)
  const [localName, setLocalName] = useState('')
  const [localContent, setLocalContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 获取当前选中的模板
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0]

  // 同步选中模板数据到本地状态
  useEffect(() => {
    if (selectedTemplate) {
      setLocalName(selectedTemplate.name)
      setLocalContent(selectedTemplate.content)
      setSaveStatus('saved')
    }
  }, [selectedTemplate])

  // 打开时同步激活模板
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplateId(activeTemplateId)
    }
  }, [isOpen, activeTemplateId])

  // 点击外部关闭下拉框
  useEffect(() => {
    if (!dropdownOpen) return
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // 自动保存（防抖 500ms）
  const triggerAutoSave = useCallback(async (name: string, content: string) => {
    if (!selectedTemplate || selectedTemplate.isBuiltIn) return
    
    setSaveStatus('saving')
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onUpdate(selectedTemplate.id, { name, content })
        setSaveStatus('saved')
      } catch (e) {
        console.error('[PromptTemplateManager] Auto-save failed:', e)
        setSaveStatus('unsaved')
      }
    }, 500)
  }, [selectedTemplate, onUpdate])

  // 清理计时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // 处理名称变更
  const handleNameChange = useCallback((value: string) => {
    setLocalName(value)
    setSaveStatus('unsaved')
    triggerAutoSave(value, localContent)
  }, [localContent, triggerAutoSave])

  // 处理内容变更
  const handleContentChange = useCallback((value: string) => {
    setLocalContent(value)
    setSaveStatus('unsaved')
    triggerAutoSave(localName, value)
  }, [localName, triggerAutoSave])

  // 切换模板
  const handleSelectTemplate = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId)
    onSelect(templateId)
    setDropdownOpen(false)
  }, [onSelect])

  // 删除模板
  const handleDelete = useCallback(async () => {
    if (!selectedTemplate || selectedTemplate.isBuiltIn) return
    
    if (!confirm(`确定删除模板 "${selectedTemplate.name}" 吗？`)) {
      return
    }

    // 清除待执行的自动保存，避免删除后误将已删模板写回
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    
    try {
      await onDelete(selectedTemplate.id)
      // 删除后选中剩余模板中的第一个（仅更新本地选中状态，不调用 onSelect 避免 setDefaultTemplate 用旧数据覆盖 deleteTemplate 的更新）
      const remainingTemplates = templates.filter((t) => t.id !== selectedTemplate.id)
      if (remainingTemplates.length > 0) {
        const nextTemplate = remainingTemplates[0]
        setSelectedTemplateId(nextTemplate.id)
      }
    } catch (e) {
      console.error('[PromptTemplateManager] Delete failed:', e)
      throw e
    }
  }, [selectedTemplate, templates, onDelete])

  // 新建模板
  const handleCreateNew = useCallback(async () => {
    try {
      const newTemplate = await onAdd('New Template', '# Role\nYou are a helpful assistant.\n\n# Task\nDescribe your task here.')
      if (newTemplate) {
        setSelectedTemplateId(newTemplate.id)
      }
    } catch (e) {
      console.error('[PromptTemplateManager] Create failed:', e)
    }
    setDropdownOpen(false)
  }, [onAdd])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="w-full max-w-[720px] max-h-[85vh] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] shadow-2xl flex flex-col overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">System instructions</h1>
            <div className="flex items-center gap-3">
              <span className={`text-xs ${
                saveStatus === 'saved' ? 'text-[var(--accent-success)]' : 
                saveStatus === 'unsaved' ? 'text-[var(--accent-danger)]' : 
                'text-[var(--text-muted)]'
              }`}>
                {saveStatus === 'saved' && 'Saved'}
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'unsaved' && 'Unsaved'}
              </span>
              <button 
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                onClick={onClose}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>
          </header>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Template Selector Dropdown */}
            <div className="relative">
              <div className="relative" ref={dropdownRef}>
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-left hover:border-[var(--border-focus)] transition-colors"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <span className="text-[var(--text-primary)]">{selectedTemplate?.name || 'Select template'}</span>
                  <ChevronDownIcon isOpen={dropdownOpen} />
                </button>
                
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-lg overflow-hidden z-10 themed-scrollbar max-h-64 overflow-y-auto"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors ${
                            template.id === selectedTemplateId ? 'bg-[var(--bg-tertiary)]' : ''
                          }`}
                          onClick={() => handleSelectTemplate(template.id)}
                        >
                          <span className="text-[var(--text-primary)]">{template.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              template.isBuiltIn 
                                ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' 
                                : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                            }`}>
                              {template.isBuiltIn ? 'Built-in' : 'Custom'}
                            </span>
                            {template.id === selectedTemplateId && <CheckIcon />}
                          </div>
                        </button>
                      ))}
                      <div className="border-t border-[var(--border-primary)]" />
                      <button
                        className="w-full flex items-center px-4 py-2.5 text-left text-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                        onClick={handleCreateNew}
                      >
                        <span>+ New Template</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Template Name Input */}
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-4 py-2.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all placeholder:text-[var(--text-muted)] disabled:opacity-50"
                value={localName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Template name"
                disabled={selectedTemplate?.isBuiltIn}
              />
              {!selectedTemplate?.isBuiltIn && (
                <button
                  className="px-3 py-2.5 bg-[var(--bg-tertiary)] text-[var(--accent-danger)] border border-[var(--border-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={handleDelete}
                  title="Delete template"
                >
                  <TrashIcon />
                </button>
              )}
            </div>

            {/* System Prompt Textarea */}
            <div className="flex-1 min-h-[300px]">
              <textarea
                className="w-full h-full min-h-[300px] px-4 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all resize-none themed-scrollbar placeholder:text-[var(--text-muted)] disabled:opacity-50"
                value={localContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Enter your system instructions here..."
                disabled={selectedTemplate?.isBuiltIn}
                spellCheck={false}
              />
            </div>

            {/* Built-in Template Notice */}
            {selectedTemplate?.isBuiltIn && (
              <div className="text-sm text-[var(--text-muted)]">
                <span>Built-in templates cannot be edited. </span>
                <button
                  className="text-[var(--accent-primary)] hover:underline"
                  onClick={() => {
                    onDuplicate(selectedTemplate.id)
                    setDropdownOpen(false)
                  }}
                >
                  Duplicate to create a custom version
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-center gap-2 px-6 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <span className="text-xs text-[var(--text-muted)]">Instructions are saved in local storage.</span>
            <span className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ============ Icon Components ============

function XIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg 
      className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
      width="16" 
      height="16" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-[var(--accent-primary)]" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
