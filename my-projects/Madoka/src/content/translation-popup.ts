/**
 * Translation Popup - 划词翻译浮动弹窗
 * 选中文本后显示翻译结果，支持固定弹窗
 * 支持三种主题：Light / Dark / Cyber
 */

export interface TranslationPopupOptions {
  originalText: string;
  translatedText?: string;
  error?: string;
  rect?: DOMRect;
  isLoading?: boolean;
}

type Theme = "light" | "dark" | "cyber" | "neon";

interface ThemeStyles {
  bg: string;
  headerGradient: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  originalBg: string;
  originalBorder: string;
  originalLabelColor: string;
  translatedBg: string;
  translatedBorder: string;
  translatedLabelColor: string;
  buttonPrimary: string;
  buttonSecondary: string;
  buttonSecondaryText: string;
  buttonSecondaryBorder: string;
  borderColor: string;
  overlayBg: string;
  loadingSpinnerBorder: string;
  loadingSpinnerTop: string;
  errorBg: string;
  errorColor: string;
  errorBtnGradient: string;
  neonShadow?: string;
  neonBorder?: string;
}

const THEME_STYLES: Record<Theme, ThemeStyles> = {
  light: {
    bg: "#ffffff",
    headerGradient:
      "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
    textPrimary: "#1a1a1a",
    textSecondary: "#4b5563",
    textMuted: "#9ca3af",
    originalBg: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
    originalBorder: "#e2e8f0",
    originalLabelColor: "#64748b",
    translatedBg: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
    translatedBorder: "#c4b5fd",
    translatedLabelColor: "#7c3aed",
    buttonPrimary: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    buttonSecondary: "#fff",
    buttonSecondaryText: "#7c3aed",
    buttonSecondaryBorder: "#c4b5fd",
    borderColor: "rgba(255, 255, 255, 0.2)",
    overlayBg: "rgba(0, 0, 0, 0.5)",
    loadingSpinnerBorder: "#e5e7eb",
    loadingSpinnerTop: "#667eea",
    errorBg: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
    errorColor: "#dc2626",
    errorBtnGradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
  },
  dark: {
    bg: "#1e1e1e",
    headerGradient:
      "linear-gradient(135deg, #3b82f6 0%, #4f46e5 50%, #6366f1 100%)",
    textPrimary: "#e0e0e0",
    textSecondary: "#a0a0a0",
    textMuted: "#6b7280",
    originalBg: "linear-gradient(135deg, #2d2d2d 0%, #252526 100%)",
    originalBorder: "#404040",
    originalLabelColor: "#9ca3af",
    translatedBg: "linear-gradient(135deg, #1e3a5f 0%, #172554 100%)",
    translatedBorder: "#1e40af",
    translatedLabelColor: "#60a5fa",
    buttonPrimary: "linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)",
    buttonSecondary: "#2d2d2d",
    buttonSecondaryText: "#60a5fa",
    buttonSecondaryBorder: "#3b82f6",
    borderColor: "rgba(255, 255, 255, 0.1)",
    overlayBg: "rgba(0, 0, 0, 0.7)",
    loadingSpinnerBorder: "#3c3c3c",
    loadingSpinnerTop: "#3b82f6",
    errorBg: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
    errorColor: "#f87171",
    errorBtnGradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
  },
  cyber: {
    bg: "#1A0B2E",
    headerGradient:
      "linear-gradient(135deg, #FF4D8D 0%, #FF2E63 50%, #00F0FF 100%)",
    textPrimary: "#F0F0FF",
    textSecondary: "#B8B8D0",
    textMuted: "#8888A0",
    originalBg: "linear-gradient(135deg, #2D1B4E 0%, #3D2B5E 100%)",
    originalBorder: "rgba(255, 77, 141, 0.3)",
    originalLabelColor: "#FF4D8D",
    translatedBg: "linear-gradient(135deg, #1A3A5F 0%, #0A2A4F 100%)",
    translatedBorder: "rgba(0, 240, 255, 0.3)",
    translatedLabelColor: "#00F0FF",
    buttonPrimary: "linear-gradient(135deg, #FF4D8D 0%, #FF2E63 100%)",
    buttonSecondary: "transparent",
    buttonSecondaryText: "#00F0FF",
    buttonSecondaryBorder: "#00F0FF",
    borderColor: "rgba(0, 240, 255, 0.2)",
    overlayBg: "rgba(26, 11, 46, 0.85)",
    loadingSpinnerBorder: "rgba(255, 77, 141, 0.3)",
    loadingSpinnerTop: "#FF4D8D",
    errorBg: "linear-gradient(135deg, #450a15 0%, #7f1d30 100%)",
    errorColor: "#FF4D6D",
    errorBtnGradient: "linear-gradient(135deg, #FF4D6D 0%, #FF2E4F 100%)",
    neonShadow:
      "0 0 30px rgba(255, 77, 141, 0.4), 0 0 60px rgba(0, 240, 255, 0.2)",
    neonBorder: "1px solid rgba(0, 240, 255, 0.3)",
  },
  neon: {
    bg: "#0A0B10",
    headerGradient:
      "linear-gradient(135deg, #00A3FF 0%, #6B46C1 50%, #39FF14 100%)",
    textPrimary: "#E0E0E6",
    textSecondary: "#A0A0A5",
    textMuted: "#5C5C66",
    originalBg: "linear-gradient(135deg, #12141A 0%, #1A1D26 100%)",
    originalBorder: "rgba(0, 163, 255, 0.2)",
    originalLabelColor: "#00A3FF",
    translatedBg: "linear-gradient(135deg, #0D1A2A 0%, #0A1220 100%)",
    translatedBorder: "rgba(57, 255, 20, 0.2)",
    translatedLabelColor: "#39FF14",
    buttonPrimary: "linear-gradient(135deg, #00A3FF 0%, #0070CC 100%)",
    buttonSecondary: "transparent",
    buttonSecondaryText: "#6B46C1",
    buttonSecondaryBorder: "#6B46C1",
    borderColor: "rgba(0, 163, 255, 0.15)",
    overlayBg: "rgba(10, 11, 16, 0.85)",
    loadingSpinnerBorder: "rgba(0, 163, 255, 0.2)",
    loadingSpinnerTop: "#00A3FF",
    errorBg: "linear-gradient(135deg, #1A0505 0%, #330808 100%)",
    errorColor: "#FF3333",
    errorBtnGradient: "linear-gradient(135deg, #FF3333 0%, #CC0000 100%)",
    neonShadow:
      "0 0 30px rgba(0, 163, 255, 0.3), 0 0 60px rgba(107, 70, 193, 0.15)",
    neonBorder: "1px solid rgba(0, 163, 255, 0.2)",
  },
};

export class TranslationPopup {
  private popup: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private isOpen = false;
  private isPinned = false;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private currentTheme: Theme = "light";

  private startDragHandler: ((e: Event) => void) | null = null;
  private doDragHandler: ((e: Event) => void) | null = null;
  private stopDragHandler: (() => void) | null = null;

  public justFinishedDragging = false;

  constructor() {
    this.loadTheme();
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.theme) {
        this.currentTheme = changes.theme.newValue as Theme;
        if (this.isOpen) {
          this.updatePopupTheme();
        }
      }
    });
  }

  private async loadTheme(): Promise<void> {
    try {
      const result = await chrome.storage.local.get("theme");
      this.currentTheme = (result.theme as Theme) || "light";
    } catch {
      this.currentTheme = "light";
    }
  }

  private getThemeStyles(): ThemeStyles {
    return THEME_STYLES[this.currentTheme];
  }

  show(options: TranslationPopupOptions): void {
    if (this.isOpen) {
      this.close();
    }

    this.isOpen = true;
    this.isPinned = false;
    const styles = this.getThemeStyles();

    this.overlay = document.createElement("div");
    this.overlay.id = "madoka-translation-overlay";
    Object.assign(this.overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      backgroundColor: styles.overlayBg,
      zIndex: "2147483646",
      opacity: "0",
      transition: "opacity 0.3s ease",
    });

    this.popup = document.createElement("div");
    this.popup.id = "madoka-translation-popup";
    this.popup.setAttribute("data-theme", this.currentTheme);
    this.applyPopupPosition(options.rect);

    const popupStyles: Record<string, string> = {
      width: "400px",
      maxWidth: "90vw",
      maxHeight: "80vh",
      backgroundColor: styles.bg,
      borderRadius: "16px",
      boxShadow:
        styles.neonShadow ||
        "0 25px 80px rgba(0, 0, 0, 0.35), 0 10px 30px rgba(0, 0, 0, 0.2)",
      zIndex: "2147483647",
      opacity: "0",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      border: styles.neonBorder || styles.borderColor,
    };
    Object.assign(this.popup.style, popupStyles);

    const originalPreview = this.escapeHtml(
      options.originalText.length > 60
        ? options.originalText.substring(0, 60) + "..."
        : options.originalText,
    );

    this.popup.innerHTML = this.generatePopupHTML(styles, originalPreview);
    this.addDynamicStyles();

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.popup);

    this.bindEvents();
    this.bindDragEvents();
    document.addEventListener("keydown", this.handleKeyDown);

    requestAnimationFrame(() => {
      if (this.overlay) {
        this.overlay.style.opacity = "1";
      }
      if (this.popup) {
        this.popup.style.opacity = "1";
      }
    });

    this.updateContent(options);
  }

  private generatePopupHTML(
    styles: ThemeStyles,
    originalPreview: string,
  ): string {
    return `
      <div id="madoka-translation-header" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: ${styles.headerGradient};
        color: white;
        cursor: move;
        user-select: none;
        position: relative;
        overflow: hidden;
      ">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%); pointer-events: none;"></div>
        <div style="display: flex; align-items: center; gap: 10px; position: relative; z-index: 1;">
          <div style="
            width: 32px;
            height: 32px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            backdrop-filter: blur(10px);
          ">🌐</div>
          <div>
            <div style="font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">Madoka 翻译</div>
            <div style="font-size: 11px; opacity: 0.85; margin-top: 2px; font-weight: 400;">${originalPreview}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; position: relative; z-index: 1;">
          <button id="madoka-translation-pin" title="固定弹窗" style="
            background: rgba(255, 255, 255, 0.15);
            border: none;
            color: white;
            font-size: 14px;
            cursor: pointer;
            padding: 6px 10px;
            border-radius: 8px;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
          ">📌</button>
          <button id="madoka-translation-close" style="
            background: rgba(255, 255, 255, 0.15);
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            line-height: 1;
          ">×</button>
        </div>
      </div>
      
      <div id="madoka-translation-content" style="
        padding: 16px;
        font-size: 14px;
        line-height: 1.6;
        color: ${styles.textPrimary};
        max-height: 60vh;
        overflow-y: auto;
      ">
        <div id="madoka-translation-loading" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          gap: 16px;
        ">
          <div style="position: relative; width: 48px; height: 48px;">
            <div style="
              position: absolute;
              width: 100%;
              height: 100%;
              border: 3px solid ${styles.loadingSpinnerBorder};
              border-radius: 50%;
            "></div>
            <div style="
              position: absolute;
              width: 100%;
              height: 100%;
              border: 3px solid transparent;
              border-top-color: ${styles.loadingSpinnerTop};
              border-radius: 50%;
              animation: madoka-translation-spin 0.8s linear infinite;
            "></div>
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 20px;
            ">✨</div>
          </div>
          <div style="color: ${styles.textSecondary}; font-size: 14px; font-weight: 500;">正在翻译中...</div>
          <div style="color: ${styles.textMuted}; font-size: 12px;">请稍候片刻</div>
        </div>
        
        <div id="madoka-translation-result" style="display: none;">
          <div style="
            margin-bottom: 16px;
            padding: 14px;
            background: ${styles.originalBg};
            border-radius: 12px;
            border: 1px solid ${styles.originalBorder};
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -8px;
              left: 12px;
              background: ${styles.bg};
              padding: 2px 8px;
              font-size: 11px;
              color: ${styles.originalLabelColor};
              font-weight: 600;
              border-radius: 4px;
              border: 1px solid ${styles.originalBorder};
            ">原文</div>
            <div style="
              font-size: 13px;
              color: ${styles.textSecondary};
              line-height: 1.7;
              margin-top: 4px;
              font-style: italic;
            ">
              <span style="color: ${styles.textMuted}; font-size: 16px; margin-right: 4px;">"</span>
              <span id="madoka-translation-original"></span>
              <span style="color: ${styles.textMuted}; font-size: 16px; margin-left: 4px;">"</span>
            </div>
          </div>

          <div style="
            padding: 16px;
            background: ${styles.translatedBg};
            border-radius: 12px;
            border: 1px solid ${styles.translatedBorder};
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -8px;
              left: 12px;
              background: ${styles.bg};
              padding: 2px 8px;
              font-size: 11px;
              color: ${styles.translatedLabelColor};
              font-weight: 600;
              border-radius: 4px;
              border: 1px solid ${styles.translatedBorder};
            ">译文</div>
            <div id="madoka-translation-text" style="
              font-size: 15px;
              color: ${styles.textPrimary};
              line-height: 1.8;
              font-weight: 500;
              margin-top: 4px;
              margin-bottom: 12px;
            "></div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <button id="madoka-translation-ask-ai" style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 14px;
                background: ${styles.buttonPrimary};
                border: none;
                border-radius: 8px;
                font-size: 13px;
                color: #fff;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
              ">
                <span>🤖</span>
                <span id="madoka-translation-ask-ai-text">问 AI</span>
              </button>
              <button id="madoka-translation-copy" style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 14px;
                background: ${styles.buttonSecondary};
                border: 1px solid ${styles.buttonSecondaryBorder};
                border-radius: 8px;
                font-size: 13px;
                color: ${styles.buttonSecondaryText};
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
              ">
                <span>📋</span>
                <span id="madoka-translation-copy-text">复制译文</span>
              </button>
            </div>
          </div>
        </div>
        
        <div id="madoka-translation-error" style="
          display: none;
          padding: 24px;
          text-align: center;
        ">
          <div style="
            width: 56px;
            height: 56px;
            margin: 0 auto 16px;
            background: ${styles.errorBg};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
          ">😕</div>
          <div style="
            font-size: 15px;
            font-weight: 600;
            color: ${styles.errorColor};
            margin-bottom: 8px;
          ">翻译出错了</div>
          <div id="madoka-translation-error-text" style="
            font-size: 13px;
            color: ${styles.textSecondary};
            margin-bottom: 16px;
            line-height: 1.6;
          "></div>
          <button id="madoka-translation-retry" style="
            padding: 10px 20px;
            background: ${styles.errorBtnGradient};
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            🔄 重试
          </button>
        </div>
      </div>
    `;
  }

  private addDynamicStyles(): void {
    const style = document.createElement("style");
    style.id = "madoka-translation-dynamic-styles";
    style.textContent = `
      @keyframes madoka-translation-spin {
        to { transform: rotate(360deg); }
      }
      #madoka-translation-close:hover {
        background-color: rgba(255, 255, 255, 0.2) !important;
      }
      #madoka-translation-pin:hover {
        background-color: rgba(255, 255, 255, 0.2) !important;
      }
      ${
        this.currentTheme === "cyber"
          ? `
        #madoka-translation-ask-ai:hover {
          box-shadow: 0 0 20px rgba(255, 77, 141, 0.6) !important;
          transform: translateY(-1px);
        }
        #madoka-translation-copy:hover {
          box-shadow: 0 0 15px rgba(0, 240, 255, 0.4) !important;
          background: rgba(0, 240, 255, 0.1) !important;
        }
        #madoka-translation-retry:hover {
          box-shadow: 0 0 15px rgba(255, 77, 109, 0.5) !important;
        }
      `
          : this.currentTheme === "neon"
            ? `
        #madoka-translation-ask-ai:hover {
          box-shadow: 0 0 20px rgba(0, 163, 255, 0.5) !important;
          transform: translateY(-1px);
        }
        #madoka-translation-copy:hover {
          box-shadow: 0 0 15px rgba(57, 255, 20, 0.3) !important;
          background: rgba(0, 163, 255, 0.08) !important;
        }
        #madoka-translation-retry:hover {
          box-shadow: 0 0 15px rgba(255, 51, 51, 0.4) !important;
        }
      `
            : ""
      }
    `;
    this.popup?.appendChild(style);
  }

  private bindEvents(): void {
    const closeBtn = this.popup?.querySelector("#madoka-translation-close");
    closeBtn?.addEventListener("click", () => this.close());

    const pinBtn = this.popup?.querySelector("#madoka-translation-pin");
    pinBtn?.addEventListener("click", () => this.togglePin());

    const copyBtn = this.popup?.querySelector("#madoka-translation-copy");
    copyBtn?.addEventListener("click", () => this.copyTranslation());

    const askAiBtn = this.popup?.querySelector("#madoka-translation-ask-ai");
    askAiBtn?.addEventListener("click", () => this.askAI());

    const retryBtn = this.popup?.querySelector("#madoka-translation-retry");
    retryBtn?.addEventListener("click", () => this.retryTranslation());

    this.overlay?.addEventListener("click", () => {
      if (!this.isPinned) {
        this.close();
      }
    });
  }

  private updatePopupTheme(): void {
    if (!this.popup) return;

    const styles = this.getThemeStyles();
    this.popup.setAttribute("data-theme", this.currentTheme);

    this.popup.style.backgroundColor = styles.bg;
    this.popup.style.boxShadow =
      styles.neonShadow ||
      "0 25px 80px rgba(0, 0, 0, 0.35), 0 10px 30px rgba(0, 0, 0, 0.2)";
    this.popup.style.border = styles.neonBorder || styles.borderColor;

    const header = this.popup.querySelector(
      "#madoka-translation-header",
    ) as HTMLElement;
    if (header) {
      header.style.background = styles.headerGradient;
    }

    const content = this.popup.querySelector(
      "#madoka-translation-content",
    ) as HTMLElement;
    if (content) {
      content.style.color = styles.textPrimary;
    }

    const dynamicStyles = this.popup.querySelector(
      "#madoka-translation-dynamic-styles",
    );
    if (dynamicStyles) {
      dynamicStyles.remove();
    }
    this.addDynamicStyles();
  }

  private applyPopupPosition(rect?: DOMRect): void {
    if (!this.popup) return;

    const popupWidth = 360;
    const popupHeight = 200;
    const padding = 12;

    if (rect) {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let top: number;
      let left = rect.left + (rect.width - popupWidth) / 2;

      if (rect.bottom + popupHeight + padding <= viewportHeight) {
        top = rect.bottom + padding;
      } else if (rect.top - popupHeight - padding >= 0) {
        top = rect.top - popupHeight - padding;
      } else {
        top = Math.max(
          padding,
          Math.min(rect.top, viewportHeight - popupHeight - padding),
        );
      }

      left = Math.max(
        padding,
        Math.min(left, viewportWidth - popupWidth - padding),
      );

      Object.assign(this.popup.style, {
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
      });
    } else {
      Object.assign(this.popup.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
    }
  }

  updateContent(options: TranslationPopupOptions): void {
    if (!this.popup) return;

    const loadingEl = this.popup.querySelector("#madoka-translation-loading");
    const resultEl = this.popup.querySelector("#madoka-translation-result");
    const errorEl = this.popup.querySelector("#madoka-translation-error");

    if (options.isLoading) {
      loadingEl?.setAttribute(
        "style",
        "display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; gap: 12px;",
      );
      resultEl?.setAttribute("style", "display: none;");
      errorEl?.setAttribute("style", "display: none;");
    } else if (options.error) {
      loadingEl?.setAttribute("style", "display: none;");
      resultEl?.setAttribute("style", "display: none;");
      errorEl?.setAttribute(
        "style",
        "display: block; padding: 16px; text-align: center;",
      );
      const errorTextEl = this.popup.querySelector(
        "#madoka-translation-error-text",
      );
      if (errorTextEl) errorTextEl.textContent = options.error;
    } else if (options.translatedText !== undefined) {
      loadingEl?.setAttribute("style", "display: none;");
      errorEl?.setAttribute("style", "display: none;");
      resultEl?.setAttribute("style", "display: block;");
      const originalEl = this.popup.querySelector(
        "#madoka-translation-original",
      );
      const textEl = this.popup.querySelector("#madoka-translation-text");
      if (originalEl) originalEl.textContent = options.originalText;
      if (textEl)
        textEl.textContent = options.translatedText || "（无翻译结果）";
    }
  }

  private togglePin(): void {
    this.isPinned = !this.isPinned;
    const pinBtn = this.popup?.querySelector("#madoka-translation-pin");
    if (pinBtn) {
      pinBtn.textContent = this.isPinned ? "📍" : "📌";
      pinBtn.setAttribute("title", this.isPinned ? "取消固定" : "固定弹窗");
    }
  }

  private copyTranslation(): void {
    const textEl = this.popup?.querySelector("#madoka-translation-text");
    const copyTextEl = this.popup?.querySelector(
      "#madoka-translation-copy-text",
    );
    if (!textEl || !copyTextEl) return;

    const text = textEl.textContent || "";
    navigator.clipboard
      .writeText(text)
      .then(() => {
        copyTextEl.textContent = "已复制!";
        setTimeout(() => {
          copyTextEl.textContent = "复制译文";
        }, 2000);
      })
      .catch(() => {
        copyTextEl.textContent = "复制失败";
        setTimeout(() => {
          copyTextEl.textContent = "复制译文";
        }, 2000);
      });
  }

  private askAI(): void {
    const originalEl = this.popup?.querySelector(
      "#madoka-translation-original",
    );
    const askAiTextEl = this.popup?.querySelector(
      "#madoka-translation-ask-ai-text",
    );
    if (!originalEl || !askAiTextEl) return;

    const originalText = originalEl.textContent || "";
    if (!originalText.trim()) return;

    askAiTextEl.textContent = "发送中...";

    try {
      chrome.runtime.sendMessage(
        { action: "askAI", text: originalText },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Madoka] Ask AI failed:", chrome.runtime.lastError);
            askAiTextEl.textContent = "发送失败";
            setTimeout(() => {
              askAiTextEl.textContent = "问 AI";
            }, 2000);
            return;
          }

          if (response?.success) {
            askAiTextEl.textContent = "已保存，请点击扩展图标打开侧边栏";
            setTimeout(() => {
              askAiTextEl.textContent = "问 AI";
            }, 3000);
          } else {
            askAiTextEl.textContent = "发送失败";
            setTimeout(() => {
              askAiTextEl.textContent = "问 AI";
            }, 2000);
          }
        },
      );
    } catch (e) {
      console.error("[Madoka] Ask AI error:", e);
      askAiTextEl.textContent = "发送失败";
      setTimeout(() => {
        askAiTextEl.textContent = "问 AI";
      }, 2000);
    }
  }

  private retryTranslation(): void {
    const event = new CustomEvent("madoka-translation-retry", {
      bubbles: true,
      cancelable: true,
    });
    this.popup?.dispatchEvent(event);
  }

  close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    const overlayToRemove = this.overlay;
    const popupToRemove = this.popup;
    this.overlay = null;
    this.popup = null;

    document.removeEventListener("keydown", this.handleKeyDown);
    this.cleanupDragEvents();

    if (overlayToRemove) {
      overlayToRemove.style.opacity = "0";
      overlayToRemove.style.pointerEvents = "none";
    }
    if (popupToRemove) {
      popupToRemove.style.opacity = "0";
    }

    setTimeout(() => {
      overlayToRemove?.remove();
      popupToRemove?.remove();
    }, 300);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      this.close();
    }
  };

  private bindDragEvents(): void {
    if (!this.popup) return;

    const header = this.popup.querySelector("#madoka-translation-header");
    if (!header) return;

    this.cleanupDragEvents();

    this.startDragHandler = (e: Event) => {
      if (!this.popup) return;

      this.isDragging = true;
      const mouseEvent = e as MouseEvent;
      const touchEvent = e as TouchEvent;
      const clientX = touchEvent.touches
        ? touchEvent.touches[0].clientX
        : mouseEvent.clientX;
      const clientY = touchEvent.touches
        ? touchEvent.touches[0].clientY
        : mouseEvent.clientY;

      const rect = this.popup.getBoundingClientRect();
      this.dragOffset.x = clientX - rect.left;
      this.dragOffset.y = clientY - rect.top;

      e.preventDefault();
    };

    this.doDragHandler = (e: Event) => {
      if (!this.isDragging || !this.popup) return;

      const mouseEvent = e as MouseEvent;
      const touchEvent = e as TouchEvent;
      const clientX = touchEvent.touches
        ? touchEvent.touches[0].clientX
        : mouseEvent.clientX;
      const clientY = touchEvent.touches
        ? touchEvent.touches[0].clientY
        : mouseEvent.clientY;

      let newLeft = clientX - this.dragOffset.x;
      let newTop = clientY - this.dragOffset.y;

      const popupRect = this.popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      newLeft = Math.max(0, Math.min(newLeft, viewportWidth - popupRect.width));
      newTop = Math.max(0, Math.min(newTop, viewportHeight - popupRect.height));

      this.popup.style.left = `${newLeft}px`;
      this.popup.style.top = `${newTop}px`;
      this.popup.style.transform = "none";

      e.preventDefault();
    };

    this.stopDragHandler = () => {
      this.isDragging = false;
      this.justFinishedDragging = true;
      setTimeout(() => {
        this.justFinishedDragging = false;
      }, 100);
    };

    header.addEventListener("mousedown", this.startDragHandler);
    document.addEventListener("mousemove", this.doDragHandler);
    document.addEventListener("mouseup", this.stopDragHandler);

    header.addEventListener("touchstart", this.startDragHandler, {
      passive: false,
    });
    document.addEventListener("touchmove", this.doDragHandler, {
      passive: false,
    });
    document.addEventListener("touchend", this.stopDragHandler);
  }

  private cleanupDragEvents(): void {
    if (!this.startDragHandler || !this.doDragHandler || !this.stopDragHandler)
      return;

    const header = this.popup?.querySelector("#madoka-translation-header");
    if (header) {
      header.removeEventListener("mousedown", this.startDragHandler);
      header.removeEventListener("touchstart", this.startDragHandler);
    }

    document.removeEventListener("mousemove", this.doDragHandler);
    document.removeEventListener("mouseup", this.stopDragHandler);
    document.removeEventListener("touchmove", this.doDragHandler);
    document.removeEventListener("touchend", this.stopDragHandler);

    this.startDragHandler = null;
    this.doDragHandler = null;
    this.stopDragHandler = null;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

let translationPopup: TranslationPopup | null = null;

export function getTranslationPopup(): TranslationPopup {
  if (!translationPopup) {
    translationPopup = new TranslationPopup();
  }
  return translationPopup;
}
