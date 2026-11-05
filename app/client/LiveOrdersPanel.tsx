"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type LiveOrder = {
  id: string;
  business_id: string;
  table_number: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number | null;
  total: number | null;
  status: string;
  source_device_code: string | null;
  created_at: string;
  order_number?: number | null;
  notes?: string | null;
};

export type LiveOrderItem = {
  id: string;
  order_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  special_request?: string | null;
  notes?: string | null;
};

type Props = {
  businessId: string;
  orders: LiveOrder[];
  orderItems: LiveOrderItem[];
  updateOrderStatus: (id: string, status: string) => Promise<void>;
  updatingOrderId: string | null;
};

const ACTIVE_STATUSES = ["pending", "accepted", "preparing", "ready", "served"];

function formatTimeAgo(isoString: string): string {
  try {
    const elapsedMs = Date.now() - new Date(isoString).getTime();
    const elapsedSec = Math.floor(elapsedMs / 1000);
    if (elapsedSec < 30) return "Just now";
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `${elapsedMin}m ago`;
    const elapsedHours = Math.floor(elapsedMin / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;
    return `${Math.floor(elapsedHours / 24)}d ago`;
  } catch {
    return "";
  }
}

function playChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.32);
  } catch {
    // AudioContext blocked or not supported
  }
}

function getNextAction(status: string): { nextStatus: string; label: string; bg: string } | null {
  switch (status) {
    case "pending":
      return { nextStatus: "accepted", label: "✓ Accept", bg: "#16a34a" };
    case "accepted":
      return { nextStatus: "preparing", label: "🍳 Start preparing", bg: "#d97706" };
    case "preparing":
      return { nextStatus: "ready", label: "🔔 Mark ready", bg: "#2563eb" };
    case "ready":
      return { nextStatus: "served", label: "🍽️ Mark served", bg: "#0891b2" };
    case "served":
      return { nextStatus: "completed", label: "✓ Complete", bg: "#475569" };
    default:
      return null;
  }
}

function getStatusBadgeStyle(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case "pending":
      return { bg: "#fef3c7", color: "#92400e", label: "Pending" };
    case "accepted":
      return { bg: "#dbeafe", color: "#1e40af", label: "Accepted" };
    case "preparing":
      return { bg: "#ffedd5", color: "#9a3412", label: "Preparing" };
    case "ready":
      return { bg: "#e0e7ff", color: "#3730a3", label: "Ready" };
    case "served":
      return { bg: "#ccfbf1", color: "#115e59", label: "Served" };
    default:
      return { bg: "#f1f5f9", color: "#475569", label: status };
  }
}

export default function LiveOrdersPanel({
  businessId,
  orders,
  orderItems,
  updateOrderStatus,
  updatingOrderId,
}: Props) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Record<string, boolean>>({});
  const [, setTick] = useState(0);

  // Initialize sound preference from localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("tapx_live_orders_sound");
        if (stored === "true") setSoundEnabled(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tapx_live_orders_sound", String(next));
          if (next) playChime();
        }
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Re-render every 30s to update elapsed time labels
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Filter active orders & sort OLDEST first
  const activeOrders = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  // Detect newly arrived active orders for sound & highlight
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstRender = useRef(true);

  useEffect(() => {
    const currentActiveIds = new Set(activeOrders.map((o) => o.id));

    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevOrderIdsRef.current = currentActiveIds;
      return;
    }

    const newIds: string[] = [];
    currentActiveIds.forEach((id) => {
      if (!prevOrderIdsRef.current.has(id)) {
        newIds.push(id);
      }
    });

    if (newIds.length > 0) {
      if (soundEnabled) {
        playChime();
      }

      setHighlightedIds((prev) => {
        const next = { ...prev };
        newIds.forEach((id) => {
          next[id] = true;
        });
        return next;
      });

      const timer = setTimeout(() => {
        setHighlightedIds((prev) => {
          const next = { ...prev };
          newIds.forEach((id) => {
            delete next[id];
          });
          return next;
        });
      }, 4000);

      prevOrderIdsRef.current = currentActiveIds;
      return () => clearTimeout(timer);
    }

    prevOrderIdsRef.current = currentActiveIds;
  }, [activeOrders, soundEnabled]);

  const handleCancel = async (orderId: string) => {
    if (typeof window !== "undefined" && !window.confirm("Are you sure you want to cancel this order?")) {
      return;
    }
    await updateOrderStatus(orderId, "cancelled");
  };

  return (
    <section style={styles.container} aria-label="Live table orders">
      <div style={styles.headerRow}>
        <div style={styles.titleGroup}>
          <div style={styles.liveIndicator}>
            <span style={styles.liveDot} />
            <span style={styles.liveText}>LIVE ORDERS</span>
          </div>
          <h2 style={styles.title}>
            Active Kitchen & Table Orders ({activeOrders.length})
          </h2>
          <p style={styles.subtitle}>
            Incoming orders from dining tables, updated in real time. Oldest orders appear first.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleSound}
          style={{
            ...styles.soundButton,
            background: soundEnabled ? "#ecfdf5" : "#f8fafc",
            borderColor: soundEnabled ? "#6ee7b7" : "#cbd5e1",
            color: soundEnabled ? "#065f46" : "#475569",
          }}
          title={soundEnabled ? "Disable order chime" : "Enable order chime"}
        >
          <span>{soundEnabled ? "🔔" : "🔕"}</span>
          <span>Sound Alerts: {soundEnabled ? "ON" : "OFF"}</span>
        </button>
      </div>

      {activeOrders.length === 0 ? (
        <div style={styles.emptyCard}>
          <div style={styles.emptyIcon}>🍽️</div>
          <div style={styles.emptyTitle}>No active orders</div>
          <div style={styles.emptySubtitle}>
            When customers place orders from their tables, they will instantly appear here.
          </div>
        </div>
      ) : (
        <div style={styles.orderGrid}>
          {activeOrders.map((order) => {
            const nextAction = getNextAction(order.status);
            const statusBadge = getStatusBadgeStyle(order.status);
            const isHighlighted = Boolean(highlightedIds[order.id]);
            const isUpdating = updatingOrderId === order.id;

            const items = orderItems.filter((i) => i.order_id === order.id);
            const timeAgo = formatTimeAgo(order.created_at);

            const cleanPhone = (order.customer_phone || "").replace(/\D/g, "");
            const whatsappUrl = cleanPhone
              ? `https://wa.me/${cleanPhone}`
              : null;

            return (
              <div
                key={order.id}
                style={{
                  ...styles.orderCard,
                  borderColor: isHighlighted
                    ? "#3b82f6"
                    : order.status === "pending"
                    ? "#f59e0b"
                    : "#e2e8f0",
                  boxShadow: isHighlighted
                    ? "0 0 0 2px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0,0,0,0.06)"
                    : "0 2px 8px rgba(0, 0, 0, 0.04)",
                  background: isHighlighted ? "#f8faff" : "#ffffff",
                }}
              >
                {/* CARD HEADER: TABLE & ORDER NUMBER */}
                <div style={styles.cardHeader}>
                  <div style={styles.tableBadgeContainer}>
                    <div style={styles.tableBadge}>
                      {order.table_number
                        ? `Table ${order.table_number}`
                        : "No Table"}
                    </div>
                    <div style={styles.orderRef}>
                      #{order.order_number || order.id.slice(0, 8)}
                    </div>
                  </div>

                  <div style={styles.statusAndTiming}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        background: statusBadge.bg,
                        color: statusBadge.color,
                      }}
                    >
                      {statusBadge.label}
                    </span>
                    <span style={styles.timeAgoText}>{timeAgo}</span>
                  </div>
                </div>

                {/* CUSTOMER INFO */}
                <div style={styles.customerRow}>
                  <span style={styles.customerName}>
                    👤 {order.customer_name || "Customer"}
                  </span>

                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.whatsappLink}
                      title="Open WhatsApp with customer"
                    >
                      💬 {order.customer_phone}
                    </a>
                  ) : order.customer_phone ? (
                    <span style={styles.customerPhone}>
                      📞 {order.customer_phone}
                    </span>
                  ) : null}
                </div>

                {/* ITEMS LIST */}
                <div style={styles.itemsBox}>
                  {items.length === 0 ? (
                    <div style={styles.noItemsText}>Order items loading...</div>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} style={styles.itemRow}>
                        <div style={styles.itemMain}>
                          <span style={styles.itemQuantity}>
                            {item.quantity}×
                          </span>
                          <span style={styles.itemName}>{item.item_name}</span>
                          {(item.special_request || item.notes) && (
                            <div style={styles.itemNote}>
                              <strong style={styles.itemNoteLabel}>Request:</strong> {item.special_request || item.notes}
                            </div>
                          )}
                        </div>

                        <span style={styles.itemPrice}>
                          ₹{(item.line_total || item.unit_price * item.quantity).toFixed(0)}
                        </span>
                      </div>
                    ))
                  )}

                  {order.notes && (
                    <div style={styles.orderLevelNote}>
                      <strong>Order Note:</strong> {order.notes}
                    </div>
                  )}
                </div>

                {/* TOTAL ROW */}
                <div style={styles.totalRow}>
                  <span style={styles.totalLabel}>Total</span>
                  <span style={styles.totalValue}>
                    ₹{(order.total || order.subtotal || 0).toFixed(0)}
                  </span>
                </div>

                {/* ACTION BUTTONS */}
                <div style={styles.actionsRow}>
                  {nextAction && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => updateOrderStatus(order.id, nextAction.nextStatus)}
                      style={{
                        ...styles.primaryActionButton,
                        background: nextAction.bg,
                        opacity: isUpdating ? 0.6 : 1,
                      }}
                    >
                      {isUpdating ? "Updating..." : nextAction.label}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleCancel(order.id)}
                    style={styles.cancelButton}
                    title="Cancel this order"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    marginBottom: "28px",
    background: "#ffffff",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "14px",
    marginBottom: "18px",
  },
  titleGroup: {
    flex: "1 1 300px",
  },
  liveIndicator: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "#fef2f2",
    color: "#dc2626",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    padding: "3px 8px",
    borderRadius: "20px",
    marginBottom: "6px",
  },
  liveDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#dc2626",
    boxShadow: "0 0 0 2px rgba(220, 38, 38, 0.2)",
  },
  liveText: {
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: "19px",
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.01em",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "#64748b",
    lineHeight: 1.4,
  },
  soundButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    borderRadius: "10px",
    border: "1px solid",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s ease",
  },
  emptyCard: {
    padding: "36px 20px",
    textAlign: "center",
    borderRadius: "12px",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
  },
  emptyIcon: {
    fontSize: "32px",
    marginBottom: "8px",
  },
  emptyTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#334155",
  },
  emptySubtitle: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "4px",
    maxWidth: "360px",
    marginInline: "auto",
  },
  orderGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "16px",
  },
  orderCard: {
    borderRadius: "14px",
    border: "1.5px solid",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    transition: "all 0.2s ease",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
    paddingBottom: "10px",
    borderBottom: "1px solid #f1f5f9",
  },
  tableBadgeContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  tableBadge: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  orderRef: {
    fontSize: "12px",
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#64748b",
  },
  statusAndTiming: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
  },
  statusBadge: {
    padding: "3px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.02em",
    lineHeight: 1.2,
  },
  timeAgoText: {
    fontSize: "11px",
    color: "#94a3b8",
    fontWeight: 600,
  },
  customerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "12px",
    gap: "8px",
  },
  customerName: {
    fontWeight: 700,
    color: "#334155",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  whatsappLink: {
    color: "#059669",
    fontWeight: 700,
    textDecoration: "none",
    fontSize: "11px",
    background: "#ecfdf5",
    padding: "3px 7px",
    borderRadius: "6px",
    whiteSpace: "nowrap",
  },
  customerPhone: {
    color: "#64748b",
    fontSize: "11px",
  },
  itemsBox: {
    background: "#f8fafc",
    borderRadius: "10px",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "12px",
  },
  noItemsText: {
    color: "#94a3b8",
    fontStyle: "italic",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
  },
  itemMain: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
  },
  itemQuantity: {
    fontWeight: 800,
    color: "#0f172a",
    marginRight: "6px",
  },
  itemName: {
    fontWeight: 600,
    color: "#334155",
  },
  itemNote: {
    display: "inline-block",
    marginTop: "3px",
    padding: "2px 7px",
    background: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: "5px",
    color: "#92400e",
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1.4,
  },
  itemNoteLabel: {
    fontWeight: 800,
    color: "#78350f",
    marginRight: "4px",
  },
  itemPrice: {
    fontWeight: 700,
    color: "#475569",
    fontFamily: "monospace",
    whiteSpace: "nowrap",
  },
  orderLevelNote: {
    marginTop: "4px",
    paddingTop: "4px",
    borderTop: "1px dashed #cbd5e1",
    fontSize: "11px",
    color: "#b45309",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "6px",
    borderTop: "1px solid #f1f5f9",
  },
  totalLabel: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  totalValue: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#0f172a",
  },
  actionsRow: {
    display: "flex",
    gap: "8px",
    marginTop: "2px",
  },
  primaryActionButton: {
    flex: 1,
    padding: "9px 12px",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "center",
    transition: "background 0.15s ease",
  },
  cancelButton: {
    padding: "9px 12px",
    background: "#fff1f2",
    color: "#e11d48",
    border: "1px solid #fecdd3",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s ease",
  },
};
