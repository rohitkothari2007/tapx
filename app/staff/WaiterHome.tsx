"use client";

import { useEffect, useState } from "react";
import NewOrderScreen from "../components/staff/NewOrderScreen";
import type { StaffMenuCategory, StaffMenuItem } from "../lib/staffMenu";
import { formatSlipTime } from "../lib/kitchenSlip";

export type StaffWaiterOrder = {
  id: string;
  order_number: number | null;
  table_number: number | null;
  order_type: "dine_in" | "takeaway";
  status: "pending" | "accepted" | "preparing" | "ready" | "served";
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

export type StaffRequest = {
  id: string;
  table_number: number;
  request_type: "water" | "bill" | "staff";
  created_at: string;
};

interface WaiterHomeProps {
  businessId: string;
  tableCount: number;
  packingCharge: number;
  categories: StaffMenuCategory[];
  items: StaffMenuItem[];
  orders: StaffWaiterOrder[];
  requests: StaffRequest[];
  onMarkServed: (orderId: string) => Promise<void>;
  onResolveRequest: (requestId: string) => Promise<void>;
  isOffline: boolean;
  lastUpdated: Date | null;
}

export default function WaiterHome({
  businessId,
  tableCount,
  packingCharge,
  categories,
  items,
  orders,
  requests,
  onMarkServed,
  onResolveRequest,
  isOffline,
  lastUpdated,
}: WaiterHomeProps) {
  const [activeTab, setActiveTab] = useState<"tables" | "new_order" | "requests">("tables");
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [selectedTableForOrder, setSelectedTableForOrder] = useState<number | null>(null);
  const [actingOrderId, setActingOrderId] = useState<string | null>(null);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Periodically refresh relative time
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const totalTables = Math.max(1, tableCount || 10);
  const tableNumbers = Array.from({ length: totalTables }, (_, i) => i + 1);

  // Group orders by table
  const ordersByTable = new Map<number, StaffWaiterOrder[]>();
  for (const o of orders) {
    if (typeof o.table_number === "number" && o.table_number > 0) {
      const list = ordersByTable.get(o.table_number) || [];
      list.push(o);
      ordersByTable.set(o.table_number, list);
    }
  }

  // Group requests by table
  const requestsByTable = new Map<number, StaffRequest[]>();
  for (const r of requests) {
    if (typeof r.table_number === "number") {
      const list = requestsByTable.get(r.table_number) || [];
      list.push(r);
      requestsByTable.set(r.table_number, list);
    }
  }

  // Ready orders across all tables
  const readyOrders = orders.filter((o) => o.status === "ready");

  function getTableState(tableNum: number): {
    state: "free" | "ordered" | "ready" | "help" | "served";
    label: string;
    orderCount: number;
    oldestMinutes: number;
  } {
    const tableOrders = ordersByTable.get(tableNum) || [];
    const tableReqs = requestsByTable.get(tableNum) || [];

    const hasHelp = tableReqs.length > 0;
    const hasReady = tableOrders.some((o) => o.status === "ready");

    let oldestMinutes = 0;
    if (tableOrders.length > 0) {
      const timestamps = tableOrders
        .map((o) => new Date(o.created_at).getTime())
        .filter((t) => Number.isFinite(t));
      if (timestamps.length > 0) {
        const oldest = Math.min(...timestamps);
        oldestMinutes = Math.max(0, Math.floor((nowMs - oldest) / 60000));
      }
    }

    if (hasReady) {
      return {
        state: "ready",
        label: "Food ready!",
        orderCount: tableOrders.length,
        oldestMinutes,
      };
    }

    if (hasHelp) {
      return {
        state: "help",
        label: "Needs help",
        orderCount: tableOrders.length,
        oldestMinutes,
      };
    }

    if (tableOrders.length === 0) {
      return {
        state: "free",
        label: "Free",
        orderCount: 0,
        oldestMinutes: 0,
      };
    }

    const allServed = tableOrders.every((o) => o.status === "served");
    if (allServed) {
      return {
        state: "served",
        label: "Served · Awaiting bill",
        orderCount: tableOrders.length,
        oldestMinutes,
      };
    }

    return {
      state: "ordered",
      label: `${tableOrders.length} ${tableOrders.length === 1 ? "order" : "orders"} · ${oldestMinutes}m`,
      orderCount: tableOrders.length,
      oldestMinutes,
    };
  }

  async function handleMarkServed(orderId: string) {
    setActingOrderId(orderId);
    try {
      await onMarkServed(orderId);
    } finally {
      setActingOrderId(null);
    }
  }

  async function handleResolveRequest(requestId: string) {
    setActingRequestId(requestId);
    try {
      await onResolveRequest(requestId);
    } finally {
      setActingRequestId(null);
    }
  }

  function handleStartOrderForTable(tableNum: number) {
    setSelectedTable(null);
    setSelectedTableForOrder(tableNum);
    setActiveTab("new_order");
  }

  const selectedTableOrders = selectedTable ? ordersByTable.get(selectedTable) || [] : [];
  const selectedTableReqs = selectedTable ? requestsByTable.get(selectedTable) || [] : [];

  return (
    <div style={{ paddingBottom: 80, minHeight: "100vh" }}>
      {/* Tab 1: Tables */}
      {activeTab === "tables" && (
        <div style={{ padding: "14px 14px 20px", maxWidth: 640, margin: "0 auto" }}>
          {/* Status Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              padding: "0 4px",
            }}
          >
            <div style={{ fontSize: 13, color: "#78716c", fontWeight: 600 }}>
              {isOffline ? (
                <span style={{ color: "#dc2626" }}>● Offline</span>
              ) : (
                <span>
                  ● Live · {lastUpdated ? `${Math.floor((nowMs - lastUpdated.getTime()) / 1000)}s ago` : "Synced"}
                </span>
              )}
            </div>
            {requests.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("requests")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "#fee2e2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  borderRadius: 14,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span>🔔 {requests.length} Call staff</span>
              </button>
            )}
          </div>

          {/* Ready to serve strip */}
          {readyOrders.length > 0 && (
            <div
              style={{
                backgroundColor: "#f0fdf4",
                border: "1.5px solid #86efac",
                borderRadius: 16,
                padding: "12px",
                marginBottom: 16,
                boxShadow: "0 2px 6px rgba(22, 163, 74, 0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#15803d",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>⚡ READY TO SERVE ({readyOrders.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readyOrders.map((ro) => (
                  <div
                    key={ro.id}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 12,
                      padding: "10px 12px",
                      border: "1px solid #bbf7d0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#166534" }}>
                        {ro.table_number ? `Table ${ro.table_number}` : "Takeaway"}
                      </div>
                      <div style={{ fontSize: 12, color: "#4b5563" }}>
                        {ro.items.length} {ro.items.length === 1 ? "item" : "items"} ·{" "}
                        {formatSlipTime(ro.created_at)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMarkServed(ro.id)}
                      disabled={actingOrderId === ro.id}
                      style={{
                        minHeight: 40,
                        padding: "0 14px",
                        backgroundColor: "#16a34a",
                        color: "#fff",
                        border: "none",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: actingOrderId === ro.id ? "not-allowed" : "pointer",
                        opacity: actingOrderId === ro.id ? 0.7 : 1,
                      }}
                    >
                      {actingOrderId === ro.id ? "..." : "Mark served ✓"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: 10,
            }}
          >
            {tableNumbers.map((num) => {
              const { state, label } = getTableState(num);

              let bgColor = "#fff";
              let borderColor = "#e7e5e4";
              let textColor = "#1c1410";
              let badgeColor = "#78716c";

              if (state === "ready") {
                bgColor = "#dcfce7";
                borderColor = "#22c55e";
                textColor = "#14532d";
                badgeColor = "#15803d";
              } else if (state === "help") {
                bgColor = "#fee2e2";
                borderColor = "#ef4444";
                textColor = "#7f1d1d";
                badgeColor = "#b91c1c";
              } else if (state === "ordered") {
                bgColor = "#fff7ed";
                borderColor = "#f97316";
                textColor = "#7c2d12";
                badgeColor = "#ea580c";
              } else if (state === "served") {
                bgColor = "#f1f5f9";
                borderColor = "#94a3b8";
                textColor = "#334155";
                badgeColor = "#64748b";
              }

              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSelectedTable(num)}
                  style={{
                    backgroundColor: bgColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: 16,
                    padding: "14px 8px 12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    minHeight: 90,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                    touchAction: "manipulation",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 900, color: textColor, lineHeight: 1.1 }}>
                    {num}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: badgeColor,
                      marginTop: 6,
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    {label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: New Order */}
      {activeTab === "new_order" && (
        <NewOrderScreen
          businessId={businessId}
          categories={categories}
          items={items}
          tableCount={tableCount}
          packingCharge={packingCharge}
          initialTable={selectedTableForOrder || undefined}
          mode="staff"
          onCreated={() => {
            setSelectedTableForOrder(null);
            setActiveTab("tables");
          }}
        />
      )}

      {/* Tab 3: Requests */}
      {activeTab === "requests" && (
        <div style={{ padding: "16px 14px 20px", maxWidth: 640, margin: "0 auto" }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1c1410", margin: "0 0 4px" }}>
              Table Requests
            </h2>
            <p style={{ fontSize: 13, color: "#78716c", margin: 0 }}>
              Assistance requested by guests from table QR codes.
            </p>
          </div>

          {requests.length === 0 ? (
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 18,
                padding: "40px 20px",
                textAlign: "center",
                border: "1px dashed #d6d3d1",
                marginTop: 16,
              }}
            >
              <div style={{ fontSize: 34, marginBottom: 10 }}>🎉</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1c1410", margin: "0 0 4px" }}>
                All requests cleared
              </h3>
              <p style={{ fontSize: 13, color: "#78716c", margin: 0 }}>
                When guests tap &quot;Call staff&quot;, requests show up here instantly.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {requests.map((req) => {
                const reqTypeLabel =
                  req.request_type === "water"
                    ? "💧 Water"
                    : req.request_type === "bill"
                    ? "🧾 Bill requested"
                    : "🔔 Call staff";

                const elapsedMin = Math.max(
                  0,
                  Math.floor((nowMs - new Date(req.created_at).getTime()) / 60000)
                );

                return (
                  <div
                    key={req.id}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 16,
                      border: "1.5px solid #fecaca",
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: "#1c1410" }}>
                          Table {req.table_number}
                        </span>
                        <span
                          style={{
                            backgroundColor: "#fee2e2",
                            color: "#b91c1c",
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                          }}
                        >
                          {reqTypeLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#78716c", marginTop: 4 }}>
                        {elapsedMin}m ago ({formatSlipTime(req.created_at)})
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleResolveRequest(req.id)}
                      disabled={actingRequestId === req.id}
                      style={{
                        minHeight: 44,
                        padding: "0 18px",
                        backgroundColor: "#16a34a",
                        color: "#fff",
                        border: "none",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: actingRequestId === req.id ? "not-allowed" : "pointer",
                        opacity: actingRequestId === req.id ? 0.7 : 1,
                      }}
                    >
                      {actingRequestId === req.id ? "..." : "Done ✓"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Table Details Sheet Modal */}
      {selectedTable !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setSelectedTable(null)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: "20px 18px 28px",
              width: "100%",
              maxWidth: 500,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 -8px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: "#1c1410", margin: 0 }}>
                  Table {selectedTable}
                </h3>
                <div style={{ fontSize: 12, color: "#78716c", marginTop: 2 }}>
                  {getTableState(selectedTable).label}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTable(null)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: "#f5f5f4",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#78716c",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Table Requests if any */}
            {selectedTableReqs.length > 0 && (
              <div
                style={{
                  backgroundColor: "#fee2e2",
                  border: "1px solid #fecaca",
                  borderRadius: 12,
                  padding: "10px 14px",
                  marginBottom: 14,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>
                  Open Requests
                </div>
                {selectedTableReqs.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#b91c1c" }}>
                      {req.request_type === "water" ? "💧 Water" : req.request_type === "bill" ? "🧾 Bill" : "🔔 Call staff"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResolveRequest(req.id)}
                      disabled={actingRequestId === req.id}
                      style={{
                        padding: "4px 10px",
                        backgroundColor: "#16a34a",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Done ✓
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action Button: + Add Order */}
            <button
              type="button"
              onClick={() => handleStartOrderForTable(selectedTable)}
              style={{
                width: "100%",
                minHeight: 48,
                backgroundColor: "#f97316",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                marginBottom: 16,
                boxShadow: "0 4px 12px rgba(249, 115, 22, 0.25)",
              }}
            >
              + Add order for Table {selectedTable}
            </button>

            {/* Table Orders List */}
            {selectedTableOrders.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px 0",
                  color: "#a8a29e",
                  fontSize: 13,
                }}
              >
                No active orders on this table.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#57534e" }}>
                  Active Orders ({selectedTableOrders.length})
                </div>
                {selectedTableOrders.map((ord) => {
                  const isReady = ord.status === "ready";
                  return (
                    <div
                      key={ord.id}
                      style={{
                        backgroundColor: "#fafaf9",
                        border: isReady ? "2px solid #86efac" : "1px solid #e7e5e4",
                        borderRadius: 14,
                        padding: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1c1410" }}>
                          Order #{ord.order_number || "?"}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 8,
                            backgroundColor:
                              ord.status === "ready"
                                ? "#dcfce7"
                                : ord.status === "served"
                                ? "#f1f5f9"
                                : "#fff7ed",
                            color:
                              ord.status === "ready"
                                ? "#15803d"
                                : ord.status === "served"
                                ? "#64748b"
                                : "#ea580c",
                            textTransform: "uppercase",
                          }}
                        >
                          {ord.status}
                        </span>
                      </div>

                      <div style={{ fontSize: 11, color: "#78716c", marginBottom: 8 }}>
                        {formatSlipTime(ord.created_at)} ·{" "}
                        {ord.taken_by_name
                          ? `Taken by ${ord.taken_by_name}`
                          : ord.order_source === "owner"
                          ? "Taken by Owner"
                          : "Guest QR"}
                      </div>

                      {/* Items */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {ord.items.map((it, idx) => (
                          <div key={idx} style={{ fontSize: 13 }}>
                            <span style={{ fontWeight: 700, color: "#ea580c" }}>{it.quantity}× </span>
                            <span style={{ color: "#1c1410", fontWeight: 600 }}>{it.name}</span>
                            {it.special_request && (
                              <span style={{ fontSize: 11, color: "#b45309", marginLeft: 6 }}>
                                ({it.special_request})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {ord.order_note && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 12,
                            color: "#92400e",
                            backgroundColor: "#fef3c7",
                            padding: "4px 8px",
                            borderRadius: 6,
                          }}
                        >
                          Note: {ord.order_note}
                        </div>
                      )}

                      {/* Mark served button if ready */}
                      {isReady && (
                        <button
                          type="button"
                          onClick={() => handleMarkServed(ord.id)}
                          disabled={actingOrderId === ord.id}
                          style={{
                            width: "100%",
                            marginTop: 10,
                            minHeight: 42,
                            backgroundColor: "#16a34a",
                            color: "#fff",
                            border: "none",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: actingOrderId === ord.id ? "not-allowed" : "pointer",
                          }}
                        >
                          {actingOrderId === ord.id ? "Updating..." : "Mark served ✓"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#fff",
          borderTop: "1px solid #e7e5e4",
          display: "flex",
          justifyContent: "space-around",
          padding: "6px 0 10px",
          zIndex: 90,
          boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("tables")}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            minHeight: 48,
            color: activeTab === "tables" ? "#f97316" : "#78716c",
            touchAction: "manipulation",
          }}
        >
          <span style={{ fontSize: 20 }}>🍽️</span>
          <span style={{ fontSize: 11, fontWeight: activeTab === "tables" ? 800 : 600, marginTop: 2 }}>
            Tables
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedTableForOrder(null);
            setActiveTab("new_order");
          }}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            minHeight: 48,
            color: activeTab === "new_order" ? "#f97316" : "#78716c",
            touchAction: "manipulation",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: activeTab === "new_order" ? "#f97316" : "#fed7aa",
              color: activeTab === "new_order" ? "#fff" : "#ea580c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            +
          </div>
          <span style={{ fontSize: 11, fontWeight: activeTab === "new_order" ? 800 : 600, marginTop: 2 }}>
            New order
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            minHeight: 48,
            position: "relative",
            color: activeTab === "requests" ? "#f97316" : "#78716c",
            touchAction: "manipulation",
          }}
        >
          <span style={{ fontSize: 20 }}>🔔</span>
          {requests.length > 0 && (
            <span
              style={{
                position: "absolute",
                top: 4,
                right: "32%",
                backgroundColor: "#dc2626",
                color: "#fff",
                borderRadius: "50%",
                padding: "1px 5px",
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {requests.length}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: activeTab === "requests" ? 800 : 600, marginTop: 2 }}>
            Requests
          </span>
        </button>
      </div>
    </div>
  );
}
