/**
 * ThemeToggle Component
 * Toggle button for light/dark/cyber theme
 */

import { motion, AnimatePresence } from "framer-motion";
import { useChatContext } from "../../context/ChatContext";
import type { Theme } from "../../styles/theme";
import { THEME_NAMES } from "../../styles/theme";

const THEME_ICONS: Record<Theme, JSX.Element> = {
  light: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ),
  dark: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  ),
  cyber: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  neon: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
      />
    </svg>
  ),
};

const THEME_COLORS: Record<Theme, string> = {
  light: "text-yellow-500",
  dark: "text-blue-400",
  cyber: "text-pink-400",
  neon: "text-cyan-400",
};

export function ThemeToggle() {
  const { state, setTheme } = useChatContext();
  const currentTheme = state.theme;

  const cycleTheme = () => {
    const themes: Theme[] = ["light", "dark", "cyber", "neon"];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <button
      onClick={cycleTheme}
      className="relative p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      title={`当前: ${THEME_NAMES[currentTheme]} (点击切换)`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTheme}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={THEME_COLORS[currentTheme]}
        >
          {THEME_ICONS[currentTheme]}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}

/**
 * ThemeToggleSwitch - Alternative switch-style toggle with 4 themes
 */
export function ThemeToggleSwitch() {
  const { state, setTheme } = useChatContext();
  const currentTheme = state.theme;

  const themes: Theme[] = ["light", "dark", "cyber", "neon"];

  return (
    <div className="flex items-center gap-1 p-0.5 rounded-full bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)] border border-[var(--border-primary)]">
      {themes.map((theme) => (
        <button
          key={theme}
          onClick={() => setTheme(theme)}
          className={`
            relative w-7 h-7 rounded-full flex items-center justify-center transition-all
            ${
              currentTheme === theme
                ? "bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-[0_0_10px_rgba(var(--accent-primary-rgb,59,130,246),0.5)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]"
            }
          `}
          title={THEME_NAMES[theme]}
        >
          {THEME_ICONS[theme]}
        </button>
      ))}
    </div>
  );
}

/**
 * ThemeSelector - Dropdown theme selector
 */
export function ThemeSelector() {
  const { state, setTheme } = useChatContext();
  const currentTheme = state.theme;
  const themes: Theme[] = ["light", "dark", "cyber", "neon"];

  return (
    <div className="flex flex-col gap-1">
      {themes.map((theme) => (
        <button
          key={theme}
          onClick={() => setTheme(theme)}
          className={`
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
            ${
              currentTheme === theme
                ? "bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-inner shadow-black/10"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            }
          `}
        >
          <span className={currentTheme === theme ? "" : THEME_COLORS[theme]}>
            {THEME_ICONS[theme]}
          </span>
          <span>{THEME_NAMES[theme]}</span>
          {currentTheme === theme && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="ml-auto"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </motion.div>
          )}
        </button>
      ))}
    </div>
  );
}
