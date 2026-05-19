/**
 * Composer Component
 * Cursor 风格的输入区域 - 统一卡片容器设计
 * 包含：文本输入区、底部工具栏（模式切换 + 功能图标）
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatContext } from '../../context/ChatContext'
import { useToast } from '../../context/ToastContext'
import { useChat } from '../../hooks/useChat'
import { usePromptTemplates } from '../../hooks/usePromptTemplates'
import { ContextPicker } from './ContextPicker'
import { AttachedContextBar } from './AttachedContextBar'
import { PromptTemplateManager } from './PromptTemplateManager'
import { BlockSelector } from '../BlockSelector'
import { WebpageHighlightRefsBar } from '../WebpageHighlightRefsBar'
import { ImageViewer } from '../ImageViewer'
// import { PdfTranslator } from '../PdfTranslator' // 暂时隐藏 PDF 翻译功能
import { onBackgroundMessage } from '../../../shared/messaging'
import type { AnyContextRef } from '../../../shared/context-types'
import type { BackgroundMessage, MessageItem, ResourceInfo } from '../../../shared/types'

export function Composer() {
  const {
    state,
    attachedContext,
    addContextRef,
    removeContextRef,
    clearContextRefs,
    resolveContextRef,
    activeConversation,
    dispatch,
    createNewConversation,
    stopResponse,
    // addMessage, // 暂时隐藏 PDF 翻译功能
  } = useChatContext()
  
  const { showToast } = useToast()
  
  const { sendMessages, isResponding, searchStatus } = useChat()
  const selectedBlocks = activeConversation?.selectedBlocks || []
  
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
  
  const [input, setInput] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  const [attachedImages, setAttachedImages] = useState<string[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  // const [pdfTranslatorOpen, setPdfTranslatorOpen] = useState(false) // 暂时隐藏 PDF 翻译功能

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  // 点击外部关闭 picker
  useEffect(() => {
    if (!pickerOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      // Context picker
      if (pickerOpen) {
        if (
          pickerRef.current?.contains(target) ||
          composerRef.current?.contains(target)
        ) {
          return;
        }
        setPickerOpen(false);
        setPickerQuery("");
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [pickerOpen]);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // 检查是否有待处理的问题（从翻译功能的"问 AI"按钮）
  useEffect(() => {
    const checkPendingQuestion = async () => {
      try {
        const result = await chrome.storage.session.get("pendingQuestion");
        if (result.pendingQuestion) {
          // 将问题填入输入框
          setInput(result.pendingQuestion);
          // 清空存储，避免重复填入
          await chrome.storage.session.remove("pendingQuestion");
          // 聚焦输入框
          textareaRef.current?.focus();
        }
      } catch (e) {
        console.error("[Composer] Failed to check pending question:", e);
      }
    };

    // 立即检查一次
    checkPendingQuestion();

    // 定期检查（每2秒检查一次）
    const interval = setInterval(checkPendingQuestion, 2000);

    return () => clearInterval(interval);
  }, []);

  // 处理 @ 触发
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);

      const cursorPos = textareaRef.current?.selectionStart || 0;
      const textBeforeCursor = value.slice(0, cursorPos);

      const atIndex = textBeforeCursor.lastIndexOf("@");

      if (atIndex !== -1) {
        const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : " ";
        if (charBefore === " " || charBefore === "\n" || atIndex === 0) {
          const queryAfterAt = textBeforeCursor.slice(atIndex + 1);
          if (!queryAfterAt.includes(" ")) {
            setPickerOpen(true);
            setPickerQuery(queryAfterAt);
            return;
          }
        }
      }

      if (pickerOpen) {
        setPickerOpen(false);
        setPickerQuery("");
      }
    },
    [pickerOpen],
  );

  // 选择上下文引用
  const handleSelectContext = useCallback(
    (ref: AnyContextRef) => {
      const isAlreadyAdded = attachedContext.refs.some((r) => r.id === ref.id);

      if (isAlreadyAdded) {
        removeContextRef(ref.id);
      } else {
        addContextRef(ref);
        resolveContextRef(ref);
      }

      // 简化逻辑：只关闭 picker，不再修改输入框内容
      setPickerOpen(false);
      setPickerQuery("");

      textareaRef.current?.focus();
    },
    [
      addContextRef,
      removeContextRef,
      resolveContextRef,
      attachedContext.refs,
    ],
  );

  // 关闭 picker
  const handleClosePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerQuery("");
    textareaRef.current?.focus();
  }, []);

  // 打开 @ picker（通过工具栏按钮）
  const handleOpenContextPicker = useCallback(() => {
    setPickerOpen(true);
    setPickerQuery("");
    textareaRef.current?.focus();
  }, []);

  // 区域截图：在页面拖拽选择区域后裁剪并附加
  const handleCaptureScreenshot = useCallback(async () => {
    if (isCapturing || isResponding) return;
    setIsCapturing(true);
    try {
      const res = await new Promise<{ success: boolean; dataUrl?: string; error?: string }>(
        (resolve) => {
          const timeout = setTimeout(() => {
            resolve({ success: false, error: "截图超时，请重试" });
          }, 60000);
          chrome.runtime.sendMessage(
            { action: "startRegionCapture" },
            (response: { success?: boolean; dataUrl?: string; error?: string } | undefined) => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else {
                resolve({
                  success: !!response?.success,
                  dataUrl: response?.dataUrl,
                  error: response?.error,
                });
              }
            }
          );
        }
      );
      if (res.success && res.dataUrl) {
        setAttachedImages((prev) => [...prev, res.dataUrl as string]);
        showToast("截图已附加", "success");
      } else {
        if (res.error && !res.error.includes("用户取消")) {
          showToast(res.error || "截图失败", "error");
        }
      }
    } catch (e) {
      showToast((e as Error).message || "截图失败", "error");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, isResponding, showToast]);

  // 移除已附加的截图
  const removeAttachedImage = useCallback((index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 发送消息
  const handleSend = useCallback(async () => {
    if ((!input.trim() && attachedImages.length === 0) || isResponding) return;

    // 使用纯净输入内容（不添加前缀）
    const userInput = input.trim() || "请描述或分析这张截图中的内容。";

    // 构建消息数组
    const messages: MessageItem[] = [];

    // 网页划线引用（当前选中文本，实时同步）
    const resourceInfos: ResourceInfo[] = [];
    try {
      const { currentSelection } = await chrome.storage.session.get("currentSelection");
      if (currentSelection?.text?.trim()) {
        resourceInfos.push({
          file_name: currentSelection.title || "网页选中文本",
          file_format: "text/plain",
          url: currentSelection.url,
          id: `selection-${Date.now()}`,
          content: currentSelection.text.trim(),
          type: "webpage_selection"
        });
      }
    } catch {
      /* ignore */
    }

    // 添加上下文引用
    if (attachedContext.refs.length > 0) {
      for (const ref of attachedContext.refs) {
        const content = attachedContext.resolvedContent[ref.id];
        resourceInfos.push({
          file_name: ref.title,
          file_format: "text/plain",
          url: ref.url,
          id: ref.id,
          content: content || "[Content not loaded]",
          type: ref.type,
          favicon: ref.favicon
        });
      }
    }

    // 如果有上下文引用，添加 context/reference 消息
    if (resourceInfos.length > 0) {
      messages.push({
        role: "user",
        mime_type: "context/reference",
        meta_data: {
          resource_infos: resourceInfos,
          ori_query: userInput
        }
      });
    }

    // 添加用户输入消息
    messages.push({
      role: "user",
      content: userInput,
      mime_type: "text/plain"
    });

    // 调用 sendMessages 发送消息数组（含 resource_infos 用于展示与多轮对话）
    sendMessages(messages, attachedImages.length > 0 ? attachedImages : undefined, resourceInfos);

    setInput("");
    clearContextRefs();
    setAttachedImages([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isResponding, attachedContext, attachedImages, sendMessages, clearContextRefs]);

  // 监听重新生成消息事件
  useEffect(() => {
    const handleRegenerate = (e: CustomEvent<{
      content: string;
      images?: string[];
      resource_infos?: ResourceInfo[];
    }>) => {
      // 直接发送，不经过输入框
      const messages: MessageItem[] = [];

      // 如果有 resource_infos，添加 context/reference 消息
      if (e.detail.resource_infos && e.detail.resource_infos.length > 0) {
        messages.push({
          role: "user",
          mime_type: "context/reference",
          meta_data: {
            resource_infos: e.detail.resource_infos,
            ori_query: e.detail.content
          }
        });
      }

      // 添加用户输入消息
      messages.push({
        role: "user",
        content: e.detail.content,
        mime_type: "text/plain"
      });

      // 直接发送
      sendMessages(messages, e.detail.images, e.detail.resource_infos);
    };

    window.addEventListener("regenerateMessage", handleRegenerate as EventListener);

    return () => {
      window.removeEventListener("regenerateMessage", handleRegenerate as EventListener);
    };
  }, [sendMessages]);

  // 键盘处理
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (pickerOpen) {
        if (["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)) {
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }

      if (e.key === "Escape" && !pickerOpen) {
        if (input) {
          setInput("");
        } else if (attachedContext.refs.length > 0) {
          clearContextRefs();
        } else if (attachedImages.length > 0) {
          setAttachedImages([]);
        }
      }
    },
    [
      pickerOpen,
      handleSend,
      input,
      attachedContext.refs.length,
      attachedImages.length,
      clearContextRefs,
    ],
  );

  // 优化提示词（流式输出）
  const handleOptimizePrompt = useCallback(() => {
    if (!input.trim() || isOptimizing || isResponding) return;

    setIsOptimizing(true);

    chrome.runtime.sendMessage({
      action: "optimizePrompt",
      input: input.trim(),
      systemPrompt: activeTemplate.content,
    });

    textareaRef.current?.focus();
  }, [input, isOptimizing, isResponding, activeTemplate.content]);

  // 监听提示词优化流式结果
  useEffect(() => {
    const unsubscribe = onBackgroundMessage((message: BackgroundMessage) => {
      if (message.action === "optimizePromptChunk") {
        setInput(message.content);
      }
      if (message.action === "optimizePromptEnd") {
        setIsOptimizing(false);
        if (message.error) {
          showToast(message.error, "error");
        } else if (message.content) {
          setInput(message.content);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = "auto";
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
            }
          }, 0);
        }
        textareaRef.current?.focus();
      }
    });
    return unsubscribe;
  }, [showToast]);

  // 选择模板
  const handleSelectTemplate = useCallback(
    async (templateId: string) => {
      await setDefaultTemplate(templateId);
    },
    [setDefaultTemplate],
  );

  return (
    <div className="composer-wrapper" ref={composerRef}>
      {/* 搜索状态 */}
      <AnimatePresence>
        {searchStatus && (
          <motion.div
            className="composer-status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className="composer-status-spinner" />
            <span>{searchStatus}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`composer-card composer-glass ${isFocused ? "focused" : ""} ${pickerOpen ? "picker-open" : ""}`}
      >
        {/* 网页划线引用 - 用户划线时显示，取消划线时消失 */}
        <WebpageHighlightRefsBar />

        {/* Block Selector - 记忆板块选择（UI 隐藏，代码保留） */}
        <div className="px-3 py-2 border-b border-[var(--border-primary)] hidden">
          <BlockSelector
            selectedBlocks={selectedBlocks}
            onChange={(blocks) =>
              dispatch({ type: "SET_SELECTED_BLOCKS", payload: blocks })
            }
          />
        </div>

        {/* Context Picker 弹出菜单 */}
        <ContextPicker
          ref={pickerRef}
          isOpen={pickerOpen}
          query={pickerQuery}
          selectedIds={attachedContext.refs.map((r) => r.id)}
          onSelect={handleSelectContext}
          onClose={handleClosePicker}
        />

        {/* 已附加的上下文 */}
        <AttachedContextBar
          refs={attachedContext.refs}
          resolvingIds={attachedContext.resolvingIds}
          onRemove={removeContextRef}
        />

        {/* 已附加的截图 */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-[var(--border-primary)]">
            {attachedImages.map((dataUrl, i) => (
              <div
                key={i}
                className="relative group rounded-lg overflow-hidden border border-[var(--border-primary)] w-16 h-16 flex-shrink-0"
              >
                <img
                  src={dataUrl}
                  alt={`截图 ${i + 1}`}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setViewingImage(dataUrl)}
                />
                <button
                  type="button"
                  className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeAttachedImage(i)}
                  aria-label="移除截图"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入区域 */}
        <div className="composer-input-wrapper">
          <textarea
            ref={textareaRef}
            className="composer-textarea"
            placeholder="Plan, @ for context, / for commands"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isResponding}
            rows={1}
          />
        </div>

        {/* 底部工具栏 */}
        <div className="composer-toolbar">
          <div className="composer-toolbar-left">
            <button
              className="composer-tool-btn"
              onClick={() => {
                createNewConversation()
                showToast('新对话已创建', 'success')
              }}
              title="新对话"
              type="button"
            >
              <NewChatIcon />
            </button>
          </div>
          <div className="composer-toolbar-right">
            {/* 截图按钮 */}
            <button
              className={`composer-tool-btn ${attachedImages.length > 0 ? "active" : ""}`}
              onClick={handleCaptureScreenshot}
              disabled={isCapturing || isResponding}
              title="选择区域截图并发送给 AI"
              type="button"
            >
              {isCapturing ? (
                <span className="composer-tool-spinner" />
              ) : (
                <ScreenshotIcon />
              )}
            </button>

            {/* @ Context 按钮 */}
            <button
              className="composer-tool-btn"
              onClick={handleOpenContextPicker}
              title="Add context (@)"
              type="button"
            >
              <AtIcon />
            </button>

            {/* 网络搜索按钮（toggle） */}
            <button
              className={`composer-tool-btn ${state.forceSearch ? "active" : ""} ${searchStatus ? "searching" : ""}`}
              onClick={() => {
                dispatch({
                  type: "SET_FORCE_SEARCH",
                  payload: !state.forceSearch,
                });
                textareaRef.current?.focus();
              }}
              title={
                state.forceSearch ? "Web search enabled" : "Enable web search"
              }
              type="button"
            >
              <GlobeIcon />
              {(state.forceSearch || searchStatus) && (
                <span className="search-indicator" />
              )}
            </button>
            
            {/* GitHub 搜索按钮（toggle，与联网搜索互斥） */}
            <button
              className={`composer-tool-btn ${state.forceGitHubSearch ? "active" : ""}`}
              onClick={() => {
                dispatch({
                  type: "SET_FORCE_GITHUB_SEARCH",
                  payload: !state.forceGitHubSearch,
                });
                textareaRef.current?.focus();
              }}
              title={
                state.forceGitHubSearch
                  ? "GitHub search enabled"
                  : "Enable GitHub search"
              }
              type="button"
            >
              <GitHubIcon />
              {state.forceGitHubSearch && (
                <span className="search-indicator" />
              )}
            </button>
            {/* PDF 翻译按钮 - 暂时隐藏
            <button
              className="composer-tool-btn"
              onClick={() => setPdfTranslatorOpen(true)}
              title="翻译 PDF 文件"
              type="button"
            >
              <PdfIcon />
            </button>
            */}

            {/* 优化提示词按钮 */}
            <button
              className={`composer-tool-btn ${isOptimizing ? "optimizing" : ""}`}
              onClick={handleOptimizePrompt}
              disabled={!input.trim() || isOptimizing || isResponding}
              title="优化提示词"
              type="button"
            >
              {isOptimizing ? (
                <span className="composer-tool-spinner" />
              ) : (
                <SparklesIcon />
              )}
            </button>

            {/* 发送 / 停止按钮 */}
            {isResponding ? (
              <button
                className="composer-stop-btn"
                onClick={stopResponse}
                aria-label="Stop generating"
                type="button"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                className="composer-send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
                aria-label="Send message"
                type="button"
              >
                <SendIcon />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 模板管理面板 */}
      <PromptTemplateManager
        isOpen={templateManagerOpen}
        templates={templates}
        activeTemplateId={activeTemplate.id}
        onClose={() => setTemplateManagerOpen(false)}
        onSelect={handleSelectTemplate}
        onAdd={async (name, content) => {
          return await addTemplate(name, content);
        }}
        onUpdate={async (id, updates) => {
          await updateTemplate(id, updates);
        }}
        onDelete={async (id) => {
          try {
            await deleteTemplate(id);
            showToast('模板已删除', 'success');
          } catch (e) {
            showToast((e as Error).message, 'error');
          }
        }}
        onDuplicate={async (id) => {
          await duplicateTemplate(id);
        }}
      />

      {/* PDF 翻译弹窗 - 暂时隐藏
      <AnimatePresence>
        {pdfTranslatorOpen && (
          <PdfTranslator
            onClose={() => setPdfTranslatorOpen(false)}
            onComplete={(result) => {
              setPdfTranslatorOpen(false)
              // Add translation result to chat
              addMessage({
                role: 'user',
                content: `PDF 翻译结果:\n\n${result.slice(0, 2000)}${result.length > 2000 ? '\n\n...(内容已截断)' : ''}`,
              })
              showToast('PDF 翻译完成', 'success')
            }}
          />
        )}
      </AnimatePresence>
      */}

      {/* 图片查看器 */}
      <AnimatePresence>
        {viewingImage && (
          <ImageViewer
            imageUrl={viewingImage}
            onClose={() => setViewingImage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ Icon Components ============

function ScreenshotIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 13v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2"
      />
    </svg>
  );
}

function AtIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  );
}


// PdfIcon - 暂时隐藏 PDF 翻译功能
/*
function PdfIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-6 4h6m-6-8h4" />
    </svg>
  )
}
*/

function NewChatIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}


function StopIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

