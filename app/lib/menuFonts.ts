import { Playfair_Display, DM_Sans } from "next/font/google";

export const playfair = Playfair_Display({
  variable: "--font-menu-serif",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  preload: false,
  fallback: ["Georgia", "Cambria", "Times New Roman", "serif"],
});

export const dmSans = DM_Sans({
  variable: "--font-menu-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "Noto Sans",
    "Mangal",
    "Nirmala UI",
    "sans-serif",
  ],
});

export const menuFontClassNames = `${playfair.variable} ${dmSans.variable}`;
