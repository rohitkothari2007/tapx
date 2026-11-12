"use client";

import React, { useMemo, useState } from "react";
import {
  BillableOrderItemLike,
  BillableOrderLike,
  LiveOrderBillLinkMap,
  formatMoney,
  formatRelativeAgeShort,
  groupBillableOrdersByTable,
} from "../../lib/billing";

type Props<T extends BillableOrderLike> = {
  orders: T[];
  orderItems: BillableOrderItemLike[];
  liveBillLinks: LiveOrderBillLinkMap;
  onBillTable: (tableNumber: number) => void;
  onBillOrderWithoutTable?: (order: T) => void;
};

export default function UnbilledOrdersWarning<T extends BillableOrderLike>({
  orders,
  orderItems,
  liveBillLinks,
  onBillTable,
  onBillOrderWithoutTable,
}: Props<T>) {
  const [expanded, setExpanded] = useState(false);

  const grouped = useMemo(() => {
    return groupBillableOrdersByTable(orders, orderItems, liveBillLinks, {
      statuses: ["served", "completed"],
    });
  }, [orders, orderItems, liveBillLinks]);

  const { totalOrders, totalAmount } = useMemo(() => {
    let count = 0;
    let sum = 0;
    for (const g of grouped) {
      count += g.orderCount;
      sum += g.unbilledTotal;
    }
    return { totalOrders: count, totalAmount: sum };
  }, [grouped]);

  if (totalOrders === 0) return null;

  return (
    <div
      style={{
        marginBottom: "18px",
        borderRadius: "12px",
        border: "1px solid #fde68a",
        background: "#fffbeb",
        color: "#92400e",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: "100%",
          border: 0,
          background: "transparent",
          padding: "11px 15px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          cursor: "pointer",
          textAlign: "left",
          color: "#92400e",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", fontWeight: 700 }}>
          <span aria-hidden="true">⚠️</span>
          <span>
            {totalOrders} served/completed {totalOrders === 1 ? "order" : "orders"} (
            {formatMoney(totalAmount)}) {totalOrders === 1 ? "has" : "have"} no bill yet
          </span>
        </div>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#b45309",
            whiteSpace: "nowrap",
          }}
        >
          {expanded ? "Hide tables ▴" : "View by table ▾"}
        </span>
      </button>

      {expanded && (
        <div
          style={{
            borderTop: "1px solid #fde68a",
            background: "#ffffff",
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {grouped.map((g) => {
            const label =
              g.tableNumber !== null ? `Table ${g.tableNumber}` : "No table";
            const age = formatRelativeAgeShort(g.oldestCreatedAt);

            return (
              <div
                key={g.tableNumber !== null ? `table-${g.tableNumber}` : "no-table"}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "#fffdf7",
                  border: "1px solid #fef3c7",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>{label}</strong>
                  <span style={{ fontSize: "12.5px", color: "#64748b" }}>
                    {g.orderCount} {g.orderCount === 1 ? "order" : "orders"} ·{" "}
                    <strong style={{ color: "#0f172a" }}>{formatMoney(g.unbilledTotal)}</strong>
                    {age ? ` · ${age}` : ""}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (g.tableNumber !== null) {
                      onBillTable(g.tableNumber);
                    } else if (onBillOrderWithoutTable && g.orders[0]) {
                      onBillOrderWithoutTable(g.orders[0]);
                    }
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #f59e0b",
                    background: "#f59e0b",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Bill
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
