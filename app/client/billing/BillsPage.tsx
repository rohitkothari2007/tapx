"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  BillingBusinessProfile,
  BillingSettings,
  PaymentMethod,
  TapxBill,
  TapxBillItem,
  TapxBillSummary,
  daysBetweenIST,
  formatBillDayLabel,
  formatBillTimeShort,
  formatMoney,
  parseBillingSettings,
  shiftISTDate,
} from "../../lib/billing";
import { formatPaymentMethodLabel, getISTDateStr } from "../../lib/orderNumber";
import BillDocument, {
  toBillDocumentDataFromDashboard,
} from "../../components/billing/BillDocument";
import QuickBill from "./QuickBill";

const BILL_SELECT_COLUMNS =
  "id, business_id, financial_year, bill_number, bill_no_text, bill_day, status, source, customer_name, customer_phone, table_number, subtotal, discount_amount, discount_note, service_charge_pct, service_charge, tax_mode, tax_total, round_off, total, payment_status, payment_method, paid_at, void_reason, voided_at, notes, share_token, created_at";

const BILL_ITEM_SELECT_COLUMNS =
  "id, bill_id, line_no, item_name, unit_price, quantity, line_total";

type DatePreset = "today" | "yesterday" | "last7" | "custom";

type Props = {
  business: BillingBusinessProfile & { id: string };
  moduleConfigs?: Array<{ module_key: string; config: Record<string, any> | null }>;
  onOpenSettings?: () => void;
};

export default function BillsPage({
  business,
  moduleConfigs,
  onOpenSettings,
}: Props) {
  const billingSettings: BillingSettings = useMemo(() => {
    const row = (moduleConfigs || []).find(
      (m) => String(m.module_key || "").trim().toLowerCase() === "billing"
    );
    return parseBillingSettings(row?.config);
  }, [moduleConfigs]);

  const [view, setView] = useState<"list" | "quick" | "detail">("list");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");

  const todayIST = getISTDateStr();
  const [customFrom, setCustomFrom] = useState(todayIST);
  const [customTo, setCustomTo] = useState(todayIST);
  const [searchQuery, setSearchQuery] = useState("");

  const [bills, setBills] = useState<TapxBill[]>([]);
  const [summary, setSummary] = useState<TapxBillSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [selectedBill, setSelectedBill] = useState<TapxBill | null>(null);
  const [selectedItems, setSelectedItems] = useState<TapxBillItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const activeRange = useMemo(() => {
    const nowToday = getISTDateStr();
    if (datePreset === "today") {
      return { from: nowToday, to: nowToday, error: "" };
    }
    if (datePreset === "yesterday") {
      const y = shiftISTDate(nowToday, -1);
      return { from: y, to: y, error: "" };
    }
    if (datePreset === "last7") {
      return { from: shiftISTDate(nowToday, -6), to: nowToday, error: "" };
    }
    if (!customFrom || !customTo) {
      return { from: nowToday, to: nowToday, error: "Select both From and To dates." };
    }
    if (customFrom > customTo) {
      return { from: customFrom, to: customTo, error: "From date must be on or before To date." };
    }
    const span = daysBetweenIST(customFrom, customTo) + 1;
    if (span > 366) {
      return { from: customFrom, to: customTo, error: "Custom date range cannot exceed 366 days." };
    }
    return { from: customFrom, to: customTo, error: "" };
  }, [datePreset, customFrom, customTo]);

  const loadBillsAndSummary = useCallback(async () => {
    if (!business?.id) return;
    if (activeRange.error) {
      setErrorMsg(activeRange.error);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const pFrom = datePreset === "today" ? null : activeRange.from;
      const pTo = datePreset === "today" ? null : activeRange.to;

      const [summaryRes, billsRes] = await Promise.all([
        supabase.rpc("tapx_bill_summary", {
          p_business_id: business.id,
          p_from: pFrom,
          p_to: pTo,
        }),
        supabase
          .from("tapx_bills")
          .select(BILL_SELECT_COLUMNS)
          .eq("business_id", business.id)
          .gte("bill_day", activeRange.from)
          .lte("bill_day", activeRange.to)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (summaryRes.error) {
        setErrorMsg(summaryRes.error.message || "Failed to load bill summary.");
      } else if (summaryRes.data && typeof summaryRes.data === "object") {
        setSummary(summaryRes.data as TapxBillSummary);
      }

      if (billsRes.error) {
        setErrorMsg(billsRes.error.message || "Failed to load bills.");
        setBills([]);
      } else {
        setBills((billsRes.data || []) as TapxBill[]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load bills.");
    } finally {
      setLoading(false);
    }
  }, [business?.id, datePreset, activeRange]);

  useEffect(() => {
    void loadBillsAndSummary();
  }, [loadBillsAndSummary]);

  const openBillById = useCallback(
    async (billId: string) => {
      if (!business?.id || !billId) return;
      setLoadingDetail(true);
      setErrorMsg("");
      try {
        const [billRes, itemsRes] = await Promise.all([
          supabase
            .from("tapx_bills")
            .select(BILL_SELECT_COLUMNS)
            .eq("id", billId)
            .eq("business_id", business.id)
            .maybeSingle(),
          supabase
            .from("tapx_bill_items")
            .select(BILL_ITEM_SELECT_COLUMNS)
            .eq("bill_id", billId)
            .order("line_no", { ascending: true }),
        ]);

        if (billRes.error) {
          setErrorMsg(billRes.error.message || "Could not load bill.");
          return;
        }
        if (!billRes.data) {
          setErrorMsg("Bill not found.");
          return;
        }
        if (itemsRes.error) {
          setErrorMsg(itemsRes.error.message || "Could not load bill items.");
          return;
        }

        setSelectedBill(billRes.data as TapxBill);
        setSelectedItems((itemsRes.data || []) as TapxBillItem[]);
        setView("detail");
      } catch (err: any) {
        setErrorMsg(err?.message || "Could not load bill.");
      } finally {
        setLoadingDetail(false);
      }
    },
    [business?.id]
  );

  const handleBillIssued = async (newBillId: string) => {
    await Promise.all([openBillById(newBillId), loadBillsAndSummary()]);
  };

  const handleMarkPaid = async (method: PaymentMethod) => {
    if (!selectedBill) return;
    const { error: rpcErr } = await supabase.rpc("set_tapx_bill_payment", {
      p_bill_id: selectedBill.id,
      p_payment_status: "paid",
      p_method: method,
    });
    if (rpcErr) throw new Error(rpcErr.message || "Could not update payment status.");
    await Promise.all([openBillById(selectedBill.id), loadBillsAndSummary()]);
  };

  const handleMarkUnpaid = async () => {
    if (!selectedBill) return;
    const { error: rpcErr } = await supabase.rpc("set_tapx_bill_payment", {
      p_bill_id: selectedBill.id,
      p_payment_status: "unpaid",
      p_method: null,
    });
    if (rpcErr) throw new Error(rpcErr.message || "Could not mark bill unpaid.");
    await Promise.all([openBillById(selectedBill.id), loadBillsAndSummary()]);
  };

  const handleVoidBill = async (reason: string) => {
    if (!selectedBill) return;
    const { error: rpcErr } = await supabase.rpc("void_tapx_bill", {
      p_bill_id: selectedBill.id,
      p_reason: reason,
    });
    if (rpcErr) throw new Error(rpcErr.message || "Could not void bill.");
    await Promise.all([openBillById(selectedBill.id), loadBillsAndSummary()]);
  };

  const filteredBills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter((b) => {
      const no = (b.bill_no_text || "").toLowerCase();
      const cust = (b.customer_name || "").toLowerCase();
      const tbl = b.table_number != null ? `table ${b.table_number}` : "";
      return no.includes(q) || cust.includes(q) || tbl.includes(q);
    });
  }, [bills, searchQuery]);

  const showDayOnRow = activeRange.from !== activeRange.to || datePreset !== "today";

  if (view === "quick") {
    return (
      <QuickBill
        businessId={business.id}
        billingSettings={billingSettings}
        moduleConfigs={moduleConfigs}
        onCancel={() => setView("list")}
        onIssued={handleBillIssued}
      />
    );
  }

  if (view === "detail" && selectedBill) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {loadingDetail && (
          <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>
            Refreshing bill...
          </div>
        )}
        <BillDocument
          mode="dashboard"
          data={toBillDocumentDataFromDashboard(
            selectedBill,
            selectedItems,
            business,
            billingSettings
          )}
          onBack={() => {
            setSelectedBill(null);
            setSelectedItems([]);
            setView("list");
          }}
          onMarkPaid={handleMarkPaid}
          onMarkUnpaid={handleMarkUnpaid}
          onVoid={handleVoidBill}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "#64748b" }}>
            COUNTER &amp; RECEIPT BILLING
          </div>
          <h2 style={{ margin: "2px 0 0", fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>
            Bills
          </h2>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              style={btnSecondaryStyle}
            >
              ⚙ Billing settings
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadBillsAndSummary()}
            style={btnSecondaryStyle}
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setView("quick")}
            style={btnPrimaryStyle}
          >
            + New bill
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* SUMMARY STRIP */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "12px",
        }}
      >
        <div style={statCardStyle}>
          <div style={statLabelStyle}>BILLED (ISSUED)</div>
          <div style={statValueStyle}>{formatMoney(summary?.billed_total ?? 0)}</div>
          <div style={statSubStyle}>
            {summary?.billed_count ?? 0} {(summary?.billed_count ?? 0) === 1 ? "bill" : "bills"}
            {(summary?.discount_total ?? 0) > 0
              ? ` · Discounts ${formatMoney(summary?.discount_total)}`
              : ""}
          </div>
        </div>

        <div style={{ ...statCardStyle, borderColor: "#bbf7d0", background: "#f0fdf4" }}>
          <div style={{ ...statLabelStyle, color: "#15803d" }}>PAID</div>
          <div style={{ ...statValueStyle, color: "#14532d" }}>
            {formatMoney(summary?.paid_total ?? 0)}
          </div>
          <div style={{ ...statSubStyle, color: "#166534" }}>
            {summary?.paid_count ?? 0} {(summary?.paid_count ?? 0) === 1 ? "bill" : "bills"}
            {" · "}Cash {formatMoney(summary?.cash_total ?? 0)} · UPI{" "}
            {formatMoney(summary?.upi_total ?? 0)} · Card {formatMoney(summary?.card_total ?? 0)}
          </div>
        </div>

        <div style={{ ...statCardStyle, borderColor: "#fde68a", background: "#fffbeb" }}>
          <div style={{ ...statLabelStyle, color: "#b45309" }}>UNPAID</div>
          <div style={{ ...statValueStyle, color: "#92400e" }}>
            {formatMoney(summary?.unpaid_total ?? 0)}
          </div>
          <div style={{ ...statSubStyle, color: "#92400e" }}>
            {summary?.unpaid_count ?? 0} {(summary?.unpaid_count ?? 0) === 1 ? "bill" : "bills"}
          </div>
        </div>

        <div style={{ ...statCardStyle, background: "#f8fafc" }}>
          <div style={{ ...statLabelStyle, color: "#64748b" }}>VOIDED (EXCLUDED)</div>
          <div style={{ ...statValueStyle, color: "#475569" }}>
            {formatMoney(summary?.void_total ?? 0)}
          </div>
          <div style={statSubStyle}>
            {summary?.void_count ?? 0} voided
          </div>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "12px 14px",
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {(
            [
              { key: "today", label: "Today" },
              { key: "yesterday", label: "Yesterday" },
              { key: "last7", label: "Last 7 days" },
              { key: "custom", label: "Custom" },
            ] as Array<{ key: DatePreset; label: string }>
          ).map((p) => {
            const active = datePreset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setDatePreset(p.key)}
                style={{
                  border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
                  background: active ? "#0f172a" : "#ffffff",
                  color: active ? "#ffffff" : "#334155",
                  borderRadius: "9px",
                  padding: "7px 12px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            );
          })}

          {datePreset === "custom" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginLeft: "4px" }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={dateInputStyle}
              />
              <span style={{ fontSize: "12px", color: "#64748b" }}>to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={dateInputStyle}
              />
            </div>
          )}
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search bill no., customer, or table..."
          style={{
            width: "250px",
            maxWidth: "100%",
            padding: "8px 12px",
            borderRadius: "9px",
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            fontSize: "13px",
          }}
        />
      </div>

      {/* BILLS LIST */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        {loading && bills.length === 0 ? (
          <div style={{ padding: "28px", textAlign: "center", color: "#64748b", fontSize: "13.5px" }}>
            Loading bills...
          </div>
        ) : bills.length === 0 ? (
          <div style={{ padding: "38px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
              No bills yet. Create your first bill
            </div>
            <div style={{ marginTop: "6px", fontSize: "12.5px", color: "#64748b" }}>
              Issue fast counter bills with printed thermal/A4 receipts, UPI QR, and shareable links.
            </div>
            <button
              type="button"
              onClick={() => setView("quick")}
              style={{ ...btnPrimaryStyle, marginTop: "14px" }}
            >
              + New bill
            </button>
          </div>
        ) : filteredBills.length === 0 ? (
          <div style={{ padding: "28px", textAlign: "center", color: "#64748b", fontSize: "13.5px" }}>
            No bills match &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          <div>
            {filteredBills.map((bill, index) => {
              const isVoid = bill.status === "void";
              const isPaid = bill.payment_status === "paid";
              const timeText = formatBillTimeShort(bill.created_at);
              const dayText = showDayOnRow ? formatBillDayLabel(bill.bill_day) : "";
              const methodLabel = formatPaymentMethodLabel(bill.payment_method);

              return (
                <button
                  key={bill.id}
                  type="button"
                  disabled={loadingDetail}
                  onClick={() => void openBillById(bill.id)}
                  style={{
                    width: "100%",
                    border: 0,
                    borderTop: index === 0 ? "none" : "1px solid #f1f5f9",
                    background: isVoid ? "#fafafa" : "#ffffff",
                    padding: "13px 16px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: "180px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "14px", color: isVoid ? "#64748b" : "#0f172a" }}>
                        {bill.bill_no_text}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        {dayText ? `${dayText} · ${timeText}` : timeText}
                      </span>
                      {bill.table_number != null && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "99px",
                            background: "#f1f5f9",
                            color: "#334155",
                          }}
                        >
                          Table {bill.table_number}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#475569" }}>
                      {bill.customer_name?.trim() || "—"}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {isVoid ? (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "3px 9px",
                          borderRadius: "99px",
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                        }}
                      >
                        VOID
                      </span>
                    ) : isPaid ? (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "3px 9px",
                          borderRadius: "99px",
                          background: "#f0fdf4",
                          color: "#15803d",
                          border: "1px solid #bbf7d0",
                        }}
                      >
                        {methodLabel ? `Paid · ${methodLabel}` : "Paid"}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "3px 9px",
                          borderRadius: "99px",
                          background: "#fffbeb",
                          color: "#b45309",
                          border: "1px solid #fde68a",
                        }}
                      >
                        Unpaid
                      </span>
                    )}

                    <strong
                      style={{
                        fontSize: "15px",
                        color: isVoid ? "#94a3b8" : "#0f172a",
                        textDecoration: isVoid ? "line-through" : "none",
                        minWidth: "74px",
                        textAlign: "right",
                      }}
                    >
                      {formatMoney(bill.total)}
                    </strong>
                  </div>
                </button>
              );
            })}

            {bills.length >= 200 && (
              <div
                style={{
                  padding: "10px 14px",
                  borderTop: "1px solid #f1f5f9",
                  background: "#f8fafc",
                  color: "#64748b",
                  fontSize: "12px",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                Showing latest 200 bills for the selected dates. Narrow the date range to see older bills.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const statCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "14px 16px",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "10.5px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: "#64748b",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 800,
  color: "#0f172a",
  marginTop: "4px",
};

const statSubStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
  marginTop: "4px",
  fontWeight: 600,
};

const dateInputStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  fontSize: "12.5px",
  color: "#0f172a",
};

const btnPrimaryStyle: React.CSSProperties = {
  border: 0,
  background: "#0f172a",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "9px 15px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondaryStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#1e293b",
  borderRadius: "10px",
  padding: "9px 13px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};
