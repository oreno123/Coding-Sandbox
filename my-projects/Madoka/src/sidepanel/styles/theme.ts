/**
 * Theme System
 * Cursor-style theme management with light/dark/cyber/neon mode support
 */

export type Theme = "light" | "dark" | "cyber" | "neon";

// Theme colors - referenced from CSS variables
export const THEME_COLORS = {
  light: {
    bgPrimary: "#ffffff",
    bgSecondary: "#f8f9fa",
    bgTertiary: "#f0f1f3",
    bgHover: "#e8e9eb",
    bgActive: "#dcdee0",
    bgSidebar: "#f3f4f6",
    textPrimary: "#1a1a1a",
    textSecondary: "#4b5563",
    textMuted: "#9ca3af",
    borderPrimary: "#e5e7eb",
    borderSecondary: "#d1d5db",
    accentPrimary: "#3b82f6",
    accentSecondary: "#6366f1",
    accentPrimaryRgb: "59, 130, 246",
    accentSecondaryRgb: "99, 102, 241",
  },
  dark: {
    bgPrimary: "#1e1e1e",
    bgSecondary: "#252526",
    bgTertiary: "#2d2d2d",
    bgHover: "#3c3c3c",
    bgActive: "#4a4a4a",
    bgSidebar: "#181818",
    textPrimary: "#cccccc",
    textSecondary: "#9ca3af",
    textMuted: "#6b7280",
    borderPrimary: "#3c3c3c",
    borderSecondary: "#4a4a4a",
    accentPrimary: "#60a5fa",
    accentSecondary: "#818cf8",
    accentPrimaryRgb: "96, 165, 250",
    accentSecondaryRgb: "129, 140, 248",
  },
  cyber: {
    bgPrimary: "#1A0B2E",
    bgSecondary: "#2D1B4E",
    bgTertiary: "#3D2B5E",
    bgHover: "#4D3B6E",
    bgActive: "#5D4B7E",
    bgSidebar: "#150A24",
    textPrimary: "#F0F0FF",
    textSecondary: "#B8B8D0",
    textMuted: "#8888A0",
    borderPrimary: "rgba(255, 255, 255, 0.1)",
    borderSecondary: "rgba(255, 255, 255, 0.15)",
    accentPrimary: "#FF4D8D",
    accentSecondary: "#00F0FF",
    accentGold: "#FFD93D",
    accentPrimaryRgb: "255, 77, 141",
    accentSecondaryRgb: "0, 240, 255",
  },
  neon: {
    bgPrimary: "#0A0B10",
    bgSecondary: "#12141A",
    bgTertiary: "#1A1D26",
    bgHover: "#222633",
    bgActive: "#2A2F40",
    bgSidebar: "#070810",
    textPrimary: "#E0E0E6",
    textSecondary: "#A0A0A5",
    textMuted: "#5C5C66",
    borderPrimary: "#1F2229",
    borderSecondary: "#2A2D38",
    accentPrimary: "#00A3FF",
    accentSecondary: "#6B46C1",
    accentGreen: "#39FF14",
    accentOrange: "#FF5F00",
    accentViolet: "#6B46C1",
    accentPrimaryRgb: "0, 163, 255",
    accentSecondaryRgb: "107, 70, 193",
  },
} as const;

// Theme display names for UI
export const THEME_NAMES: Record<Theme, string> = {
  light: "浅色",
  dark: "深色",
  cyber: "赛博",
  neon: "泼墨",
};

/**
 * Get the current theme from the document
 */
export function getCurrentTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme) || "light";
}

/**
 * Set the theme on the document
 */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  // Persist to storage
  chrome.storage.local.set({ theme });
}

/**
 * Cycle through themes: light -> dark -> cyber -> neon -> light
 */
export function cycleTheme(): Theme {
  const current = getCurrentTheme();
  const themes: Theme[] = ["light", "dark", "cyber", "neon"];
  const currentIndex = themes.indexOf(current);
  const nextIndex = (currentIndex + 1) % themes.length;
  const next = themes[nextIndex];
  setTheme(next);
  return next;
}

/**
 * Toggle between light and dark themes (legacy, for backward compatibility)
 */
export function toggleTheme(): Theme {
  const current = getCurrentTheme();
  if (current === "cyber" || current === "neon") {
    setTheme("light");
    return "light";
  }
  const next = current === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}

/**
 * Initialize theme from storage
 */
export async function initializeTheme(): Promise<Theme> {
  try {
    const result = await chrome.storage.local.get("theme");
    const theme = (result.theme as Theme) || "light";
    setTheme(theme);
    return theme;
  } catch {
    setTheme("light");
    return "light";
  }
}

/**
 * React hook for theme management is in useTheme.ts
 */
