"use client";

import React, { useState, useEffect, useRef } from "react";
import type { BillingBusinessProfile } from "../../lib/billing";
import { formatMoney } from "../../lib/billing";
import {
  udhaarBillInfo,
  udhaarFindCustomers,
  udhaarSaveCustomer,
  udhaarPutBillOnCredit,
  parseLimitExceeded,
  formatUdhaarError,
  type UdhaarBillInfo,
  type UdhaarCustomerSearchResult,
} from "../../lib/udhaar";

export type PutOnCreditPanelProps = {
  business: BillingBusinessProfile & { id: string };
  bill: {
    id: string;
    status: string;
    payment_status: string;
    total: number;
    customer_name?: string | null;
    customer_phone?: string | null;
  };
  onChanged?: () => void | Promise<void>;
  onOpenLedger?: (customerId: string) => void;
  onCreditInfo?: (info: UdhaarBillInfo | null) => void;
};

export default function PutOnCreditPanel({
  business,
  bill,
  onChanged,
  onOpenLedger,
  onCreditInfo,
}: PutOnCreditPanelProps) {
  const [creditInfo, setCreditInfo] = useState<UdhaarBillInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UdhaarCustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<UdhaarCustomerSearchResult | null>(null);

  // Inline new customer form
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newLimit, setNewLimit] = useState("");
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);

  // Submit & limit exceeded
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [limitExceededMessage, setLimitExceededMessage] = useState<string | null>(null);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onCreditInfoRef = useRef(onCreditInfo);
  useEffect(() => {
    onCreditInfoRef.current = onCreditInfo;
  }, [onCreditInfo]);

  const businessId = business?.id;
  const billId = bill?.id;

  // Fetch credit info on mount or bill.id change
  useEffect(() => {
    if (!billId || !businessId) {
      return;
    }
    let ignore = false;
    udhaarBillInfo(businessId, [billId])
      .then((list) => {
        if (!ignore) {
          const info = list.find((b) => b.bill_id === billId) || null;
          setCreditInfo(info);
          onCreditInfoRef.current?.(info);
          setLoadingInfo(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setCreditInfo(null);
          onCreditInfoRef.current?.(null);
          setLoadingInfo(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [businessId, billId]);

  // Handle opening the modal
  const handleOpenModal = () => {
    const prefill = (bill.customer_phone || bill.customer_name || "").trim();
    setSearchQuery(prefill);
    setSelectedCustomerId(null);
    setSelectedCustomer(null);
    setShowNewCustomer(false);
    setNewName(bill.customer_name || "");
    setNewPhone(bill.customer_phone || "");
    setNewLimit("");
    setNewCustomerError(null);
    setErrorMsg(null);
    setLimitExceededMessage(null);
    setModalOpen(true);
    void searchCustomers(prefill);
  };

  const searchCustomers = async (q: string) => {
    setIsSearching(true);
    try {
      const results = await udhaarFindCustomers(business.id, q);
      setSearchResults(results);
    } catch (err: unknown) {
      setErrorMsg(formatUdhaarError(err));
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void searchCustomers(val);
    }, 250);
  };

  // Create new customer inline
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setNewCustomerError("Please enter customer name.");
      return;
    }
    if (!newPhone.trim()) {
      setNewCustomerError("Please enter 10-digit mobile number.");
      return;
    }

    setSavingNewCustomer(true);
    setNewCustomerError(null);
    try {
      const parsedLimit = newLimit.trim() ? parseFloat(newLimit) : null;
      const customerId = await udhaarSaveCustomer({
        businessId: business.id,
        name: newName.trim(),
        phone: newPhone.trim(),
        creditLimit: parsedLimit && !isNaN(parsedLimit) ? parsedLimit : null,
      });

      // Select newly created/returned customer
      const newCust: UdhaarCustomerSearchResult = {
        id: customerId,
        name: newName.trim(),
        phone: newPhone.trim(),
        credit_limit: parsedLimit && !isNaN(parsedLimit) ? parsedLimit : null,
        balance: 0,
      };

      setSelectedCustomerId(customerId);
      setSelectedCustomer(newCust);
      setShowNewCustomer(false);
      setSearchResults((prev) => [newCust, ...prev.filter((c) => c.id !== customerId)]);
    } catch (err: unknown) {
      setNewCustomerError(formatUdhaarError(err));
    } finally {
      setSavingNewCustomer(false);
    }
  };

  // Confirm put on credit
  const handleConfirmPutOnCredit = async (overrideLimit: boolean = false) => {
    if (!selectedCustomerId || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      await udhaarPutBillOnCredit(bill.id, selectedCustomerId, overrideLimit);

      // Successfully put on credit
      setModalOpen(false);
      setLimitExceededMessage(null);

      // Refresh credit info
      if (businessId && billId) {
        try {
          const list = await udhaarBillInfo(businessId, [billId]);
          const info = list.find((b) => b.bill_id === billId) || null;
          setCreditInfo(info);
          onCreditInfoRef.current?.(info);
        } catch {
          // ignore
        }
      }
      if (onChanged) {
        await onChanged();
      }
    } catch (err: unknown) {
      const limitText = parseLimitExceeded(err);
      if (limitText) {
        setLimitExceededMessage(limitText);
      } else {
        setErrorMsg(formatUdhaarError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // If already on credit: show compact badge
  if (creditInfo) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "10px 14px",
          background: "#fef3c7",
          border: "1px solid #fde68a",
          borderRadius: "8px",
          marginBottom: "12px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "16px" }}>📒</span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#92400e" }}>
            On udhaar — {creditInfo.customer_name}
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#b45309",
              background: "#fef9c3",
              padding: "2px 8px",
              borderRadius: "12px",
            }}
          >
            Due: {formatMoney(creditInfo.due)}
          </span>
        </div>

        {onOpenLedger && (
          <button
            type="button"
            onClick={() => onOpenLedger(creditInfo.customer_id)}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#92400e",
              background: "#ffffff",
              border: "1px solid #fcd34d",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Open ledger
          </button>
        )}
      </div>
    );
  }

  // If loading credit info, don't flicker button
  if (loadingInfo) {
    return null;
  }

  // Eligible to be put on credit?
  const canPutOnCredit =
    bill.status === "issued" && bill.payment_status === "unpaid" && Number(bill.total) > 0;

  if (!canPutOnCredit) {
    return null;
  }

  return (
    <>
      <div style={{ marginBottom: "12px" }}>
        <button
          type="button"
          onClick={handleOpenModal}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            minHeight: "44px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#92400e",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "8px",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          <span>📒</span>
          <span>Put on credit (udhaar)</span>
        </button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              width: "100%",
              maxWidth: "480px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "20px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "17px",
                    fontWeight: 700,
                    color: "#0f172a",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>📒</span>
                  <span>Put bill on credit</span>
                </h3>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                  Bill amount: <strong style={{ color: "#0f172a" }}>{formatMoney(bill.total)}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "20px",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  borderRadius: "8px",
                  color: "#b91c1c",
                  fontSize: "13px",
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* LIMIT EXCEEDED Warning Modal confirmation */}
            {limitExceededMessage ? (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#92400e" }}>
                  ⚠️ Credit limit exceeded
                </div>
                <div style={{ fontSize: "13px", color: "#78350f", lineHeight: "1.5" }}>
                  {limitExceededMessage}
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setLimitExceededMessage(null)}
                    disabled={submitting}
                    style={{
                      padding: "8px 14px",
                      fontSize: "13px",
                      fontWeight: 600,
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      color: "#475569",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmPutOnCredit(true)}
                    disabled={submitting}
                    style={{
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 600,
                      background: "#d97706",
                      border: "none",
                      borderRadius: "6px",
                      color: "#ffffff",
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {submitting ? "Processing..." : "Put on credit anyway"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Search Bar & Add Customer Button */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#334155",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Select customer
                  </label>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="Search name or phone..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      style={{
                        flex: 1,
                        minHeight: "42px",
                        padding: "8px 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontSize: "14px",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewCustomer((prev) => !prev)}
                      style={{
                        minHeight: "42px",
                        padding: "8px 12px",
                        fontSize: "13px",
                        fontWeight: 600,
                        background: showNewCustomer ? "#f1f5f9" : "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: "8px",
                        color: "#1d4ed8",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {showNewCustomer ? "Cancel" : "+ New customer"}
                    </button>
                  </div>
                </div>

                {/* Inline New Customer Form */}
                {showNewCustomer && (
                  <form
                    onSubmit={handleCreateCustomer}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                      New customer details
                    </div>

                    {newCustomerError && (
                      <div style={{ fontSize: "12px", color: "#b91c1c" }}>{newCustomerError}</div>
                    )}

                    <div>
                      <input
                        type="text"
                        placeholder="Customer name *"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          fontSize: "13px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <input
                        type="tel"
                        placeholder="10-digit mobile *"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        required
                        style={{
                          padding: "8px 10px",
                          fontSize: "13px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          boxSizing: "border-box",
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Credit limit (optional)"
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        min="0"
                        step="100"
                        style={{
                          padding: "8px 10px",
                          fontSize: "13px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                      <button
                        type="submit"
                        disabled={savingNewCustomer}
                        style={{
                          padding: "8px 14px",
                          fontSize: "13px",
                          fontWeight: 600,
                          background: "#2563eb",
                          border: "none",
                          borderRadius: "6px",
                          color: "#ffffff",
                          cursor: savingNewCustomer ? "not-allowed" : "pointer",
                        }}
                      >
                        {savingNewCustomer ? "Saving..." : "Save & Select"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Customer List */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    maxHeight: "220px",
                    overflowY: "auto",
                  }}
                >
                  {isSearching ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                      Searching customers...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                      No customers found. Click <strong>+ New customer</strong> to add one.
                    </div>
                  ) : (
                    searchResults.map((cust) => {
                      const isSelected = selectedCustomerId === cust.id;
                      return (
                        <div
                          key={cust.id}
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setSelectedCustomer(cust);
                          }}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                            background: isSelected ? "#eff6ff" : "#ffffff",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            boxSizing: "border-box",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                              {cust.name}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                              {cust.phone}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: cust.balance > 0 ? "#dc2626" : "#16a34a",
                              }}
                            >
                              Owes {formatMoney(cust.balance)}
                            </div>
                            {typeof cust.credit_limit === "number" && (
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                Limit: {formatMoney(cust.credit_limit)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Action Buttons */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: "16px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={submitting}
                    style={{
                      minHeight: "44px",
                      padding: "8px 16px",
                      fontSize: "14px",
                      fontWeight: 600,
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      color: "#475569",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmPutOnCredit(false)}
                    disabled={!selectedCustomerId || submitting}
                    style={{
                      minHeight: "44px",
                      padding: "8px 20px",
                      fontSize: "14px",
                      fontWeight: 600,
                      background: selectedCustomerId && !submitting ? "#2563eb" : "#94a3b8",
                      border: "none",
                      borderRadius: "8px",
                      color: "#ffffff",
                      cursor: selectedCustomerId && !submitting ? "pointer" : "not-allowed",
                    }}
                  >
                    {submitting
                      ? "Putting on credit..."
                      : selectedCustomer
                      ? `Confirm (${selectedCustomer.name})`
                      : "Select a customer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
