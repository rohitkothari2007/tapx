"use client";

import { useEffect, useState, type CSSProperties } from "react";
import RestaurantExperience, {
  type RestaurantExperienceProps,
} from "./RestaurantExperience";
import {
  parseStandTableNumber,
  getDiningCardSubtitle,
  resolveSessionTableNumber,
} from "../lib/tableNumber";
import { MENU_TOKENS } from "../lib/menuTheme";
import { menuFontClassNames } from "../lib/menuFonts";

function UtensilsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
      <path d="M15 2v18" />
      <path d="M6 2v6a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2" />
      <path d="M9 2v18" />
      <path d="M6 22h6" />
      <path d="M15 22h6" />
    </svg>
  );
}

export type DiningLayerWrapperProps = RestaurantExperienceProps & {
  tableOrderingEnabled?: boolean;
  tableCount?: number;
};

export default function DiningLayerWrapper(props: DiningLayerWrapperProps) {
  const {
    business,
    device,
    tableOrderingEnabled,
    tableCount,
    onTrackAction,
    onOpenFeedback,
    onOpenLoyalty,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [hasEverOpened, setHasEverOpened] = useState(false);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  const storageKey = `tapx_active_order_${business.id}_${device.device_code}`;

  const checkActiveOrder = () => {
    try {
      if (typeof window !== "undefined") {
        const savedId = window.localStorage.getItem(storageKey);
        setHasActiveOrder(Boolean(savedId && savedId.trim()));
      }
    } catch {
      setHasActiveOrder(false);
    }
  };

  // Check for active order on this device
  useEffect(() => {
    checkActiveOrder();
    const interval = setInterval(checkActiveOrder, 2000);
    window.addEventListener("storage", checkActiveOrder);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", checkActiveOrder);
    };
  }, [storageKey]);

  // Lock body scroll when full-screen layer is open
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle browser back button & ensure refresh keeps layer closed
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Refresh guarantee: if page loads with #menu, clean hash so layer stays closed
    if (window.location.hash === "#menu") {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      setIsOpen(false);
    }

    const handleHashOrPop = () => {
      if (window.location.hash !== "#menu") {
        setIsOpen(false);
        checkActiveOrder();
      }
    };

    window.addEventListener("hashchange", handleHashOrPop);
    window.addEventListener("popstate", handleHashOrPop);

    return () => {
      window.removeEventListener("hashchange", handleHashOrPop);
      window.removeEventListener("popstate", handleHashOrPop);
    };
  }, [storageKey]);

  const openLayer = () => {
    setHasEverOpened(true);
    setIsOpen(true);
    if (typeof window !== "undefined") {
      window.location.hash = "menu";
    }
    if (onTrackAction) {
      onTrackAction("menu_click");
    }
  };

  const closeLayer = () => {
    checkActiveOrder();
    setIsOpen(false);
    if (typeof window !== "undefined" && window.location.hash === "#menu") {
      window.history.back();
    }
  };

  // Read URL query parameter for ?table=N
  const [urlTableParam, setUrlTableParam] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setUrlTableParam(params.get("table"));
    }
  }, []);

  // Resolve table: (a) stand device.label/location, (b) ?table=N or session, (c) null
  const resolvedTableNum = resolveSessionTableNumber({
    standLabel: device.label,
    standLocation: device.location,
    queryTableParam: urlTableParam,
    deviceCode: device.device_code,
    tableCount,
  });

  const cardTitle = tableOrderingEnabled ? "Menu & order" : "View menu";
  const cardSubtitle = getDiningCardSubtitle(Boolean(tableOrderingEnabled), resolvedTableNum);

  return (
    <>
      {/* 1. PROMINENT DINING CARD ON STANDARD TAP PAGE */}
      <button
        type="button"
        onClick={openLayer}
        className={`menu-tap-press ${menuFontClassNames}`}
        style={styles.cardButton}
      >
        <div style={styles.cardIconBox}>
          <UtensilsIcon size={22} />
        </div>

        <div style={styles.cardTextContainer}>
          <div style={styles.cardTitleRow}>
            <span style={styles.cardTitle}>{cardTitle}</span>
            <span style={styles.cardChevron}>›</span>
          </div>

          <div style={styles.cardSubtitle}>{cardSubtitle}</div>

          {hasActiveOrder && (
            <div style={styles.activeOrderBadge}>
              <span style={styles.activeOrderDot}>●</span>
              <span>You have an active order</span>
            </div>
          )}
        </div>
      </button>

      {/* 2. FULL-SCREEN DINING LAYER OVER THE TAP PAGE */}
      <div
        className={menuFontClassNames}
        style={{
          ...styles.layerOverlay,
          display: isOpen ? "block" : "none",
        }}
        aria-hidden={!isOpen}
      >
        {/* Layer Header with Back Button */}
        <div style={styles.layerHeader}>
          <button
            type="button"
            onClick={closeLayer}
            className="menu-tap-press"
            style={styles.backButton}
            aria-label={`Back to ${business.name}`}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>←</span>
            <span>Back to {business.name}</span>
          </button>
        </div>

        {/* Dining Interface Content (keeps cart, orders, and form state in memory once opened) */}
        <div style={styles.layerContent}>
          {hasEverOpened && (
            <RestaurantExperience
              {...props}
              device={{
                ...device,
                location: device.location || (resolvedTableNum ? `Table ${resolvedTableNum}` : null),
              }}
              initialTab="menu"
              tableOrderingEnabled={tableOrderingEnabled}
              tableCount={tableCount}
              onOpenFeedback={
                onOpenFeedback
                  ? () => {
                      closeLayer();
                      onOpenFeedback();
                    }
                  : undefined
              }
              onOpenLoyalty={
                onOpenLoyalty
                  ? () => {
                      closeLayer();
                      onOpenLoyalty();
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  cardButton: {
    gridColumn: "1 / -1",
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "16px",
    background: "#ffffff",
    borderRadius: MENU_TOKENS.radii.card,
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    boxShadow: MENU_TOKENS.shadows.card,
    cursor: "pointer",
    textAlign: "left",
    boxSizing: "border-box",
    fontFamily: MENU_TOKENS.fonts.sans,
    appearance: "none",
    WebkitAppearance: "none",
    transition: "transform 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  cardIconBox: {
    width: "44px",
    height: "44px",
    borderRadius: MENU_TOKENS.radii.input,
    background: MENU_TOKENS.colors.light.accentLight,
    color: MENU_TOKENS.colors.light.accent,
    border: `1px solid ${MENU_TOKENS.colors.light.accentBorder}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  cardTitle: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "17px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.ink,
    letterSpacing: "-0.01em",
  },
  cardChevron: {
    fontSize: "18px",
    fontWeight: 400,
    color: MENU_TOKENS.colors.light.muted,
    lineHeight: 1,
  },
  cardSubtitle: {
    fontFamily: MENU_TOKENS.fonts.sans,
    fontSize: "13px",
    color: MENU_TOKENS.colors.light.muted,
    marginTop: "2px",
    lineHeight: 1.35,
  },
  activeOrderBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    marginTop: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: MENU_TOKENS.colors.light.veg,
    background: MENU_TOKENS.colors.light.vegBg,
    padding: "2px 8px",
    borderRadius: MENU_TOKENS.radii.badge,
    border: "1px solid #A7F3D0",
  },
  activeOrderDot: {
    fontSize: "8px",
    animation: "livePulseStep 2s infinite ease-in-out",
  },
  layerOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: MENU_TOKENS.colors.light.bg,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
  layerHeader: {
    position: "sticky",
    top: 0,
    zIndex: 10001,
    background: "rgba(251, 248, 243, 0.94)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderBottom: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    boxShadow: "0 1px 3px rgba(28, 25, 23, 0.03)",
  },
  backButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    background: "#ffffff",
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    borderRadius: "10px",
    color: MENU_TOKENS.colors.light.ink,
    fontSize: "13px",
    fontWeight: 600,
    fontFamily: MENU_TOKENS.fonts.sans,
    cursor: "pointer",
    maxWidth: "90vw",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxSizing: "border-box",
    boxShadow: "0 1px 2px rgba(28, 25, 23, 0.04)",
  },
  layerContent: {
    width: "100%",
    minHeight: "100%",
  },
};
