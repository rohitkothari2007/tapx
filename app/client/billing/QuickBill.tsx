"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  BillingSettings,
  CreditNoteSearchItem,
  PaymentMethod,
  SavedMenuItem,
  formatMoney,
  hasAtMostDecimals,
  parseSavedItemsFromConfig,
} from "../../lib/billing";
import { CreditNotePickerSheet } from "./CreditNotesPage";

type DraftLine = {
  key: string;
  name: string;
  priceInput: string;
  qtyInput: string;
  menu_item_id?: string;
};

type Props = {
  businessId: string;
  billingSettings: BillingSettings;
  moduleConfigs?: Array<{ module_key: string; config: Record<string, any> | null }>;
  upiQrEnabled?: boolean;
  exchange?: {
    billId: string;
    billNo: string;
    returnLines: { bill_item_id: string; quantity: number; restock: boolean }[];
    creditValue: number;
    customerName: string | null;
    customerPhone: string | null;
    creditNoteAllowed: boolean;
    reason: string;
  };
  onCancel: () => void;
  onIssued: (
    billId: string,
    opts?: {
      collectUpi?: boolean;
      creditNote?: {
        id: string;
        note_no_text: string;
        amount: number;
        balance_left: number;
        expires_on: string | null;
      } | null;
    }
  ) => Promise<void> | void;
};

function createBlankLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    priceInput: "",
    qtyInput: "1",
  };
}

export default function QuickBill({
  businessId,
  billingSettings,
  moduleConfigs,
  upiQrEnabled = false,
  exchange,
  onCancel,
  onIssued,
}: Props) {
  const initialMenuConfig = useMemo(() => {
    const row = (moduleConfigs || []).find((m) => {
      const k = String(m.module_key || "").trim().toLowerCase();
      return k === "digital_menu" || k === "digital-menu";
    });
    return parseSavedItemsFromConfig(row?.config);
  }, [moduleConfigs]);

  const [savedItems, setSavedItems] = useState<SavedMenuItem[]>(initialMenuConfig);
  const [itemSearch, setItemSearch] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([createBlankLine()]);
  const [customerName, setCustomerName] = useState(exchange?.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(exchange?.customerPhone || "");

  useEffect(() => {
    if (exchange) {
      if (exchange.customerName) setCustomerName(exchange.customerName);
      if (exchange.customerPhone) setCustomerPhone(exchange.customerPhone);
    }
  }, [exchange]);
  const [discountType, setDiscountType] = useState<"none" | "amount" | "percent">("none");
  const [discountValueInput, setDiscountValueInput] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [serviceChargeInput, setServiceChargeInput] = useState(
    billingSettings.service_charge_pct !== null
      ? String(billingSettings.service_charge_pct)
      : ""
  );

  const [showPaidChooser, setShowPaidChooser] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const submittingRef = useRef(false);

  // Credit Note State (used when billingSettings.exchange_enabled && !exchange)
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNoteSearchItem | null>(null);
  const [showCreditNotePicker, setShowCreditNotePicker] = useState(false);
  const canUseCreditNote = Boolean(billingSettings.exchange_enabled) && !exchange;

  // Sync saved items from digital_menu module config the same way the dashboard loads it
  useEffect(() => {
    let active = true;
    async function loadDigitalMenuItems() {
      if (!businessId) return;
      try {
        const { data, error } = await supabase
          .from("business_module_configs")
          .select("id, config, module_key")
          .eq("business_id", businessId)
          .or("module_key.eq.digital_menu,module_key.eq.digital-menu")
          .maybeSingle();
        if (!active || error) return;
        const parsed = parseSavedItemsFromConfig(data?.config as Record<string, any> | null);
        setSavedItems(parsed);
      } catch {
        // Keep initial cached items if query fails
      }
    }
    void loadDigitalMenuItems();
    return () => {
      active = false;
    };
  }, [businessId]);

  const filteredSavedItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return savedItems;
    return savedItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [savedItems, itemSearch]);

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const handleAddBlankLine = () => {
    if (lines.length >= 100) {
      setErrorMsg("Maximum 100 item lines are allowed per bill.");
      return;
    }
    setErrorMsg("");
    setLines((prev) => [...prev, createBlankLine()]);
  };

  const handlePickSavedItem = (item: SavedMenuItem) => {
    setErrorMsg("");
    setLines((prev) => {
      const nextLine: DraftLine = {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: item.name.slice(0, 120),
        priceInput: String(item.price),
        qtyInput: "1",
        menu_item_id: item.id,
      };
      if (
        prev.length === 1 &&
        !prev[0].name.trim() &&
        !prev[0].priceInput.trim()
      ) {
        return [nextLine];
      }
      if (prev.length >= 100) {
        setErrorMsg("Maximum 100 item lines are allowed per bill.");
        return prev;
      }
      return [...prev, nextLine];
    });
  };

  const handleRemoveLine = (key: string) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((l) => l.key !== key);
    });
  };

  // Client-side LIVE PREVIEW only (server computes authoritative amounts on Issue)
  const preview = useMemo(() => {
    let subtotal = 0;
    for (const line of lines) {
      const p = Number(line.priceInput);
      const q = Number(line.qtyInput);
      if (Number.isFinite(p) && p >= 0 && Number.isFinite(q) && q > 0) {
        subtotal += p * q;
      }
    }
    subtotal = Math.round(subtotal * 100) / 100;

    let discountAmount = 0;
    const rawDisc = Number(discountValueInput);
    if (discountType === "amount" && Number.isFinite(rawDisc) && rawDisc > 0) {
      discountAmount = Math.min(subtotal, Math.round(rawDisc * 100) / 100);
    } else if (discountType === "percent" && Number.isFinite(rawDisc) && rawDisc > 0) {
      const pct = Math.min(100, rawDisc);
      discountAmount = Math.round(((subtotal * pct) / 100) * 100) / 100;
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const scPctNum = Number(serviceChargeInput);
    const scPct =
      serviceChargeInput.trim() !== "" &&
      Number.isFinite(scPctNum) &&
      scPctNum > 0 &&
      scPctNum <= 30
        ? scPctNum
        : 0;
    const serviceCharge = Math.round(((afterDiscount * scPct) / 100) * 100) / 100;

    const rawTotal = afterDiscount + serviceCharge;
    const roundedTotal = billingSettings.round_off ? Math.round(rawTotal) : Math.round(rawTotal * 100) / 100;
    const roundOffDelta = Math.round((roundedTotal - rawTotal) * 100) / 100;

    return {
      subtotal,
      discountAmount,
      serviceChargePct: scPct,
      serviceCharge,
      roundOffDelta,
      estimatedTotal: roundedTotal,
    };
  }, [lines, discountType, discountValueInput, serviceChargeInput, billingSettings.round_off]);

  const exchangeCredit = exchange?.creditValue || 0;
  const netAfterDiscount = Math.max(0, preview.subtotal - preview.discountAmount);
  const payableY = exchange ? Math.max(0, netAfterDiscount - exchangeCredit) : preview.estimatedTotal;
  const balanceZ = exchange ? Math.max(0, exchangeCredit - netAfterDiscount) : 0;
  const exchangeUnderpaid = Boolean(exchange && !exchange.creditNoteAllowed && balanceZ > 0);

  // Credit Note calculations
  const creditBalance = selectedCreditNote?.balance || 0;
  const creditApplied = selectedCreditNote ? Math.min(creditBalance, netAfterDiscount) : 0;
  const creditPayableY = selectedCreditNote
    ? Math.max(0, netAfterDiscount - creditBalance)
    : preview.estimatedTotal;
  const creditBalanceRemaining = selectedCreditNote
    ? Math.max(0, creditBalance - netAfterDiscount)
    : 0;

  const validateAndBuildPayload = (paymentMethod?: PaymentMethod) => {
    if (lines.length < 1 || lines.length > 100) {
      return { error: "Please add between 1 and 100 items." };
    }

    const manualItems: Array<{
      name: string;
      unit_price: number;
      quantity: number;
      menu_item_id?: string;
    }> = [];

    let subtotalCheck = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const name = l.name.trim();
      if (!name) {
        return { error: `Line ${i + 1}: Please enter an item name.` };
      }
      if (name.length > 120) {
        return { error: `Line ${i + 1}: Item name cannot exceed 120 characters.` };
      }
      if (l.priceInput.trim() === "") {
        return { error: `Line ${i + 1} (${name}): Please enter a price.` };
      }
      const price = Number(l.priceInput);
      if (!Number.isFinite(price) || price < 0 || !hasAtMostDecimals(price, 2)) {
        return {
          error: `Line ${i + 1} (${name}): Price must be 0 or more with at most 2 decimals.`,
        };
      }
      const qty = Number(l.qtyInput);
      if (!Number.isFinite(qty) || qty <= 0 || !hasAtMostDecimals(qty, 3)) {
        return {
          error: `Line ${i + 1} (${name}): Quantity must be greater than 0 with at most 3 decimals.`,
        };
      }
      subtotalCheck += price * qty;
      manualItems.push({
        name,
        unit_price: Math.round(price * 100) / 100,
        quantity: Number(qty.toFixed(3)),
        ...(l.menu_item_id ? { menu_item_id: l.menu_item_id } : {}),
      });
    }

    subtotalCheck = Math.round(subtotalCheck * 100) / 100;

    const args: Record<string, any> = {
      p_business_id: businessId,
      p_manual_items: manualItems,
    };

    if (exchange) {
      args.p_original_bill_id = exchange.billId;
      args.p_return_lines = exchange.returnLines;
      if (exchange.reason) {
        args.p_reason = exchange.reason;
      }
    } else if (selectedCreditNote) {
      args.p_credit_note_id = selectedCreditNote.id;
    }

    const cleanCustomerName = customerName.trim();
    if (cleanCustomerName) {
      args.p_customer_name = cleanCustomerName;
    }

    const cleanCustomerPhone = customerPhone.trim();
    if (cleanCustomerPhone) {
      args.p_customer_phone = cleanCustomerPhone;
    }

    if (discountType !== "none") {
      const discVal = Number(discountValueInput);
      if (!discountValueInput.trim() || !Number.isFinite(discVal) || discVal <= 0) {
        return { error: "Enter a discount value greater than 0, or set discount to None." };
      }
      if (discountType === "amount") {
        if (!hasAtMostDecimals(discVal, 2)) {
          return { error: "Discount amount can have at most 2 decimals." };
        }
        if (discVal > subtotalCheck) {
          return { error: "Discount amount cannot exceed the subtotal." };
        }
      } else if (discountType === "percent") {
        if (discVal > 100) {
          return { error: "Discount percent cannot exceed 100%." };
        }
      }
      args.p_discount_type = discountType;
      args.p_discount_value = discVal;
      const cleanNote = discountNote.trim();
      if (cleanNote) {
        args.p_discount_note = cleanNote;
      }
    }

    const scTrim = serviceChargeInput.trim();
    if (scTrim !== "" && !exchange) {
      const sc = Number(scTrim);
      if (!Number.isFinite(sc) || sc < 0 || sc > 30) {
        return { error: "Service charge % must be between 0 and 30." };
      }
      args.p_service_charge_pct = Math.round(sc * 100) / 100;
    }

    if (paymentMethod && (!exchange || payableY > 0)) {
      args.p_payment_method = paymentMethod;
    }

    return { args };
  };

  const submitBill = async (paymentMethod?: PaymentMethod) => {
    if (submittingRef.current || issuing) return;
    setErrorMsg("");

    const isExchange = Boolean(exchange);
    const rpcName = isExchange ? "create_tapx_exchange" : "create_tapx_bill";

    const isUpiCollect = paymentMethod === "upi" && Boolean(upiQrEnabled);
    const isCreditFull = Boolean(selectedCreditNote && creditPayableY === 0);
    const check = validateAndBuildPayload(
      isUpiCollect || (isExchange && payableY === 0) || isCreditFull ? undefined : paymentMethod
    );
    if ("error" in check) {
      setErrorMsg(check.error || "Please check your entries.");
      return;
    }

    submittingRef.current = true;
    setIssuing(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc(
        rpcName,
        check.args
      );
      if (rpcErr) {
        setErrorMsg(rpcErr.message || "Failed to issue bill.");
        return;
      }

      if (isExchange) {
        const billObj = data?.bill;
        const billId = billObj?.id ? String(billObj.id) : "";
        if (!billId) {
          setErrorMsg("Exchange bill was created without an ID. Please refresh the bills list.");
          return;
        }
        await onIssued(billId, {
          collectUpi: isUpiCollect,
          creditNote: data?.credit_note || null,
        });
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        const billId = row?.id ? String(row.id) : "";
        if (!billId) {
          setErrorMsg("Bill was created without an ID. Please refresh the bills list.");
          return;
        }
        setSelectedCreditNote(null);
        await onIssued(billId, isUpiCollect ? { collectUpi: true } : undefined);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to issue bill.");
    } finally {
      submittingRef.current = false;
      setIssuing(false);
    }
  };

  return (
    <div className="quickbill-root" style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "160px" }}>
      {exchange && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            fontSize: "14px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div>
            Exchange for bill {exchange.billNo} — customer returns {formatMoney(exchange.creditValue)}
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              border: "1px solid #93c5fd",
              background: "#ffffff",
              color: "#1d4ed8",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
              minHeight: "44px",
            }}
          >
            Cancel exchange
          </button>
        </div>
      )}
      <style>{`
        .quickbill-item-row {
          padding: 10px;
          border-radius: 11px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        @media (min-width: 640px) {
          .quickbill-item-row {
            display: flex !important;
            align-items: flex-end !important;
            gap: 8px !important;
          }
          .quickbill-line1 {
            flex: 2 !important;
            min-width: 150px !important;
            display: flex !important;
            align-items: flex-end !important;
            gap: 8px !important;
          }
          .quickbill-line1-input-wrap {
            flex: 1 !important;
            min-width: 0 !important;
          }
          .quickbill-remove-mobile {
            display: none !important;
          }
          .quickbill-line2 {
            flex: 3 !important;
            display: flex !important;
            align-items: flex-end !important;
            gap: 8px !important;
          }
          .quickbill-line2-price {
            flex: 1 !important;
            min-width: 90px !important;
          }
          .quickbill-line2-qty {
            flex: 1 !important;
            min-width: 85px !important;
          }
          .quickbill-line2-total-wrap {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
          }
          .quickbill-line2-total-label {
            display: none !important;
          }
          .quickbill-line2-total {
            font-size: 13px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            min-width: 60px !important;
            text-align: right !important;
            height: 40px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
          }
          .quickbill-remove-desktop {
            display: block !important;
            width: 36px !important;
            height: 40px !important;
            border: 1px solid #fecaca !important;
            background: #fef2f2 !important;
            color: #dc2626 !important;
            border-radius: 8px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
          }
        }

        @media (max-width: 639px) {
          .quickbill-root input,
          .quickbill-root select,
          .quickbill-root textarea {
            font-size: 16px !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
          }
          .quickbill-item-row {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
          }
          .quickbill-line1 {
            display: flex !important;
            align-items: flex-end !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .quickbill-line1-input-wrap {
            flex: 1 !important;
            min-width: 0 !important;
          }
          .quickbill-remove-mobile {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-width: 40px !important;
            width: 40px !important;
            height: 40px !important;
            min-height: 40px !important;
            font-size: 16px !important;
            flex-shrink: 0 !important;
            border: 1px solid #fecaca !important;
            background: #fef2f2 !important;
            color: #dc2626 !important;
            border-radius: 8px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
          }
          .quickbill-line2 {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 8px !important;
            align-items: end !important;
            width: 100% !important;
          }
          .quickbill-line2-price,
          .quickbill-line2-qty,
          .quickbill-line2-total-wrap {
            min-width: 0 !important;
          }
          .quickbill-line2-total-wrap {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-end !important;
          }
          .quickbill-line2-total-label {
            display: block !important;
          }
          .quickbill-line2-total {
            font-size: 14px !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            text-align: right !important;
            white-space: nowrap !important;
            height: 40px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .quickbill-remove-desktop {
            display: none !important;
          }
        }
      `}</style>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "#64748b" }}>
            QUICK BILL
          </div>
          <h2 style={{ margin: "2px 0 0", fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>
            New Bill
          </h2>
        </div>
        <button
          type="button"
          disabled={issuing}
          onClick={onCancel}
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#1e293b",
            borderRadius: "10px",
            padding: "9px 14px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← Back to bills
        </button>
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

      {/* SAVED ITEMS PICKER (only when business has digital_menu items) */}
      {savedItems.length > 0 && (
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <strong style={{ fontSize: "14px", color: "#0f172a" }}>
              Tap a menu item to add ({savedItems.length})
            </strong>
            <input
              type="search"
              value={itemSearch}
              disabled={issuing}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search menu items..."
              style={{
                width: "220px",
                maxWidth: "100%",
                padding: "8px 11px",
                borderRadius: "9px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                background: "#f8fafc",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              maxHeight: "170px",
              overflowY: "auto",
            }}
          >
            {filteredSavedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={issuing}
                onClick={() => handlePickSavedItem(item)}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  minHeight: "40px",
                }}
              >
                <span>+ {item.name}</span>
                <span style={{ color: "#15803d", fontWeight: 700 }}>
                  {formatMoney(item.price)}
                </span>
              </button>
            ))}
            {filteredSavedItems.length === 0 && (
              <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                No matching menu items. You can still type any custom item below.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ITEM LINES */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <strong style={{ fontSize: "15px", color: "#0f172a" }}>
            Bill Items ({lines.length}/100)
          </strong>
          <button
            type="button"
            disabled={issuing || lines.length >= 100}
            onClick={handleAddBlankLine}
            style={{
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#ffffff",
              borderRadius: "9px",
              padding: "8px 13px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Add item
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {lines.map((line, index) => {
            const p = Number(line.priceInput);
            const q = Number(line.qtyInput);
            const estLine =
              Number.isFinite(p) && p >= 0 && Number.isFinite(q) && q > 0 ? p * q : 0;
            return (
              <div
                key={line.key}
                className="quickbill-item-row"
              >
                {/* Line 1 on phone (<640px) */}
                <div className="quickbill-line1">
                  <div className="quickbill-line1-input-wrap">
                    <label style={miniLabelStyle}>Item {index + 1}</label>
                    <input
                      type="text"
                      maxLength={120}
                      disabled={issuing}
                      value={line.name}
                      onChange={(e) =>
                        updateLine(line.key, {
                          name: e.target.value,
                          menu_item_id: undefined,
                        })
                      }
                      placeholder="Item name"
                      style={fieldStyle}
                    />
                  </div>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      disabled={issuing}
                      onClick={() => handleRemoveLine(line.key)}
                      aria-label={`Remove line ${index + 1}`}
                      className="quickbill-remove-mobile"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Line 2 on phone (<640px) */}
                <div className="quickbill-line2">
                  <div className="quickbill-line2-price">
                    <label style={miniLabelStyle}>Price</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={issuing}
                      value={line.priceInput}
                      onChange={(e) => updateLine(line.key, { priceInput: e.target.value })}
                      placeholder="0"
                      style={fieldStyle}
                    />
                  </div>
                  <div className="quickbill-line2-qty">
                    <label style={miniLabelStyle}>Qty</label>
                    <input
                      type="number"
                      min={0.001}
                      step="any"
                      disabled={issuing}
                      value={line.qtyInput}
                      onChange={(e) => updateLine(line.key, { qtyInput: e.target.value })}
                      placeholder="1"
                      style={fieldStyle}
                    />
                  </div>
                  <div className="quickbill-line2-total-wrap">
                    <label style={miniLabelStyle} className="quickbill-line2-total-label">Total</label>
                    <div className="quickbill-line2-total">
                      {formatMoney(estLine)}
                    </div>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        disabled={issuing}
                        onClick={() => handleRemoveLine(line.key)}
                        aria-label={`Remove line ${index + 1}`}
                        className="quickbill-remove-desktop"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CUSTOMER, DISCOUNT & SERVICE CHARGE */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "14px",
        }}
      >
        <div style={cardStyle}>
          <strong style={{ fontSize: "14px", color: "#0f172a", display: "block", marginBottom: "10px" }}>
            Customer (optional)
          </strong>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <label style={miniLabelStyle}>Customer Name</label>
              <input
                type="text"
                maxLength={100}
                disabled={issuing}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional name"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={miniLabelStyle}>Phone</label>
              <input
                type="tel"
                maxLength={20}
                disabled={issuing}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Optional phone"
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <strong style={{ fontSize: "14px", color: "#0f172a", display: "block", marginBottom: "10px" }}>
            Discount &amp; Service Charge
          </strong>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label style={miniLabelStyle}>Discount Type</label>
                <select
                  value={discountType}
                  disabled={issuing}
                  onChange={(e) => {
                    const v = e.target.value as "none" | "amount" | "percent";
                    setDiscountType(v);
                    if (v === "none") {
                      setDiscountValueInput("");
                      setDiscountNote("");
                    }
                  }}
                  style={fieldStyle}
                >
                  <option value="none">No discount</option>
                  <option value="amount">Flat amount</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </div>
              <div>
                <label style={miniLabelStyle}>
                  {discountType === "percent" ? "Percent %" : "Amount"}
                </label>
                <input
                  type="number"
                  min={0}
                  max={discountType === "percent" ? 100 : undefined}
                  step="0.01"
                  disabled={issuing || discountType === "none"}
                  value={discountValueInput}
                  onChange={(e) => setDiscountValueInput(e.target.value)}
                  placeholder="0"
                  style={fieldStyle}
                />
              </div>
            </div>
            {discountType !== "none" && (
              <div>
                <label style={miniLabelStyle}>Discount Note (optional)</label>
                <input
                  type="text"
                  maxLength={80}
                  disabled={issuing}
                  value={discountNote}
                  onChange={(e) => setDiscountNote(e.target.value)}
                  placeholder="e.g. Festival 10%"
                  style={fieldStyle}
                />
              </div>
            )}
            <div>
              <label style={miniLabelStyle}>Service Charge % (0–30)</label>
              <input
                type="number"
                min={0}
                max={30}
                step="0.01"
                disabled={issuing}
                value={serviceChargeInput}
                onChange={(e) => setServiceChargeInput(e.target.value)}
                placeholder="0"
                style={fieldStyle}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ESTIMATED PREVIEW */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <strong style={{ fontSize: "14px", color: "#0f172a" }}>Estimated Summary</strong>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#475569",
              background: "#f1f5f9",
              padding: "3px 8px",
              borderRadius: "99px",
            }}
          >
            Estimated — final total calculated by server
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13.5px", color: "#334155" }}>
          <div style={summaryRowStyle}>
            <span>{exchange ? "New items total" : "Subtotal"}</span>
            <span>{formatMoney(preview.subtotal)}</span>
          </div>
          {preview.discountAmount > 0 && (
            <div style={{ ...summaryRowStyle, color: "#15803d" }}>
              <span>Discount</span>
              <span>-{formatMoney(preview.discountAmount)}</span>
            </div>
          )}
          {canUseCreditNote && (
            <div
              style={{
                ...summaryRowStyle,
                padding: "6px 0",
                borderTop: "1px dashed #e2e8f0",
                borderBottom: "1px dashed #e2e8f0",
                margin: "4px 0",
              }}
            >
              <span style={{ fontWeight: 600, color: "#0f172a" }}>Credit note</span>
              {selectedCreditNote ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#0284c7", fontWeight: 700 }}>
                    {selectedCreditNote.note_no_text} - {formatMoney(creditApplied)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCreditNote(null)}
                    style={{
                      background: "#fee2e2",
                      color: "#991b1b",
                      border: 0,
                      borderRadius: "6px",
                      padding: "3px 8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      minHeight: "28px",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreditNotePicker(true)}
                  style={{
                    background: "#f1f5f9",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    minHeight: "36px",
                  }}
                >
                  Use credit note
                </button>
              )}
            </div>
          )}
          {exchange && (
            <div style={{ ...summaryRowStyle, color: "#0284c7" }}>
              <span>Returned items credit</span>
              <span>-{formatMoney(exchangeCredit)}</span>
            </div>
          )}
          {preview.serviceCharge > 0 && !exchange && (
            <div style={summaryRowStyle}>
              <span>Service charge ({preview.serviceChargePct}%)</span>
              <span>{formatMoney(preview.serviceCharge)}</span>
            </div>
          )}
          {preview.roundOffDelta !== 0 && !exchange && !selectedCreditNote && (
            <div style={summaryRowStyle}>
              <span>Estimated round-off</span>
              <span>
                {preview.roundOffDelta > 0 ? `+${formatMoney(preview.roundOffDelta)}` : `-${formatMoney(Math.abs(preview.roundOffDelta))}`}
              </span>
            </div>
          )}
          <div
            style={{
              ...summaryRowStyle,
              borderTop: "1px solid #e2e8f0",
              paddingTop: "8px",
              marginTop: "4px",
              fontSize: "17px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            <span>{exchange || selectedCreditNote ? "Customer pays" : "Estimated Total"}</span>
            <span>{formatMoney(exchange ? payableY : selectedCreditNote ? creditPayableY : preview.estimatedTotal)}</span>
          </div>

          {selectedCreditNote && creditBalanceRemaining > 0 && (
            <div style={{ marginTop: "6px", fontSize: "12.5px", color: "#0284c7", fontWeight: 600 }}>
              {formatMoney(creditBalanceRemaining)} will stay on the credit note.
            </div>
          )}

          {exchange && balanceZ > 0 && (
            <div style={{ marginTop: "6px" }}>
              {exchange.creditNoteAllowed ? (
                <div style={{ fontSize: "12.5px", color: "#0284c7", fontWeight: 600 }}>
                  {formatMoney(balanceZ)} will stay as a credit note for the customer.
                </div>
              ) : (
                <div style={{ fontSize: "12.5px", color: "#d97706", fontWeight: 700 }}>
                  Add items worth at least {formatMoney(balanceZ)} more.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* STICKY BOTTOM BAR */}
      <div
        style={{
          position: "sticky",
          bottom: "12px",
          zIndex: 20,
          background: "#0f172a",
          color: "#ffffff",
          borderRadius: "14px",
          padding: "12px 16px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          boxShadow: "0 14px 32px rgba(15, 23, 42, 0.24)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>
              {exchange || selectedCreditNote ? "CUSTOMER PAYS" : "ESTIMATED TOTAL"}
            </div>
            <div style={{ fontSize: "20px", fontWeight: 800 }}>
              {formatMoney(exchange ? payableY : selectedCreditNote ? creditPayableY : preview.estimatedTotal)}
            </div>
          </div>

          {exchange && payableY === 0 ? (
            <button
              type="button"
              disabled={issuing || exchangeUnderpaid}
              onClick={() => void submitBill()}
              style={{
                border: 0,
                background: "#22c55e",
                color: "#052e16",
                borderRadius: "10px",
                padding: "12px 18px",
                fontSize: "14px",
                fontWeight: 800,
                cursor: issuing || exchangeUnderpaid ? "not-allowed" : "pointer",
                opacity: issuing || exchangeUnderpaid ? 0.5 : 1,
                minHeight: "46px",
              }}
            >
              {issuing ? "Completing exchange..." : "Complete exchange"}
            </button>
          ) : selectedCreditNote && creditPayableY === 0 ? (
            <button
              type="button"
              disabled={issuing}
              onClick={() => void submitBill()}
              style={{
                border: 0,
                background: "#22c55e",
                color: "#052e16",
                borderRadius: "10px",
                padding: "12px 18px",
                fontSize: "14px",
                fontWeight: 800,
                cursor: issuing ? "not-allowed" : "pointer",
                opacity: issuing ? 0.5 : 1,
                minHeight: "46px",
              }}
            >
              {issuing ? "Completing sale..." : "Complete sale"}
            </button>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                type="button"
                disabled={issuing || exchangeUnderpaid}
                onClick={() => {
                  setShowPaidChooser(false);
                  void submitBill();
                }}
                style={{
                  border: "1px solid rgba(255,255,255,0.28)",
                  background: "rgba(255,255,255,0.12)",
                  color: "#ffffff",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: issuing || exchangeUnderpaid ? "not-allowed" : "pointer",
                  opacity: issuing || exchangeUnderpaid ? 0.5 : 1,
                  minHeight: "46px",
                }}
              >
                {issuing ? "Issuing..." : "Issue bill"}
              </button>

              <button
                type="button"
                disabled={issuing || exchangeUnderpaid}
                onClick={() => setShowPaidChooser((v) => !v)}
                style={{
                  border: 0,
                  background: "#22c55e",
                  color: "#052e16",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: issuing || exchangeUnderpaid ? "not-allowed" : "pointer",
                  opacity: issuing || exchangeUnderpaid ? 0.5 : 1,
                  minHeight: "46px",
                }}
              >
                {issuing ? "Issuing..." : "Issue & mark paid"}
              </button>
            </div>
          )}
        </div>

        {showPaidChooser && !issuing && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "8px",
              paddingTop: "8px",
              borderTop: "1px solid rgba(255,255,255,0.14)",
            }}
          >
            <span style={{ fontSize: "12.5px", color: "#cbd5e1", fontWeight: 600 }}>
              Paid via:
            </span>
            {(["cash", "upi", "card"] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                disabled={issuing}
                onClick={() => void submitBill(method)}
                style={{
                  border: 0,
                  background: "#ffffff",
                  color: "#0f172a",
                  borderRadius: "9px",
                  padding: "9px 15px",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  minHeight: "40px",
                }}
              >
                {method === "upi" ? "UPI" : method === "cash" ? "Cash" : "Card"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Credit Note Picker Bottom Sheet / Modal */}
      <CreditNotePickerSheet
        businessId={businessId}
        isOpen={showCreditNotePicker}
        onClose={() => setShowCreditNotePicker(false)}
        onSelect={(note) => {
          setSelectedCreditNote(note);
        }}
      />
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "14px 16px",
};

const miniLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  color: "#64748b",
  marginBottom: "4px",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "9px 10px",
  borderRadius: "9px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "13.5px",
  fontWeight: 500,
  boxSizing: "border-box",
  minHeight: "40px",
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
};
