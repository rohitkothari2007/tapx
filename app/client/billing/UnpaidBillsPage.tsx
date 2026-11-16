"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  BillingBusinessProfile,
  formatBillDateTime,
  formatMoney,
} from "../../lib/billing";
import {
  UNPAID_BILL_COLUMNS,
  UnpaidBillRow,
  UnpaidGroup,
  buildDuesReminderMessage,
  daysSince,
  formatDueAge,
  groupUnpaidBills,
} from "../../lib/unpaidBills";

export type UnpaidBillsPageProps = {
  business: BillingBusinessProfile & { id: string };
  onOpenBill: (billId: string) => void;
  onBillsChanged?: () => void | Promise<void>;
};

function getDueAgeStyle(days: number) {
  if (days < 7) {
    return { color: "#64748b", background: "#f1f5f9" };
  }
  if (days <= 14) {
    return { color: "#92400e", background: "#fef3c7" };
  }
  return { color: "#b91c1c", background: "#fee2e2" };
}

export default function UnpaidBillsPage({
  business,
  onOpenBill,
  onBillsChanged,
}: UnpaidBillsPageProps) {
  const [rows, setRows] = useState<UnpaidBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [isTruncated500, setIsTruncated500] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  // Mark paid inline panel state
  const [markingPaidBillId, setMarkingPaidBillId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "upi" | "card" | null>(null);
  const [markingPaidSaving, setMarkingPaidSaving] = useState(false);
  const [markPaidError, setMarkPaidError] = useState<{ billId: string; message: string } | null>(null);

  const reqCountRef = useRef(0);

  const fetchUnpaidBills = useCallback(
    async (silent = false) => {
      if (!business?.id) return;
      const reqId = ++reqCountRef.current;
      if (!silent) {
        setLoading(true);
      }
      setErrorMsg("");

      try {
        const { data, error } = await supabase
          .from("tapx_bills")
          .select(UNPAID_BILL_COLUMNS)
          .eq("business_id", business.id)
          .eq("payment_status", "unpaid")
          .eq("status", "issued")
          .gt("total", 0)
          .order("created_at", { ascending: true })
          .limit(500);

        if (reqId !== reqCountRef.current) return;
        if (error) throw error;

        const loadedRows = (data as UnpaidBillRow[]) || [];
        setRows(loadedRows);
        setIsTruncated500(loadedRows.length === 500);
      } catch (err: any) {
        if (reqId !== reqCountRef.current) return;
        if (!silent) {
          setErrorMsg(err?.message || "Failed to load unpaid bills.");
        }
      } finally {
        if (reqId === reqCountRef.current && !silent) {
          setLoading(false);
        }
      }
    },
    [business?.id]
  );

  useEffect(() => {
    void fetchUnpaidBills(false);
  }, [business.id]);

  const groups = useMemo(() => groupUnpaidBills(rows), [rows]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    const qDigits = q.replace(/\D/g, "");

    return groups.filter((g) => {
      if (g.name.toLowerCase().includes(q)) return true;
      if (g.phone && g.phone.toLowerCase().includes(q)) return true;
      if (qDigits && g.phone && g.phone.replace(/\D/g, "").includes(qDigits)) return true;
      const matchesBill = g.bills.some((b) => b.bill_no_text.toLowerCase().includes(q));
      if (matchesBill) return true;
      return false;
    });
  }, [groups, searchQuery]);

  const totalPending = useMemo(
    () => Math.round((groups.reduce((s, g) => s + g.total, 0) + Number.EPSILON) * 100) / 100,
    [groups]
  );

  const oldestDate = rows[0]?.created_at;
  const oldestAgeText = oldestDate ? formatDueAge(daysSince(oldestDate)) : "-";

  const handleConfirmMarkPaid = async (billId: string) => {
    if (!selectedMethod || markingPaidSaving) return;
    setMarkingPaidSaving(true);
    setMarkPaidError(null);

    try {
      const { error: rpcErr } = await supabase.rpc("set_tapx_bill_payment", {
        p_bill_id: billId,
        p_payment_status: "paid",
        p_method: selectedMethod,
      });

      if (rpcErr) throw new Error(rpcErr.message || "Could not update payment status.");

      setMarkingPaidBillId(null);
      setSelectedMethod(null);
      await Promise.all([
        fetchUnpaidBills(true),
        onBillsChanged ? onBillsChanged() : Promise.resolve(),
      ]);
    } catch (err: any) {
      setMarkPaidError({ billId, message: err?.message || "Failed to mark bill as paid." });
    } finally {
      setMarkingPaidSaving(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "960px",
        margin: "0 auto",
        padding: "16px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <style jsx>{`
        .unpaid-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          width: 100%;
        }
        @media (min-width: 640px) {
          .unpaid-summary-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
        }
      `}</style>

      {/* TOP HEADER */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "#0f172a",
            margin: 0,
            lineHeight: 1.25,
          }}
        >
          Unpaid Bills
        </h1>
        <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
          Track pending payments, send WhatsApp reminders, and mark bills as received.
        </p>
      </div>

      {/* TOP SUMMARY (4 TILES) */}
      <div className="unpaid-summary-grid">
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "14px 16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Total pending
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
            {formatMoney(totalPending)}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "14px 16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Customers
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
            {groups.length}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "14px 16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Bills
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
            {rows.length}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "14px 16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Oldest
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
            {oldestAgeText}
          </div>
        </div>
      </div>

      {/* SEARCH BOX */}
      <div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Name, phone or bill no."
          style={{
            width: "100%",
            boxSizing: "border-box",
            minHeight: "44px",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            fontSize: "14px",
            outline: "none",
            background: "#ffffff",
          }}
        />
      </div>

      {/* 500 ROWS NOTICE */}
      {isTruncated500 && (
        <div style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic" }}>
          Showing the oldest 500 unpaid bills.
        </div>
      )}

      {/* ERROR STATE */}
      {errorMsg && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "10px",
            padding: "14px",
            color: "#991b1b",
            fontSize: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxSizing: "border-box",
          }}
        >
          <div>{errorMsg}</div>
          <button
            type="button"
            onClick={() => void fetchUnpaidBills(false)}
            style={{
              alignSelf: "flex-start",
              background: "#dc2626",
              color: "#ffffff",
              border: 0,
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              minHeight: "44px",
              boxSizing: "border-box",
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "48px 16px",
            textAlign: "center",
            color: "#64748b",
            fontSize: "15px",
            boxSizing: "border-box",
          }}
        >
          Loading unpaid bills...
        </div>
      )}

      {/* EMPTY: NO UNPAID BILLS AT ALL */}
      {!loading && !errorMsg && groups.length === 0 && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "48px 16px",
            textAlign: "center",
            color: "#64748b",
            fontSize: "15px",
            boxSizing: "border-box",
          }}
        >
          No unpaid bills. Everyone has paid.
        </div>
      )}

      {/* EMPTY: SEARCH FILTER MISMATCH */}
      {!loading && !errorMsg && groups.length > 0 && filteredGroups.length === 0 && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "40px 16px",
            textAlign: "center",
            color: "#64748b",
            fontSize: "14px",
            boxSizing: "border-box",
          }}
        >
          No match.
        </div>
      )}

      {/* CUSTOMER GROUPS LIST */}
      {!loading && !errorMsg && filteredGroups.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredGroups.map((group) => {
            const isExpanded = expandedGroupKey === group.key;
            const days = daysSince(group.oldestCreatedAt);
            const ageStyle = getDueAgeStyle(days);

            return (
              <div
                key={group.key}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "16px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Header row (tap to expand/collapse) */}
                <div
                  onClick={() => setExpandedGroupKey(isExpanded ? null : group.key)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    cursor: "pointer",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#0f172a",
                        wordBreak: "break-word",
                        lineHeight: 1.3,
                      }}
                    >
                      {group.name}
                    </div>
                    {group.phone && (
                      <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                        {group.phone}
                      </div>
                    )}
                    {group.bills.length > 1 && (
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        {group.bills.length} bills
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "6px",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                      {formatMoney(group.total)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          color: ageStyle.color,
                          background: ageStyle.background,
                        }}
                      >
                        {formatDueAge(days)}
                      </span>
                      <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* EXPANDED SECTION */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: "1px dashed #e2e8f0",
                      paddingTop: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {/* Bills list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {group.bills.map((bill) => (
                        <div
                          key={bill.id}
                          style={{
                            borderTop: "1px solid #f1f5f9",
                            paddingTop: "10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <div style={{ minWidth: "120px", flex: "1 1 auto" }}>
                              <div style={{ fontWeight: 600, fontSize: "14px", color: "#0f172a" }}>
                                {bill.bill_no_text}
                              </div>
                              <div style={{ fontSize: "12px", color: "#64748b" }}>
                                {formatBillDateTime(bill.created_at)}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                                {formatMoney(bill.total)}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <button
                                  type="button"
                                  onClick={() => onOpenBill(bill.id)}
                                  style={{
                                    minHeight: "44px",
                                    padding: "8px 14px",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    background: "#f8fafc",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    color: "#334155",
                                    cursor: "pointer",
                                    boxSizing: "border-box",
                                  }}
                                >
                                  Open
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (markingPaidBillId === bill.id) {
                                      setMarkingPaidBillId(null);
                                      setSelectedMethod(null);
                                      setMarkPaidError(null);
                                    } else {
                                      setMarkingPaidBillId(bill.id);
                                      setSelectedMethod(null);
                                      setMarkPaidError(null);
                                    }
                                  }}
                                  style={{
                                    minHeight: "44px",
                                    padding: "8px 14px",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    background: "#2563eb",
                                    border: "1px solid #2563eb",
                                    borderRadius: "6px",
                                    color: "#ffffff",
                                    cursor: "pointer",
                                    boxSizing: "border-box",
                                  }}
                                >
                                  Mark paid
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Inline mark paid panel */}
                          {markingPaidBillId === bill.id && (
                            <div
                              style={{
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: "8px",
                                padding: "12px",
                                marginTop: "4px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                boxSizing: "border-box",
                              }}
                            >
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                                Received by
                              </div>

                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {(["cash", "upi", "card"] as const).map((method) => {
                                  const isSelected = selectedMethod === method;
                                  const label =
                                    method === "cash" ? "Cash" : method === "upi" ? "UPI" : "Card";
                                  return (
                                    <button
                                      key={method}
                                      type="button"
                                      disabled={markingPaidSaving}
                                      onClick={() => setSelectedMethod(method)}
                                      style={{
                                        flex: "1 1 70px",
                                        minHeight: "44px",
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: isSelected
                                          ? "2px solid #0f172a"
                                          : "1px solid #cbd5e1",
                                        background: isSelected ? "#0f172a" : "#ffffff",
                                        color: isSelected ? "#ffffff" : "#334155",
                                        fontWeight: 600,
                                        fontSize: "13px",
                                        cursor: markingPaidSaving ? "not-allowed" : "pointer",
                                        boxSizing: "border-box",
                                      }}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  justifyContent: "flex-end",
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={markingPaidSaving}
                                  onClick={() => {
                                    setMarkingPaidBillId(null);
                                    setSelectedMethod(null);
                                    setMarkPaidError(null);
                                  }}
                                  style={{
                                    minHeight: "44px",
                                    padding: "8px 14px",
                                    borderRadius: "6px",
                                    border: "1px solid #cbd5e1",
                                    background: "#ffffff",
                                    color: "#64748b",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    cursor: markingPaidSaving ? "not-allowed" : "pointer",
                                    boxSizing: "border-box",
                                  }}
                                >
                                  Cancel
                                </button>

                                <button
                                  type="button"
                                  disabled={!selectedMethod || markingPaidSaving}
                                  onClick={() => void handleConfirmMarkPaid(bill.id)}
                                  style={{
                                    minHeight: "44px",
                                    padding: "8px 16px",
                                    borderRadius: "6px",
                                    border: 0,
                                    background:
                                      !selectedMethod || markingPaidSaving ? "#94a3b8" : "#16a34a",
                                    color: "#ffffff",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    cursor:
                                      !selectedMethod || markingPaidSaving
                                        ? "not-allowed"
                                        : "pointer",
                                    boxSizing: "border-box",
                                  }}
                                >
                                  {markingPaidSaving ? "Saving..." : "Confirm"}
                                </button>
                              </div>

                              {markPaidError && markPaidError.billId === bill.id && (
                                <div
                                  style={{
                                    color: "#dc2626",
                                    fontSize: "13px",
                                    marginTop: "2px",
                                  }}
                                >
                                  {markPaidError.message}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* WhatsApp reminder button / no valid phone text */}
                    <div
                      style={{
                        marginTop: "4px",
                        borderTop: "1px dashed #e2e8f0",
                        paddingTop: "12px",
                      }}
                    >
                      {group.waPhone ? (
                        <a
                          href={`https://wa.me/${group.waPhone}?text=${encodeURIComponent(
                            buildDuesReminderMessage({
                              customerName: group.contactName,
                              businessName: business.name,
                              bills: group.bills,
                              origin: typeof window !== "undefined" ? window.location.origin : "",
                              upiId: business.upi_id,
                            })
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "44px",
                            padding: "10px 16px",
                            background: "#16a34a",
                            color: "#ffffff",
                            borderRadius: "8px",
                            fontWeight: 600,
                            fontSize: "14px",
                            textDecoration: "none",
                            boxSizing: "border-box",
                            width: "100%",
                            maxWidth: "280px",
                          }}
                        >
                          💬 Remind on WhatsApp
                        </a>
                      ) : (
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#64748b",
                            fontStyle: "italic",
                            padding: "8px 0",
                          }}
                        >
                          No valid phone number, so no reminder.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
