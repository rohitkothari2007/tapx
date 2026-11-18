"use client";

import React, { useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { type StaffMenuCategory, type StaffMenuItem } from "../../lib/staffMenu";

export type NewOrderScreenProps = {
  businessId: string;
  categories: StaffMenuCategory[];
  items: StaffMenuItem[];
  tableCount: number | null;
  packingCharge: number;
  initialTable?: number | null;
  onCreated: (orderId: string) => void;
  onCancel?: () => void;
  mode: "staff" | "owner";
};

type CartLine = {
  itemId: string;
  quantity: number;
  specialRequest: string;
};

function generateClientToken(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC 4122 v4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function NewOrderScreen({
  businessId,
  categories,
  items,
  tableCount,
  packingCharge,
  initialTable,
  onCreated,
  onCancel,
  mode,
}: NewOrderScreenProps) {
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">(
    initialTable ? "dine_in" : "dine_in"
  );
  const [selectedTable, setSelectedTable] = useState<number | null>(
    initialTable || (tableCount && tableCount > 0 ? 1 : null)
  );
  const [prevInitialTable, setPrevInitialTable] = useState(initialTable);
  if (initialTable !== prevInitialTable) {
    setPrevInitialTable(initialTable);
    if (initialTable) {
      setSelectedTable(initialTable);
      setOrderType("dine_in");
    }
  }

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNote, setOrderNote] = useState("");

  // Search & Category filter
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Cart: itemId -> CartLine
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  // Item notes open state
  const [activeNoteItemId, setActiveNoteItemId] = useState<string | null>(null);

  // Client token generated once per draft to prevent duplicate orders
  const [clientToken, setClientToken] = useState(() => generateClientToken());

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);

  // Filtered items
  const filteredItems = useMemo(() => {
    let list = items;
    if (selectedCategoryId !== "all") {
      list = list.filter((it) => it.categoryId === selectedCategoryId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.description && it.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, selectedCategoryId, searchQuery]);

  // Cart operations
  const updateQuantity = (item: StaffMenuItem, delta: number) => {
    setCart((prev) => {
      const curr = prev[item.id];
      const newQty = (curr?.quantity || 0) + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return {
        ...prev,
        [item.id]: {
          itemId: item.id,
          quantity: Math.min(50, newQty),
          specialRequest: curr?.specialRequest || "",
        },
      };
    });
  };

  const updateItemNote = (itemId: string, note: string) => {
    setCart((prev) => {
      const curr = prev[itemId];
      if (!curr) return prev;
      return {
        ...prev,
        [itemId]: {
          ...curr,
          specialRequest: note.slice(0, 200),
        },
      };
    });
  };

  // Cart totals
  const totalItemCount = useMemo(() => {
    return Object.values(cart).reduce((sum, line) => sum + line.quantity, 0);
  }, [cart]);

  const itemsTotalEstimate = useMemo(() => {
    let total = 0;
    for (const [id, line] of Object.entries(cart)) {
      const item = items.find((i) => i.id === id);
      if (item && item.price !== undefined) {
        const priceNum = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
        total += priceNum * line.quantity;
      }
    }
    return Math.round(total * 100) / 100;
  }, [cart, items]);

  // Submit order
  const handleSendOrder = async () => {
    setErrorMsg("");

    if (totalItemCount === 0) {
      setErrorMsg("Please add at least one item to the order.");
      return;
    }

    if (orderType === "dine_in" && (!selectedTable || selectedTable < 1)) {
      setErrorMsg("Please select a table number for dine-in orders.");
      return;
    }

    setSubmitting(true);
    try {
      const cartLinesArray = Object.values(cart);
      const payloadItems = cartLinesArray.map((l) => ({
        item_id: l.itemId,
        quantity: l.quantity,
        special_request: l.specialRequest.trim() ? l.specialRequest.trim().slice(0, 200) : null,
      }));

      const cleanPhone = customerPhone.replace(/\D/g, "");

      const { data, error } = await supabase.rpc("create_tapx_staff_order", {
        p_business_id: businessId,
        p_order_type: orderType,
        p_table_number: orderType === "dine_in" ? selectedTable : null,
        p_customer_name: customerName.trim() || null,
        p_customer_phone: cleanPhone || null,
        p_items: payloadItems,
        p_order_note: orderNote.trim() ? orderNote.trim().slice(0, 300) : null,
        p_client_token: clientToken,
      });

      if (error) {
        if (error.message?.includes("does not exist") || error.code === "42883") {
          throw new Error("Staff order entry is not enabled on the database yet.");
        }
        throw new Error(error.message || "Failed to create order.");
      }

      const orderId = String(data || "");
      setCreatedOrderNumber(orderId);

      // Generate a new client token for the next draft
      setClientToken(generateClientToken());

      // Clear current cart & inputs
      setCart({});
      setCustomerName("");
      setCustomerPhone("");
      setOrderNote("");

      onCreated(orderId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error sending order";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Success view
  if (createdOrderNumber) {
    return (
      <div style={{ maxWidth: "480px", margin: "20px auto", padding: "16px", textAlign: "center" }}>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #fed7aa",
            borderRadius: "16px",
            padding: "32px 20px",
            boxShadow: "0 10px 25px -5px rgba(249, 115, 22, 0.1)",
          }}
        >
          <div style={{ fontSize: "44px", marginBottom: "12px" }}>✅</div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#1c1410", margin: "0 0 6px" }}>
            Order Sent to Kitchen!
          </h2>
          <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px" }}>
            {orderType === "dine_in"
              ? `Table ${selectedTable} order is now active on the kitchen board.`
              : "Takeaway order has been sent to the kitchen."}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {orderType === "dine_in" && (
              <button
                type="button"
                onClick={() => setCreatedOrderNumber(null)}
                style={{
                  minHeight: "44px",
                  padding: "12px",
                  background: "#f97316",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "15px",
                  cursor: "pointer",
                }}
              >
                ＋ Add another order for Table {selectedTable}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setCreatedOrderNumber(null);
                onCancel?.();
              }}
              style={{
                minHeight: "44px",
                padding: "12px",
                background: "#f1f5f9",
                color: "#334155",
                border: "none",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              {orderType === "dine_in" ? "Back to tables" : "Done"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dietaryDotColor = (d?: StaffMenuItem["dietary"]) => {
    if (d === "veg" || d === "vegan") return "#16a34a";
    if (d === "egg") return "#d97706";
    if (d === "non_veg") return "#dc2626";
    return null;
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", paddingBottom: "110px", boxSizing: "border-box" }}>
      {/* Top Bar: Order Type Switch & Back Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          marginBottom: "14px",
          padding: "4px 0",
        }}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              minHeight: "44px",
              padding: "8px 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              fontSize: "13.5px",
              fontWeight: 700,
              color: "#475569",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        )}

        {mode === "owner" && (
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#c2410c",
              backgroundColor: "#ffedd5",
              padding: "4px 8px",
              borderRadius: "8px",
            }}
          >
            Owner
          </span>
        )}

        {/* Order Type Toggle */}
        <div
          role="group"
          aria-label="Order Type"
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            borderRadius: "10px",
            padding: "3px",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            aria-pressed={orderType === "dine_in"}
            onClick={() => setOrderType("dine_in")}
            style={{
              flex: 1,
              minHeight: "40px",
              padding: "6px 14px",
              border: "none",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 800,
              background: orderType === "dine_in" ? "#f97316" : "transparent",
              color: orderType === "dine_in" ? "#ffffff" : "#475569",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            🍽️ Dine-in
          </button>
          <button
            type="button"
            aria-pressed={orderType === "takeaway"}
            onClick={() => setOrderType("takeaway")}
            style={{
              flex: 1,
              minHeight: "40px",
              padding: "6px 14px",
              border: "none",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 800,
              background: orderType === "takeaway" ? "#f97316" : "transparent",
              color: orderType === "takeaway" ? "#ffffff" : "#475569",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            🛍️ Takeaway
          </button>
        </div>
      </div>

      {/* Target Details Card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #fed7aa",
          borderRadius: "14px",
          padding: "14px 16px",
          marginBottom: "14px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {orderType === "dine_in" ? (
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
              Select Table *
            </label>
            {tableCount && tableCount > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(46px, 1fr))",
                  gap: "6px",
                  maxHeight: "130px",
                  overflowY: "auto",
                  padding: "2px",
                }}
              >
                {Array.from({ length: tableCount }, (_, i) => i + 1).map((tbl) => {
                  const isSel = selectedTable === tbl;
                  return (
                    <button
                      key={tbl}
                      type="button"
                      onClick={() => setSelectedTable(tbl)}
                      style={{
                        minHeight: "44px",
                        padding: "6px",
                        borderRadius: "8px",
                        border: `1.5px solid ${isSel ? "#ea580c" : "#cbd5e1"}`,
                        background: isSel ? "#ea580c" : "#ffffff",
                        color: isSel ? "#ffffff" : "#1e293b",
                        fontSize: "14px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {tbl}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="number"
                min="1"
                placeholder="Table Number (e.g. 5)"
                value={selectedTable || ""}
                onChange={(e) => setSelectedTable(parseInt(e.target.value) || null)}
                style={{
                  width: "100%",
                  minHeight: "44px",
                  padding: "10px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "15px",
                  fontWeight: 700,
                  boxSizing: "border-box",
                }}
              />
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Customer Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    padding: "8px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Mobile (optional)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="10 digits"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    padding: "8px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            {packingCharge > 0 && (
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#c2410c", background: "#fff7ed", padding: "6px 10px", borderRadius: "6px" }}>
                📦 Packing charge ₹{packingCharge} will be added when billing this order.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: "10px" }}>
        <input
          type="search"
          placeholder="🔍 Search dishes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            minHeight: "44px",
            padding: "8px 14px",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            fontSize: "14px",
            background: "#ffffff",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Categories Horizontal Scroll */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "8px",
          marginBottom: "12px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedCategoryId("all")}
          style={{
            minHeight: "40px",
            padding: "6px 14px",
            borderRadius: "20px",
            border: `1.5px solid ${selectedCategoryId === "all" ? "#f97316" : "#e2e8f0"}`,
            background: selectedCategoryId === "all" ? "#f97316" : "#ffffff",
            color: selectedCategoryId === "all" ? "#ffffff" : "#475569",
            fontSize: "13px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            cursor: "pointer",
          }}
        >
          All Items ({items.length})
        </button>

        {categories.map((cat) => {
          const isSel = selectedCategoryId === cat.id;
          const count = items.filter((i) => i.categoryId === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              style={{
                minHeight: "40px",
                padding: "6px 14px",
                borderRadius: "20px",
                border: `1.5px solid ${isSel ? "#f97316" : "#e2e8f0"}`,
                background: isSel ? "#f97316" : "#ffffff",
                color: isSel ? "#ffffff" : "#475569",
                fontSize: "13px",
                fontWeight: 700,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Item List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredItems.length === 0 ? (
          <div style={{ padding: "30px 10px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
            No dishes found matching your search.
          </div>
        ) : (
          filteredItems.map((item) => {
            const line = cart[item.id];
            const qty = line?.quantity || 0;
            const isAvail = item.available !== false;
            const dot = dietaryDotColor(item.dietary);

            return (
              <div
                key={item.id}
                style={{
                  background: "#ffffff",
                  border: `1px solid ${qty > 0 ? "#fed7aa" : "#e2e8f0"}`,
                  borderRadius: "12px",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  opacity: isAvail ? 1 : 0.5,
                  boxShadow: qty > 0 ? "0 2px 6px rgba(249, 115, 22, 0.08)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                  {/* Left: Dietary + Name + Price */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {dot && (
                        <span
                          style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "3px",
                            border: `1px solid ${dot}`,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: dot }} />
                        </span>
                      )}
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "#1c1410",
                          wordBreak: "break-word",
                        }}
                      >
                        {item.name}
                      </div>
                    </div>

                    <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#ea580c", marginTop: "2px" }}>
                      {item.price !== undefined && item.price !== ""
                        ? `₹${item.price}`
                        : ""}
                    </div>
                  </div>

                  {/* Right: Stepper or Add button */}
                  <div>
                    {!isAvail ? (
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8" }}>
                        Unavailable
                      </span>
                    ) : qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => updateQuantity(item, 1)}
                        style={{
                          minHeight: "44px",
                          padding: "6px 18px",
                          background: "#fffaf3",
                          border: "1.5px solid #f97316",
                          color: "#f97316",
                          borderRadius: "8px",
                          fontSize: "13.5px",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        ＋ Add
                      </button>
                    ) : (
                      <div style={{ display: "inline-flex", alignItems: "center", background: "#f97316", borderRadius: "8px" }}>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item, -1)}
                          style={{
                            minHeight: "44px",
                            minWidth: "40px",
                            background: "transparent",
                            color: "#ffffff",
                            border: "none",
                            fontSize: "18px",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          −
                        </button>
                        <span style={{ minWidth: "24px", textAlign: "center", color: "#ffffff", fontWeight: 800, fontSize: "15px" }}>
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item, 1)}
                          style={{
                            minHeight: "44px",
                            minWidth: "40px",
                            background: "transparent",
                            color: "#ffffff",
                            border: "none",
                            fontSize: "18px",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          ＋
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-item note row if item in cart */}
                {qty > 0 && (
                  <div>
                    {activeNoteItemId === item.id || line?.specialRequest ? (
                      <div style={{ marginTop: "4px" }}>
                        <input
                          type="text"
                          maxLength={200}
                          placeholder="Special request (e.g. less spicy, no onion)"
                          value={line?.specialRequest || ""}
                          onChange={(e) => updateItemNote(item.id, e.target.value)}
                          style={{
                            width: "100%",
                            minHeight: "40px",
                            padding: "6px 10px",
                            fontSize: "12.5px",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveNoteItemId(item.id)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "2px 0",
                          color: "#64748b",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        📝 Add note for chef
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Order-level note */}
      <div style={{ marginTop: "16px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
          Order Note / Allergies (optional)
        </label>
        <textarea
          rows={2}
          maxLength={300}
          placeholder="e.g. Allergy to peanuts, rush order"
          value={orderNote}
          onChange={(e) => setOrderNote(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            fontSize: "13.5px",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div
          style={{
            marginTop: "12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "13.5px",
            fontWeight: 600,
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.06)",
          padding: "12px 16px",
          zIndex: 900,
        }}
      >
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#1c1410" }}>
              {totalItemCount} {totalItemCount === 1 ? "item" : "items"}{" "}
              {itemsTotalEstimate > 0 && `· ₹${itemsTotalEstimate}`}
            </div>
            <div style={{ fontSize: "11.5px", color: "#64748b" }}>
              {orderType === "dine_in"
                ? `Table ${selectedTable || "—"}`
                : `Takeaway ${packingCharge > 0 ? `(+₹${packingCharge} packing)` : ""}`}
            </div>
          </div>

          <button
            type="button"
            disabled={submitting || totalItemCount === 0}
            onClick={handleSendOrder}
            style={{
              minHeight: "48px",
              padding: "12px 24px",
              background: totalItemCount > 0 ? "#f97316" : "#cbd5e1",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 800,
              cursor: submitting || totalItemCount === 0 ? "not-allowed" : "pointer",
              boxShadow: totalItemCount > 0 ? "0 4px 12px rgba(249, 115, 22, 0.3)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {submitting ? "Sending..." : "🍳 Send to kitchen"}
          </button>
        </div>
      </div>
    </div>
  );
}
