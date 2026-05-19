/**
 * PDF Translator Component
 * Upload and translate PDF documents
 */

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { extractTextFromPdf, splitPagesIntoSegments, mergeTranslatedSegments } from '../../shared/pdf-utils'
import { sendToBackground } from '../../shared/messaging'

interface PdfTranslatorProps {
  onClose: () => void
  onComplete: (result: string) => void
}

interface TranslationProgress {
  current: number
  total: number
  status: 'extracting' | 'translating' | 'complete' | 'error'
  error?: string
}

type ExportFormat = 'markdown' | 'txt'
type ExportContent = 'translated-only' | 'side-by-side'

export function PdfTranslator({ onClose, onComplete }: PdfTranslatorProps) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [preview, setPreview] = useState<{ original: string; translated: string } | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown')
  const [exportContent, setExportContent] = useState<ExportContent>('translated-only')
  const [translatedSegments, setTranslatedSegments] = useState<{ index: number; original: string; translated: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setProgress(null)
      setPreview(null)
    }
  }, [])

  const handleTranslate = useCallback(async () => {
    if (!file) return

    setProgress({ current: 0, total: 0, status: 'extracting' })

    try {
      // Step 1: Extract text from PDF
      const extractionResult = await extractTextFromPdf(file)
      
      if (!extractionResult.text.trim()) {
        setProgress({ current: 0, total: 0, status: 'error', error: 'PDF 中未检测到文本内容' })
        return
      }

      // Step 2: Split into segments (1000 chars per segment for better performance with xi-xu.me DeepLX)
      const segments = splitPagesIntoSegments(extractionResult.pages, 1000)
      
      setProgress({ current: 0, total: segments.length, status: 'translating' })

      // Step 3: Translate segments via background (with 60s timeout for long translations)
      const response = await sendToBackground<{
        success: boolean
        results?: { index: number; original: string; translated: string }[]
        error?: string
      }>({
        action: 'translatePdfSegments',
        segments: segments.map(s => ({ index: s.index, text: s.text })),
        targetLanguage: '中文',
      }, 60000)

      if (!response.success || !response.results) {
        throw new Error(response.error || 'Translation failed')
      }

      // Step 4: Merge results
      const mergedTranslation = mergeTranslatedSegments(response.results)
      
      setTranslatedSegments(response.results)
      setProgress({ current: segments.length, total: segments.length, status: 'complete' })
      setPreview({
        original: extractionResult.text.slice(0, 1000) + (extractionResult.text.length > 1000 ? '...' : ''),
        translated: mergedTranslation,
      })

      // Auto-complete after a short delay
      setTimeout(() => {
        onComplete(mergedTranslation)
      }, 1500)

    } catch (e) {
      setProgress({ 
        current: 0, 
        total: 0, 
        status: 'error', 
        error: (e as Error).message 
      })
    }
  }, [file, onComplete])

  const generateExportContent = useCallback(() => {
    if (!preview?.translated) return ''

    if (exportContent === 'translated-only') {
      return preview.translated
    }

    // Side-by-side format
    return translatedSegments.map((seg, i) => {
      return `## 段落 ${i + 1}\n\n**原文：**\n${seg.original}\n\n**译文：**\n${seg.translated}\n`
    }).join('\n---\n\n')
  }, [preview, translatedSegments, exportContent])

  const handleExport = useCallback(() => {
    const content = generateExportContent()
    if (!content) return

    const mimeType = exportFormat === 'markdown' ? 'text/markdown' : 'text/plain'
    const extension = exportFormat === 'markdown' ? 'md' : 'txt'
    
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${file?.name?.replace('.pdf', '') || 'translation'}_translated.${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [generateExportContent, exportFormat, file])

  const handleCopyToClipboard = useCallback(async () => {
    const content = generateExportContent()
    if (!content) return

    try {
      await navigator.clipboard.writeText(content)
      // Could show a toast here
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }, [generateExportContent])

  return (
    <motion.div
      className="pdf-translator-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="pdf-translator-modal"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
      >
        {/* Header */}
        <div className="pdf-translator-header">
          <h3>PDF 翻译</h3>
          <button className="pdf-translator-close" onClick={onClose}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="pdf-translator-content">
          {/* File upload area */}
          <div 
            className="pdf-upload-area"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="pdf-upload-icon">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            {file ? (
              <div className="pdf-file-info">
                <span className="pdf-file-name">{file.name}</span>
                <span className="pdf-file-size">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            ) : (
              <p className="pdf-upload-text">点击选择 PDF 文件</p>
            )}
          </div>

          {/* Progress */}
          <AnimatePresence>
            {progress && (
              <motion.div
                className="pdf-progress"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {progress.status === 'extracting' && (
                  <div className="pdf-progress-text">
                    <span className="pdf-progress-spinner" />
                    正在提取文本...
                  </div>
                )}
                {progress.status === 'translating' && (
                  <div className="pdf-progress-bar-container">
                    <div className="pdf-progress-bar">
                      <div 
                        className="pdf-progress-fill"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                    <span className="pdf-progress-text">
                      正在翻译 {progress.current}/{progress.total}
                    </span>
                  </div>
                )}
                {progress.status === 'complete' && (
                  <div className="pdf-progress-success">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    翻译完成！
                  </div>
                )}
                {progress.status === 'error' && (
                  <div className="pdf-progress-error">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {progress.error || '翻译失败'}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preview */}
          {preview && (
            <div className="pdf-preview">
              <div className="pdf-preview-header">
                <span>翻译结果预览</span>
                <div className="pdf-export-actions">
                  <button className="pdf-copy-btn" onClick={handleCopyToClipboard} title="复制到剪贴板">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    复制
                  </button>
                  <button className="pdf-export-btn" onClick={handleExport}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    导出
                  </button>
                </div>
              </div>
              
              {/* Export Options */}
              <div className="pdf-export-options">
                <div className="pdf-export-option">
                  <label>格式：</label>
                  <select 
                    value={exportFormat} 
                    onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  >
                    <option value="markdown">Markdown</option>
                    <option value="txt">纯文本</option>
                  </select>
                </div>
                <div className="pdf-export-option">
                  <label>内容：</label>
                  <select 
                    value={exportContent} 
                    onChange={(e) => setExportContent(e.target.value as ExportContent)}
                  >
                    <option value="translated-only">仅译文</option>
                    <option value="side-by-side">原文+译文对照</option>
                  </select>
                </div>
              </div>
              
              <div className="pdf-preview-content">
                {preview.translated.slice(0, 500)}...
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pdf-translator-footer">
          <button className="pdf-btn-secondary" onClick={onClose}>
            取消
          </button>
          <button 
            className="pdf-btn-primary"
            onClick={handleTranslate}
            disabled={!file || progress?.status === 'translating' || progress?.status === 'extracting'}
          >
            {progress?.status === 'translating' || progress?.status === 'extracting' 
              ? '翻译中...' 
              : '开始翻译'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
