"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { parseStandTableNumber, resolveSessionTableNumber } from "../lib/tableNumber";
import { formatOrderNumber } from "../lib/orderNumber";
import { WhatsAppIcon } from "./BrandIcons";
import UpiPaymentModal from "./UpiPaymentModal";
import { MENU_TOKENS, MENU_THEME_GLOBAL_CSS, formatDisplayName } from "../lib/menuTheme";
import { menuFontClassNames } from "../lib/menuFonts";

// Layout configuration constants
const MENU_LAYOUT: "rail-grid" | "rail-list" = "rail-grid";
const MENU_CATEGORY_NAV: "rail" | "chips" = "rail";

export type RestaurantExperienceProps = {
  business: {
    id: string;
    name: string;
    category?: string | null;
    phone?: string | null;
    whatsapp_number?: string | null;
    address?: string | null;
    city?: string | null;
    logo_url?: string | null;
    google_review_url?: string | null;
    instagram_url?: string | null;
    payment_url?: string | null;
    upi_id?: string | null;
    upi_qr_url?: string | null;
    payment_enabled?: boolean | null;
  };
  device: {
    id: string;
    device_code: string;
    location: string | null;
    label?: string | null;
  };
  categories: Array<{
    id: string;
    name: string;
    description?: string;
    image?: string;
  }>;
  items: Array<{
    id: string;
    categoryId?: string;
    category_id?: string;
    name: string;
    price?: string | number;
    description?: string;
    imageUrl?: string;
    image_url?: string;
    dietary?: "veg" | "non_veg" | "egg" | "none" | "vegan";
    popular?: boolean;
    available?: boolean;
    badge?: string;
  }>;
  offers?: Array<{
    id: string;
    title?: string;
    name?: string;
    description?: string;
    discount?: string;
  }>;
  initialTab?: "menu" | "orders";
  tableOrderingEnabled?: boolean;
  tableCount?: number;
  quickRequests?: string[];
  loyaltyEnabled?: boolean;
  feedbackEnabled?: boolean;
  onOpenFeedback?: () => void;
  onOpenLoyalty?: () => void;
  onTrackAction?: (actionType: string) => void;
};

export type CartLine = {
  lineId: string;
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  special_request: string;
  dietary?: "veg" | "non_veg" | "egg" | "none" | "vegan";
  imageUrl?: string;
};

type ActiveOrder = {
  id: string;
  order_number?: number;
  table_number: number;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  subtotal: number;
  total: number;
  created_at: string;
};

type ActiveOrderItem = {
  id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  special_request?: string | null;
};

const DEFAULT_QUICK_REQUESTS = [
  "Less spicy",
  "Extra spicy",
  "No onion",
  "No garlic",
  "Less sugar",
  "Jain",
];

// Helper: parse price
function parsePrice(raw?: string | number): number {
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

// Geometric dietary indicator badge
function DietaryBadge({
  dietary,
  size = 14,
}: {
  dietary?: "veg" | "non_veg" | "egg" | "none" | "vegan";
  size?: number;
}) {
  if (!dietary || dietary === "none") return null;

  const isVeg = dietary === "veg" || dietary === "vegan";
  const isEgg = dietary === "egg";
  const borderColor = isVeg
    ? MENU_TOKENS.colors.light.veg
    : isEgg
    ? MENU_TOKENS.colors.light.egg
    : MENU_TOKENS.colors.light.nonVeg;
  const dotColor = borderColor;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${size}px`,
        height: `${size}px`,
        border: `1.5px solid ${borderColor}`,
        borderRadius: "4px",
        flexShrink: 0,
        backgroundColor: "#ffffff",
        boxSizing: "border-box",
      }}
      aria-label={isVeg ? "Vegetarian" : isEgg ? "Contains Egg" : "Non-Vegetarian"}
      title={isVeg ? "Vegetarian" : isEgg ? "Contains Egg" : "Non-Vegetarian"}
    >
      {isVeg ? (
        <span
          style={{
            width: `${Math.max(5, Math.floor(size * 0.45))}px`,
            height: `${Math.max(5, Math.floor(size * 0.45))}px`,
            borderRadius: "50%",
            backgroundColor: dotColor,
          }}
        />
      ) : isEgg ? (
        <span
          style={{
            width: `${Math.max(5, Math.floor(size * 0.45))}px`,
            height: `${Math.max(6, Math.floor(size * 0.52))}px`,
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            backgroundColor: dotColor,
          }}
        />
      ) : (
        // Non-veg red triangle
        <span
          style={{
            width: 0,
            height: 0,
            borderLeft: `${Math.max(3, Math.floor(size * 0.25))}px solid transparent`,
            borderRight: `${Math.max(3, Math.floor(size * 0.25))}px solid transparent`,
            borderBottom: `${Math.max(5, Math.floor(size * 0.45))}px solid ${dotColor}`,
          }}
        />
      )}
    </span>
  );
}

// 4:3 Aspect-ratio Dish Image with shimmer background and fade-in
function DishImage({
  src,
  name,
  width = 92,
  height = 69,
}: {
  src?: string;
  name: string;
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const initial = (name || "D").trim().charAt(0).toUpperCase();

  if (!src || failed) {
    return (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: "14px",
          background: "linear-gradient(135deg, #F5EFE6 0%, #E8DCCB 100%)",
          border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: MENU_TOKENS.colors.light.muted,
          fontFamily: MENU_TOKENS.fonts.serif,
          fontSize: `${Math.floor(height * 0.42)}px`,
          fontWeight: 700,
          flexShrink: 0,
          userSelect: "none",
          boxSizing: "border-box",
        }}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className={!loaded ? "menu-shimmer-bg" : undefined}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: "14px",
        overflow: "hidden",
        backgroundColor: "#F5EFE6",
        border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
        flexShrink: 0,
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity 200ms ease",
        }}
      />
    </div>
  );
}

// Round Dish Photo with fixed size, shimmer placeholder, letter fallback, and smooth fade-in
function RoundDishPhoto({
  src,
  name,
  size = 64,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const initial = (name || "D").trim().charAt(0).toUpperCase();

  if (!src || failed) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #F5EFE6 0%, #E8DCCB 100%)",
          border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: MENU_TOKENS.colors.light.accentInk,
          fontFamily: MENU_TOKENS.fonts.serif,
          fontSize: `${Math.floor(size * 0.42)}px`,
          fontWeight: 700,
          flexShrink: 0,
          userSelect: "none",
          boxSizing: "border-box",
        }}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className={!loaded ? "menu-shimmer-bg" : undefined}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        overflow: "hidden",
        backgroundColor: "#F5EFE6",
        border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
        flexShrink: 0,
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          borderRadius: "50%",
          opacity: loaded ? 1 : 0,
          transition: "opacity 200ms ease",
        }}
      />
    </div>
  );
}

export default function RestaurantExperience({
  business,
  device,
  categories,
  items,
  offers = [],
  initialTab = "menu",
  tableOrderingEnabled = false,
  tableCount,
  quickRequests,
  loyaltyEnabled,
  feedbackEnabled,
  onOpenFeedback,
  onOpenLoyalty,
  onTrackAction,
}: RestaurantExperienceProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"menu" | "orders">(initialTab);

  // Search & category navigation
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const railNavRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchBarRef = useRef<HTMLDivElement | null>(null);

  // Dynamic sticky header metrics
  const [stickyMetrics, setStickyMetrics] = useState({
    headerTop: 0,
    stickyOffset: 124,
  });

  // Flag to suppress scroll spy flickering during smooth scroll triggered by category tap
  const isClickScrollingRef = useRef(false);
  const clickScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Read URL query parameter for ?table=N
  const [urlTableParam, setUrlTableParam] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setUrlTableParam(params.get("table"));
    }
  }, []);

  // Table number resolution in order: (a) stand, (b) ?table=N or session, (c) null
  const resolvedTableNum = useMemo(() => {
    return resolveSessionTableNumber({
      standLabel: device.label,
      standLocation: device.location,
      queryTableParam: urlTableParam,
      deviceCode: device.device_code,
      tableCount,
    });
  }, [device.label, device.location, device.device_code, urlTableParam, tableCount]);

  // Cart state: keyed by composite lineId: `${itemId}::${special_request.trim()}`
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [showCheckoutSheet, setShowCheckoutSheet] = useState(false);

  // Item customization / detail sheet
  type ItemType = (typeof items)[number];
  const [detailItem, setDetailItem] = useState<ItemType | null>(null);
  const [customRequest, setCustomRequest] = useState<string>("");
  const [customQty, setCustomQty] = useState<number>(1);

  // Checkout inputs
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tablePickerInput, setTablePickerInput] = useState("");
  const [tableNumber, setTableNumber] = useState<string>(() => {
    const initialNum = resolveSessionTableNumber({
      standLabel: device.label,
      standLocation: device.location,
      deviceCode: device.device_code,
      tableCount,
    });
    if (initialNum !== null && initialNum > 0) return String(initialNum);
    return "";
  });

  useEffect(() => {
    if (resolvedTableNum !== null && resolvedTableNum > 0) {
      setTableNumber((prev) => (prev && prev.trim() ? prev : String(resolvedTableNum)));
    }
  }, [resolvedTableNum]);

  const parsedCurrentTable = parseInt(tableNumber, 10);
  const isTableValid = Boolean(
    tableNumber &&
    tableNumber.trim() &&
    !isNaN(parsedCurrentTable) &&
    parsedCurrentTable >= 1 &&
    parsedCurrentTable <= (tableCount && tableCount > 0 ? tableCount : 999)
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Live order state
  const storageKey = `tapx_active_order_${business.id}_${device.device_code}`;
  const [currentOrder, setCurrentOrder] = useState<ActiveOrder | null>(null);
  const [currentOrderItems, setCurrentOrderItems] = useState<ActiveOrderItem[]>([]);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Cart animation trigger counter
  const [cartPopTrigger, setCartPopTrigger] = useState(0);

  // Active quick request options
  const activeQuickRequests = useMemo(() => {
    if (Array.isArray(quickRequests) && quickRequests.length > 0) {
      return quickRequests;
    }
    return DEFAULT_QUICK_REQUESTS;
  }, [quickRequests]);

  // Derived cart totals
  const cartLinesList = useMemo(() => Object.values(cart), [cart]);

  const totalCartCount = useMemo(
    () => cartLinesList.reduce((acc, line) => acc + line.quantity, 0),
    [cartLinesList]
  );

  const cartTotal = useMemo(
    () => cartLinesList.reduce((acc, line) => acc + line.unitPrice * line.quantity, 0),
    [cartLinesList]
  );

  // Trigger bounce animation when cart count changes
  useEffect(() => {
    if (totalCartCount > 0) {
      setCartPopTrigger((c) => c + 1);
    }
  }, [totalCartCount]);

  // Quick helper to get standard line count (no special request)
  const getStandardItemQty = (itemId: string) => {
    const key = `${itemId}::`;
    return cart[key]?.quantity || 0;
  };

  // Add standard item (+1) with no special request
  const addStandardItem = (item: ItemType) => {
    if (item.available === false) return;
    const price = parsePrice(item.price);
    const lineId = `${item.id}::`;
    setCart((prev) => {
      const existing = prev[lineId];
      if (existing) {
        return {
          ...prev,
          [lineId]: { ...existing, quantity: existing.quantity + 1 },
        };
      }
      return {
        ...prev,
        [lineId]: {
          lineId,
          itemId: item.id,
          name: item.name,
          unitPrice: price,
          quantity: 1,
          special_request: "",
          dietary: item.dietary,
          imageUrl: item.imageUrl || item.image_url,
        },
      };
    });
  };

  // Decrement standard item (-1)
  const removeStandardItem = (itemId: string) => {
    const lineId = `${itemId}::`;
    setCart((prev) => {
      const existing = prev[lineId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const copy = { ...prev };
        delete copy[lineId];
        return copy;
      }
      return {
        ...prev,
        [lineId]: { ...existing, quantity: existing.quantity - 1 },
      };
    });
  };

  // Update line quantity in checkout sheet
  const updateLineQty = (lineId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[lineId];
      if (!existing) return prev;
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[lineId];
        return copy;
      }
      return {
        ...prev,
        [lineId]: { ...existing, quantity: nextQty },
      };
    });
  };

  // Open item detail / customization sheet
  const openItemDetail = (item: ItemType) => {
    setDetailItem(item);
    setCustomRequest("");
    setCustomQty(1);
  };

  // Add customized item from detail sheet
  const handleAddCustomizedItem = () => {
    if (!detailItem || detailItem.available === false) return;
    const price = parsePrice(detailItem.price);
    const trimmedReq = customRequest.trim().slice(0, 200);
    const lineId = `${detailItem.id}::${trimmedReq}`;

    setCart((prev) => {
      const existing = prev[lineId];
      if (existing) {
        return {
          ...prev,
          [lineId]: {
            ...existing,
            quantity: existing.quantity + customQty,
          },
        };
      }
      return {
        ...prev,
        [lineId]: {
          lineId,
          itemId: detailItem.id,
          name: detailItem.name,
          unitPrice: price,
          quantity: customQty,
          special_request: trimmedReq,
          dietary: detailItem.dietary,
          imageUrl: detailItem.imageUrl || detailItem.image_url,
        },
      };
    });

    setDetailItem(null);
  };

  // Toggle quick-request chip in textarea
  const toggleQuickChip = (chip: string) => {
    const current = customRequest.trim();
    if (!current) {
      setCustomRequest(chip);
      return;
    }
    // Check if chip already present
    const regex = new RegExp(`(^|,\\s*)${chip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(,?\\s*|$)`, "i");
    if (regex.test(current)) {
      // Remove it
      const updated = current
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.toLowerCase() !== chip.toLowerCase())
        .join(", ");
      setCustomRequest(updated);
    } else {
      // Append if length <= 200
      const next = `${current}, ${chip}`;
      if (next.length <= 200) {
        setCustomRequest(next);
      }
    }
  };

  // Filtered menu items (search only, dietary filter removed from customer menu)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search query (filters by dish name and description)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = (item.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  }, [items, searchQuery]);

  // Group filtered items by category (preserves owner order, excludes empty categories)
  const groupedCategories = useMemo(() => {
    const categoryMap = new Map<string, { cat: (typeof categories)[number]; items: ItemType[] }>();

    for (const cat of categories) {
      categoryMap.set(cat.id, { cat, items: [] });
    }

    const uncategorizedItems: ItemType[] = [];

    for (const item of filteredItems) {
      const catId = item.categoryId || item.category_id;
      if (catId && categoryMap.has(catId)) {
        categoryMap.get(catId)!.items.push(item);
      } else {
        uncategorizedItems.push(item);
      }
    }

    const result = Array.from(categoryMap.values()).filter((g) => g.items.length > 0);

    if (uncategorizedItems.length > 0) {
      result.push({
        cat: { id: "other", name: "Other Items" },
        items: uncategorizedItems,
      });
    }

    return result;
  }, [categories, filteredItems]);

  // Sync active category ID when groupedCategories load or update
  useEffect(() => {
    if (groupedCategories.length > 0) {
      const exists = groupedCategories.some((g) => g.cat.id === activeCategoryId);
      if (!exists) {
        setActiveCategoryId(groupedCategories[0].cat.id);
      }
    }
  }, [groupedCategories, activeCategoryId]);

  // Find the real scrolling container (layerOverlay in DiningLayerWrapper, or window)
  const getScrollContainer = useCallback((): HTMLElement | Window => {
    let parent = rootRef.current?.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const style = window.getComputedStyle(parent);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        return parent;
      }
      parent = parent.parentElement;
    }
    return window;
  }, []);

  // Lock background scroll when any modal sheet is open
  const isAnySheetOpen = Boolean(detailItem || showCheckoutSheet || showTablePicker);

  useEffect(() => {
    if (typeof document === "undefined" || !isAnySheetOpen) return;
    const container = getScrollContainer();
    const origBodyOverflow = document.body.style.overflow;
    let origContainerOverflow = "";
    if (container instanceof HTMLElement) {
      origContainerOverflow = container.style.overflow;
      container.style.overflow = "hidden";
    }
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = origBodyOverflow;
      if (container instanceof HTMLElement) {
        container.style.overflow = origContainerOverflow;
      }
    };
  }, [isAnySheetOpen, getScrollContainer]);

  // Dynamically measure sticky header heights based on actual DOM elements
  const measureStickyMetrics = useCallback(() => {
    if (typeof window === "undefined" || !rootRef.current) return;

    const container = getScrollContainer();
    let topOffset = 0;

    if (container instanceof HTMLElement) {
      // In DiningLayerWrapper: container has layerHeader (Back button) at top: 0
      const prevSibling = rootRef.current.parentElement?.previousElementSibling as HTMLElement | null;
      if (prevSibling && prevSibling.offsetHeight > 0) {
        topOffset = prevSibling.offsetHeight;
      }
    } else {
      // In standalone window mode: topHeader sits at top
      const topHeader = rootRef.current.querySelector<HTMLElement>("header");
      if (topHeader && topHeader.offsetHeight > 0) {
        topOffset = topHeader.offsetHeight;
      }
    }

    const searchBarH = searchBarRef.current?.offsetHeight || 56;
    const totalOffset = topOffset + searchBarH;

    setStickyMetrics({
      headerTop: topOffset,
      stickyOffset: totalOffset > 0 ? totalOffset : 124,
    });
  }, [getScrollContainer]);

  useEffect(() => {
    measureStickyMetrics();
    window.addEventListener("resize", measureStickyMetrics);
    return () => window.removeEventListener("resize", measureStickyMetrics);
  }, [measureStickyMetrics]);

  // Scroll to category section smoothly on the real scroll container
  const scrollToCategory = (catId: string) => {
    setActiveCategoryId(catId);

    // Suppress scroll spy updates during programmatic smooth scroll to prevent category flickering
    isClickScrollingRef.current = true;
    if (clickScrollTimeoutRef.current) {
      clearTimeout(clickScrollTimeoutRef.current);
    }
    clickScrollTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 800);

    const container = getScrollContainer();
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = prefersReduced ? "auto" : "smooth";

    if (catId === "all") {
      if (container instanceof HTMLElement) {
        container.scrollTo({ top: 0, behavior });
      } else {
        window.scrollTo({ top: 0, behavior });
      }
      return;
    }

    const elem = document.getElementById(`cat-section-${catId}`);
    if (!elem) return;

    if (container instanceof HTMLElement) {
      const containerRect = container.getBoundingClientRect();
      const elemRect = elem.getBoundingClientRect();
      const targetTop =
        container.scrollTop + (elemRect.top - containerRect.top) - (stickyMetrics.stickyOffset + 8);
      container.scrollTo({ top: Math.max(0, targetTop), behavior });
    } else {
      const elemRect = elem.getBoundingClientRect();
      const targetTop =
        window.scrollY + elemRect.top - (stickyMetrics.stickyOffset + 8);
      window.scrollTo({ top: Math.max(0, targetTop), behavior });
    }
  };

  // Release scroll-lock if user manually wheels, touches or clicks during smooth scroll
  useEffect(() => {
    const container = getScrollContainer();
    const target = container instanceof HTMLElement ? container : window;
    const unlock = () => {
      isClickScrollingRef.current = false;
    };

    target.addEventListener("wheel", unlock, { passive: true });
    target.addEventListener("touchstart", unlock, { passive: true });
    target.addEventListener("pointerdown", unlock, { passive: true });

    return () => {
      target.removeEventListener("wheel", unlock);
      target.removeEventListener("touchstart", unlock);
      target.removeEventListener("pointerdown", unlock);
    };
  }, [getScrollContainer]);

  // Throttled scroll spy on the REAL scroll container
  useEffect(() => {
    const container = getScrollContainer();
    let ticking = false;

    const handleScroll = () => {
      if (isClickScrollingRef.current) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (groupedCategories.length === 0) {
            ticking = false;
            return;
          }

          const currentScroll =
            container instanceof HTMLElement
              ? container.scrollTop
              : window.scrollY;

          const maxScroll =
            container instanceof HTMLElement
              ? container.scrollHeight - container.clientHeight
              : document.documentElement.scrollHeight - window.innerHeight;

          if (MENU_CATEGORY_NAV === "chips" && currentScroll < 80) {
            setActiveCategoryId("all");
            ticking = false;
            return;
          }

          if (currentScroll < 40) {
            setActiveCategoryId(groupedCategories[0].cat.id);
            ticking = false;
            return;
          }

          // Near bottom of list
          if (maxScroll > 0 && currentScroll >= maxScroll - 30) {
            setActiveCategoryId(groupedCategories[groupedCategories.length - 1].cat.id);
            ticking = false;
            return;
          }

          const containerTop =
            container instanceof HTMLElement
              ? container.getBoundingClientRect().top
              : 0;

          const threshold = containerTop + stickyMetrics.stickyOffset + 24;

          for (let i = groupedCategories.length - 1; i >= 0; i--) {
            const grp = groupedCategories[i];
            const elem = document.getElementById(`cat-section-${grp.cat.id}`);
            if (elem) {
              const rect = elem.getBoundingClientRect();
              if (rect.top <= threshold) {
                setActiveCategoryId(grp.cat.id);
                break;
              }
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    const target = container instanceof HTMLElement ? container : window;
    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => target.removeEventListener("scroll", handleScroll);
  }, [groupedCategories, getScrollContainer, stickyMetrics.stickyOffset]);

  // Keep active rail category button visible in scrollable rail
  useEffect(() => {
    if (railNavRef.current && activeCategoryId) {
      const activeBtn = railNavRef.current.querySelector<HTMLElement>(
        `[data-category-id="${activeCategoryId}"]`
      );
      if (activeBtn) {
        const navTop = railNavRef.current.scrollTop;
        const navHeight = railNavRef.current.clientHeight;
        const btnTop = activeBtn.offsetTop;
        const btnHeight = activeBtn.offsetHeight;
        if (btnTop < navTop) {
          railNavRef.current.scrollTo({ top: btnTop, behavior: "smooth" });
        } else if (btnTop + btnHeight > navTop + navHeight) {
          railNavRef.current.scrollTo({
            top: btnTop + btnHeight - navHeight,
            behavior: "smooth",
          });
        }
      }
    }
  }, [activeCategoryId]);

  // Load active order from storage
  const loadActiveOrder = async (orderIdOverride?: string) => {
    try {
      const savedId =
        orderIdOverride ||
        (typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null);

      if (!savedId) {
        setCurrentOrder(null);
        setCurrentOrderItems([]);
        return;
      }

      const { data: orderData, error: orderErr } = await supabase.rpc(
        "get_tap_order_status",
        { p_order_id: savedId }
      );

      if (orderErr || !orderData) {
        if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
        setCurrentOrder(null);
        setCurrentOrderItems([]);
        return;
      }

      const typedOrder = {
        id: String(orderData.id),
        order_number: (orderData as any).order_number || null,
        table_number: orderData.table_number,
        customer_name: "",
        customer_phone: "",
        status: String(orderData.status),
        subtotal: Number(orderData.subtotal || 0),
        total: Number(orderData.total || 0),
        created_at: String(orderData.created_at),
      } as ActiveOrder;

      setCurrentOrder(typedOrder);
      if (typedOrder.table_number) {
        setTableNumber(String(typedOrder.table_number));
      }

      const activeStatuses = ["pending", "accepted", "preparing", "ready", "served"];
      if (!activeStatuses.includes(typedOrder.status) && typedOrder.status !== "completed") {
        setCurrentOrderItems([]);
        return;
      }

      setCurrentOrderItems((orderData.items || []) as ActiveOrderItem[]);
    } catch (err) {
      console.warn("TAPX active order polling warning:", err);
    }
  };

  // Poll active order
  useEffect(() => {
    void loadActiveOrder();
    const interval = setInterval(() => {
      void loadActiveOrder();
    }, 7000);
    return () => clearInterval(interval);
  }, [business.id, device.device_code]);

  // Place Table Order
  const handlePlaceOrder = async () => {
    setOrderError("");
    const parsedNum = parseInt(tableNumber, 10);
    if (!tableNumber || isNaN(parsedNum) || parsedNum < 1 || parsedNum > (tableCount && tableCount > 0 ? tableCount : 999)) {
      setOrderError("Please select or enter a valid table number.");
      return;
    }
    if (cartLinesList.length === 0) {
      setOrderError("Please add items to your cart.");
      return;
    }

    // Name is optional. When blank, send "Table N" as p_customer_name (client side only)
    const resolvedName = customerName.trim()
      ? customerName.trim().slice(0, 80)
      : `Table ${parsedNum}`.slice(0, 80);

    setPlacingOrder(true);
    try {
      const cleanPhone = customerPhone.replace(/\D/g, "");

      const { data, error: rpcErr } = await supabase.rpc("create_tapx_table_order", {
        p_business_id: business.id,
        p_table_number: parsedNum,
        p_customer_name: resolvedName,
        p_customer_phone: cleanPhone || null,
        p_source_device_code: device.device_code,
        p_items: cartLinesList.map((line) => ({
          item_id: line.itemId,
          quantity: line.quantity,
          special_request: line.special_request ? line.special_request.trim().slice(0, 200) : null,
        })),
      });

      if (rpcErr) throw rpcErr;

      const newOrderId = String(data || "");
      if (newOrderId && typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, newOrderId);
      }

      setCart({});
      setShowCheckoutSheet(false);
      setActiveTab("orders");
    } catch (err: any) {
      console.error("Error creating table order:", err);
      setOrderError(err.message || "Failed to place order. Please check your table number.");
    } finally {
      setPlacingOrder(false);
    }
  };

  // Cancel Order
  const handleCancelOrder = async () => {
    if (!currentOrder) return;
    if (!confirm("Are you sure you want to cancel this order?")) return;

    setCancellingOrder(true);
    try {
      const { data: wasCancelled, error: rpcErr } = await supabase.rpc(
        "cancel_tapx_order",
        { p_order_id: currentOrder.id }
      );

      if (rpcErr) throw new Error(rpcErr.message || "Failed to cancel order.");

      if (!wasCancelled) {
        alert(
          "This order cannot be cancelled online because it has already been accepted or is being prepared by the kitchen. Please speak to staff directly."
        );
        await loadActiveOrder(currentOrder.id);
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(storageKey);
      }
      setCurrentOrder(null);
      setCurrentOrderItems([]);
    } catch (err: any) {
      alert("Unable to cancel order: " + (err.message || err));
    } finally {
      setCancellingOrder(false);
    }
  };

  const hasActiveOrder = Boolean(currentOrder && currentOrder.status !== "cancelled");

  // Format order created time
  const formatOrderTime = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Status mapping
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
      case "accepted":
        return { label: "Received", step: 1, bg: "#EBF3FF", color: "#1D4ED8", border: "#BFDBFE" };
      case "preparing":
        return { label: "Preparing", step: 2, bg: "#FEF7EC", color: "#B45309", border: "#FDE68A" };
      case "ready":
        return { label: "Ready to Serve", step: 3, bg: "#EAF7EE", color: "#047857", border: "#A7F3D0" };
      case "served":
      case "completed":
        return { label: "Served", step: 4, bg: "#EAF7EE", color: "#15803D", border: "#BBF7D0" };
      case "cancelled":
        return { label: "Cancelled", step: 0, bg: "#FDF2F2", color: "#B91C1C", border: "#FECACA" };
      default:
        return { label: "Active", step: 1, bg: "#EBF3FF", color: "#1D4ED8", border: "#BFDBFE" };
    }
  };

  return (
    <div ref={rootRef} className={menuFontClassNames} style={styles.container}>
      {/* Inject Design System CSS Keyframes, CSS variables, and overrides */}
      <style dangerouslySetInnerHTML={{ __html: MENU_THEME_GLOBAL_CSS }} />

      {/* ---------------------------------------------------- */}
      {/* 1. TOP BRAND & ACTION HEADER */}
      {/* ---------------------------------------------------- */}
      <header style={styles.topHeader}>
        <div style={styles.brandRow}>
          {business.logo_url ? (
            <img src={business.logo_url} alt={business.name} style={styles.brandLogo} />
          ) : (
            <div style={styles.brandLogoPlaceholder}>
              {(business.name || "M").charAt(0).toUpperCase()}
            </div>
          )}

          <div style={styles.brandTextWrap}>
            <h1 style={styles.businessNameHeading}>{business.name}</h1>
            {tableOrderingEnabled && (
              isTableValid ? (
                <div style={styles.tableChip}>
                  Table {tableNumber}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTablePicker(true)}
                  className="menu-tap-press"
                  style={styles.tablePickerTriggerBtn}
                  title="Choose table number"
                >
                  Choose Table ›
                </button>
              )
            )}
          </div>
        </div>

        <div style={styles.headerRightActions}>
          {tableOrderingEnabled && Boolean(tableNumber && tableNumber.trim()) && (business.whatsapp_number || business.phone) && (
            <a
              href={
                business.whatsapp_number
                  ? `https://wa.me/${business.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Table ${tableNumber} needs assistance`
                    )}`
                  : `tel:${business.phone}`
              }
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onTrackAction && onTrackAction("whatsapp_click")}
              className="menu-tap-press"
              style={styles.callStaffBtn}
              title="Call Staff"
            >
              <WhatsAppIcon size={16} />
              <span>Call Staff</span>
            </a>
          )}
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 2. TAB: MENU */}
      {/* ---------------------------------------------------- */}
      {activeTab === "menu" && (
        <div style={styles.menuTabContainer}>
          {/* SEARCH BAR (Quiet pill, sticky under header) */}
          <div
            ref={searchBarRef}
            style={{
              ...styles.searchBarWrapper,
              top: `${stickyMetrics.headerTop}px`,
            }}
          >
            <div style={styles.searchInputBox}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Search dishes or drinks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={styles.clearSearchBtn}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* HORIZONTAL CHIPS NAV (Preserved behind MENU_CATEGORY_NAV === 'chips') */}
          {MENU_CATEGORY_NAV === "chips" && (
            <div style={styles.stickyFilterContainer}>
              <div style={styles.categoryScrollContainer}>
                <button
                  type="button"
                  onClick={() => scrollToCategory("all")}
                  className="menu-tap-press"
                  style={{
                    ...styles.categoryChip,
                    backgroundColor: activeCategoryId === "all" ? MENU_TOKENS.colors.light.ink : "#FFFFFF",
                    color: activeCategoryId === "all" ? "#FFFFFF" : MENU_TOKENS.colors.light.muted,
                    borderColor: activeCategoryId === "all" ? MENU_TOKENS.colors.light.ink : MENU_TOKENS.colors.light.hairline,
                  }}
                >
                  All ({filteredItems.length})
                </button>
                {groupedCategories.map((group) => (
                  <button
                    key={group.cat.id}
                    type="button"
                    onClick={() => scrollToCategory(group.cat.id)}
                    className="menu-tap-press"
                    style={{
                      ...styles.categoryChip,
                      backgroundColor: activeCategoryId === group.cat.id ? MENU_TOKENS.colors.light.ink : "#FFFFFF",
                      color: activeCategoryId === group.cat.id ? "#FFFFFF" : MENU_TOKENS.colors.light.muted,
                      borderColor: activeCategoryId === group.cat.id ? MENU_TOKENS.colors.light.ink : MENU_TOKENS.colors.light.hairline,
                    }}
                  >
                    {formatDisplayName(group.cat.name)} ({group.items.length})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TWO-COLUMN LAYOUT: Left Rail + Content Column */}
          <div style={styles.menuBodyRow}>
            {/* LEFT RAIL (Categories) - Only shown in rail mode when >1 categories exist */}
            {MENU_CATEGORY_NAV === "rail" && groupedCategories.length > 1 && (
              <nav
                aria-label="Categories"
                className="menu-rail-nav"
                ref={railNavRef}
                style={{
                  ...styles.railNav,
                  top: `${stickyMetrics.stickyOffset + 6}px`,
                  maxHeight: `calc(100vh - ${stickyMetrics.stickyOffset + 16}px)`,
                }}
              >
                {groupedCategories.map((group) => {
                  const isActive = activeCategoryId === group.cat.id;
                  return (
                    <button
                      key={group.cat.id}
                      type="button"
                      onClick={() => scrollToCategory(group.cat.id)}
                      className="menu-rail-btn menu-tap-press"
                      aria-current={isActive ? "true" : undefined}
                      data-category-id={group.cat.id}
                      style={{
                        ...styles.railItemBtn,
                        backgroundColor: isActive ? MENU_TOKENS.colors.light.accentLight : "transparent",
                      }}
                    >
                      <div
                        style={{
                          ...styles.railThumbnailBox,
                          boxShadow: isActive
                            ? `0 0 0 2px ${MENU_TOKENS.colors.light.accent}`
                            : `0 0 0 1px ${MENU_TOKENS.colors.light.hairline}`,
                        }}
                      >
                        {group.cat.image ? (
                          <img
                            src={group.cat.image}
                            alt=""
                            loading="lazy"
                            style={styles.railThumbnailImg}
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                              const sib = e.currentTarget.nextElementSibling as HTMLElement;
                              if (sib) sib.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            ...styles.railThumbnailLetter,
                            display: group.cat.image ? "none" : "flex",
                          }}
                        >
                          {(group.cat.name || "C").charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <span
                        style={{
                          ...styles.railItemLabel,
                          color: isActive ? MENU_TOKENS.colors.light.accentInk : MENU_TOKENS.colors.light.ink,
                          fontWeight: isActive ? 700 : 500,
                        }}
                      >
                        {formatDisplayName(group.cat.name)}
                      </span>
                    </button>
                  );
                })}
              </nav>
            )}

            {/* CONTENT COLUMN */}
            <div
              style={{
                ...styles.contentCol,
                width: MENU_CATEGORY_NAV === "rail" && groupedCategories.length > 1 ? undefined : "100%",
              }}
            >
              {groupedCategories.length === 0 ? (
                <div style={styles.emptyStateCard}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>🍽️</div>
                  <div style={styles.emptyStateTitle}>No dishes found</div>
                  <div style={styles.emptyStateSubtitle}>
                    Try clearing your search query.
                  </div>
                </div>
              ) : (
                groupedCategories.map((group) => (
                  <section
                    key={group.cat.id}
                    id={`cat-section-${group.cat.id}`}
                    style={{
                      ...styles.categorySection,
                      scrollMarginTop: `${stickyMetrics.stickyOffset + 8}px`,
                    }}
                  >
                    <div style={styles.sectionHeaderRow}>
                      <h2 style={styles.sectionCategoryTitle}>{formatDisplayName(group.cat.name)}</h2>
                      <span style={styles.sectionItemCountBadge}>
                        {group.items.length} {group.items.length === 1 ? "dish" : "dishes"}
                      </span>
                    </div>

                    {/* DISH CARDS (Controlled by MENU_LAYOUT) */}
                    {MENU_LAYOUT === "rail-grid" ? (
                      <div style={styles.dishGridWrap}>
                        {group.items.map((dish, idx) => {
                          const isSoldOut = dish.available === false;
                          const numPrice = parsePrice(dish.price);
                          const stdQty = getStandardItemQty(dish.id);

                          return (
                            <div
                              key={dish.id}
                              className="menu-tap-press"
                              style={{
                                ...styles.gridDishCard,
                                opacity: isSoldOut ? 0.55 : 1,
                                backgroundColor: isSoldOut ? "#F7F5F0" : "#FFFFFF",
                                filter: isSoldOut ? "grayscale(25%)" : "none",
                                animation: idx < 8 ? `menuCardFadeIn 260ms cubic-bezier(0.22, 1, 0.36, 1) ${idx * 30}ms both` : undefined,
                              }}
                              onClick={() => {
                                openItemDetail(dish);
                              }}
                            >
                              {/* Round Photo with Dietary mark */}
                              <div style={styles.gridPhotoWrap}>
                                <RoundDishPhoto
                                  src={dish.imageUrl || dish.image_url}
                                  name={dish.name}
                                  size={64}
                                />
                                {dish.dietary && (
                                  <div style={styles.gridDietaryMark}>
                                    <DietaryBadge dietary={dish.dietary} size={14} />
                                  </div>
                                )}
                              </div>

                              {/* Bestseller Badge */}
                              {dish.popular && (
                                <span style={styles.gridPopularTag}>★ Bestseller</span>
                              )}

                              {/* Dish Name */}
                              <h3 style={styles.gridDishName}>{formatDisplayName(dish.name)}</h3>

                              {/* Description (omitted if empty) */}
                              {dish.description ? (
                                <p style={styles.gridDishDescription}>{dish.description}</p>
                              ) : null}

                              {/* Tabular Price */}
                              <div style={styles.gridDishPrice}>
                                ₹{numPrice.toFixed(0)}
                              </div>

                              {/* Actions / Stepper */}
                              <div
                                style={styles.gridDishActions}
                                onClick={(e) => {
                                  if (tableOrderingEnabled) e.stopPropagation();
                                }}
                              >
                                {tableOrderingEnabled ? (
                                  <>
                                    {isSoldOut ? (
                                      <div style={styles.gridSoldOutPill}>Sold out</div>
                                    ) : stdQty > 0 ? (
                                      <div style={styles.gridStepperBox}>
                                        <button
                                          type="button"
                                          onClick={() => removeStandardItem(dish.id)}
                                          className="menu-tap-press"
                                          style={styles.gridStepperBtn}
                                          aria-label={`Remove one ${dish.name}`}
                                        >
                                          −
                                        </button>
                                        <span style={styles.gridStepperQty}>{stdQty}</span>
                                        <button
                                          type="button"
                                          onClick={() => addStandardItem(dish)}
                                          className="menu-tap-press"
                                          style={styles.gridStepperBtn}
                                          aria-label={`Add one ${dish.name}`}
                                        >
                                          +
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => addStandardItem(dish)}
                                        className="menu-tap-press"
                                        style={styles.gridAddBtn}
                                      >
                                        + ADD
                                      </button>
                                    )}

                                    {!isSoldOut && (
                                      <button
                                        type="button"
                                        onClick={() => openItemDetail(dish)}
                                        style={styles.gridCustomizeLink}
                                      >
                                        Customize ›
                                      </button>
                                    )}
                                  </>
                                ) : isSoldOut ? (
                                  <div style={styles.gridSoldOutPill}>Sold out</div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* rail-list alternative */
                      <div style={styles.dishListWrap}>
                        {group.items.map((dish, idx) => {
                          const isSoldOut = dish.available === false;
                          const numPrice = parsePrice(dish.price);
                          const stdQty = getStandardItemQty(dish.id);

                          return (
                            <div
                              key={dish.id}
                              className="menu-tap-press"
                              style={{
                                ...styles.listDishCard,
                                opacity: isSoldOut ? 0.55 : 1,
                                backgroundColor: isSoldOut ? "#F7F5F0" : "#FFFFFF",
                                filter: isSoldOut ? "grayscale(25%)" : "none",
                                animation: idx < 6 ? `menuCardFadeIn 260ms cubic-bezier(0.22, 1, 0.36, 1) ${idx * 40}ms both` : undefined,
                              }}
                              onClick={() => {
                                openItemDetail(dish);
                              }}
                            >
                              {/* Left: 76px Round Photo with Dietary mark */}
                              <div style={styles.listPhotoWrap}>
                                <RoundDishPhoto
                                  src={dish.imageUrl || dish.image_url}
                                  name={dish.name}
                                  size={76}
                                />
                                {dish.dietary && (
                                  <div style={styles.listDietaryMark}>
                                    <DietaryBadge dietary={dish.dietary} size={15} />
                                  </div>
                                )}
                              </div>

                              {/* Middle: Info */}
                              <div style={styles.dishInfoCol}>
                                <div style={styles.dishTagRow}>
                                  {dish.popular && (
                                    <span style={styles.popularTag}>★ Bestseller</span>
                                  )}
                                  {isSoldOut && (
                                    <span style={styles.soldOutBadge}>Sold out</span>
                                  )}
                                </div>
                                <h3 style={styles.dishName}>{formatDisplayName(dish.name)}</h3>
                                <div style={styles.dishPriceText}>
                                  ₹{numPrice.toFixed(0)}
                                </div>
                                {dish.description && (
                                  <p style={styles.dishDescription}>{dish.description}</p>
                                )}
                              </div>

                              {/* Right: Actions */}
                              <div
                                style={styles.dishActionCol}
                                onClick={(e) => {
                                  if (tableOrderingEnabled) e.stopPropagation();
                                }}
                              >
                                {tableOrderingEnabled ? (
                                  <div style={styles.dishBtnWrap}>
                                    {isSoldOut ? (
                                      <button type="button" disabled style={styles.soldOutBtn}>
                                        Sold out
                                      </button>
                                    ) : stdQty > 0 ? (
                                      <div style={styles.stepperBox}>
                                        <button
                                          type="button"
                                          onClick={() => removeStandardItem(dish.id)}
                                          className="menu-tap-press"
                                          style={styles.stepperActionBtn}
                                          aria-label={`Remove one ${dish.name}`}
                                        >
                                          −
                                        </button>
                                        <span style={styles.stepperValue}>{stdQty}</span>
                                        <button
                                          type="button"
                                          onClick={() => addStandardItem(dish)}
                                          className="menu-tap-press"
                                          style={styles.stepperActionBtn}
                                          aria-label={`Add one ${dish.name}`}
                                        >
                                          +
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => addStandardItem(dish)}
                                        className="menu-tap-press"
                                        style={styles.addBtn}
                                      >
                                        + ADD
                                      </button>
                                    )}
                                    {!isSoldOut && (
                                      <button
                                        type="button"
                                        onClick={() => openItemDetail(dish)}
                                        style={styles.customizeLinkBtn}
                                      >
                                        Customize ›
                                      </button>
                                    )}
                                  </div>
                                ) : isSoldOut ? (
                                  <div style={styles.dishBtnWrap}>
                                    <div
                                      style={{
                                        ...styles.soldOutBtn,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      Sold out
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                ))
              )}

              {/* Bottom spacer so the last category can scroll all the way to the top */}
              {groupedCategories.length > 0 && (
                <div
                  style={{
                    minHeight: `calc(100vh - ${stickyMetrics.stickyOffset + 80}px)`,
                    pointerEvents: "none",
                  }}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. TAB: MY ORDERS (Live Tracker) */}
      {/* ---------------------------------------------------- */}
      {tableOrderingEnabled && activeTab === "orders" && (
        <div style={styles.ordersTabContainer}>
          <div style={styles.ordersHeaderBox}>
            <div style={styles.ordersTablePill}>Table {tableNumber || "1"}</div>
            <h2 style={styles.ordersPageTitle}>My Orders</h2>
            <p style={styles.ordersPageSub}>
              Live status updates for your dine-in table order
            </p>
          </div>

          {currentOrder ? (
            <div style={styles.orderCard}>
              {/* Status Header */}
              <div style={styles.orderTopMetaRow}>
                <div>
                  <div style={styles.orderIdText}>
                    Order #{formatOrderNumber(currentOrder)}
                  </div>
                  <div style={styles.orderTimeText}>
                    Placed at {formatOrderTime(currentOrder.created_at) || "Just now"}
                  </div>
                </div>
                <div
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: getStatusDisplay(currentOrder.status).bg,
                    color: getStatusDisplay(currentOrder.status).color,
                    borderColor: getStatusDisplay(currentOrder.status).border,
                  }}
                >
                  {getStatusDisplay(currentOrder.status).label}
                </div>
              </div>

              {/* 4-Step Visual Progress Bar */}
              {currentOrder.status !== "cancelled" && (
                <div style={styles.stepperProgressContainer}>
                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressBarFill,
                        transform: `scaleX(${Math.min(
                          1,
                          Math.max(
                            0,
                            (getStatusDisplay(currentOrder.status).step - 1) / 3
                          )
                        )})`,
                      }}
                    />
                  </div>

                  <div style={styles.stepsRow}>
                    {[
                      { step: 1, label: "Received" },
                      { step: 2, label: "Preparing" },
                      { step: 3, label: "Ready" },
                      { step: 4, label: "Served" },
                    ].map((s) => {
                      const currentStep = getStatusDisplay(currentOrder.status).step;
                      const isDone = currentStep >= s.step;
                      const isCurrent = currentStep === s.step;

                      return (
                        <div key={s.step} style={styles.stepCol}>
                          <div
                            style={{
                              ...styles.stepNode,
                              backgroundColor: isDone ? MENU_TOKENS.colors.light.veg : "#FFFFFF",
                              borderColor: isCurrent ? MENU_TOKENS.colors.light.accent : isDone ? MENU_TOKENS.colors.light.veg : MENU_TOKENS.colors.light.hairline,
                              color: isDone ? "#FFFFFF" : MENU_TOKENS.colors.light.muted,
                              animation: isCurrent ? "livePulseStep 2s infinite ease-in-out" : undefined,
                            }}
                          >
                            {isDone ? "✓" : s.step}
                          </div>
                          <span
                            style={{
                              ...styles.stepNodeLabel,
                              color: isCurrent ? MENU_TOKENS.colors.light.ink : isDone ? MENU_TOKENS.colors.light.veg : MENU_TOKENS.colors.light.muted,
                              fontWeight: isCurrent ? 700 : 500,
                            }}
                          >
                            {s.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Items Breakdown */}
              <div style={styles.orderItemsSection}>
                <div style={styles.sectionSubHeader}>Items in this order:</div>
                <div style={styles.orderItemsList}>
                  {currentOrderItems.map((item) => (
                    <div key={item.id} style={styles.orderItemCardRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.orderItemNameLine}>
                          <span style={styles.orderItemName}>{formatDisplayName(item.item_name)}</span>
                          <span style={styles.orderItemQtyTag}>x{item.quantity}</span>
                        </div>

                        {/* Special request display */}
                        {item.special_request && (
                          <div style={styles.itemRequestBadge}>
                            <strong style={{ fontWeight: 700 }}>Request:</strong>{" "}
                            {item.special_request}
                          </div>
                        )}
                      </div>

                      <div style={styles.orderItemPrice}>
                        ₹{Number(item.line_total || 0).toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={styles.orderTotalDivider} />

                <div style={styles.orderTotalRow}>
                  <span style={styles.orderTotalLabel}>Total Amount:</span>
                  <span style={styles.orderTotalAmount}>
                    ₹{Number(currentOrder.total || 0).toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Add more items, WhatsApp, Cancel */}
              <div style={styles.orderActionsRow}>
                <button
                  type="button"
                  onClick={() => setActiveTab("menu")}
                  className="menu-tap-press"
                  style={styles.orderMoreBtn}
                >
                  🍴 Order More Items
                </button>

                {currentOrder.status === "pending" && (
                  <button
                    type="button"
                    disabled={cancellingOrder}
                    onClick={handleCancelOrder}
                    className="menu-tap-press"
                    style={styles.cancelBtn}
                  >
                    {cancellingOrder ? "Cancelling..." : "Cancel Order"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={styles.emptyOrdersCard}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🧾</div>
              <h3 style={styles.emptyOrdersTitle}>No active order</h3>
              <p style={styles.emptyOrdersSub}>
                You haven&apos;t placed any table orders yet. Browse our menu to add items and place an order.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("menu")}
                className="menu-tap-press"
                style={styles.browseMenuBtn}
              >
                Browse Menu
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. STICKY BOTTOM CART BAR */}
      {/* ---------------------------------------------------- */}
      {tableOrderingEnabled && totalCartCount > 0 && activeTab === "menu" && (
        <div style={styles.stickyCartBarWrap}>
          <div
            key={cartPopTrigger}
            style={{
              ...styles.stickyCartBar,
              animation: "cartBarPop 220ms ease",
            }}
          >
            <div>
              <div style={styles.cartCountLabel}>
                {totalCartCount} {totalCartCount === 1 ? "item" : "items"}
              </div>
              <div style={styles.cartTotalLabel}>₹{cartTotal.toFixed(0)}</div>
            </div>

            <button
              type="button"
              onClick={() => setShowCheckoutSheet(true)}
              className="menu-tap-press"
              style={styles.viewCartBtn}
            >
              <span>View Order</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. ITEM DETAIL & CUSTOMIZATION SHEET (MODAL) */}
      {/* ---------------------------------------------------- */}
      {mounted && typeof document !== "undefined" && detailItem && createPortal(
        <div
          style={styles.modalOverlay}
          className={menuFontClassNames}
          onClick={() => setDetailItem(null)}
        >
          <div
            style={styles.modalSheet}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleRow}>
                <DietaryBadge dietary={detailItem.dietary} size={16} />
                <h3 style={styles.modalTitle}>{formatDisplayName(detailItem.name)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                style={styles.modalCloseBtn}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Big Dish Photo / Fallback */}
              {(detailItem.imageUrl || detailItem.image_url) && (
                <div style={styles.modalImageWrap}>
                  <img
                    src={detailItem.imageUrl || detailItem.image_url}
                    alt={detailItem.name}
                    loading="lazy"
                    decoding="async"
                    style={styles.modalImg}
                  />
                </div>
              )}

              <div style={styles.modalPriceText}>
                ₹{parsePrice(detailItem.price).toFixed(0)}
              </div>

              {detailItem.description && (
                <p style={styles.modalDescription}>{detailItem.description}</p>
              )}

              {/* Quick customization & special instructions (ordering mode only) */}
              {tableOrderingEnabled && detailItem.available !== false && (
                <div style={styles.customizationSection}>
                  <label style={styles.customLabel}>
                    Quick customizations (tap to add):
                  </label>
                  <div style={styles.quickChipsWrap}>
                    {activeQuickRequests.map((chip) => {
                      const isSelected = customRequest
                        .toLowerCase()
                        .includes(chip.toLowerCase());
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => toggleQuickChip(chip)}
                          className="menu-tap-press"
                          style={{
                            ...styles.quickChipBtn,
                            backgroundColor: isSelected ? MENU_TOKENS.colors.light.accentInk : MENU_TOKENS.colors.light.accentLight,
                            color: isSelected ? "#FFFFFF" : MENU_TOKENS.colors.light.ink,
                            borderColor: isSelected ? MENU_TOKENS.colors.light.accentInk : MENU_TOKENS.colors.light.accentBorder,
                          }}
                        >
                          {isSelected ? "✓ " : "+ "}
                          {chip}
                        </button>
                      );
                    })}
                  </div>

                  <label style={{ ...styles.customLabel, marginTop: "14px" }}>
                    Special instructions for kitchen:
                  </label>
                  <textarea
                    rows={2}
                    maxLength={200}
                    placeholder="e.g. Less oil, extra crispy, sauce on the side..."
                    value={customRequest}
                    onChange={(e) => setCustomRequest(e.target.value)}
                    style={styles.customTextarea}
                  />
                  <div style={styles.charCountText}>
                    {customRequest.length}/200 characters
                  </div>

                  {/* Quantity selector */}
                  <div style={styles.modalQtyRow}>
                    <span style={styles.modalQtyLabel}>Quantity:</span>
                    <div style={styles.stepperBox}>
                      <button
                        type="button"
                        onClick={() => setCustomQty((q) => Math.max(1, q - 1))}
                        className="menu-tap-press"
                        style={styles.stepperActionBtn}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span style={styles.stepperValue}>{customQty}</span>
                      <button
                        type="button"
                        onClick={() => setCustomQty((q) => q + 1)}
                        className="menu-tap-press"
                        style={styles.stepperActionBtn}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {detailItem.available === false && (
                <div style={styles.soldOutNoticeBanner}>
                  ⚠️ This dish is currently sold out and cannot be ordered.
                </div>
              )}
            </div>

            {/* Footer */}
            {tableOrderingEnabled && detailItem.available !== false && (
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={handleAddCustomizedItem}
                  className="menu-tap-press"
                  style={styles.confirmAddBtn}
                >
                  Add to order • ₹{(parsePrice(detailItem.price) * customQty).toFixed(0)}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ---------------------------------------------------- */}
      {/* 6. CART CHECKOUT SHEET (MODAL) */}
      {/* ---------------------------------------------------- */}
      {mounted && typeof document !== "undefined" && tableOrderingEnabled && showCheckoutSheet && createPortal(
        <div
          style={styles.modalOverlay}
          className={menuFontClassNames}
          onClick={() => setShowCheckoutSheet(false)}
        >
          <div
            style={styles.checkoutSheet}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Your Order</h3>
                <div style={styles.checkoutTableLabel}>
                  {isTableValid ? `Table ${tableNumber} • Dine In` : "Dine In Order"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutSheet(false)}
                style={styles.modalCloseBtn}
                aria-label="Close order sheet"
              >
                ✕
              </button>
            </div>

            <div style={styles.checkoutBody}>
              {/* Cart items list */}
              <div style={styles.checkoutItemsList}>
                {cartLinesList.map((line) => (
                  <div key={line.lineId} style={styles.checkoutItemRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.checkoutItemNameRow}>
                        <DietaryBadge dietary={line.dietary} size={14} />
                        <span style={styles.checkoutItemName}>{formatDisplayName(line.name)}</span>
                      </div>
                      <div style={styles.checkoutItemUnit}>
                        ₹{line.unitPrice.toFixed(0)} each
                      </div>

                      {/* Request chip */}
                      {line.special_request && (
                        <div style={styles.checkoutRequestPill}>
                          <strong>Request:</strong> {line.special_request}
                        </div>
                      )}
                    </div>

                    <div style={styles.checkoutItemRight}>
                      <div style={styles.stepperBox}>
                        <button
                          type="button"
                          onClick={() => updateLineQty(line.lineId, -1)}
                          className="menu-tap-press"
                          style={styles.stepperActionBtn}
                          aria-label={`Decrease ${line.name}`}
                        >
                          −
                        </button>
                        <span style={styles.stepperValue}>{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateLineQty(line.lineId, 1)}
                          className="menu-tap-press"
                          style={styles.stepperActionBtn}
                          aria-label={`Increase ${line.name}`}
                        >
                          +
                        </button>
                      </div>

                      <div style={styles.checkoutLineTotal}>
                        ₹{(line.unitPrice * line.quantity).toFixed(0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bill Summary */}
              <div style={styles.billBox}>
                <div style={styles.billRow}>
                  <span>Subtotal:</span>
                  <span>₹{cartTotal.toFixed(0)}</span>
                </div>
                <div style={styles.billTotalRow}>
                  <span>Total Payable:</span>
                  <span>₹{cartTotal.toFixed(0)}</span>
                </div>
              </div>

              {/* Customer Inputs */}
              <div style={styles.customerInputsBox}>
                {/* Table Line or Picker */}
                {isTableValid ? (
                  <div style={styles.checkoutTableCard}>
                    <div style={styles.checkoutTableCardLeft}>
                      <span style={styles.checkoutTableCardLabel}>Table</span>
                      <span style={styles.checkoutTableCardValue}>Table {tableNumber}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTablePicker(true)}
                      style={styles.checkoutTableChangeBtn}
                      className="menu-tap-press"
                      aria-label="Change table number"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={styles.inputLabel}>
                        Table Number <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      {tableCount && tableCount > 0 && tableCount <= 50 && (
                        <button
                          type="button"
                          onClick={() => setShowTablePicker(true)}
                          style={{ background: "none", border: "none", color: MENU_TOKENS.colors.light.accentInk, fontSize: "12px", fontWeight: 700, cursor: "pointer", padding: 0 }}
                        >
                          Pick from list ›
                        </button>
                      )}
                    </div>
                    {tableCount && tableCount > 0 && tableCount <= 50 ? (
                      <button
                        type="button"
                        onClick={() => setShowTablePicker(true)}
                        className="menu-tap-press"
                        style={styles.pickTablePromptBtn}
                      >
                        Select your table number ›
                      </button>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        max={tableCount || 999}
                        placeholder="Enter your table number (e.g. 5)"
                        value={tableNumber}
                        onChange={(e) => {
                          setTableNumber(e.target.value);
                          setOrderError("");
                        }}
                        style={styles.inputField}
                      />
                    )}
                  </div>
                )}

                <div style={{ marginBottom: "12px" }}>
                  <label style={styles.inputLabel}>Your name (optional)</label>
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="Enter your name (optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={styles.inputField}
                  />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={styles.inputLabel}>Mobile Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    style={styles.inputField}
                  />
                  <div style={styles.inputHint}>for offers and loyalty</div>
                </div>

                {orderError && (
                  <div style={styles.orderErrorAlert}>
                    ⚠️ {orderError}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.checkoutFooter}>
              <button
                type="button"
                disabled={placingOrder || !isTableValid || cartLinesList.length === 0}
                onClick={handlePlaceOrder}
                className="menu-tap-press"
                style={{
                  ...styles.placeOrderBtn,
                  opacity: placingOrder || !isTableValid || cartLinesList.length === 0 ? 0.5 : 1,
                  cursor: placingOrder || !isTableValid || cartLinesList.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {placingOrder ? "Placing Order..." : `Place Order (₹${cartTotal.toFixed(0)})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ---------------------------------------------------- */}
      {/* 6.5 WHICH TABLE ARE YOU AT? MODAL */}
      {/* ---------------------------------------------------- */}
      {mounted && typeof document !== "undefined" && tableOrderingEnabled && showTablePicker && createPortal(
        <div
          style={styles.modalOverlay}
          className={menuFontClassNames}
          onClick={() => setShowTablePicker(false)}
        >
          <div
            style={styles.tablePickerModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Which table are you at?</h3>
                <p style={styles.tablePickerSubtitle}>
                  Please choose or enter your table number to complete your order.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTablePicker(false)}
                style={styles.modalCloseBtn}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={styles.tablePickerBody}>
              {tableCount && tableCount > 0 && tableCount <= 50 ? (
                <div style={styles.tablePillGrid}>
                  {Array.from({ length: tableCount }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setTableNumber(String(num));
                        setShowTablePicker(false);
                        setOrderError("");
                        try {
                          const sessionKey = device.device_code ? `tapx_session_table_${device.device_code}` : "tapx_session_table";
                          if (typeof window !== "undefined" && window.sessionStorage) {
                            window.sessionStorage.setItem(sessionKey, String(num));
                          }
                        } catch {}
                      }}
                      className="menu-tap-press"
                      style={{
                        ...styles.tablePillBtn,
                        backgroundColor: tableNumber === String(num) ? MENU_TOKENS.colors.light.ink : "#FFFFFF",
                        color: tableNumber === String(num) ? "#FFFFFF" : MENU_TOKENS.colors.light.ink,
                        borderColor: tableNumber === String(num) ? MENU_TOKENS.colors.light.ink : MENU_TOKENS.colors.light.hairline,
                      }}
                    >
                      Table {num}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label style={styles.inputLabel}>
                    Table Number <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={tableCount || 999}
                    placeholder="e.g. 5"
                    value={tablePickerInput}
                    onChange={(e) => setTablePickerInput(e.target.value)}
                    style={styles.inputField}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseInt(tablePickerInput, 10);
                      if (!parsed || parsed <= 0 || (tableCount && tableCount > 0 && parsed > tableCount)) {
                        setOrderError("Please enter a valid table number.");
                        return;
                      }
                      setTableNumber(String(parsed));
                      setShowTablePicker(false);
                      setOrderError("");
                      try {
                        const sessionKey = device.device_code ? `tapx_session_table_${device.device_code}` : "tapx_session_table";
                        if (typeof window !== "undefined" && window.sessionStorage) {
                          window.sessionStorage.setItem(sessionKey, String(parsed));
                        }
                      } catch {}
                    }}
                    className="menu-tap-press"
                    style={styles.confirmAddBtn}
                  >
                    Confirm Table
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ---------------------------------------------------- */}
      {/* 7. BOTTOM NAVIGATION DOCK (MENU / ORDERS) */}
      {/* ---------------------------------------------------- */}
      {tableOrderingEnabled && (
        <nav style={styles.bottomNav}>
          <button
            type="button"
            onClick={() => setActiveTab("menu")}
            className="menu-tap-press"
            style={{
              ...styles.navBtn,
              backgroundColor: activeTab === "menu" ? MENU_TOKENS.colors.light.ink : "transparent",
              color: activeTab === "menu" ? "#FFFFFF" : MENU_TOKENS.colors.light.muted,
            }}
          >
            <span style={{ fontSize: "18px" }}>🍴</span>
            <span style={styles.navLabel}>Menu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className="menu-tap-press"
            style={{
              ...styles.navBtn,
              backgroundColor: activeTab === "orders" ? MENU_TOKENS.colors.light.ink : "transparent",
              color: activeTab === "orders" ? "#FFFFFF" : MENU_TOKENS.colors.light.muted,
              position: "relative",
            }}
          >
            <span style={{ fontSize: "18px" }}>📋</span>
            <span style={styles.navLabel}>My Orders</span>
            {hasActiveOrder && <span style={styles.orderActiveDot} />}
          </button>
        </nav>
      )}

      <UpiPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        businessName={business.name}
        upiId={business.upi_id}
        paymentUrl={business.payment_url}
        onTrackAction={onTrackAction}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: MENU_TOKENS.layout.maxContentWidth,
    margin: "0 auto",
    minHeight: "100vh",
    backgroundColor: MENU_TOKENS.colors.light.bg,
    display: "flex",
    flexDirection: "column",
    paddingBottom: "100px",
    fontFamily: MENU_TOKENS.fonts.sans,
    position: "relative",
    color: MENU_TOKENS.colors.light.ink,
    boxSizing: "border-box",
  },
  topHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    backgroundColor: "rgba(251, 248, 243, 0.94)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderBottom: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    position: "sticky",
    top: 0,
    zIndex: 100,
    boxShadow: "0 1px 3px rgba(28, 25, 23, 0.03)",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  brandLogo: {
    width: "40px",
    height: "40px",
    borderRadius: MENU_TOKENS.radii.input,
    objectFit: "cover",
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    flexShrink: 0,
  },
  brandLogoPlaceholder: {
    width: "40px",
    height: "40px",
    borderRadius: MENU_TOKENS.radii.input,
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
    color: MENU_TOKENS.colors.light.accentInk,
    border: `1px solid ${MENU_TOKENS.colors.light.accentBorder}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: MENU_TOKENS.fonts.serif,
    fontWeight: 700,
    fontSize: "18px",
    flexShrink: 0,
  },
  brandTextWrap: {
    minWidth: 0,
  },
  businessNameHeading: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "17px",
    fontWeight: 700,
    margin: 0,
    color: MENU_TOKENS.colors.light.ink,
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tableChip: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: 600,
    color: MENU_TOKENS.colors.light.accentInk,
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
    border: `1px solid ${MENU_TOKENS.colors.light.accentBorder}`,
    padding: "1px 7px",
    borderRadius: MENU_TOKENS.radii.badge,
    marginTop: "2px",
  },
  headerRightActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  callStaffBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    padding: "0 14px",
    backgroundColor: MENU_TOKENS.colors.light.vegBg,
    color: MENU_TOKENS.colors.light.veg,
    border: "1px solid #A7F3D0",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 700,
    textDecoration: "none",
    boxSizing: "border-box",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(30, 142, 62, 0.08)",
  },
  menuTabContainer: {
    flex: 1,
  },
  searchBarWrapper: {
    position: "sticky",
    top: "64px",
    zIndex: 90,
    padding: "10px 16px 8px 16px",
    backgroundColor: "rgba(251, 248, 243, 0.94)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderBottom: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    boxShadow: "0 1px 3px rgba(28, 25, 23, 0.02)",
  },
  menuBodyRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "12px 10px 24px 8px",
    boxSizing: "border-box",
  },
  railNav: {
    position: "sticky",
    top: "124px",
    maxHeight: "calc(100vh - 130px)",
    overflowY: "auto",
    scrollbarWidth: "none",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    paddingBottom: "80px",
    boxSizing: "border-box",
  },
  railItemBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "6px 2px",
    borderRadius: "14px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
  },
  railThumbnailBox: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
    transition: "box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  railThumbnailImg: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover",
    display: "block",
  },
  railThumbnailLetter: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "16px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.accentInk,
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
  },
  railItemLabel: {
    marginTop: "4px",
    fontSize: "12px",
    lineHeight: 1.25,
    textAlign: "center",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    wordBreak: "break-word",
    maxWidth: "100%",
    padding: "0 2px",
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
  },
  dishGridWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
    gap: "10px",
  },
  gridDishCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: "18px",
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    boxShadow: MENU_TOKENS.shadows.card,
    padding: "12px 8px 10px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    position: "relative",
    cursor: "pointer",
    boxSizing: "border-box",
    transition: "background-color 0.15s ease, transform 160ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  gridPhotoWrap: {
    position: "relative",
    width: "64px",
    height: "64px",
    margin: "0 auto",
    flexShrink: 0,
  },
  gridDietaryMark: {
    position: "absolute",
    top: "-2px",
    left: "-2px",
    zIndex: 2,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    borderRadius: "4px",
  },
  gridPopularTag: {
    fontSize: "10px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.accentInk,
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
    border: `1px solid ${MENU_TOKENS.colors.light.accentBorder}`,
    padding: "1px 6px",
    borderRadius: "4px",
    marginTop: "6px",
    whiteSpace: "nowrap",
  },
  gridDishName: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "13.5px",
    fontWeight: 700,
    margin: "6px 0 2px 0",
    color: MENU_TOKENS.colors.light.ink,
    lineHeight: 1.25,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    width: "100%",
  },
  gridDishDescription: {
    fontSize: "12px",
    color: MENU_TOKENS.colors.light.muted,
    margin: "2px 0 0 0",
    lineHeight: 1.35,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    width: "100%",
  },
  gridDishPrice: {
    fontSize: "13px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.ink,
    fontVariantNumeric: "tabular-nums",
    marginTop: "6px",
    marginBottom: "4px",
  },
  gridDishActions: {
    width: "100%",
    marginTop: "auto",
    paddingTop: "4px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3px",
  },
  gridAddBtn: {
    minHeight: "32px",
    width: "100%",
    maxWidth: "100px",
    padding: "0 12px",
    backgroundColor: "#FFFFFF",
    color: MENU_TOKENS.colors.light.veg,
    border: `1.5px solid ${MENU_TOKENS.colors.light.veg}`,
    borderRadius: "16px",
    fontSize: "11.5px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(30, 142, 62, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  },
  gridStepperBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: MENU_TOKENS.colors.light.veg,
    color: "#FFFFFF",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(30, 142, 62, 0.2)",
    width: "100%",
    maxWidth: "100px",
    height: "32px",
    boxSizing: "border-box",
  },
  gridStepperBtn: {
    background: "none",
    border: "none",
    color: "#FFFFFF",
    fontSize: "15px",
    fontWeight: 700,
    width: "30px",
    height: "32px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  gridStepperQty: {
    fontSize: "12px",
    fontWeight: 700,
    padding: "0 4px",
    minWidth: "16px",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  },
  gridCustomizeLink: {
    background: "none",
    border: "none",
    color: MENU_TOKENS.colors.light.accentInk,
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    padding: "2px 4px",
  },
  gridSoldOutPill: {
    fontSize: "11px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.soldOutText,
    backgroundColor: MENU_TOKENS.colors.light.soldOutBg,
    border: `1px solid ${MENU_TOKENS.colors.light.soldOutBorder}`,
    borderRadius: "6px",
    padding: "3px 8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dishListWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  listDishCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "14px",
    borderRadius: "18px",
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    boxShadow: MENU_TOKENS.shadows.card,
    cursor: "pointer",
    boxSizing: "border-box",
    transition: "background-color 0.15s ease, transform 160ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  listPhotoWrap: {
    position: "relative",
    width: "76px",
    height: "76px",
    flexShrink: 0,
  },
  listDietaryMark: {
    position: "absolute",
    top: "-2px",
    left: "-2px",
    zIndex: 2,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    borderRadius: "4px",
  },
  searchInputBox: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: MENU_TOKENS.radii.chip,
    padding: "0 14px",
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    boxSizing: "border-box",
    boxShadow: "0 1px 3px rgba(28, 25, 23, 0.02)",
  },
  searchIcon: {
    fontSize: "14px",
    color: MENU_TOKENS.colors.light.muted,
    marginRight: "8px",
  },
  searchInput: {
    flex: 1,
    border: "none",
    backgroundColor: "transparent",
    fontSize: "14px",
    fontFamily: MENU_TOKENS.fonts.sans,
    color: MENU_TOKENS.colors.light.ink,
    outline: "none",
    padding: "8px 0",
  },
  clearSearchBtn: {
    background: "none",
    border: "none",
    color: MENU_TOKENS.colors.light.muted,
    fontSize: "14px",
    cursor: "pointer",
    padding: "4px 8px",
    minHeight: "36px",
    display: "flex",
    alignItems: "center",
  },
  stickyFilterContainer: {
    position: "sticky",
    top: "64px",
    zIndex: 90,
    backgroundColor: "rgba(251, 248, 243, 0.94)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderBottom: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    boxShadow: "0 2px 6px rgba(28, 25, 23, 0.02)",
  },
  dietaryFilterRow: {
    display: "flex",
    gap: "8px",
    padding: "8px 16px 6px 16px",
    overflowX: "auto",
    scrollbarWidth: "none",
  },
  dietFilterPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "36px",
    padding: "0 14px",
    borderRadius: MENU_TOKENS.radii.chip,
    border: "1px solid",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
    boxShadow: "0 1px 2px rgba(28, 25, 23, 0.03)",
  },
  categoryScrollContainer: {
    display: "flex",
    gap: "8px",
    padding: "4px 16px 10px 16px",
    overflowX: "auto",
    scrollbarWidth: "none",
  },
  categoryChip: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "34px",
    padding: "0 14px",
    borderRadius: MENU_TOKENS.radii.chip,
    border: "1px solid",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
    boxShadow: "0 1px 2px rgba(28, 25, 23, 0.03)",
  },
  sectionsList: {
    padding: "12px 16px",
  },
  emptyStateCard: {
    padding: "48px 20px",
    textAlign: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: MENU_TOKENS.radii.card,
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    marginTop: "20px",
    boxShadow: MENU_TOKENS.shadows.card,
  },
  emptyStateTitle: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "18px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.ink,
  },
  emptyStateSubtitle: {
    fontSize: "13px",
    color: MENU_TOKENS.colors.light.muted,
    marginTop: "6px",
  },
  categorySection: {
    marginBottom: "28px",
  },
  sectionHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    paddingBottom: "8px",
    borderBottom: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
  },
  sectionCategoryTitle: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "18px",
    fontWeight: 700,
    margin: 0,
    color: MENU_TOKENS.colors.light.ink,
    letterSpacing: "-0.01em",
  },
  sectionItemCountBadge: {
    fontSize: "12px",
    fontWeight: 600,
    color: MENU_TOKENS.colors.light.muted,
  },
  cardsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  dishCard: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    padding: "16px",
    borderRadius: MENU_TOKENS.radii.card,
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    boxShadow: MENU_TOKENS.shadows.card,
    cursor: "pointer",
    boxSizing: "border-box",
    transition: "background-color 0.15s ease, transform 160ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  dishInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  dishTagRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "4px",
  },
  popularTag: {
    fontSize: "10px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.accentInk,
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
    border: `1px solid ${MENU_TOKENS.colors.light.accentBorder}`,
    padding: "1px 6px",
    borderRadius: "4px",
  },
  soldOutBadge: {
    fontSize: "10px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.soldOutText,
    backgroundColor: MENU_TOKENS.colors.light.soldOutBg,
    border: `1px solid ${MENU_TOKENS.colors.light.soldOutBorder}`,
    padding: "1px 6px",
    borderRadius: "4px",
  },
  dishName: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "16px",
    fontWeight: 700,
    margin: "0 0 4px 0",
    color: MENU_TOKENS.colors.light.ink,
    lineHeight: 1.3,
  },
  dishPriceText: {
    fontSize: "15px",
    fontWeight: 600,
    color: MENU_TOKENS.colors.light.ink,
    fontVariantNumeric: "tabular-nums",
    marginBottom: "6px",
  },
  dishDescription: {
    fontSize: "12.5px",
    color: MENU_TOKENS.colors.light.muted,
    margin: 0,
    lineHeight: 1.45,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  dishActionCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
  },
  dishBtnWrap: {
    marginTop: "8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    width: "100%",
  },
  addBtn: {
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    width: "100%",
    padding: "0 16px",
    backgroundColor: "#FFFFFF",
    color: MENU_TOKENS.colors.light.veg,
    border: `1.5px solid ${MENU_TOKENS.colors.light.veg}`,
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(30, 142, 62, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  },
  soldOutBtn: {
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    width: "100%",
    padding: "0 10px",
    backgroundColor: MENU_TOKENS.colors.light.soldOutBg,
    color: MENU_TOKENS.colors.light.soldOutText,
    border: `1px solid ${MENU_TOKENS.colors.light.soldOutBorder}`,
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "not-allowed",
    boxSizing: "border-box",
  },
  customizeLinkBtn: {
    background: "none",
    border: "none",
    color: MENU_TOKENS.colors.light.muted,
    fontSize: "11px",
    fontWeight: 600,
    padding: "2px 4px",
    cursor: "pointer",
  },
  stepperBox: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    backgroundColor: MENU_TOKENS.colors.light.ink,
    borderRadius: "10px",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  stepperActionBtn: {
    minWidth: "40px",
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    backgroundColor: "transparent",
    border: "none",
    color: "#FFFFFF",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    minWidth: "22px",
    textAlign: "center",
  },
  stickyCartBarWrap: {
    position: "fixed",
    bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 12px)",
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    zIndex: 95,
    pointerEvents: "none",
    padding: "0 16px",
  },
  stickyCartBar: {
    maxWidth: MENU_TOKENS.layout.maxContentWidth,
    width: "100%",
    backgroundColor: MENU_TOKENS.colors.light.ink,
    color: "#FFFFFF",
    borderRadius: MENU_TOKENS.radii.card,
    padding: "10px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: MENU_TOKENS.shadows.floatingBar,
    pointerEvents: "auto",
    boxSizing: "border-box",
  },
  cartCountLabel: {
    fontSize: "12px",
    color: "#A8A096",
    fontWeight: 500,
  },
  cartTotalLabel: {
    fontSize: "18px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: "#FFFFFF",
  },
  viewCartBtn: {
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    padding: "0 18px",
    backgroundColor: MENU_TOKENS.colors.light.veg,
    color: "#FFFFFF",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    boxSizing: "border-box",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(28, 25, 23, 0.6)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    zIndex: 100000,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "center",
    animation: "menuBackdropFadeIn 200ms ease",
  },
  modalSheet: {
    width: "100%",
    maxWidth: MENU_TOKENS.layout.maxContentWidth,
    backgroundColor: "#FFFFFF",
    borderRadius: MENU_TOKENS.radii.sheetTop,
    maxHeight: "90dvh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: MENU_TOKENS.shadows.modal,
    animation: "menuSheetSlideUp 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  modalHeader: {
    padding: "16px 20px",
    borderBottom: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    zIndex: 10,
    flexShrink: 0,
  },
  modalTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
  modalTitle: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "18px",
    fontWeight: 700,
    margin: 0,
    color: MENU_TOKENS.colors.light.ink,
  },
  modalCloseBtn: {
    minWidth: "40px",
    minHeight: "40px",
    backgroundColor: MENU_TOKENS.colors.light.bg,
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    borderRadius: "50%",
    color: MENU_TOKENS.colors.light.muted,
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: "16px 20px",
    flex: 1,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    minHeight: 0,
    overscrollBehavior: "contain",
  },
  modalImageWrap: {
    width: "100%",
    height: "200px",
    borderRadius: "16px",
    overflow: "hidden",
    marginBottom: "16px",
    backgroundColor: "#F5EFE6",
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
  },
  modalImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  modalPriceText: {
    fontSize: "18px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: MENU_TOKENS.colors.light.ink,
    marginBottom: "6px",
  },
  modalDescription: {
    fontSize: "13.5px",
    color: MENU_TOKENS.colors.light.muted,
    lineHeight: 1.5,
    margin: "0 0 16px 0",
  },
  customizationSection: {
    marginTop: "16px",
    borderTop: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    paddingTop: "14px",
  },
  customLabel: {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.ink,
    marginBottom: "8px",
  },
  quickChipsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "10px",
  },
  quickChipBtn: {
    minHeight: "36px",
    padding: "0 12px",
    borderRadius: MENU_TOKENS.radii.chip,
    border: "1px solid",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    boxSizing: "border-box",
  },
  customTextarea: {
    width: "100%",
    borderRadius: MENU_TOKENS.radii.input,
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    padding: "12px",
    fontSize: "13px",
    fontFamily: MENU_TOKENS.fonts.sans,
    color: MENU_TOKENS.colors.light.ink,
    backgroundColor: "#FFFFFF",
    boxSizing: "border-box",
    outline: "none",
    resize: "none",
  },
  charCountText: {
    fontSize: "11px",
    color: MENU_TOKENS.colors.light.muted,
    textAlign: "right",
    marginTop: "2px",
  },
  modalQtyRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "16px",
    paddingTop: "12px",
    borderTop: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
  },
  modalQtyLabel: {
    fontSize: "14px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.ink,
  },
  soldOutNoticeBanner: {
    marginTop: "14px",
    padding: "12px 14px",
    backgroundColor: MENU_TOKENS.colors.light.soldOutBg,
    color: MENU_TOKENS.colors.light.soldOutText,
    border: `1px solid ${MENU_TOKENS.colors.light.soldOutBorder}`,
    fontSize: "12px",
    fontWeight: 600,
    borderRadius: "10px",
  },
  modalFooter: {
    padding: "14px 20px",
    borderTop: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    backgroundColor: "#FFFFFF",
    paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
    flexShrink: 0,
  },
  confirmAddBtn: {
    width: "100%",
    minHeight: "48px",
    backgroundColor: MENU_TOKENS.colors.light.veg,
    color: "#FFFFFF",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  checkoutSheet: {
    width: "100%",
    maxWidth: MENU_TOKENS.layout.maxContentWidth,
    backgroundColor: "#FFFFFF",
    borderRadius: MENU_TOKENS.radii.sheetTop,
    maxHeight: "90dvh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: MENU_TOKENS.shadows.modal,
    animation: "menuSheetSlideUp 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  checkoutTableLabel: {
    fontSize: "12px",
    color: MENU_TOKENS.colors.light.accentInk,
    fontWeight: 600,
    marginTop: "2px",
  },
  checkoutBody: {
    padding: "16px 20px",
    flex: 1,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    minHeight: 0,
    overscrollBehavior: "contain",
  },
  checkoutItemsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "16px",
  },
  checkoutItemRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    paddingBottom: "12px",
    borderBottom: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
  },
  checkoutItemNameRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  checkoutItemName: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "15px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.ink,
  },
  checkoutItemUnit: {
    fontSize: "12px",
    color: MENU_TOKENS.colors.light.muted,
    fontVariantNumeric: "tabular-nums",
    marginTop: "2px",
  },
  checkoutRequestPill: {
    marginTop: "6px",
    padding: "3px 8px",
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
    color: MENU_TOKENS.colors.light.accentInk,
    border: `1px solid ${MENU_TOKENS.colors.light.accentBorder}`,
    borderRadius: "6px",
    fontSize: "11px",
    lineHeight: 1.3,
    display: "inline-block",
  },
  checkoutItemRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
  },
  checkoutLineTotal: {
    fontSize: "15px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: MENU_TOKENS.colors.light.ink,
  },
  billBox: {
    backgroundColor: MENU_TOKENS.colors.light.bg,
    borderRadius: MENU_TOKENS.radii.input,
    padding: "14px 16px",
    marginBottom: "16px",
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
  },
  billRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    color: MENU_TOKENS.colors.light.muted,
    fontVariantNumeric: "tabular-nums",
    marginBottom: "6px",
  },
  billTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "16px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: MENU_TOKENS.colors.light.ink,
    paddingTop: "8px",
    borderTop: `1px dashed ${MENU_TOKENS.colors.light.hairline}`,
  },
  customerInputsBox: {
    marginBottom: "12px",
  },
  checkoutTableCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    backgroundColor: MENU_TOKENS.colors.light.bg,
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    borderRadius: MENU_TOKENS.radii.input,
    marginBottom: "14px",
  },
  checkoutTableCardLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  checkoutTableCardLabel: {
    fontSize: "11px",
    color: MENU_TOKENS.colors.light.muted,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontWeight: 600,
  },
  checkoutTableCardValue: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "16px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.ink,
  },
  checkoutTableChangeBtn: {
    padding: "6px 12px",
    backgroundColor: "#FFFFFF",
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.accentInk,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(28, 25, 23, 0.04)",
  },
  pickTablePromptBtn: {
    width: "100%",
    padding: "12px 14px",
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
    border: `1px dashed ${MENU_TOKENS.colors.light.accentBorder}`,
    borderRadius: MENU_TOKENS.radii.input,
    fontSize: "13px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.accentInk,
    cursor: "pointer",
    textAlign: "left",
  },
  inputHint: {
    fontSize: "11px",
    color: MENU_TOKENS.colors.light.muted,
    marginTop: "4px",
    lineHeight: 1.3,
  },
  inputLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.ink,
    marginBottom: "4px",
  },
  inputField: {
    width: "100%",
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    padding: "0 14px",
    borderRadius: MENU_TOKENS.radii.input,
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    fontSize: "14px",
    fontFamily: MENU_TOKENS.fonts.sans,
    color: MENU_TOKENS.colors.light.ink,
    backgroundColor: "#FFFFFF",
    boxSizing: "border-box",
    outline: "none",
  },
  orderErrorAlert: {
    padding: "10px 12px",
    backgroundColor: "#FDF2F2",
    color: "#B91C1C",
    fontSize: "12px",
    fontWeight: 600,
    borderRadius: "8px",
    marginTop: "8px",
  },
  checkoutFooter: {
    padding: "14px 20px",
    borderTop: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    backgroundColor: "#FFFFFF",
    paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
    flexShrink: 0,
  },
  placeOrderBtn: {
    width: "100%",
    minHeight: "48px",
    backgroundColor: MENU_TOKENS.colors.light.veg,
    color: "#FFFFFF",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  ordersTabContainer: {
    padding: "16px",
    flex: 1,
  },
  ordersHeaderBox: {
    marginBottom: "16px",
  },
  ordersTablePill: {
    display: "inline-block",
    padding: "3px 10px",
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
    color: MENU_TOKENS.colors.light.accentInk,
    border: `1px solid ${MENU_TOKENS.colors.light.accentBorder}`,
    borderRadius: MENU_TOKENS.radii.badge,
    fontSize: "11px",
    fontWeight: 800,
    marginBottom: "6px",
  },
  ordersPageTitle: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "22px",
    fontWeight: 700,
    margin: 0,
    color: MENU_TOKENS.colors.light.ink,
  },
  ordersPageSub: {
    fontSize: "13px",
    color: MENU_TOKENS.colors.light.muted,
    margin: "4px 0 0 0",
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: MENU_TOKENS.radii.card,
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    padding: "20px",
    boxShadow: MENU_TOKENS.shadows.card,
  },
  orderTopMetaRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  orderIdText: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "17px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.ink,
  },
  orderTimeText: {
    fontSize: "12px",
    color: MENU_TOKENS.colors.light.muted,
    marginTop: "2px",
  },
  statusBadge: {
    padding: "4px 12px",
    borderRadius: MENU_TOKENS.radii.chip,
    border: "1px solid",
    fontSize: "12px",
    fontWeight: 700,
  },
  stepperProgressContainer: {
    margin: "20px 0 22px 0",
    position: "relative",
  },
  progressTrack: {
    position: "absolute",
    top: "14px",
    left: "24px",
    right: "24px",
    height: "4px",
    backgroundColor: MENU_TOKENS.colors.light.hairline,
    borderRadius: "2px",
    zIndex: 1,
  },
  progressBarFill: {
    height: "100%",
    width: "100%",
    transformOrigin: "left",
    backgroundColor: MENU_TOKENS.colors.light.veg,
    borderRadius: "2px",
    transition: "transform 0.3s ease",
  },
  stepsRow: {
    position: "relative",
    display: "flex",
    justifyContent: "space-between",
    zIndex: 2,
  },
  stepCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "60px",
  },
  stepNode: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "2px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: 800,
    backgroundColor: "#FFFFFF",
    boxSizing: "border-box",
  },
  stepNodeLabel: {
    fontSize: "11px",
    marginTop: "6px",
    textAlign: "center",
  },
  orderItemsSection: {
    marginTop: "16px",
    paddingTop: "14px",
    borderTop: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
  },
  sectionSubHeader: {
    fontSize: "13px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.muted,
    marginBottom: "10px",
  },
  orderItemsList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  orderItemCardRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    fontSize: "13px",
  },
  orderItemNameLine: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  orderItemName: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.ink,
  },
  orderItemQtyTag: {
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.veg,
    fontSize: "12px",
  },
  itemRequestBadge: {
    marginTop: "4px",
    padding: "2px 8px",
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
    color: MENU_TOKENS.colors.light.accentInk,
    border: `1px solid ${MENU_TOKENS.colors.light.accentBorder}`,
    borderRadius: "4px",
    fontSize: "11px",
    display: "inline-block",
  },
  orderItemPrice: {
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: MENU_TOKENS.colors.light.ink,
    marginLeft: "10px",
  },
  orderTotalDivider: {
    height: "1px",
    backgroundColor: MENU_TOKENS.colors.light.hairline,
    margin: "14px 0",
  },
  orderTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderTotalLabel: {
    fontSize: "14px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.muted,
  },
  orderTotalAmount: {
    fontSize: "18px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: MENU_TOKENS.colors.light.ink,
  },
  orderActionsRow: {
    marginTop: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  orderMoreBtn: {
    width: "100%",
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    backgroundColor: MENU_TOKENS.colors.light.ink,
    color: "#FFFFFF",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    boxSizing: "border-box",
  },
  cancelBtn: {
    width: "100%",
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    backgroundColor: "#FFFFFF",
    color: MENU_TOKENS.colors.light.nonVeg,
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    boxSizing: "border-box",
  },
  emptyOrdersCard: {
    padding: "48px 24px",
    textAlign: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: MENU_TOKENS.radii.card,
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    boxShadow: MENU_TOKENS.shadows.card,
  },
  emptyOrdersTitle: {
    fontFamily: MENU_TOKENS.fonts.serif,
    fontSize: "18px",
    fontWeight: 700,
    margin: "0 0 6px 0",
    color: MENU_TOKENS.colors.light.ink,
  },
  emptyOrdersSub: {
    fontSize: "13px",
    color: MENU_TOKENS.colors.light.muted,
    lineHeight: 1.5,
    margin: "0 0 20px 0",
  },
  browseMenuBtn: {
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    padding: "0 24px",
    backgroundColor: MENU_TOKENS.colors.light.ink,
    color: "#FFFFFF",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: MENU_TOKENS.layout.maxContentWidth,
    margin: "0 auto",
    height: "64px",
    backgroundColor: "rgba(251, 248, 243, 0.94)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderTop: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    zIndex: 100,
    boxShadow: "0 -2px 10px rgba(28, 25, 23, 0.03)",
  },
  navBtn: {
    flex: 1,
    height: "48px",
    margin: "0 8px",
    borderRadius: "12px",
    border: "none",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  navLabel: {
    fontSize: "13px",
    fontWeight: 700,
  },
  orderActiveDot: {
    position: "absolute",
    top: "10px",
    right: "24px",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: MENU_TOKENS.colors.light.veg,
    boxShadow: "0 0 0 2px #FFFFFF",
    animation: "livePulseStep 2s infinite ease-in-out",
  },
  tablePickerTriggerBtn: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: 700,
    color: MENU_TOKENS.colors.light.accentInk,
    backgroundColor: MENU_TOKENS.colors.light.accentLight,
    border: `1px dashed ${MENU_TOKENS.colors.light.accentBorder}`,
    padding: "3px 8px",
    borderRadius: "6px",
    marginTop: "2px",
    cursor: "pointer",
  },
  tablePickerModal: {
    width: "100%",
    maxWidth: MENU_TOKENS.layout.maxContentWidth,
    backgroundColor: "#FFFFFF",
    borderRadius: MENU_TOKENS.radii.sheetTop,
    maxHeight: "85dvh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: MENU_TOKENS.shadows.modal,
    animation: "menuSheetSlideUp 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  tablePickerSubtitle: {
    fontSize: "12px",
    color: MENU_TOKENS.colors.light.muted,
    margin: "4px 0 0 0",
  },
  tablePickerBody: {
    padding: "16px 20px 24px 20px",
    flex: 1,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    minHeight: 0,
    overscrollBehavior: "contain",
  },
  tablePillGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "10px",
  },
  tablePillBtn: {
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    padding: "8px 4px",
    borderRadius: "10px",
    border: "1px solid",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    boxSizing: "border-box",
  },
};
