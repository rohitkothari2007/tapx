"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { BillingBusinessProfile } from "../../lib/billing";
import { formatMoney, normalizeWhatsAppPhone, formatBillDateTime } from "../../lib/billing";
import { daysSince, formatDueAge } from "../../lib/unpaidBills";
import {
  udhaarListCustomers,
  udhaarCustomerDetail,
  udhaarSaveCustomer,
  udhaarReceivePayment,
  udhaarReversePayment,
  buildUdhaarStatementMessage,
  buildUdhaarReceiptMessage,
  formatUdhaarError,
  type UdhaarCustomerSummary,
  type UdhaarCustomerDetail,
  type UdhaarReceivePaymentResult,
  type UdhaarPaymentItem,
} from "../../lib/udhaar";

export type UdhaarPageProps = {
  business: BillingBusinessProfile & { id: string };
  initialCustomerId?: string | null;
  onConsumedInitialCustomerId?: () => void;
  onBillsChanged?: () => void | Promise<void>;
  onOpenBill: (billId: string) => void;
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

export default function UdhaarPage({
  business,
  initialCustomerId,
  onConsumedInitialCustomerId,
  onBillsChanged,
  onOpenBill,
}: UdhaarPageProps) {
  // Navigation / View state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId || null);
  const [prevInitialId, setPrevInitialId] = useState(initialCustomerId);
  if (initialCustomerId && initialCustomerId !== prevInitialId) {
    setPrevInitialId(initialCustomerId);
    setSelectedCustomerId(initialCustomerId);
  }

  const onConsumedRef = useRef(onConsumedInitialCustomerId);
  useEffect(() => {
    onConsumedRef.current = onConsumedInitialCustomerId;
  }, [onConsumedInitialCustomerId]);

  useEffect(() => {
    if (initialCustomerId) {
      onConsumedRef.current?.();
    }
  }, [initialCustomerId]);

  // List view state
  const [customers, setCustomers] = useState<UdhaarCustomerSummary[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [customersWithDue, setCustomersWithDue] = useState(0);
  const [onlyDue, setOnlyDue] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const reqCountRef = useRef(0);

  // Ledger detail state
  const [customerDetail, setCustomerDetail] = useState<UdhaarCustomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Modals state
  // 1. Add / Edit Customer
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<{
    id?: string;
    name: string;
    phone: string;
    creditLimit: string;
    notes: string;
  } | null>(null);
  const [customerModalSaving, setCustomerModalSaving] = useState(false);
  const [customerModalError, setCustomerModalError] = useState<string | null>(null);

  // 2. Receive Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card" | null>(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessResult, setPaymentSuccessResult] = useState<UdhaarReceivePaymentResult | null>(null);

  // 3. Reverse Payment Modal
  const [reverseModalTarget, setReverseModalTarget] = useState<UdhaarPaymentItem | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseSaving, setReverseSaving] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  const businessId = business.id;

  // Fetch list of customers
  const fetchCustomers = useCallback(
    async (isOnlyDue: boolean, silent: boolean = false) => {
      const reqId = ++reqCountRef.current;
      if (!silent) setLoadingList(true);
      setListError(null);

      try {
        const resp = await udhaarListCustomers(businessId, isOnlyDue);
        if (reqId !== reqCountRef.current) return;
        setCustomers(resp.customers);
        setTotalDue(resp.total_due);
        setCustomersWithDue(resp.customers_with_due);
      } catch (err: unknown) {
        if (reqId !== reqCountRef.current) return;
        setListError(formatUdhaarError(err));
      } finally {
        if (reqId === reqCountRef.current && !silent) {
          setLoadingList(false);
        }
      }
    },
    [businessId]
  );

  useEffect(() => {
    let ignore = false;
    const reqId = ++reqCountRef.current;
    udhaarListCustomers(businessId, onlyDue)
      .then((resp) => {
        if (!ignore && reqId === reqCountRef.current) {
          setCustomers(resp.customers);
          setTotalDue(resp.total_due);
          setCustomersWithDue(resp.customers_with_due);
          setLoadingList(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore && reqId === reqCountRef.current) {
          setListError(formatUdhaarError(err));
          setLoadingList(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [businessId, onlyDue]);

  // Fetch detail when selectedCustomerId changes
  const fetchCustomerDetail = useCallback(
    async (customerId: string, silent: boolean = false) => {
      if (!customerId) return;
      if (!silent) setLoadingDetail(true);
      setDetailError(null);

      try {
        const detail = await udhaarCustomerDetail(customerId);
        setCustomerDetail(detail);
      } catch (err: unknown) {
        setDetailError(formatUdhaarError(err));
      } finally {
        if (!silent) setLoadingDetail(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedCustomerId) {
      return;
    }
    let ignore = false;
    udhaarCustomerDetail(selectedCustomerId)
      .then((detail) => {
        if (!ignore) {
          setCustomerDetail(detail);
          setLoadingDetail(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setDetailError(formatUdhaarError(err));
          setLoadingDetail(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [selectedCustomerId]);

  // Client-side search filtering on list
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    const qDigits = q.replace(/\D/g, "");

    return customers.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.phone.toLowerCase().includes(q)) return true;
      if (qDigits && c.phone.replace(/\D/g, "").includes(qDigits)) return true;
      return false;
    });
  }, [customers, searchQuery]);

  // -------------------------------------------------------------
  // Add / Edit Customer Handlers
  // -------------------------------------------------------------
  const handleOpenAddCustomer = () => {
    setEditingCustomer({
      name: "",
      phone: "",
      creditLimit: "",
      notes: "",
    });
    setCustomerModalError(null);
    setCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = () => {
    if (!customerDetail?.customer) return;
    const c = customerDetail.customer;
    setEditingCustomer({
      id: c.id,
      name: c.name,
      phone: c.phone,
      creditLimit: typeof c.credit_limit === "number" ? String(c.credit_limit) : "",
      notes: c.notes || "",
    });
    setCustomerModalError(null);
    setCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || customerModalSaving) return;

    if (!editingCustomer.name.trim()) {
      setCustomerModalError("Please enter customer name.");
      return;
    }
    if (!editingCustomer.phone.trim()) {
      setCustomerModalError("Please enter mobile number.");
      return;
    }

    setCustomerModalSaving(true);
    setCustomerModalError(null);

    try {
      const parsedLimit = editingCustomer.creditLimit.trim()
        ? parseFloat(editingCustomer.creditLimit)
        : null;

      const returnedId = await udhaarSaveCustomer({
        businessId: business.id,
        customerId: editingCustomer.id || null,
        name: editingCustomer.name.trim(),
        phone: editingCustomer.phone.trim(),
        creditLimit: parsedLimit && !isNaN(parsedLimit) ? parsedLimit : null,
        notes: editingCustomer.notes.trim() || null,
      });

      setCustomerModalOpen(false);

      // If creating new customer:
      if (!editingCustomer.id) {
        // If returning an already existing customer
        const existed = customers.some((c) => c.id === returnedId);
        if (existed) {
          setNoticeMessage("This customer already existed.");
        }
        setSelectedCustomerId(returnedId);
      } else {
        // Updated existing customer
        void fetchCustomerDetail(editingCustomer.id);
      }

      void fetchCustomers(onlyDue, true);
    } catch (err: unknown) {
      setCustomerModalError(formatUdhaarError(err));
    } finally {
      setCustomerModalSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Receive Payment Handlers & Live Preview
  // -------------------------------------------------------------
  const handleOpenReceivePayment = () => {
    setPaymentAmount("");
    setPaymentMethod(null);
    setPaymentNote("");
    setPaymentError(null);
    setPaymentSuccessResult(null);
    setPaymentModalOpen(true);
  };

  const numericPaymentAmount = parseFloat(paymentAmount) || 0;
  const currentBalance = customerDetail?.balance || 0;

  // Live allocation preview computed client-side
  const computeAllocationPreview = () => {
    if (!customerDetail?.bills || numericPaymentAmount <= 0) return null;
    const openBills = [...customerDetail.bills]
      .filter((b) => Number(b.due) > 0 && b.status !== "void")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (openBills.length === 0) return "No open bills to clear.";

    let remaining = numericPaymentAmount;
    const fullyCleared: string[] = [];
    let partiallyClearedText: string | null = null;

    for (const bill of openBills) {
      if (remaining <= 0) break;
      const due = Number(bill.due);
      if (remaining >= due) {
        fullyCleared.push(bill.bill_no_text);
        remaining -= due;
      } else {
        partiallyClearedText = `${formatMoney(remaining)} toward ${bill.bill_no_text}`;
        remaining = 0;
        break;
      }
    }

    if (fullyCleared.length === 0 && !partiallyClearedText) {
      return null;
    }

    const parts: string[] = [];
    if (fullyCleared.length > 0) {
      if (fullyCleared.length === 1) {
        parts.push(`clear ${fullyCleared[0]}`);
      } else if (fullyCleared.length === 2) {
        parts.push(`clear ${fullyCleared[0]} and ${fullyCleared[1]}`);
      } else {
        const last = fullyCleared[fullyCleared.length - 1];
        const rest = fullyCleared.slice(0, -1).join(", ");
        parts.push(`clear ${rest}, and ${last}`);
      }
    }
    if (partiallyClearedText) {
      parts.push(partiallyClearedText);
    }

    return `Will ${parts.join(", and ")}.`;
  };
  const allocationPreviewText = computeAllocationPreview();

  const handleConfirmReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerDetail?.customer || paymentSaving) return;

    if (numericPaymentAmount <= 0) {
      setPaymentError("Payment amount must be greater than 0.");
      return;
    }
    if (numericPaymentAmount > currentBalance) {
      setPaymentError(`Amount cannot exceed the customer's balance of ${formatMoney(currentBalance)}.`);
      return;
    }
    if (!paymentMethod) {
      setPaymentError("Please choose a payment method (Cash, UPI, or Card).");
      return;
    }

    setPaymentSaving(true);
    setPaymentError(null);

    try {
      const result = await udhaarReceivePayment({
        customerId: customerDetail.customer.id,
        amount: numericPaymentAmount,
        method: paymentMethod,
        note: paymentNote.trim() || null,
      });

      setPaymentSuccessResult(result);
      void fetchCustomerDetail(customerDetail.customer.id, true);
      void fetchCustomers(onlyDue, true);
      if (onBillsChanged) {
        void onBillsChanged();
      }
    } catch (err: unknown) {
      setPaymentError(formatUdhaarError(err));
    } finally {
      setPaymentSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Reverse Payment Handlers
  // -------------------------------------------------------------
  const handleOpenReverseModal = (payment: UdhaarPaymentItem) => {
    setReverseModalTarget(payment);
    setReverseReason("");
    setReverseError(null);
  };

  const handleConfirmReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseModalTarget || !customerDetail?.customer || reverseSaving) return;

    if (!reverseReason.trim() || reverseReason.trim().length < 3) {
      setReverseError("Please provide a reason of at least 3 characters.");
      return;
    }

    setReverseSaving(true);
    setReverseError(null);

    try {
      await udhaarReversePayment(reverseModalTarget.id, reverseReason.trim());
      setReverseModalTarget(null);
      void fetchCustomerDetail(customerDetail.customer.id, true);
      void fetchCustomers(onlyDue, true);
      if (onBillsChanged) {
        void onBillsChanged();
      }
    } catch (err: unknown) {
      setReverseError(formatUdhaarError(err));
    } finally {
      setReverseSaving(false);
    }
  };

  // =========================================================================
  // VIEW: LEDGER VIEW (SINGLE CUSTOMER)
  // =========================================================================
  if (selectedCustomerId) {
    const cust = customerDetail?.customer;
    const waPhone = cust?.phone ? normalizeWhatsAppPhone(cust.phone) : null;
    const balance = customerDetail?.balance || 0;
    const creditLimit = cust?.credit_limit;

    // Statement WhatsApp Message
    const statementUrl =
      waPhone && customerDetail
        ? `https://wa.me/${waPhone}?text=${encodeURIComponent(
            buildUdhaarStatementMessage({
              customerName: cust.name,
              businessName: business.name,
              balance: customerDetail.balance,
              bills: customerDetail.bills,
              origin: typeof window !== "undefined" ? window.location.origin : "",
              upiId: business.upi_id,
            })
          )}`
        : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "900px" }}>
        {/* Top Back Navigation Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={() => {
              setSelectedCustomerId(null);
              setCustomerDetail(null);
              setNoticeMessage(null);
              void fetchCustomers(onlyDue, true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              minHeight: "44px",
              padding: "8px 14px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#334155",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            ← Back to customers
          </button>

          {cust && (
            <button
              type="button"
              onClick={handleOpenEditCustomer}
              style={{
                minHeight: "44px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#475569",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              ✎ Edit customer
            </button>
          )}
        </div>

        {/* Notice Message Banner */}
        {noticeMessage && (
          <div
            style={{
              padding: "10px 14px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              color: "#1d4ed8",
              fontSize: "13px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{noticeMessage}</span>
            <button
              type="button"
              onClick={() => setNoticeMessage(null)}
              style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading / Error States */}
        {loadingDetail && (
          <div
            style={{
              padding: "36px",
              textAlign: "center",
              background: "#ffffff",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Loading ledger...
          </div>
        )}

        {detailError && (
          <div
            style={{
              padding: "14px 16px",
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "8px",
              color: "#b91c1c",
              fontSize: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{detailError}</span>
            <button
              type="button"
              onClick={() => fetchCustomerDetail(selectedCustomerId)}
              style={{
                padding: "6px 12px",
                background: "#ffffff",
                border: "1px solid #fca5a5",
                borderRadius: "6px",
                color: "#b91c1c",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Customer Header Card */}
        {cust && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
                  {cust.name}
                </h2>
                <div style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
                  📞 {cust.phone}
                </div>
                {cust.notes && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#475569",
                      marginTop: "6px",
                      background: "#f8fafc",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      display: "inline-block",
                    }}
                  >
                    Note: {cust.notes}
                  </div>
                )}
              </div>

              {/* Big Balance Display */}
              <div style={{ textAlign: "right", minWidth: "140px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#64748b",
                  }}
                >
                  Balance Due
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 800,
                    color: balance > 0 ? "#dc2626" : "#16a34a",
                    marginTop: "2px",
                  }}
                >
                  {formatMoney(balance)}
                </div>
                {typeof creditLimit === "number" && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: balance > creditLimit ? "#dc2626" : "#64748b",
                      marginTop: "2px",
                      fontWeight: balance > creditLimit ? 700 : 500,
                    }}
                  >
                    {balance > creditLimit ? "⚠️ Exceeds limit: " : "Credit limit: "}
                    {formatMoney(creditLimit)}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                borderTop: "1px solid #f1f5f9",
                paddingTop: "14px",
              }}
            >
              <button
                type="button"
                onClick={handleOpenReceivePayment}
                disabled={balance <= 0}
                style={{
                  minHeight: "44px",
                  padding: "8px 18px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: balance > 0 ? "#16a34a" : "#94a3b8",
                  border: "none",
                  borderRadius: "8px",
                  cursor: balance > 0 ? "pointer" : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>₹</span>
                <span>Receive payment</span>
              </button>

              {statementUrl ? (
                <a
                  href={statementUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    minHeight: "44px",
                    padding: "8px 18px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#15803d",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "8px",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxSizing: "border-box",
                  }}
                >
                  <span>💬</span>
                  <span>WhatsApp statement</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Customer does not have a valid Indian WhatsApp mobile number"
                  style={{
                    minHeight: "44px",
                    padding: "8px 18px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#94a3b8",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    cursor: "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>💬</span>
                  <span>WhatsApp statement (No phone)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Section 1: Bills on Credit */}
        {customerDetail && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                Bills on credit ({customerDetail.bills.length})
              </h3>
            </div>

            {customerDetail.bills.length === 0 ? (
              <div style={{ padding: "16px", color: "#64748b", fontSize: "13px", textAlign: "center" }}>
                No bills currently on this customer&apos;s account.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {customerDetail.bills.map((bill) => {
                  const isVoid = bill.status === "void";
                  const isPaid = bill.payment_status === "paid";
                  const isPartPaid = !isPaid && !isVoid && Number(bill.due) < Number(bill.total);

                  const statusChip = isVoid ? (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        color: "#64748b",
                        background: "#f1f5f9",
                      }}
                    >
                      Void
                    </span>
                  ) : isPaid ? (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        color: "#16a34a",
                        background: "#dcfce7",
                      }}
                    >
                      Paid
                    </span>
                  ) : isPartPaid ? (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        color: "#d97706",
                        background: "#fef3c7",
                      }}
                    >
                      Part-paid
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        color: "#dc2626",
                        background: "#fee2e2",
                      }}
                    >
                      Unpaid
                    </span>
                  );

                  return (
                    <div
                      key={bill.bill_id}
                      onClick={() => onOpenBill(bill.bill_id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "10px",
                        padding: "12px 14px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        cursor: "pointer",
                        boxSizing: "border-box",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                            {bill.bill_no_text}
                          </span>
                          {statusChip}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {formatBillDateTime(bill.created_at)}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                          Due: {formatMoney(bill.due)}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          Total: {formatMoney(bill.total)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Section 2: Payments */}
        {customerDetail && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                Payments & Collections ({customerDetail.payments.length})
              </h3>
            </div>

            {customerDetail.payments.length === 0 ? (
              <div style={{ padding: "16px", color: "#64748b", fontSize: "13px", textAlign: "center" }}>
                No payments recorded yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {customerDetail.payments.map((p) => {
                  const isReversed = Boolean(p.reversed_at);
                  const allocationSummary =
                    p.allocations && p.allocations.length > 0
                      ? p.allocations
                          .map((a) => `${a.bill_no_text}: ${formatMoney(a.amount)}`)
                          .join(", ")
                      : null;

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: "12px 14px",
                        background: isReversed ? "#f1f5f9" : "#ffffff",
                        border: isReversed ? "1px dashed #cbd5e1" : "1px solid #e2e8f0",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "10px",
                        boxSizing: "border-box",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "180px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: isReversed ? "#64748b" : "#16a34a",
                              textDecoration: isReversed ? "line-through" : "none",
                            }}
                          >
                            +{formatMoney(p.amount)}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "#f1f5f9",
                              color: "#475569",
                            }}
                          >
                            {p.method}
                          </span>
                        </div>

                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {formatBillDateTime(p.created_at)}
                          {p.note && <span> · {p.note}</span>}
                        </div>

                        {allocationSummary && (
                          <div style={{ fontSize: "12px", color: "#475569", marginTop: "3px" }}>
                            Applied to {allocationSummary}
                          </div>
                        )}

                        {isReversed && (
                          <div
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#b91c1c",
                              marginTop: "4px",
                            }}
                          >
                            Reversed — {p.reverse_reason || "Reversed"}
                          </div>
                        )}
                      </div>

                      {!isReversed && (
                        <div>
                          <button
                            type="button"
                            onClick={() => handleOpenReverseModal(p)}
                            style={{
                              minHeight: "36px",
                              padding: "6px 12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "#b91c1c",
                              background: "#fff1f2",
                              border: "1px solid #fecdd3",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                          >
                            Reverse
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* RECEIVE PAYMENT MODAL */}
        {/* ------------------------------------------------------------- */}
        {paymentModalOpen && (
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
                width: "100%",
                maxWidth: "460px",
                padding: "20px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {paymentSuccessResult ? (
                // Payment Success Screen with Receipt Link
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <div style={{ fontSize: "36px" }}>🎉</div>
                    <h3 style={{ margin: "8px 0 4px", fontSize: "18px", color: "#0f172a" }}>
                      Payment Received!
                    </h3>
                    <div style={{ fontSize: "14px", color: "#64748b" }}>
                      Recorded {formatMoney(paymentSuccessResult.amount)} successfully.
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginTop: "8px" }}>
                      Remaining balance: {formatMoney(paymentSuccessResult.balance_after)}
                    </div>
                  </div>

                  {paymentSuccessResult.applied && paymentSuccessResult.applied.length > 0 && (
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#475569",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: "4px" }}>Bills covered:</div>
                      {paymentSuccessResult.applied.map((a) => (
                        <div key={a.bill_id}>
                          • {a.bill_no_text}: {formatMoney(a.amount)}{" "}
                          {a.fully_paid ? "(Fully cleared)" : "(Partially paid)"}
                        </div>
                      ))}
                    </div>
                  )}

                  {waPhone && (
                    <a
                      href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                        buildUdhaarReceiptMessage({
                          customerName: cust?.name,
                          businessName: business.name,
                          amount: paymentSuccessResult.amount,
                          method: paymentMethod || "payment",
                          balanceAfter: paymentSuccessResult.balance_after,
                        })
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        minHeight: "44px",
                        padding: "10px 16px",
                        background: "#25D366",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "14px",
                        borderRadius: "8px",
                        textDecoration: "none",
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <span>💬</span>
                      <span>Send receipt on WhatsApp</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentModalOpen(false);
                      setPaymentSuccessResult(null);
                    }}
                    style={{
                      minHeight: "44px",
                      padding: "8px 16px",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                // Receive Payment Form
                <form onSubmit={handleConfirmReceivePayment} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                      Receive Payment — {cust?.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setPaymentModalOpen(false)}
                      style={{ background: "none", border: "none", fontSize: "20px", color: "#94a3b8", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>

                  {paymentError && (
                    <div style={{ padding: "8px 12px", background: "#fee2e2", borderRadius: "6px", color: "#b91c1c", fontSize: "13px" }}>
                      {paymentError}
                    </div>
                  )}

                  {/* Amount Input & Full Balance Quick Button */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        Amount to receive (₹) *
                      </label>
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(String(balance))}
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#2563eb",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Full balance ({formatMoney(balance)})
                      </button>
                    </div>

                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={balance}
                      placeholder="Enter amount..."
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        minHeight: "44px",
                        padding: "8px 12px",
                        fontSize: "16px",
                        fontWeight: 700,
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Live Allocation Preview */}
                  {allocationPreviewText && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "#166534",
                        lineHeight: "1.4",
                      }}
                    >
                      💡 {allocationPreviewText}
                    </div>
                  )}

                  {/* Payment Method Chips */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Payment method *
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                      {(["cash", "upi", "card"] as const).map((m) => {
                        const isSelected = paymentMethod === m;
                        const label = m === "cash" ? "Cash" : m === "upi" ? "UPI" : "Card";
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPaymentMethod(m)}
                            style={{
                              minHeight: "42px",
                              padding: "8px",
                              fontSize: "13px",
                              fontWeight: 700,
                              borderRadius: "8px",
                              border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                              background: isSelected ? "#eff6ff" : "#ffffff",
                              color: isSelected ? "#1d4ed8" : "#334155",
                              cursor: "pointer",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Note */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      maxLength={200}
                      placeholder="e.g. GPay ref #1234, cash received by manager..."
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        fontSize: "13px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setPaymentModalOpen(false)}
                      disabled={paymentSaving}
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
                      type="submit"
                      disabled={paymentSaving || numericPaymentAmount <= 0 || numericPaymentAmount > balance || !paymentMethod}
                      style={{
                        minHeight: "44px",
                        padding: "8px 20px",
                        fontSize: "14px",
                        fontWeight: 700,
                        background:
                          !paymentSaving && numericPaymentAmount > 0 && numericPaymentAmount <= balance && paymentMethod
                            ? "#16a34a"
                            : "#94a3b8",
                        border: "none",
                        borderRadius: "8px",
                        color: "#ffffff",
                        cursor:
                          !paymentSaving && numericPaymentAmount > 0 && numericPaymentAmount <= balance && paymentMethod
                            ? "pointer"
                            : "not-allowed",
                      }}
                    >
                      {paymentSaving ? "Recording..." : `Record ${formatMoney(numericPaymentAmount || 0)}`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* REVERSE PAYMENT MODAL */}
        {/* ------------------------------------------------------------- */}
        {reverseModalTarget && (
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
            <form
              onSubmit={handleConfirmReversePayment}
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "460px",
                padding: "20px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#b91c1c" }}>
                  Reverse payment of {formatMoney(reverseModalTarget.amount)}
                </h3>
                <button
                  type="button"
                  onClick={() => setReverseModalTarget(null)}
                  style={{ background: "none", border: "none", fontSize: "20px", color: "#94a3b8", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {reverseError && (
                <div style={{ padding: "8px 12px", background: "#fee2e2", borderRadius: "6px", color: "#b91c1c", fontSize: "13px" }}>
                  {reverseError}
                </div>
              )}

              <div
                style={{
                  padding: "10px 12px",
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#9f1239",
                  lineHeight: "1.4",
                }}
              >
                ⚠️ <strong>Warning:</strong> Reversing this payment will add{" "}
                <strong>{formatMoney(reverseModalTarget.amount)}</strong> back to the customer&apos;s balance. Any bills that
                were cleared by this payment will become unpaid again.
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Reason for reversal (required, min 3 chars) *
                </label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Duplicate entry, bounced UPI payment..."
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setReverseModalTarget(null)}
                  disabled={reverseSaving}
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
                  type="submit"
                  disabled={reverseSaving || reverseReason.trim().length < 3}
                  style={{
                    minHeight: "44px",
                    padding: "8px 20px",
                    fontSize: "14px",
                    fontWeight: 700,
                    background: !reverseSaving && reverseReason.trim().length >= 3 ? "#dc2626" : "#94a3b8",
                    border: "none",
                    borderRadius: "8px",
                    color: "#ffffff",
                    cursor: !reverseSaving && reverseReason.trim().length >= 3 ? "pointer" : "not-allowed",
                  }}
                >
                  {reverseSaving ? "Reversing..." : "Confirm Reversal"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* EDIT CUSTOMER MODAL */}
        {/* ------------------------------------------------------------- */}
        {customerModalOpen && editingCustomer && (
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
            <form
              onSubmit={handleSaveCustomer}
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "460px",
                padding: "20px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                  {editingCustomer.id ? "Edit Customer" : "+ Add Customer"}
                </h3>
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(false)}
                  style={{ background: "none", border: "none", fontSize: "20px", color: "#94a3b8", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {customerModalError && (
                <div style={{ padding: "8px 12px", background: "#fee2e2", borderRadius: "6px", color: "#b91c1c", fontSize: "13px" }}>
                  {customerModalError}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Customer Name (max 80 chars) *
                </label>
                <input
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Ramesh Kumar"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    fontSize: "14px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Mobile number *
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit number"
                    value={editingCustomer.phone}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      minHeight: "42px",
                      padding: "8px 12px",
                      fontSize: "14px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Credit limit (optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="Empty = no limit"
                    value={editingCustomer.creditLimit}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, creditLimit: e.target.value })}
                    style={{
                      width: "100%",
                      minHeight: "42px",
                      padding: "8px 12px",
                      fontSize: "14px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Notes (optional, max 300 chars)
                </label>
                <textarea
                  maxLength={300}
                  rows={2}
                  placeholder="Address, company name, reference notes..."
                  value={editingCustomer.notes}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "13px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(false)}
                  disabled={customerModalSaving}
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
                  type="submit"
                  disabled={customerModalSaving}
                  style={{
                    minHeight: "44px",
                    padding: "8px 20px",
                    fontSize: "14px",
                    fontWeight: 700,
                    background: customerModalSaving ? "#94a3b8" : "#2563eb",
                    border: "none",
                    borderRadius: "8px",
                    color: "#ffffff",
                    cursor: customerModalSaving ? "not-allowed" : "pointer",
                  }}
                >
                  {customerModalSaving ? "Saving..." : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: LIST VIEW (DEFAULT)
  // =========================================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "900px" }}>
      {/* Header Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "16px 20px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Total to receive
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "#dc2626", marginTop: "4px" }}>
            {formatMoney(totalDue)}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "16px 20px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Customers with dues
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
            {customersWithDue}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "12px 16px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "240px" }}>
          <input
            type="text"
            placeholder="Search customer name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minHeight: "42px",
              padding: "8px 12px",
              fontSize: "14px",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              boxSizing: "border-box",
            }}
          />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#475569",
              cursor: "pointer",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={onlyDue}
              onChange={(e) => setOnlyDue(e.target.checked)}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            <span>Only with dues</span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleOpenAddCustomer}
          style={{
            minHeight: "42px",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            background: "#2563eb",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          <span>+</span>
          <span>Add customer</span>
        </button>
      </div>

      {/* List State: Loading / Error / Empty / Customer Cards */}
      {loadingList ? (
        <div
          style={{
            padding: "48px 16px",
            textAlign: "center",
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            color: "#64748b",
            fontSize: "14px",
          }}
        >
          Loading customers...
        </div>
      ) : listError ? (
        <div
          style={{
            padding: "16px 20px",
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: "12px",
            color: "#b91c1c",
            fontSize: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{listError}</span>
          <button
            type="button"
            onClick={() => fetchCustomers(onlyDue)}
            style={{
              padding: "6px 14px",
              background: "#ffffff",
              border: "1px solid #fca5a5",
              borderRadius: "6px",
              color: "#b91c1c",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div
          style={{
            padding: "48px 20px",
            textAlign: "center",
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>📒</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
            {searchQuery.trim() ? "No customers match your search" : "No credit customers found"}
          </div>
          <div style={{ fontSize: "13px", color: "#64748b", marginTop: "6px", maxWidth: "420px", margin: "6px auto 0" }}>
            To put a bill on customer credit, open any unpaid bill from <strong>Bills</strong> or{" "}
            <strong>Unpaid bills</strong> and tap <strong>Put on credit</strong>.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredCustomers.map((cust) => {
            const hasDue = cust.balance > 0;
            const oldestDays = cust.oldest_due_since ? daysSince(cust.oldest_due_since) : null;
            const ageStyle = oldestDays !== null ? getDueAgeStyle(oldestDays) : null;
            const isOverLimit =
              typeof cust.credit_limit === "number" && cust.credit_limit > 0 && cust.balance > cust.credit_limit;

            return (
              <div
                key={cust.id}
                onClick={() => setSelectedCustomerId(cust.id)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  cursor: "pointer",
                  transition: "box-shadow 0.15s ease",
                  boxSizing: "border-box",
                }}
              >
                {/* Left Column: Name, Phone, Age Chips */}
                <div style={{ flex: 1, minWidth: "180px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                      {cust.name}
                    </span>
                    {ageStyle && oldestDays !== null && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          color: ageStyle.color,
                          background: ageStyle.background,
                        }}
                      >
                        {formatDueAge(oldestDays)}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                    📞 {cust.phone}
                  </div>

                  <div
                    style={{
                      fontSize: "12px",
                      color: "#475569",
                      marginTop: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>
                      {cust.open_bills} open {cust.open_bills === 1 ? "bill" : "bills"}
                    </span>

                    {typeof cust.credit_limit === "number" && (
                      <span style={{ color: isOverLimit ? "#dc2626" : "#64748b", fontWeight: isOverLimit ? 700 : 500 }}>
                        · {formatMoney(cust.balance)} of {formatMoney(cust.credit_limit)} limit
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Column: Balance & Arrow */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", textAlign: "right" }}>
                  <div>
                    {hasDue ? (
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "#dc2626" }}>
                        {formatMoney(cust.balance)}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#16a34a",
                          background: "#dcfce7",
                          padding: "3px 10px",
                          borderRadius: "12px",
                        }}
                      >
                        Settled
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: "18px", color: "#cbd5e1" }}>→</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ADD CUSTOMER MODAL */}
      {/* ------------------------------------------------------------- */}
      {customerModalOpen && editingCustomer && (
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
          <form
            onSubmit={handleSaveCustomer}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "460px",
              padding: "20px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                + Add Customer
              </h3>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "20px", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {customerModalError && (
              <div style={{ padding: "8px 12px", background: "#fee2e2", borderRadius: "6px", color: "#b91c1c", fontSize: "13px" }}>
                {customerModalError}
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                Customer Name (max 80 chars) *
              </label>
              <input
                type="text"
                maxLength={80}
                placeholder="e.g. Ramesh Kumar"
                value={editingCustomer.name}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                required
                style={{
                  width: "100%",
                  minHeight: "42px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Mobile number *
                </label>
                <input
                  type="tel"
                  placeholder="10-digit number"
                  value={editingCustomer.phone}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    fontSize: "14px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Credit limit (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Empty = no limit"
                  value={editingCustomer.creditLimit}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, creditLimit: e.target.value })}
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    fontSize: "14px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                Notes (optional, max 300 chars)
              </label>
              <textarea
                maxLength={300}
                rows={2}
                placeholder="Address, company name, reference notes..."
                value={editingCustomer.notes}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "13px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                disabled={customerModalSaving}
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
                type="submit"
                disabled={customerModalSaving}
                style={{
                  minHeight: "44px",
                  padding: "8px 20px",
                  fontSize: "14px",
                  fontWeight: 700,
                  background: customerModalSaving ? "#94a3b8" : "#2563eb",
                  border: "none",
                  borderRadius: "8px",
                  color: "#ffffff",
                  cursor: customerModalSaving ? "not-allowed" : "pointer",
                }}
              >
                {customerModalSaving ? "Saving..." : "Save Customer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
