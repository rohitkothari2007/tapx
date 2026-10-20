"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { InstagramIcon, WhatsAppIcon } from "./BrandIcons";
import UpiPaymentModal from "./UpiPaymentModal";

export type RestaurantExperienceProps = {
  business: {
    id: string;
    name: string;
    category: string | null;
    phone: string | null;
    whatsapp_number: string | null;
    address: string | null;
    city: string | null;
    logo_url: string | null;
    google_review_url: string | null;
    instagram_url: string | null;
    payment_url: string | null;
    upi_id: string | null;
    upi_qr_url: string | null;
    payment_enabled: boolean | null;
  };
  device: {
    id: string;
    device_code: string;
    location: string | null;
  };
  categories: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  items: Array<{
    id: string;
    categoryId: string;
    name: string;
    price?: string;
    description?: string;
    imageUrl?: string;
    dietary?: "veg" | "non_veg" | "egg" | "none";
    popular?: boolean;
    available?: boolean;
  }>;
  offers?: Array<{
    id: string;
    title?: string;
    name?: string;
    description?: string;
    discount?: string;
  }>;
  initialTab?: "home" | "menu" | "search" | "orders";
  loyaltyEnabled?: boolean;
  feedbackEnabled?: boolean;
  onOpenFeedback?: () => void;
  onOpenLoyalty?: () => void;
  onTrackAction?: (actionType: string) => void;
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
};

type TabKey = "home" | "menu" | "search" | "orders";

export default function RestaurantExperience({
  business,
  device,
  categories,
  items,
  offers = [],
  initialTab = "home",
  loyaltyEnabled,
  feedbackEnabled,
  onOpenFeedback,
  onOpenLoyalty,
  onTrackAction,
}: RestaurantExperienceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Cart state
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCheckoutSheet, setShowCheckoutSheet] = useState(false);
  const [tableNumber, setTableNumber] = useState<string>(() => {
    if (device.location) {
      const match = device.location.replace(/\D/g, "");
      if (match) return match;
    }
    return "1";
  });
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");

  // Live order state
  const storageKey = `tapx_active_order_${business.id}_${device.device_code}`;
  const [currentOrder, setCurrentOrder] = useState<ActiveOrder | null>(null);
  const [currentOrderItems, setCurrentOrderItems] = useState<ActiveOrderItem[]>([]);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  // Available items
  const availableItems = useMemo(
    () => items.filter((item) => item.available !== false),
    [items]
  );

  // Cart items calculated
  const cartItems = useMemo(() => {
    return availableItems
      .filter((item) => (cart[item.id] || 0) > 0)
      .map((item) => {
        const numPrice = Number(String(item.price || "").replace(/[^0-9.]/g, "")) || 0;
        return {
          ...item,
          quantity: cart[item.id],
          numericPrice: numPrice,
          lineTotal: numPrice * cart[item.id],
        };
      });
  }, [availableItems, cart]);

  const cartTotal = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.lineTotal, 0),
    [cartItems]
  );

  const cartCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems]
  );

  // Add / remove cart helper
  const addToCart = (id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const current = prev[id] || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: current - 1 };
    });
  };

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

      // Check if order is still active
      const activeStatuses = ["pending", "accepted", "preparing", "ready", "served"];
      if (!activeStatuses.includes(typedOrder.status) && typedOrder.status !== "completed") {
        setCurrentOrderItems([]);
        return;
      }

      setCurrentOrderItems((orderData.items || []) as ActiveOrderItem[]);
    } catch (err) {
      console.warn("Error restoring active order:", err);
    }
  };

  // Poll active order status every 7 seconds
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
    if (!tableNumber) {
      setOrderError("Please enter your table number.");
      return;
    }
    if (!customerName.trim()) {
      setOrderError("Please enter your name.");
      return;
    }
    if (!cartItems.length) {
      setOrderError("Please add items to your order.");
      return;
    }

    setPlacingOrder(true);
    try {
      const cleanPhone = customerPhone.replace(/\D/g, "");

      const { data, error: rpcErr } = await supabase.rpc("create_tapx_table_order", {
        p_business_id: business.id,
        p_table_number: Number(tableNumber),
        p_customer_name: customerName.trim(),
        p_customer_phone: cleanPhone || null,
        p_source_device_code: device.device_code,
        p_items: cartItems.map((item) => ({
          item_id: item.id,
          quantity: item.quantity,
        })),
      });

      if (rpcErr) throw rpcErr;

      const newOrderId = String(data || "");
      if (newOrderId && typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, newOrderId);
      }

      setCart({});
      setShowCheckoutSheet(false);
      await loadActiveOrder(newOrderId);
      setActiveTab("orders");
    } catch (err: any) {
      console.error("Order placement error:", err);
      setOrderError(err.message || "Failed to place order. Please try again.");
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

      if (rpcErr) {
        throw new Error(rpcErr.message || "Failed to cancel order.");
      }

      if (!wasCancelled) {
        alert(
          "This order cannot be cancelled online because it has already been accepted or is being prepared by the kitchen. Please speak to staff directly."
        );
        // Refresh the active order to display latest kitchen status
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

  // Formatted order time helper
  const formatOrderTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Friendly status labels
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
      case "accepted":
        return { label: "Got Order", bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" };
      case "preparing":
        return { label: "Preparing", bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
      case "ready":
        return { label: "Ready to Serve", bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" };
      case "served":
        return { label: "Served", bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" };
      case "completed":
        return { label: "Completed", bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
      case "cancelled":
        return { label: "Cancelled", bg: "#fee2e2", color: "#b91c1c", border: "#fecaca" };
      default:
        return { label: "Order Active", bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" };
    }
  };

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return availableItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.categoryId === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [availableItems, selectedCategory, searchQuery]);

  const hasActiveOrder = Boolean(currentOrder && currentOrder.status !== "cancelled");

  return (
    <div style={styles.container}>
      {/* ---------------------------------------------------- */}
      {/* 1. TOP BRAND HEADER */}
      {/* ---------------------------------------------------- */}
      <header style={styles.topHeader}>
        <div style={styles.topBrandInfo}>
          <div style={styles.logoCircle}>
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} style={styles.logoImg} />
            ) : (
              <span>🍽️</span>
            )}
          </div>
          <div>
            <h1 style={styles.businessNameHeading}>{business.name}</h1>
            <div style={styles.tableBadgeSubtitle}>
              Table {tableNumber || "1"} • Dine In
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab("search")}
          style={{
            ...styles.iconButton,
            background: activeTab === "search" ? "#111827" : "#f1f5f9",
            color: activeTab === "search" ? "#ffffff" : "#334155",
          }}
          title="Search menu"
        >
          🔍
        </button>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 2. MAIN CONTENT TABS */}
      {/* ---------------------------------------------------- */}
      <main style={styles.contentBody}>
        {/* --- TAB 1: HOME --- */}
        {activeTab === "home" && (
          <div style={styles.tabContent}>
            {/* HERO RESTAURANT BANNER */}
            <div style={styles.heroCard}>
              <div style={styles.heroOverlay}>
                <div style={styles.heroTopRow}>
                  <div style={styles.glassTablePill}>
                    Table {tableNumber || "1"} • Dine In
                  </div>
                  <div style={styles.glassCutleryCircle}>🍴</div>
                </div>

                <div style={styles.heroBottomContent}>
                  <div style={styles.watermarkTagline}>Taste Tradition Together ♡</div>
                  <h2 style={styles.heroMainTitle}>
                    Authentic {business.category === "cafe" ? "Cafe Treats" : "Delicious Food"}
                  </h2>
                  <p style={styles.heroSubtitle}>
                    Welcome to {business.name}! Experience authentic flavours, freshly prepared with love ❤️
                  </p>

                  <button
                    type="button"
                    onClick={() => setActiveTab("menu")}
                    style={styles.startOrderingBtn}
                  >
                    🍴 Start Ordering
                  </button>
                </div>
              </div>
            </div>

            {/* OFFERS SECTION */}
            {offers.length > 0 && (
              <div style={styles.offersContainer}>
                <div style={styles.sectionHeaderTitle}>Offers</div>
                <div style={styles.offersCard}>
                  <div style={styles.offerIconBadge}>🎁</div>
                  <div>
                    <div style={styles.offerTitle}>
                      {offers[0].title || offers[0].name || "Special Offer"}
                    </div>
                    <div style={styles.offerDesc}>
                      {offers[0].description || "Special offer available on your dine-in order today!"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* QUICK ACTIONS & CONNECT */}
            <div style={styles.quickActionsGrid}>
              {business.google_review_url && (
                <a
                  href={business.google_review_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onTrackAction && onTrackAction("google_review_click")}
                  style={styles.actionCard}
                >
                  <span style={styles.actionIcon}>⭐</span>
                  <div>
                    <div style={styles.actionTitle}>Review Us</div>
                    <div style={styles.actionSub}>Rate on Google</div>
                  </div>
                </a>
              )}

              {business.instagram_url && (
                <a
                  href={business.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onTrackAction && onTrackAction("instagram_click")}
                  style={styles.actionCard}
                >
                  <span style={{ ...styles.actionIcon, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <InstagramIcon size={20} />
                  </span>
                  <div>
                    <div style={styles.actionTitle}>Instagram</div>
                    <div style={styles.actionSub}>Tag @{business.name}</div>
                  </div>
                </a>
              )}

              {(business.whatsapp_number || business.phone) && (
                <a
                  href={
                    business.whatsapp_number
                      ? `https://wa.me/${business.whatsapp_number.replace(/\D/g, "")}`
                      : `tel:${business.phone}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onTrackAction && onTrackAction("whatsapp_click")}
                  style={styles.actionCard}
                >
                  <span style={{ ...styles.actionIcon, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <WhatsAppIcon size={20} />
                  </span>
                  <div>
                    <div style={styles.actionTitle}>Call Staff</div>
                    <div style={styles.actionSub}>Need help at table?</div>
                  </div>
                </a>
              )}

              {business.payment_enabled && (business.payment_url || business.upi_id) && (
                <button
                  type="button"
                  onClick={() => {
                    if (onTrackAction) onTrackAction("payment_click");
                    setIsPaymentModalOpen(true);
                  }}
                  style={{ ...styles.actionCard, cursor: "pointer", textAlign: "left" }}
                >
                  <span style={styles.actionIcon}>💳</span>
                  <div>
                    <div style={styles.actionTitle}>Pay Online</div>
                    <div style={styles.actionSub}>Instant UPI &amp; QR</div>
                  </div>
                </button>
              )}

              {feedbackEnabled && onOpenFeedback && (
                <button
                  type="button"
                  onClick={onOpenFeedback}
                  style={{ ...styles.actionCard, cursor: "pointer", textAlign: "left" }}
                >
                  <span style={styles.actionIcon}>📝</span>
                  <div>
                    <div style={styles.actionTitle}>Feedback</div>
                    <div style={styles.actionSub}>Share review</div>
                  </div>
                </button>
              )}

              {loyaltyEnabled && onOpenLoyalty && (
                <button
                  type="button"
                  onClick={onOpenLoyalty}
                  style={{ ...styles.actionCard, cursor: "pointer", textAlign: "left" }}
                >
                  <span style={styles.actionIcon}>🎁</span>
                  <div>
                    <div style={styles.actionTitle}>Rewards</div>
                    <div style={styles.actionSub}>Loyalty points</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 2: MENU --- */}
        {activeTab === "menu" && (
          <div style={styles.tabContent}>
            {/* SEARCH BAR */}
            <div style={styles.searchBoxWrapper}>
              <span style={{ fontSize: "15px", color: "#94a3b8" }}>🔍</span>
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={styles.clearSearchBtn}
                >
                  ✕
                </button>
              )}
            </div>

            {/* CATEGORY FILTER PILLS */}
            <div style={styles.categoryScroll}>
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                style={{
                  ...styles.categoryPill,
                  background: selectedCategory === "all" ? "#111827" : "#ffffff",
                  color: selectedCategory === "all" ? "#ffffff" : "#475569",
                  borderColor: selectedCategory === "all" ? "#111827" : "#e2e8f0",
                }}
              >
                All Dishes
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    ...styles.categoryPill,
                    background: selectedCategory === cat.id ? "#111827" : "#ffffff",
                    color: selectedCategory === cat.id ? "#ffffff" : "#475569",
                    borderColor: selectedCategory === cat.id ? "#111827" : "#e2e8f0",
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* DISH CARDS LIST */}
            <div style={styles.menuItemsList}>
              {filteredMenuItems.length === 0 ? (
                <div style={styles.emptyResultsCard}>
                  <div>🍽️</div>
                  <div style={{ fontWeight: 700, marginTop: "8px", color: "#1e293b" }}>
                    No dishes found
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                    Try selecting a different category or clearing your search.
                  </div>
                </div>
              ) : (
                filteredMenuItems.map((dish) => {
                  const qty = cart[dish.id] || 0;
                  const numPrice = Number(String(dish.price || "").replace(/[^0-9.]/g, "")) || 0;

                  return (
                    <div key={dish.id} style={styles.dishCard}>
                      <div style={styles.dishInfoCol}>
                        {/* Veg / Non-Veg Indicator */}
                        <div style={styles.dietaryRow}>
                          <span
                            style={{
                              ...styles.dietaryDotBorder,
                              borderColor: dish.dietary === "non_veg" ? "#dc2626" : "#16a34a",
                            }}
                          >
                            <span
                              style={{
                                ...styles.dietaryDotInner,
                                background: dish.dietary === "non_veg" ? "#dc2626" : "#16a34a",
                              }}
                            />
                          </span>
                          {dish.popular && (
                            <span style={styles.popularBadge}>★ Best Seller</span>
                          )}
                        </div>

                        <div style={styles.dishName}>{dish.name}</div>
                        <div style={styles.dishPrice}>₹{numPrice.toFixed(0)}</div>

                        {dish.description && (
                          <div style={styles.dishDesc}>{dish.description}</div>
                        )}
                      </div>

                      {/* Right side Image & Add button */}
                      <div style={styles.dishActionCol}>
                        {dish.imageUrl ? (
                          <div style={styles.dishImageWrap}>
                            <img src={dish.imageUrl} alt={dish.name} style={styles.dishImg} />
                          </div>
                        ) : (
                          <div style={styles.dishImagePlaceholder}>
                            <span>🍲</span>
                          </div>
                        )}

                        <div style={styles.addBtnContainer}>
                          {qty > 0 ? (
                            <div style={styles.qtyStepper}>
                              <button
                                type="button"
                                onClick={() => removeFromCart(dish.id)}
                                style={styles.stepperBtn}
                              >
                                −
                              </button>
                              <span style={styles.stepperCount}>{qty}</span>
                              <button
                                type="button"
                                onClick={() => addToCart(dish.id)}
                                style={styles.stepperBtn}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToCart(dish.id)}
                              style={styles.addButton}
                            >
                              ADD +
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* --- TAB 3: SEARCH --- */}
        {activeTab === "search" && (
          <div style={styles.tabContent}>
            <div style={styles.searchBoxWrapper}>
              <span style={{ fontSize: "16px", color: "#94a3b8" }}>🔍</span>
              <input
                type="text"
                autoFocus
                placeholder="Search food by name, ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={styles.clearSearchBtn}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ marginTop: "16px" }}>
              <div style={styles.sectionHeaderTitle}>
                {searchQuery ? `Search Results (${filteredMenuItems.length})` : "All Dishes"}
              </div>

              <div style={styles.menuItemsList}>
                {filteredMenuItems.map((dish) => {
                  const qty = cart[dish.id] || 0;
                  const numPrice = Number(String(dish.price || "").replace(/[^0-9.]/g, "")) || 0;

                  return (
                    <div key={dish.id} style={styles.dishCard}>
                      <div style={styles.dishInfoCol}>
                        <div style={styles.dishName}>{dish.name}</div>
                        <div style={styles.dishPrice}>₹{numPrice.toFixed(0)}</div>
                        {dish.description && (
                          <div style={styles.dishDesc}>{dish.description}</div>
                        )}
                      </div>
                      <div style={styles.dishActionCol}>
                        {qty > 0 ? (
                          <div style={styles.qtyStepper}>
                            <button
                              type="button"
                              onClick={() => removeFromCart(dish.id)}
                              style={styles.stepperBtn}
                            >
                              −
                            </button>
                            <span style={styles.stepperCount}>{qty}</span>
                            <button
                              type="button"
                              onClick={() => addToCart(dish.id)}
                              style={styles.stepperBtn}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToCart(dish.id)}
                            style={styles.addButton}
                          >
                            ADD +
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 4: MY ORDERS (SCREENSHOT 2 DESIGN) --- */}
        {activeTab === "orders" && (
          <div style={styles.tabContent}>
            {/* Header info */}
            <div style={styles.ordersHeaderRow}>
              <div>
                <div style={styles.tableSuperTag}>TABLE T{tableNumber || "1"}</div>
                <h2 style={styles.ordersPageTitle}>My Orders</h2>
              </div>
              <div style={styles.ordersIconHeader}>📋</div>
            </div>

            {currentOrder ? (
              <div style={styles.ordersBody}>
                {/* CURRENT BILL CARD */}
                <div style={styles.currentBillCard}>
                  <div style={styles.billHeaderRow}>
                    <div style={styles.billReceiptCircle}>🧾</div>
                    <div style={styles.billTitleCol}>
                      <div style={styles.currentBillLabel}>CURRENT BILL</div>
                      <div style={styles.billAmountLarge}>
                        ₹{Number(currentOrder.total || 0).toFixed(0)}
                      </div>
                    </div>
                    {/* Status Chip */}
                    <div
                      style={{
                        ...styles.statusChip,
                        background: getStatusBadge(currentOrder.status).bg,
                        color: getStatusBadge(currentOrder.status).color,
                        border: `1px solid ${getStatusBadge(currentOrder.status).border}`,
                      }}
                    >
                      {getStatusBadge(currentOrder.status).label}
                    </div>
                  </div>

                  <div style={styles.billSummaryLine}>
                    1 order • {currentOrderItems.length || 1} item{currentOrderItems.length !== 1 ? "s" : ""}
                  </div>

                  <div style={styles.billHelperNote}>
                    Your bill will update here as order statuses change.
                  </div>
                </div>

                {/* DETAILED ORDER CARD */}
                <div style={styles.orderDetailCard}>
                  <div style={styles.orderDetailHeader}>
                    <div>
                      <div style={styles.orderNumberText}>
                        Order #{currentOrder.order_number || currentOrder.id.slice(0, 6).toUpperCase()}
                      </div>
                      <div style={styles.orderTimestampText}>
                        Dine in • {formatOrderTime(currentOrder.created_at) || "Just now"}
                      </div>
                    </div>
                    <div
                      style={{
                        ...styles.statusChip,
                        background: getStatusBadge(currentOrder.status).bg,
                        color: getStatusBadge(currentOrder.status).color,
                        border: `1px solid ${getStatusBadge(currentOrder.status).border}`,
                      }}
                    >
                      {getStatusBadge(currentOrder.status).label}
                    </div>
                  </div>

                  {/* Order Items List */}
                  <div style={styles.orderItemsBreakdown}>
                    {currentOrderItems.map((item) => (
                      <div key={item.id} style={styles.orderItemLine}>
                        <span style={styles.orderItemNameText}>
                          {item.item_name} <strong style={{ color: "#0f172a" }}>x{item.quantity}</strong>
                        </span>
                        <span style={styles.orderItemPriceText}>
                          ₹{Number(item.line_total || 0).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order Total Line */}
                  <div style={styles.orderTotalDivider} />
                  <div style={styles.orderTotalRow}>
                    <span style={styles.orderTotalLabel}>Order Total</span>
                    <span style={styles.orderTotalValue}>
                      ₹{Number(currentOrder.total || 0).toFixed(0)}
                    </span>
                  </div>

                  {/* Support Contact Row */}
                  <div style={styles.orderHelpBanner}>
                    <span style={styles.helpText}>Check your order status here.</span>
                    <div style={styles.helpButtonsRow}>
                      {business.phone && (
                        <a
                          href={`tel:${business.phone}`}
                          style={styles.helpIconBtn}
                          title="Call staff"
                        >
                          📞
                        </a>
                      )}
                      {business.whatsapp_number && (
                        <a
                          href={`https://wa.me/${business.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I am at Table ${tableNumber} (Order #${currentOrder.order_number || currentOrder.id.slice(0, 6)}). Need assistance.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...styles.helpIconBtn, display: "flex", alignItems: "center", justifyContent: "center" }}
                          title="WhatsApp staff"
                        >
                          <WhatsAppIcon size={18} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Cancel Button (only if order is still pending) */}
                  {currentOrder.status === "pending" && (
                    <button
                      type="button"
                      disabled={cancellingOrder}
                      onClick={handleCancelOrder}
                      style={styles.cancelOrderBtn}
                    >
                      {cancellingOrder ? "Cancelling..." : "✕ Cancel Order"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={styles.noOrdersCard}>
                <div style={{ fontSize: "38px", marginBottom: "12px" }}>🧾</div>
                <div style={styles.noOrdersTitle}>No active order yet</div>
                <p style={styles.noOrdersSub}>
                  Browse the menu, add items to your cart and place an order to track your live status here.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("menu")}
                  style={styles.browseMenuCtaBtn}
                >
                  🍴 Browse Menu
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ---------------------------------------------------- */}
      {/* 3. FLOATING ACTION BUBBLE (FAB) */}
      {/* ---------------------------------------------------- */}
      {hasActiveOrder && activeTab !== "orders" && (
        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          style={styles.floatingOrderFab}
          title="View Active Order"
        >
          <span>🧾</span>
          <span style={styles.fabCountBadge}>1</span>
        </button>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. STICKY CART BAR (WHEN ITEMS IN CART) */}
      {/* ---------------------------------------------------- */}
      {cartCount > 0 && (
        <div style={styles.stickyCartBarWrapper}>
          <div style={styles.stickyCartBar}>
            <div>
              <div style={styles.cartCountLabel}>{cartCount} item{cartCount > 1 ? "s" : ""} added</div>
              <div style={styles.cartPriceLabel}>₹{cartTotal.toFixed(0)}</div>
            </div>

            <button
              type="button"
              onClick={() => setShowCheckoutSheet(true)}
              style={styles.viewCartButton}
            >
              View Cart / Order →
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. CHECKOUT / PLACE ORDER SHEET MODAL */}
      {/* ---------------------------------------------------- */}
      {showCheckoutSheet && (
        <div style={styles.modalOverlay}>
          <div style={styles.checkoutSheet}>
            <div style={styles.sheetHeader}>
              <div>
                <h3 style={styles.sheetTitle}>Table Order</h3>
                <div style={styles.sheetSubtitle}>Review items & confirm your order</div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutSheet(false)}
                style={styles.closeSheetBtn}
              >
                ✕
              </button>
            </div>

            <div style={styles.sheetBody}>
              {/* Order Items Summary */}
              <div style={styles.sheetItemsList}>
                {cartItems.map((item) => (
                  <div key={item.id} style={styles.sheetItemRow}>
                    <div>
                      <div style={styles.sheetItemName}>{item.name}</div>
                      <div style={styles.sheetItemPrice}>₹{item.numericPrice.toFixed(0)} each</div>
                    </div>

                    <div style={styles.qtyStepperSmall}>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        style={styles.stepperBtn}
                      >
                        −
                      </button>
                      <span style={styles.stepperCount}>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => addToCart(item.id)}
                        style={styles.stepperBtn}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bill Summary */}
              <div style={styles.billTotalRow}>
                <span>Subtotal:</span>
                <span>₹{cartTotal.toFixed(0)}</span>
              </div>
              <div style={{ ...styles.billTotalRow, fontWeight: 800, fontSize: "16px", color: "#0f172a" }}>
                <span>Total Payable:</span>
                <span>₹{cartTotal.toFixed(0)}</span>
              </div>

              {/* Customer Inputs */}
              <div style={styles.formInputsBox}>
                <label style={styles.inputLabel}>
                  Table Number <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Enter table number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  style={styles.sheetInput}
                />

                <label style={styles.inputLabel}>
                  Your Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={styles.sheetInput}
                />

                <label style={styles.inputLabel}>Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  style={styles.sheetInput}
                />

                {orderError && (
                  <div style={styles.orderErrorMessage}>
                    ⚠️ {orderError}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.sheetFooter}>
              <button
                type="button"
                disabled={placingOrder}
                onClick={handlePlaceOrder}
                style={styles.confirmOrderBtn}
              >
                {placingOrder ? "Placing Order..." : `Place Order (₹${cartTotal.toFixed(0)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 6. FIXED BOTTOM NAVIGATION DOCK (4 TABS) */}
      {/* ---------------------------------------------------- */}
      <nav style={styles.bottomNavDock}>
        {/* Tab 1: Home */}
        <button
          type="button"
          onClick={() => setActiveTab("home")}
          style={{
            ...styles.navTabBtn,
            background: activeTab === "home" ? "#111827" : "transparent",
            color: activeTab === "home" ? "#ffffff" : "#64748b",
          }}
        >
          <span style={styles.navIcon}>🏠</span>
          <span style={styles.navLabel}>Home</span>
        </button>

        {/* Tab 2: Menu */}
        <button
          type="button"
          onClick={() => setActiveTab("menu")}
          style={{
            ...styles.navTabBtn,
            background: activeTab === "menu" ? "#111827" : "transparent",
            color: activeTab === "menu" ? "#ffffff" : "#64748b",
          }}
        >
          <span style={styles.navIcon}>🍴</span>
          <span style={styles.navLabel}>Menu</span>
        </button>

        {/* Tab 3: Search */}
        <button
          type="button"
          onClick={() => setActiveTab("search")}
          style={{
            ...styles.navTabBtn,
            background: activeTab === "search" ? "#111827" : "transparent",
            color: activeTab === "search" ? "#ffffff" : "#64748b",
          }}
        >
          <span style={styles.navIcon}>🔍</span>
          <span style={styles.navLabel}>Search</span>
        </button>

        {/* Tab 4: My Orders */}
        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          style={{
            ...styles.navTabBtn,
            background: activeTab === "orders" ? "#111827" : "transparent",
            color: activeTab === "orders" ? "#ffffff" : "#64748b",
            position: "relative",
          }}
        >
          <span style={styles.navIcon}>📋</span>
          <span style={styles.navLabel}>My Orders</span>
          {hasActiveOrder && (
            <span style={styles.navActiveDot} />
          )}
        </button>
      </nav>

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

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "480px",
    margin: "0 auto",
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    paddingBottom: "85px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    position: "relative",
    color: "#0f172a",
  },
  topHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #f1f5f9",
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  topBrandInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  logoCircle: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    backgroundColor: "#fef3c7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    overflow: "hidden",
    border: "1px solid #fde68a",
  },
  logoImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  businessNameHeading: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: "1.2",
  },
  tableBadgeSubtitle: {
    fontSize: "11px",
    color: "#64748b",
    fontWeight: 600,
    marginTop: "2px",
  },
  iconButton: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  contentBody: {
    flex: 1,
    padding: "14px 16px",
  },
  tabContent: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  heroCard: {
    width: "100%",
    minHeight: "310px",
    borderRadius: "20px",
    backgroundImage: `radial-gradient(circle at center, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.95) 100%), url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
  },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  heroTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  glassTablePill: {
    background: "rgba(255, 255, 255, 0.2)",
    backdropFilter: "blur(8px)",
    color: "#ffffff",
    padding: "5px 12px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 700,
    border: "1px solid rgba(255, 255, 255, 0.3)",
  },
  glassCutleryCircle: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.2)",
    backdropFilter: "blur(8px)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "15px",
    border: "1px solid rgba(255, 255, 255, 0.3)",
  },
  heroBottomContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "6px",
  },
  watermarkTagline: {
    alignSelf: "flex-end",
    fontSize: "11px",
    color: "rgba(255, 255, 255, 0.65)",
    fontStyle: "italic",
    marginBottom: "4px",
  },
  heroMainTitle: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 900,
    color: "#ffffff",
    lineHeight: "1.15",
    letterSpacing: "-0.5px",
  },
  heroSubtitle: {
    margin: "4px 0 14px",
    fontSize: "12px",
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: "1.4",
  },
  startOrderingBtn: {
    background: "#ffffff",
    color: "#0f172a",
    border: "none",
    padding: "10px 18px",
    borderRadius: "30px",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
  },
  offersContainer: {
    marginTop: "6px",
  },
  sectionHeaderTitle: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: "8px",
  },
  offersCard: {
    background: "linear-gradient(135deg, #fefce8 0%, #fffbeb 100%)",
    border: "1px solid #fef08a",
    padding: "12px 14px",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  offerIconBadge: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    backgroundColor: "#fde047",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    flexShrink: 0,
  },
  offerTitle: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#854d0e",
  },
  offerDesc: {
    fontSize: "11px",
    color: "#a16207",
    marginTop: "2px",
  },
  quickActionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginTop: "4px",
  },
  actionCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    padding: "12px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
    color: "inherit",
    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
  },
  actionIcon: {
    fontSize: "20px",
  },
  actionTitle: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#0f172a",
  },
  actionSub: {
    fontSize: "10px",
    color: "#64748b",
    marginTop: "1px",
  },
  searchBoxWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "10px 14px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
  },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: "13px",
    color: "#0f172a",
    background: "transparent",
  },
  clearSearchBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: "12px",
    cursor: "pointer",
  },
  categoryScroll: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: "4px",
    scrollbarWidth: "none",
  },
  categoryPill: {
    padding: "7px 14px",
    borderRadius: "20px",
    border: "1px solid",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  },
  menuItemsList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  emptyResultsCard: {
    background: "#ffffff",
    padding: "24px",
    borderRadius: "14px",
    textAlign: "center",
    border: "1px solid #e2e8f0",
  },
  dishCard: {
    background: "#ffffff",
    border: "1px solid #f1f5f9",
    borderRadius: "16px",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
  },
  dishInfoCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  dietaryRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "2px",
  },
  dietaryDotBorder: {
    width: "12px",
    height: "12px",
    border: "1.5px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "3px",
  },
  dietaryDotInner: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
  },
  popularBadge: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#d97706",
    background: "#fef3c7",
    padding: "1px 6px",
    borderRadius: "4px",
  },
  dishName: {
    fontSize: "14px",
    fontWeight: 750,
    color: "#0f172a",
  },
  dishPrice: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#059669",
  },
  dishDesc: {
    fontSize: "11px",
    color: "#64748b",
    lineHeight: "1.35",
    marginTop: "2px",
  },
  dishActionCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  dishImageWrap: {
    width: "68px",
    height: "68px",
    borderRadius: "12px",
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
  },
  dishImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  dishImagePlaceholder: {
    width: "68px",
    height: "68px",
    borderRadius: "12px",
    backgroundColor: "#f8fafc",
    border: "1px dashed #cbd5e1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
  },
  addBtnContainer: {
    width: "74px",
  },
  addButton: {
    width: "100%",
    background: "#ffffff",
    color: "#15803d",
    border: "1px solid #86efac",
    padding: "5px 0",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
  },
  qtyStepper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#15803d",
    borderRadius: "8px",
    color: "#ffffff",
    padding: "3px 4px",
  },
  qtyStepperSmall: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#15803d",
    borderRadius: "6px",
    color: "#ffffff",
    padding: "2px 6px",
  },
  stepperBtn: {
    background: "transparent",
    border: "none",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
    padding: "0 4px",
  },
  stepperCount: {
    fontSize: "12px",
    fontWeight: 800,
  },
  ordersHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tableSuperTag: {
    fontSize: "11px",
    fontWeight: 800,
    color: "#ea580c",
    letterSpacing: "0.5px",
  },
  ordersPageTitle: {
    margin: "2px 0 0",
    fontSize: "22px",
    fontWeight: 900,
    color: "#0f172a",
  },
  ordersIconHeader: {
    fontSize: "24px",
    background: "#f1f5f9",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  ordersBody: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    marginTop: "6px",
  },
  currentBillCard: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "16px",
    border: "1px solid #f1f5f9",
    boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  billHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  billReceiptCircle: {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    backgroundColor: "#ffedd5",
    color: "#c2410c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    flexShrink: 0,
  },
  billTitleCol: {
    flex: 1,
  },
  currentBillLabel: {
    fontSize: "10px",
    fontWeight: 800,
    color: "#ea580c",
    letterSpacing: "0.5px",
  },
  billAmountLarge: {
    fontSize: "24px",
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: "1.2",
  },
  statusChip: {
    fontSize: "11px",
    fontWeight: 800,
    padding: "4px 10px",
    borderRadius: "20px",
    whiteSpace: "nowrap",
  },
  billSummaryLine: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#475569",
    marginTop: "4px",
  },
  billHelperNote: {
    fontSize: "11px",
    color: "#94a3b8",
    lineHeight: "1.4",
  },
  orderDetailCard: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "16px",
    border: "1px solid #f1f5f9",
    boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
  },
  orderDetailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "12px",
  },
  orderNumberText: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#0f172a",
  },
  orderTimestampText: {
    fontSize: "11px",
    color: "#64748b",
    marginTop: "2px",
  },
  orderItemsBreakdown: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  orderItemLine: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
  },
  orderItemNameText: {
    color: "#475569",
  },
  orderItemPriceText: {
    fontWeight: 700,
    color: "#0f172a",
  },
  orderTotalDivider: {
    height: "1px",
    background: "#f1f5f9",
    margin: "12px 0",
  },
  orderTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    fontWeight: 800,
    color: "#0f172a",
  },
  orderTotalLabel: {
    color: "#0f172a",
  },
  orderTotalValue: {
    color: "#0f172a",
    fontSize: "16px",
  },
  orderHelpBanner: {
    marginTop: "16px",
    background: "#fff7ed",
    border: "1px solid #ffedd5",
    borderRadius: "12px",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  helpText: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#9a3412",
  },
  helpButtonsRow: {
    display: "flex",
    gap: "8px",
  },
  helpIconBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: "#ffffff",
    border: "1px solid #fed7aa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    fontSize: "13px",
  },
  cancelOrderBtn: {
    width: "100%",
    marginTop: "12px",
    padding: "9px 0",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#dc2626",
    border: "1px solid #fecaca",
    fontSize: "12px",
    fontWeight: 750,
    cursor: "pointer",
  },
  noOrdersCard: {
    background: "#ffffff",
    padding: "36px 20px",
    borderRadius: "18px",
    textAlign: "center",
    border: "1px solid #e2e8f0",
    marginTop: "10px",
  },
  noOrdersTitle: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#0f172a",
  },
  noOrdersSub: {
    fontSize: "12px",
    color: "#64748b",
    lineHeight: "1.5",
    maxWidth: "280px",
    margin: "6px auto 18px",
  },
  browseMenuCtaBtn: {
    background: "#111827",
    color: "#ffffff",
    border: "none",
    padding: "10px 22px",
    borderRadius: "24px",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
  floatingOrderFab: {
    position: "fixed",
    bottom: "80px",
    right: "18px",
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    backgroundColor: "#16a34a",
    color: "#ffffff",
    border: "none",
    fontSize: "22px",
    boxShadow: "0 6px 18px rgba(22, 163, 74, 0.35)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
  },
  fabCountBadge: {
    position: "absolute",
    top: "-3px",
    right: "-3px",
    backgroundColor: "#0f172a",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: 800,
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #ffffff",
  },
  stickyCartBarWrapper: {
    position: "fixed",
    bottom: "74px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "calc(100% - 24px)",
    maxWidth: "450px",
    zIndex: 45,
  },
  stickyCartBar: {
    background: "#0f172a",
    borderRadius: "14px",
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#ffffff",
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
  },
  cartCountLabel: {
    fontSize: "11px",
    color: "#94a3b8",
  },
  cartPriceLabel: {
    fontSize: "16px",
    fontWeight: 900,
  },
  viewCartButton: {
    background: "#10b981",
    color: "#ffffff",
    border: "none",
    padding: "8px 14px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(4px)",
    zIndex: 60,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  checkoutSheet: {
    background: "#ffffff",
    width: "100%",
    maxWidth: "480px",
    borderTopLeftRadius: "24px",
    borderTopRightRadius: "24px",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 -10px 30px rgba(0,0,0,0.2)",
    animation: "slideUp 0.25s ease-out",
  },
  sheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #f1f5f9",
  },
  sheetTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 800,
    color: "#0f172a",
  },
  sheetSubtitle: {
    fontSize: "11px",
    color: "#64748b",
    marginTop: "2px",
  },
  closeSheetBtn: {
    background: "#f1f5f9",
    border: "none",
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    fontSize: "13px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBody: {
    padding: "16px 20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sheetItemsList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sheetItemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "8px",
    borderBottom: "1px dashed #e2e8f0",
  },
  sheetItemName: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#0f172a",
  },
  sheetItemPrice: {
    fontSize: "11px",
    color: "#64748b",
  },
  billTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    color: "#475569",
    paddingTop: "4px",
  },
  formInputsBox: {
    marginTop: "10px",
    background: "#f8fafc",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  },
  inputLabel: {
    display: "block",
    fontSize: "11px",
    fontWeight: 750,
    color: "#334155",
    marginBottom: "4px",
    marginTop: "8px",
  },
  sheetInput: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    color: "#0f172a",
    outline: "none",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
  },
  orderErrorMessage: {
    marginTop: "8px",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    padding: "8px 10px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 600,
  },
  sheetFooter: {
    padding: "14px 20px",
    borderTop: "1px solid #f1f5f9",
  },
  confirmOrderBtn: {
    width: "100%",
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    padding: "13px 0",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(15,23,42,0.2)",
  },
  bottomNavDock: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: "480px",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    backdropFilter: "blur(12px)",
    borderTop: "1px solid #e2e8f0",
    padding: "8px 12px 14px",
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "6px",
    zIndex: 50,
    boxSizing: "border-box",
  },
  navTabBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 4px",
    borderRadius: "14px",
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  navIcon: {
    fontSize: "17px",
    lineHeight: "1",
  },
  navLabel: {
    fontSize: "10px",
    fontWeight: 750,
    marginTop: "3px",
  },
  navActiveDot: {
    position: "absolute",
    top: "6px",
    right: "18px",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#10b981",
  },
};
