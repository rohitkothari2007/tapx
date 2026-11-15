"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  BillingBusinessProfile,
  BillingSettings,
  ExchangeSearchBill,
  ReturnableBill,
  ReturnableBillLine,
  formatBillDateTime,
  formatMoney,
} from "../../lib/billing";
import CreditNoteSlip from "./CreditNoteSlip";

interface ExchangeFlowProps {
  businessId: string;
  businessProfile: BillingBusinessProfile | null;
  billingSettings: BillingSettings;
  initialBillId?: string | null;
  onClose: () => void;
  onStartExchange: (exchangeData: {
    billId: string;
    billNo: string;
    returnLines: { bill_item_id: string; quantity: number; restock: boolean }[];
    creditValue: number;
    customerName: string | null;
    customerPhone: string | null;
    creditNoteAllowed: boolean;
    reason: string;
  }) => void;
}

const REASON_OPTIONS = [
  "Wrong size or fit",
  "Did not like it",
  "Damaged or defective",
  "Other",
] as const;

export default function ExchangeFlow({
  businessId,
  businessProfile,
  billingSettings,
  initialBillId,
  onClose,
  onStartExchange,
}: ExchangeFlowProps) {
  // Navigation step: 0 = find bill, 1 = pick items & reason, 2 = pick action (exchange vs credit note)
  const [step, setStep] = useState<0 | 1 | 2>(initialBillId ? 1 : 0);
  const [activeBillId, setActiveBillId] = useState<string | null>(initialBillId || null);

  // Step 0: Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<ExchangeSearchBill[]>([]);
  const searchReqIdRef = useRef(0);

  // Step 1: Returnable bill data
  const [loadingReturnable, setLoadingReturnable] = useState(false);
  const [returnableError, setReturnableError] = useState("");
  const [returnableBill, setReturnableBill] = useState<ReturnableBill | null>(null);

  // Line selections: map bill_item_id -> { qty: number, restock: boolean }
  const [returnSelections, setReturnSelections] = useState<
    Record<string, { qty: number; restock: boolean }>
  >({});
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [otherReasonNote, setOtherReasonNote] = useState("");

  // Step 2: Credit note creation state
  const [cnCustomerName, setCnCustomerName] = useState("");
  const [cnCustomerPhone, setCnCustomerPhone] = useState("");
  const [creatingCn, setCreatingCn] = useState(false);
  const [cnError, setCnError] = useState("");
  const [createdCn, setCreatedCn] = useState<{
    id: string;
    note_no_text: string;
    amount: number;
    expires_on?: string | null;
  } | null>(null);
  const [viewingSlipId, setViewingSlipId] = useState<string | null>(null);

  // Detect touch device for autofocus
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouch(Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches));
    }
  }, []);

  // --- Step 0: Bill Search ---
  const runSearch = useCallback(
    async (q: string) => {
      if (!businessId) return;
      const curReqId = ++searchReqIdRef.current;
      setSearching(true);
      setSearchError("");
      try {
        const cleanQ = q.trim();
        const { data, error } = await supabase.rpc("find_tapx_bills_for_exchange", {
          p_business_id: businessId,
          p_query: cleanQ.length > 0 ? cleanQ : null,
        });

        if (curReqId !== searchReqIdRef.current) return;
        if (error) {
          setSearchError(error.message || "Failed to search bills.");
          setSearchResults([]);
        } else {
          setSearchResults((data || []) as ExchangeSearchBill[]);
        }
      } catch (err: any) {
        if (curReqId === searchReqIdRef.current) {
          setSearchError(err?.message || "Failed to search bills.");
          setSearchResults([]);
        }
      } finally {
        if (curReqId === searchReqIdRef.current) {
          setSearching(false);
        }
      }
    },
    [businessId]
  );

  // Debounce search
  useEffect(() => {
    if (step !== 0) return;
    const t = setTimeout(() => {
      void runSearch(searchQuery);
    }, 300);
    return () => clearTimeout(t);
  }, [step, searchQuery, runSearch]);

  // Initial search on step 0
  useEffect(() => {
    if (step === 0 && searchResults.length === 0 && !searching && !searchError) {
      void runSearch("");
    }
  }, [step, runSearch, searchResults.length, searching, searchError]);

  // --- Step 1: Fetch Returnable Bill ---
  const loadReturnable = useCallback(async (billId: string) => {
    setLoadingReturnable(true);
    setReturnableError("");
    try {
      const { data, error } = await supabase.rpc("get_tapx_bill_returnable", {
        p_bill_id: billId,
      });

      if (error) {
        setReturnableError(error.message || "Failed to check bill return eligibility.");
        setReturnableBill(null);
      } else {
        const res = data as ReturnableBill;
        setReturnableBill(res);
        setCnCustomerName(res.customer_name || "");
        setCnCustomerPhone(res.customer_phone || "");
        // Reset selections
        const initSel: Record<string, { qty: number; restock: boolean }> = {};
        for (const line of res.lines || []) {
          initSel[line.bill_item_id] = { qty: 0, restock: true };
        }
        setReturnSelections(initSel);
      }
    } catch (err: any) {
      setReturnableError(err?.message || "Failed to load bill details.");
      setReturnableBill(null);
    } finally {
      setLoadingReturnable(false);
    }
  }, []);

  useEffect(() => {
    if (activeBillId && step >= 1) {
      void loadReturnable(activeBillId);
    }
  }, [activeBillId, step, loadReturnable]);

  // Handle bill selection from search
  const handleSelectBill = (b: ExchangeSearchBill) => {
    setActiveBillId(b.id);
    setStep(1);
  };

  // Stepper quantity update
  const handleQtyChange = (line: ReturnableBillLine, newQty: number) => {
    const clamped = Math.max(0, Math.min(line.remaining_qty, Number(newQty.toFixed(3))));
    setReturnSelections((prev) => ({
      ...prev,
      [line.bill_item_id]: {
        qty: clamped,
        restock: prev[line.bill_item_id]?.restock ?? true,
      },
    }));
  };

  const handleRestockChange = (billItemId: string, restock: boolean) => {
    setReturnSelections((prev) => ({
      ...prev,
      [billItemId]: {
        qty: prev[billItemId]?.qty ?? 0,
        restock,
      },
    }));
  };

  // Calculate total return credit and lines
  const { totalReturnCredit, selectedLinesPayload, totalReturnCount } = useMemo(() => {
    if (!returnableBill?.lines) {
      return { totalReturnCredit: 0, selectedLinesPayload: [], totalReturnCount: 0 };
    }
    let sum = 0;
    let count = 0;
    const payload: { bill_item_id: string; quantity: number; restock: boolean }[] = [];

    for (const line of returnableBill.lines) {
      const sel = returnSelections[line.bill_item_id];
      const q = sel?.qty || 0;
      if (q > 0) {
        sum += q * (line.credit_per_unit || 0);
        count += q;
        payload.push({
          bill_item_id: line.bill_item_id,
          quantity: q,
          restock: sel?.restock ?? true,
        });
      }
    }
    return {
      totalReturnCredit: Math.round(sum * 100) / 100,
      selectedLinesPayload: payload,
      totalReturnCount: count,
    };
  }, [returnableBill, returnSelections]);

  const finalReason = useMemo(() => {
    if (!selectedReason) return "";
    if (selectedReason === "Other") {
      const trimmed = otherReasonNote.trim().slice(0, 150);
      return trimmed ? `Other: ${trimmed}` : "Other";
    }
    return selectedReason;
  }, [selectedReason, otherReasonNote]);

  const canContinueToStep2 = totalReturnCount > 0 && totalReturnCredit > 0 && Boolean(selectedReason);

  // --- Step 2 Actions ---
  const handleStartExchangeMode = () => {
    if (!returnableBill) return;
    onStartExchange({
      billId: returnableBill.bill_id,
      billNo: returnableBill.bill_no_text,
      returnLines: selectedLinesPayload,
      creditValue: totalReturnCredit,
      customerName: returnableBill.customer_name,
      customerPhone: returnableBill.customer_phone,
      creditNoteAllowed: Boolean(returnableBill.settings?.credit_note),
      reason: finalReason,
    });
  };

  const handleCreateCreditNote = async () => {
    if (!returnableBill || creatingCn) return;
    setCreatingCn(true);
    setCnError("");
    try {
      const { data, error } = await supabase.rpc("create_tapx_credit_note", {
        p_business_id: businessId,
        p_original_bill_id: returnableBill.bill_id,
        p_lines: selectedLinesPayload,
        p_customer_name: cnCustomerName.trim() || null,
        p_customer_phone: cnCustomerPhone.trim() || null,
        p_reason: finalReason || null,
      });

      if (error) {
        setCnError(error.message || "Failed to create credit note.");
        return;
      }

      const res = data as {
        id: string;
        note_no_text: string;
        amount: number;
        expires_on?: string | null;
      };
      setCreatedCn(res);
    } catch (err: any) {
      setCnError(err?.message || "Failed to create credit note.");
    } finally {
      setCreatingCn(false);
    }
  };

  if (viewingSlipId) {
    return (
      <CreditNoteSlip
        creditNoteId={viewingSlipId}
        business={businessProfile}
        paper={billingSettings.paper}
        originalBillNo={returnableBill?.bill_no_text}
        onClose={() => setViewingSlipId(null)}
      />
    );
  }

  return (
    <div
      className="exchange-flow-root"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        paddingBottom: "100px",
      }}
    >
      <style>{`
        .exchange-input {
          font-size: 16px !important;
        }
        .exchange-btn {
          min-height: 44px !important;
        }
      `}</style>

      {/* Top Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "12px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className="exchange-btn"
            onClick={() => {
              if (createdCn) {
                onClose();
              } else if (step === 2) {
                setStep(1);
              } else if (step === 1 && !initialBillId) {
                setStep(0);
                setActiveBillId(null);
                setReturnableBill(null);
              } else {
                onClose();
              }
            }}
            style={btnBackStyle}
          >
            ← Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
              {step === 0
                ? "Find bill for exchange"
                : step === 1
                ? "What is coming back?"
                : "Choose resolution"}
            </h2>
            {returnableBill && (
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Bill {returnableBill.bill_no_text}
              </span>
            )}
          </div>
        </div>

        {step > 0 && !createdCn && (
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "99px",
              background: "#f1f5f9",
              color: "#475569",
            }}
          >
            Step {step} of 2
          </span>
        )}
      </div>

      {/* STEP 0: Find Bill */}
      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={cardStyle}>
            <label style={labelStyle}>Search Bill</label>
            <input
              type="search"
              className="exchange-input"
              autoFocus={!isTouch}
              placeholder="Bill number, phone or name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={inputFieldStyle}
            />
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
              Only paid bills within the exchange window can be exchanged.
            </div>
          </div>

          {searching && (
            <div style={{ padding: "24px", textAlign: "center", color: "#64748b", fontSize: "14px", fontWeight: 600 }}>
              Searching eligible bills...
            </div>
          )}

          {searchError && (
            <div style={errorBoxStyle}>
              <div>{searchError}</div>
              <button
                type="button"
                className="exchange-btn"
                onClick={() => void runSearch(searchQuery)}
                style={btnRetryStyle}
              >
                Retry
              </button>
            </div>
          )}

          {!searching && !searchError && searchResults.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
              No bills found that can still be exchanged.
            </div>
          )}

          {!searching && !searchError && searchResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {searchResults.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="exchange-btn"
                  onClick={() => handleSelectBill(b)}
                  style={{
                    ...billCardBtnStyle,
                    minHeight: "56px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "14.5px", color: "#0f172a" }}>
                        {b.bill_no_text}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>{b.bill_day}</span>
                      {b.days_left !== null && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "99px",
                            background: b.days_left === 0 ? "#fef2f2" : "#f1f5f9",
                            color: b.days_left === 0 ? "#b91c1c" : "#334155",
                          }}
                        >
                          {b.days_left === 0 ? "Last day" : `${b.days_left} days left`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#475569" }}>
                      {[b.customer_name, b.customer_phone].filter(Boolean).join(" · ") || "Walk-in customer"}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14.5px", fontWeight: 800, color: "#0f172a" }}>
                      {formatMoney(b.total)}
                    </div>
                    <div style={{ fontSize: "11px", color: "#2563eb", fontWeight: 700 }}>
                      Select bill →
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 1: What is coming back? */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {loadingReturnable && (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748b", fontSize: "14px", fontWeight: 600 }}>
              Checking bill return eligibility...
            </div>
          )}

          {returnableError && (
            <div style={errorBoxStyle}>
              <div>{returnableError}</div>
              <button
                type="button"
                className="exchange-btn"
                onClick={() => activeBillId && void loadReturnable(activeBillId)}
                style={btnRetryStyle}
              >
                Retry
              </button>
            </div>
          )}

          {!loadingReturnable && !returnableError && returnableBill && !returnableBill.eligible && (
            <div style={cardStyle}>
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                <strong>Not eligible for exchange</strong>
                <div style={{ marginTop: "4px" }}>
                  {returnableBill.reason || "This bill is no longer eligible for exchange."}
                </div>
              </div>
              <div style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="exchange-btn"
                  onClick={() => {
                    if (initialBillId) onClose();
                    else setStep(0);
                  }}
                  style={btnSecondaryFullStyle}
                >
                  ← Back to bills
                </button>
              </div>
            </div>
          )}

          {!loadingReturnable && !returnableError && returnableBill && returnableBill.eligible && (
            <>
              {/* Bill summary info */}
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                      Bill {returnableBill.bill_no_text}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#475569", marginTop: "2px" }}>
                      {[returnableBill.customer_name, returnableBill.customer_phone].filter(Boolean).join(" · ") ||
                        "Walk-in customer"}
                    </div>
                  </div>

                  {returnableBill.days_left !== null && (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: "99px",
                        background: returnableBill.days_left === 0 ? "#fef2f2" : "#eff6ff",
                        color: returnableBill.days_left === 0 ? "#b91c1c" : "#1d4ed8",
                      }}
                    >
                      {returnableBill.days_left === 0
                        ? "Last day for exchange"
                        : `${returnableBill.days_left} days left for exchange`}
                    </span>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div style={cardStyle}>
                <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  Select items to return
                </h3>

                {returnableBill.lines.filter((l) => l.remaining_qty > 0).length === 0 ? (
                  <div style={{ padding: "16px 0", color: "#64748b", fontSize: "13.5px" }}>
                    All items from this bill have already been returned or exchanged.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {returnableBill.lines
                      .filter((l) => l.remaining_qty > 0)
                      .map((line) => {
                        const sel = returnSelections[line.bill_item_id] || { qty: 0, restock: true };
                        const isDec = !Number.isInteger(line.quantity);
                        const stepVal = isDec ? 0.25 : 1;
                        const lineCredit = Math.round(sel.qty * line.credit_per_unit * 100) / 100;

                        return (
                          <div
                            key={line.bill_item_id}
                            style={{
                              padding: "12px",
                              borderRadius: "12px",
                              background: sel.qty > 0 ? "#f0fdf4" : "#f8fafc",
                              border: sel.qty > 0 ? "1px solid #86efac" : "1px solid #e2e8f0",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: "#0f172a",
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {line.item_name}
                                </div>
                                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                                  Bought {line.quantity}
                                  {line.returned_qty > 0 && ` · Already returned ${line.returned_qty}`}
                                  {` · Credit/unit ${formatMoney(line.credit_per_unit)}`}
                                </div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: sel.qty > 0 ? "#15803d" : "#64748b" }}>
                                  {formatMoney(lineCredit)}
                                </div>
                              </div>
                            </div>

                            {/* Stepper */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                flexWrap: "wrap",
                                paddingTop: "4px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="exchange-btn"
                                  disabled={sel.qty <= 0}
                                  onClick={() => handleQtyChange(line, sel.qty - stepVal)}
                                  style={stepperBtnStyle}
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  className="exchange-input"
                                  min={0}
                                  max={line.remaining_qty}
                                  step={stepVal}
                                  value={sel.qty || ""}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                    if (!isNaN(val)) handleQtyChange(line, val);
                                  }}
                                  style={stepperInputStyle}
                                />
                                <button
                                  type="button"
                                  className="exchange-btn"
                                  disabled={sel.qty >= line.remaining_qty}
                                  onClick={() => handleQtyChange(line, sel.qty + stepVal)}
                                  style={stepperBtnStyle}
                                >
                                  +
                                </button>
                                <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "4px" }}>
                                  max {line.remaining_qty}
                                </span>
                              </div>

                              {sel.qty > 0 && (
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "12.5px",
                                    color: "#334155",
                                    cursor: "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={sel.restock}
                                    onChange={(e) => handleRestockChange(line.bill_item_id, e.target.checked)}
                                    style={{ width: "18px", height: "18px", accentColor: "#16a34a" }}
                                  />
                                  <span>Can be sold again</span>
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Reason Picker */}
              <div style={cardStyle}>
                <label style={labelStyle}>Reason for exchange / return (required)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                  {REASON_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="exchange-btn"
                      onClick={() => setSelectedReason(opt)}
                      style={{
                        ...reasonBtnStyle,
                        background: selectedReason === opt ? "#eff6ff" : "#ffffff",
                        borderColor: selectedReason === opt ? "#2563eb" : "#cbd5e1",
                        color: selectedReason === opt ? "#1d4ed8" : "#1e293b",
                        fontWeight: selectedReason === opt ? 700 : 500,
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {selectedReason === "Other" && (
                  <div style={{ marginTop: "10px" }}>
                    <input
                      type="text"
                      className="exchange-input"
                      maxLength={150}
                      placeholder="Enter reason note (optional, max 150 chars)"
                      value={otherReasonNote}
                      onChange={(e) => setOtherReasonNote(e.target.value)}
                      style={inputFieldStyle}
                    />
                  </div>
                )}
              </div>

              {/* Total & Continue Bar */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
                    VALUE OF RETURNED ITEMS
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
                    {formatMoney(totalReturnCredit)}
                  </div>
                </div>

                <button
                  type="button"
                  className="exchange-btn"
                  disabled={!canContinueToStep2}
                  onClick={() => setStep(2)}
                  style={{
                    ...btnPrimaryStyle,
                    opacity: canContinueToStep2 ? 1 : 0.45,
                    cursor: canContinueToStep2 ? "pointer" : "not-allowed",
                  }}
                >
                  Continue →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Choose Resolution (Exchange vs Credit Note) */}
      {step === 2 && !createdCn && returnableBill && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={cardStyle}>
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              Returned items credit from bill <strong>{returnableBill.bill_no_text}</strong>:
            </div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
              {formatMoney(totalReturnCredit)}
            </div>
            <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
              Reason: <strong>{finalReason}</strong>
            </div>
          </div>

          <h3 style={{ margin: "0", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
            What does the customer want?
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Card 1: Exchange */}
            <button
              type="button"
              className="exchange-btn"
              onClick={handleStartExchangeMode}
              style={actionCardBtnStyle}
            >
              <div style={{ fontSize: "24px", lineHeight: 1 }}>🛍️</div>
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                  Exchange for other items
                </div>
                <div style={{ fontSize: "12.5px", color: "#475569", marginTop: "2px" }}>
                  Customer takes replacement items now. Pay only the difference.
                </div>
              </div>
              <div style={{ fontSize: "16px", color: "#2563eb", fontWeight: 700 }}>→</div>
            </button>

            {/* Card 2: Credit Note (if enabled) */}
            {returnableBill.settings?.credit_note && (
              <div
                style={{
                  ...cardStyle,
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ fontSize: "24px", lineHeight: 1 }}>🎫</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                      Keep as credit note
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#475569", marginTop: "2px" }}>
                      Issue a numbered credit note the customer can redeem on their next purchase.
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
                  <div>
                    <label style={labelStyle}>Customer Name (optional)</label>
                    <input
                      type="text"
                      className="exchange-input"
                      placeholder="Customer name"
                      value={cnCustomerName}
                      onChange={(e) => setCnCustomerName(e.target.value)}
                      style={inputFieldStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Mobile Number (optional)</label>
                    <input
                      type="tel"
                      className="exchange-input"
                      placeholder="Mobile number"
                      maxLength={15}
                      value={cnCustomerPhone}
                      onChange={(e) => setCnCustomerPhone(e.target.value)}
                      style={inputFieldStyle}
                    />
                  </div>
                </div>

                {cnError && (
                  <div style={{ ...errorBoxStyle, margin: "4px 0" }}>
                    <div>{cnError}</div>
                  </div>
                )}

                <button
                  type="button"
                  className="exchange-btn"
                  disabled={creatingCn}
                  onClick={handleCreateCreditNote}
                  style={{
                    ...btnPrimaryStyle,
                    background: "#0f172a",
                    marginTop: "4px",
                  }}
                >
                  {creatingCn ? "Creating credit note..." : `Create credit note for ${formatMoney(totalReturnCredit)}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit Note Success Screen */}
      {createdCn && (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <div style={{ fontSize: "42px", lineHeight: 1, marginBottom: "10px" }}>✅</div>
            <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
              Credit Note Issued
            </h3>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#166534" }}>
              {createdCn.note_no_text}
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "#0f172a", margin: "8px 0" }}>
              {formatMoney(createdCn.amount)}
            </div>

            {createdCn.expires_on && (
              <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                Valid until {createdCn.expires_on}
              </div>
            )}

            <div style={{ fontSize: "13px", color: "#475569", marginTop: "10px" }}>
              The customer can use this on their next purchase.
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                className="exchange-btn"
                onClick={() => setViewingSlipId(createdCn.id)}
                style={btnPrimaryStyle}
              >
                🖨️ Print slip
              </button>

              <button
                type="button"
                className="exchange-btn"
                onClick={onClose}
                style={btnSecondaryStyle}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "16px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: "#475569",
  marginBottom: "4px",
};

const inputFieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "16px",
  minHeight: "44px",
};

const stepperInputStyle: React.CSSProperties = {
  width: "60px",
  textAlign: "center",
  padding: "8px 4px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "16px",
  minHeight: "44px",
  boxSizing: "border-box",
};

const stepperBtnStyle: React.CSSProperties = {
  width: "44px",
  minHeight: "44px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "18px",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const reasonBtnStyle: React.CSSProperties = {
  minHeight: "44px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  padding: "8px 12px",
  fontSize: "13px",
  textAlign: "center",
  cursor: "pointer",
  boxSizing: "border-box",
};

const billCardBtnStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  cursor: "pointer",
  textAlign: "left",
};

const actionCardBtnStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "16px",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  cursor: "pointer",
  textAlign: "left",
};

const btnBackStyle: React.CSSProperties = {
  minHeight: "44px",
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnPrimaryStyle: React.CSSProperties = {
  minHeight: "44px",
  padding: "10px 20px",
  borderRadius: "10px",
  border: 0,
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondaryStyle: React.CSSProperties = {
  minHeight: "44px",
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondaryFullStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnRetryStyle: React.CSSProperties = {
  minHeight: "44px",
  padding: "6px 14px",
  borderRadius: "8px",
  border: "1px solid #b91c1c",
  background: "#ffffff",
  color: "#b91c1c",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const errorBoxStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "12px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
  fontSize: "13.5px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
};
