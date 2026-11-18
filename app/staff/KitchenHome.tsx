"use client";

import { useEffect, useRef, useState } from "react";
import { computeTableRounds, addOnBadgeText } from "../lib/tableRounds";
import {
  buildKitchenSlip,
  renderKitchenSlipsHtml,
  printHtmlInHiddenFrame,
  formatSlipTime,
} from "../lib/kitchenSlip";
import { isSoundEnabled, setSoundEnabled, playNewOrderChime } from "./audio";

export type StaffKitchenOrder = {
  id: string;
  order_number: number | null;
  table_number: number | null;
  order_type: "dine_in" | "takeaway";
  status: "pending" | "accepted" | "preparing" | "ready";
  created_at: string;
  customer_name?: string | null;
  taken_by_name?: string | null;
  order_source?: string | null;
  order_note?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    special_request?: string | null;
  }>;
};

interface KitchenHomeProps {
  orders: StaffKitchenOrder[];
  onUpdateStatus: (orderId: string, nextStatus: "accepted" | "preparing" | "ready") => Promise<void>;
  isOffline: boolean;
  lastUpdated: Date | null;
}

export default function KitchenHome({
  orders,
  onUpdateStatus,
  isOffline,
  lastUpdated,
}: KitchenHomeProps) {
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Track previous order IDs to play chime when new orders arrive
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Update relative time every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Check for new orders to chime
  useEffect(() => {
    const currentIds = new Set(orders.map((o) => o.id));
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      prevOrderIdsRef.current = currentIds;
      return;
    }

    const hasNewOrder = orders.some(
      (o) => !prevOrderIdsRef.current.has(o.id) && o.status === "pending"
    );
    if (hasNewOrder && soundOn) {
      playNewOrderChime();
    }
    prevOrderIdsRef.current = currentIds;
  }, [orders, soundOn]);

  function handleSoundToggle() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) {
      playNewOrderChime();
    }
  }

  // Pre-calculate rounds for table orders
  const roundsMap = computeTableRounds(orders, null, nowMs);

  function getElapsedMinutes(createdAt: string): number {
    const t = new Date(createdAt).getTime();
    if (Number.isNaN(t)) return 0;
    return Math.max(0, Math.floor((nowMs - t) / 60000));
  }

  function handlePrintSingleSlip(order: StaffKitchenOrder) {
    const roundInfo = roundsMap.get(order.id);
    const addOn = roundInfo ? addOnBadgeText(roundInfo.round) : "";

    const slip = buildKitchenSlip({
      tableNumber: order.table_number,
      addOnText: addOn,
      orderLabel: order.order_number ? `#${order.order_number}` : null,
      createdAt: order.created_at,
      items: (order.items || []).map((it) => ({
        item_name: it.name,
        quantity: it.quantity,
        special_request: it.special_request,
      })),
      orderNote: order.order_note,
    });

    const printedAt = formatSlipTime(new Date());
    printHtmlInHiddenFrame(renderKitchenSlipsHtml([slip], printedAt));
  }

  function handlePrintAllNew() {
    const pendingOrders = orders
      .filter((o) => o.status === "pending")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (pendingOrders.length === 0) {
      alert("No pending orders to print.");
      return;
    }

    const slips = pendingOrders.map((order) => {
      const roundInfo = roundsMap.get(order.id);
      const addOn = roundInfo ? addOnBadgeText(roundInfo.round) : "";
      return buildKitchenSlip({
        tableNumber: order.table_number,
        addOnText: addOn,
        orderLabel: order.order_number ? `#${order.order_number}` : null,
        createdAt: order.created_at,
        items: (order.items || []).map((it) => ({
          item_name: it.name,
          quantity: it.quantity,
          special_request: it.special_request,
        })),
        orderNote: order.order_note,
      });
    });

    const printedAt = formatSlipTime(new Date());
    printHtmlInHiddenFrame(renderKitchenSlipsHtml(slips, printedAt));
  }

  async function handleStatusClick(orderId: string, nextStatus: "accepted" | "preparing" | "ready") {
    setUpdatingId(orderId);
    try {
      await onUpdateStatus(orderId, nextStatus);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div style={{ padding: "16px 14px 48px", maxWidth: 640, margin: "0 auto" }}>
      {/* Top Action Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={handleSoundToggle}
            style={{
              minHeight: 40,
              padding: "6px 14px",
              borderRadius: 20,
              border: soundOn ? "1.5px solid #16a34a" : "1.5px solid #d6d3d1",
              backgroundColor: soundOn ? "#f0fdf4" : "#f5f5f4",
              color: soundOn ? "#15803d" : "#78716c",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
          >
            <span>{soundOn ? "🔔 Sound ON" : "🔕 Sound OFF"}</span>
          </button>
          {isOffline ? (
            <span
              style={{
                fontSize: 12,
                color: "#dc2626",
                fontWeight: 600,
                backgroundColor: "#fef2f2",
                padding: "4px 8px",
                borderRadius: 12,
              }}
            >
              ● Offline
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#78716c" }}>
              {lastUpdated ? `Synced ${Math.floor((nowMs - lastUpdated.getTime()) / 1000)}s ago` : "Synced"}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handlePrintAllNew}
          style={{
            minHeight: 40,
            padding: "6px 14px",
            borderRadius: 20,
            border: "1.5px solid #1c1410",
            backgroundColor: "#fff",
            color: "#1c1410",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <span>🖨️ Print all new</span>
          {orders.filter((o) => o.status === "pending").length > 0 && (
            <span
              style={{
                backgroundColor: "#f97316",
                color: "#fff",
                borderRadius: "50%",
                padding: "1px 6px",
                fontSize: 11,
              }}
            >
              {orders.filter((o) => o.status === "pending").length}
            </span>
          )}
        </button>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 20,
            padding: "40px 20px",
            textAlign: "center",
            border: "1px dashed #d6d3d1",
            marginTop: 20,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🍳</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1c1410", margin: "0 0 6px" }}>
            Kitchen is clear
          </h3>
          <p style={{ fontSize: 13, color: "#78716c", margin: 0 }}>
            New dine-in and takeaway orders will appear here automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {orders.map((order) => {
            const isTakeaway = order.order_type === "takeaway" || order.table_number === null;
            const roundInfo = roundsMap.get(order.id);
            const addOnText = roundInfo ? addOnBadgeText(roundInfo.round) : "";
            const elapsedMin = getElapsedMinutes(order.created_at);
            const isLateAlert = elapsedMin >= 20;
            const isLateWarn = elapsedMin >= 10 && !isLateAlert;
            const isUpdating = updatingId === order.id;

            return (
              <div
                key={order.id}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 18,
                  border:
                    order.status === "ready"
                      ? "2px solid #86efac"
                      : isLateAlert
                      ? "2px solid #fca5a5"
                      : "1.5px solid #e7e5e4",
                  padding: "16px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {isTakeaway ? (
                      <span
                        style={{
                          backgroundColor: "#f97316",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: 14,
                          padding: "3px 10px",
                          borderRadius: 8,
                          letterSpacing: "0.04em",
                        }}
                      >
                        TAKEAWAY · #{order.order_number || "?"}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: "#1c1410",
                        }}
                      >
                        Table {order.table_number}
                      </span>
                    )}

                    {addOnText && (
                      <span
                        style={{
                          backgroundColor: "#fef3c7",
                          color: "#b45309",
                          border: "1.5px solid #f59e0b",
                          fontWeight: 800,
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 8,
                        }}
                      >
                        {addOnText}
                      </span>
                    )}
                  </div>

                  {/* Timer badge */}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 10,
                      backgroundColor: isLateAlert ? "#fee2e2" : isLateWarn ? "#ffedd5" : "#f5f5f4",
                      color: isLateAlert ? "#b91c1c" : isLateWarn ? "#c2410c" : "#57534e",
                    }}
                  >
                    {elapsedMin}m ago {isLateAlert && "⚠️ LATE"}
                  </div>
                </div>

                {/* Subtitle / Source info */}
                <div
                  style={{
                    fontSize: 12,
                    color: "#78716c",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    Order #{order.order_number || "?"} · {formatSlipTime(order.created_at)}
                  </span>
                  <span>•</span>
                  <span>
                    {order.taken_by_name
                      ? `Taken by ${order.taken_by_name}`
                      : order.order_source === "owner"
                      ? "Taken by Owner"
                      : "Guest QR"}
                  </span>
                  {isTakeaway && order.customer_name && (
                    <>
                      <span>•</span>
                      <span style={{ fontWeight: 600, color: "#44403c" }}>
                        Guest: {order.customer_name}
                      </span>
                    </>
                  )}
                </div>

                {/* Dishes list */}
                <div
                  style={{
                    backgroundColor: "#fafaf9",
                    borderRadius: 12,
                    padding: "10px 12px",
                    marginBottom: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {(order.items || []).map((it, idx) => (
                    <div key={idx} style={{ fontSize: 14 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span
                          style={{
                            fontWeight: 800,
                            color: "#ea580c",
                            minWidth: 26,
                            fontSize: 15,
                          }}
                        >
                          {it.quantity}×
                        </span>
                        <span style={{ fontWeight: 700, color: "#1c1410", flex: 1 }}>
                          {it.name}
                        </span>
                      </div>
                      {it.special_request && (
                        <div
                          style={{
                            marginLeft: 34,
                            marginTop: 2,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#b45309",
                            backgroundColor: "#fef3c7",
                            padding: "2px 8px",
                            borderRadius: 6,
                            display: "inline-block",
                          }}
                        >
                          Note: {it.special_request}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Order-level note if any */}
                {order.order_note && (
                  <div
                    style={{
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#92400e",
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                    }}
                  >
                    <span>📝</span>
                    <span>Order Note: {order.order_note}</span>
                  </div>
                )}

                {/* Action buttons */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handlePrintSingleSlip(order)}
                    style={{
                      minHeight: 44,
                      padding: "0 14px",
                      borderRadius: 12,
                      border: "1.5px solid #d6d3d1",
                      backgroundColor: "#fff",
                      color: "#44403c",
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    🖨️ Print
                  </button>

                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                    {order.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleStatusClick(order.id, "accepted")}
                        disabled={isUpdating}
                        style={{
                          minHeight: 44,
                          padding: "0 18px",
                          borderRadius: 12,
                          border: "none",
                          backgroundColor: "#f97316",
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: isUpdating ? "not-allowed" : "pointer",
                          opacity: isUpdating ? 0.7 : 1,
                        }}
                      >
                        {isUpdating ? "..." : "Accept"}
                      </button>
                    )}

                    {order.status === "accepted" && (
                      <button
                        type="button"
                        onClick={() => handleStatusClick(order.id, "preparing")}
                        disabled={isUpdating}
                        style={{
                          minHeight: 44,
                          padding: "0 18px",
                          borderRadius: 12,
                          border: "none",
                          backgroundColor: "#ea580c",
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: isUpdating ? "not-allowed" : "pointer",
                          opacity: isUpdating ? 0.7 : 1,
                        }}
                      >
                        {isUpdating ? "..." : "Start preparing"}
                      </button>
                    )}

                    {order.status === "preparing" && (
                      <button
                        type="button"
                        onClick={() => handleStatusClick(order.id, "ready")}
                        disabled={isUpdating}
                        style={{
                          minHeight: 44,
                          padding: "0 20px",
                          borderRadius: 12,
                          border: "none",
                          backgroundColor: "#16a34a",
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: isUpdating ? "not-allowed" : "pointer",
                          opacity: isUpdating ? 0.7 : 1,
                        }}
                      >
                        {isUpdating ? "..." : "Mark ready ✓"}
                      </button>
                    )}

                    {order.status === "ready" && (
                      <div
                        style={{
                          padding: "8px 14px",
                          borderRadius: 12,
                          backgroundColor: "#dcfce7",
                          color: "#15803d",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        ✓ Ready · Waiting for waiter
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
