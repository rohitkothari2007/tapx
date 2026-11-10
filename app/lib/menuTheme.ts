/**
 * Design Tokens & Theme Configuration for TAPX Menu & Dining Experience
 * Single source of truth for Customer Menu & Owner Menu Manager.
 * Generic and independent of business category or identifiers.
 */

import type { CSSProperties } from "react";

export const MENU_TOKENS = {
  fonts: {
    serif: "var(--font-menu-serif), Georgia, 'Times New Roman', serif",
    sans: "var(--font-menu-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Noto Sans', 'Mangal', 'Nirmala UI', sans-serif",
  },
  typeScale: {
    display: {
      fontFamily: "var(--font-menu-serif), Georgia, serif",
      fontSize: "30px",
      lineHeight: "36px",
      fontWeight: 700,
      letterSpacing: "-0.5px",
    },
    title: {
      fontFamily: "var(--font-menu-serif), Georgia, serif",
      fontSize: "22px",
      lineHeight: "28px",
      fontWeight: 700,
      letterSpacing: "-0.3px",
    },
    section: {
      fontFamily: "var(--font-menu-serif), Georgia, serif",
      fontSize: "18px",
      lineHeight: "24px",
      fontWeight: 600,
      letterSpacing: "-0.2px",
    },
    body: {
      fontFamily: "var(--font-menu-sans), sans-serif",
      fontSize: "15px",
      lineHeight: "22px",
      fontWeight: 400,
    },
    small: {
      fontFamily: "var(--font-menu-sans), sans-serif",
      fontSize: "13px",
      lineHeight: "18px",
      fontWeight: 500,
    },
    caption: {
      fontFamily: "var(--font-menu-sans), sans-serif",
      fontSize: "12px",
      lineHeight: "16px",
      fontWeight: 500,
    },
    price: {
      fontFamily: "var(--font-menu-sans), sans-serif",
      fontSize: "15px",
      lineHeight: "20px",
      fontWeight: 600,
      fontVariantNumeric: "tabular-nums",
    },
  },
  colors: {
    light: {
      bg: "#FBF8F3", // Warm ivory
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      ink: "#1C1917", // Deep warm stone
      muted: "#6B645C", // Warm muted text
      hairline: "#ECE6DC", // Hairline border
      accent: "#B8893B", // Champagne gold
      accentHover: "#A4772E",
      accentInk: "#8A6424", // Warm amber bronze text/ink (contrast >= 4.5:1)
      accentLight: "#F7F2E8",
      accentBorder: "#E8D9BF",
      veg: "#1E8E3E",
      vegBg: "#EAF7EE",
      nonVeg: "#C62828",
      nonVegBg: "#FDF2F2",
      egg: "#E08A00",
      eggBg: "#FEF7EC",
      soldOutText: "#94A3B8",
      soldOutBg: "#F1F5F9",
      soldOutBorder: "#E2E8F0",
    },
    dark: {
      bg: "#121110",
      surface: "#1B1917",
      surfaceElevated: "#24211E",
      ink: "#F5EFE6",
      muted: "#A8A096",
      hairline: "#2A2724",
      accent: "#C99B4C", // Slightly lightened champagne gold
      accentHover: "#D6A95B",
      accentInk: "#121110",
      accentLight: "#262118",
      accentBorder: "#4A3B22",
      veg: "#2EAA50",
      vegBg: "#132E1B",
      nonVeg: "#E04848",
      nonVegBg: "#331414",
      egg: "#F0A020",
      eggBg: "#33220E",
      soldOutText: "#64748B",
      soldOutBg: "#1E293B",
      soldOutBorder: "#334155",
    },
  },
  radii: {
    card: "18px",
    sheetTop: "24px 24px 0 0",
    sheetFull: "24px",
    chip: "999px",
    thumb: "14px",
    input: "12px",
    button: "12px",
    badge: "6px",
  },
  shadows: {
    card: "0 2px 4px rgba(28, 25, 23, 0.02), 0 8px 16px rgba(28, 25, 23, 0.04)",
    elevated: "0 4px 12px rgba(28, 25, 23, 0.05), 0 16px 32px rgba(28, 25, 23, 0.08)",
    floatingBar: "0 4px 12px rgba(28, 25, 23, 0.08), 0 12px 28px rgba(28, 25, 23, 0.12)",
    modal: "0 8px 24px rgba(28, 25, 23, 0.12), 0 24px 48px rgba(28, 25, 23, 0.16)",
  },
  motion: {
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    fast: "160ms cubic-bezier(0.22, 1, 0.36, 1)",
    normal: "220ms cubic-bezier(0.22, 1, 0.36, 1)",
    slow: "300ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  layout: {
    maxContentWidth: "480px",
    gutter: "20px",
    minTouchTarget: "44px",
  },
};

/**
 * Global CSS styles injected for Menu & Dining experience.
 * Includes keyframes, dark-mode CSS variables, safe-area helpers, and reduced-motion overrides.
 */
export const MENU_THEME_GLOBAL_CSS = `
:root {
  color-scheme: light;
  --menu-rail-width: 72px;
  --menu-bg: #FBF8F3;
  --menu-surface: #FFFFFF;
  --menu-surface-elevated: #FFFFFF;
  --menu-ink: #1C1917;
  --menu-muted: #6B645C;
  --menu-hairline: #ECE6DC;
  --menu-accent: #B8893B;
  --menu-accent-ink: #8A6424;
  --menu-accent-light: #F7F2E8;
  --menu-accent-border: #E8D9BF;
  --menu-veg: #1E8E3E;
  --menu-veg-bg: #EAF7EE;
  --menu-nonveg: #C62828;
  --menu-nonveg-bg: #FDF2F2;
  --menu-egg: #E08A00;
  --menu-egg-bg: #FEF7EC;
  --menu-soldout-text: #94A3B8;
  --menu-soldout-bg: #F1F5F9;
  --menu-soldout-border: #E2E8F0;
  --menu-card-shadow: 0 2px 4px rgba(28, 25, 23, 0.02), 0 8px 16px rgba(28, 25, 23, 0.04);
  --menu-elevated-shadow: 0 4px 12px rgba(28, 25, 23, 0.05), 0 16px 32px rgba(28, 25, 23, 0.08);
  --menu-floating-shadow: 0 4px 12px rgba(28, 25, 23, 0.08), 0 12px 28px rgba(28, 25, 23, 0.12);
}

@media (max-width: 359px) {
  :root {
    --menu-rail-width: 60px;
  }
}

.menu-rail-nav {
  width: var(--menu-rail-width, 72px);
  flex-shrink: 0;
}

.menu-rail-btn {
  min-height: 44px;
  min-width: 44px;
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.menu-rail-btn:focus-visible {
  outline: 2px solid var(--menu-accent, #B8893B);
  outline-offset: 2px;
}

@keyframes menuCardFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes menuSheetSlideUp {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes menuBackdropFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes menuShimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes cartBarPop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.04);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes livePulseStep {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
}

.menu-tap-press:active {
  transform: scale(0.98) !important;
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1) !important;
}

.menu-shimmer-bg {
  background: linear-gradient(90deg, var(--menu-hairline, #ECE6DC) 25%, var(--menu-surface, #FFFFFF) 50%, var(--menu-hairline, #ECE6DC) 75%);
  background-size: 200% 100%;
  animation: menuShimmer 1.8s infinite;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

const PRESERVED_ACRONYMS = new Set([
  "BBQ",
  "BLT",
  "IPA",
  "DOP",
  "USA",
  "UK",
  "NY",
  "LA",
  "CBD",
  "GST",
  "VAP",
]);

/**
 * Render-time display helper: converts ALL-CAPS Latin strings to Title Case,
 * while leaving mixed case (e.g. "Pizza Slice"), non-Latin scripts (e.g. Devanagari),
 * and recognised acronyms (e.g. "BBQ") untouched.
 */
export function formatDisplayName(text?: string | null): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return text;

  const hasLatinLower = /[a-z]/.test(trimmed);
  const hasLatinUpper = /[A-Z]/.test(trimmed);

  // If string already has lowercase Latin, or has no uppercase Latin (e.g. Devanagari only), keep as is
  if (!hasLatinUpper || hasLatinLower) {
    return text;
  }

  // Pure Latin uppercase string: convert each word to Title Case, preserving acronyms
  return trimmed.replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g, (word) => {
    const upperWord = word.toUpperCase();
    if (PRESERVED_ACRONYMS.has(upperWord)) {
      return upperWord;
    }
    if (word.includes("'")) {
      const parts = word.split("'");
      return (
        parts[0].charAt(0).toUpperCase() +
        parts[0].slice(1).toLowerCase() +
        "'" +
        parts[1].toLowerCase()
      );
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}
