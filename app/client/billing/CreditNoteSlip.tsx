"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  BillingBusinessProfile,
  BillingPaperSize,
  formatBillDateTime,
  formatMoney,
} from "../../lib/billing";

interface CreditNoteSlipProps {
  creditNoteId: string;
  business: BillingBusinessProfile | null;
  paper?: BillingPaperSize;
  originalBillNo?: string | null;
  onClose?: () => void;
}

function formatExpiryDate(dateStr?: string | null): string {
  if (!dateStr) return "No expiry";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function CreditNoteSlip({
  creditNoteId,
  business,
  paper = "80mm",
  originalBillNo,
  onClose,
}: CreditNoteSlipProps) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [note, setNote] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [billNo, setBillNo] = useState<string>(originalBillNo || "");

  useEffect(() => {
    let active = true;
    async function fetchNoteData() {
      setLoading(true);
      setErrorMsg("");
      try {
        const { data: noteData, error: noteErr } = await supabase
          .from("tapx_credit_notes")
          .select("*")
          .eq("id", creditNoteId)
          .single();

        if (noteErr) throw noteErr;
        if (!active) return;
        setNote(noteData);

        const { data: itemsData, error: itemsErr } = await supabase
          .from("tapx_credit_note_items")
          .select("*")
          .eq("credit_note_id", creditNoteId);

        if (itemsErr) throw itemsErr;
        if (!active) return;
        setItems(itemsData || []);

        if (!originalBillNo && noteData?.original_bill_id) {
          const { data: billData } = await supabase
            .from("tapx_bills")
            .select("bill_no_text")
            .eq("id", noteData.original_bill_id)
            .maybeSingle();

          if (active && billData?.bill_no_text) {
            setBillNo(billData.bill_no_text);
          }
        }
      } catch (err: any) {
        if (active) {
          setErrorMsg(err?.message || "Failed to load credit note.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (creditNoteId) {
      void fetchNoteData();
    }
    return () => {
      active = false;
    };
  }, [creditNoteId, originalBillNo]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const pageCssRule =
    paper === "58mm"
      ? "@page { size: 58mm auto; margin: 3mm; }"
      : paper === "a4"
      ? "@page { size: A4; margin: 12mm; }"
      : "@page { size: 80mm auto; margin: 4mm; }";

  const sheetWidthStyle: React.CSSProperties =
    paper === "58mm"
      ? { width: "100%", maxWidth: "240px" }
      : paper === "a4"
      ? { width: "100%", maxWidth: "740px" }
      : { width: "100%", maxWidth: "330px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <style>{`
        ${pageCssRule}
        @media print {
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          .portal .sidebar,
          .portal .topbar,
          .portal .mobile-overlay,
          .tapx-bill-no-print {
            display: none !important;
          }
          .portal .main {
            margin-left: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .tapx-bill-print-sheet,
          .tapx-bill-print-sheet * {
            visibility: visible !important;
          }
          .tapx-bill-print-sheet {
            margin: 0 auto !important;
            max-width: 100% !important;
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}</style>

      {/* Screen-only action bar */}
      <div
        className="tapx-bill-no-print"
        style={{
          boxSizing: "border-box",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "12px 14px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            borderRadius: "10px",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            minHeight: "44px",
          }}
        >
          ← Back
        </button>

        <button
          type="button"
          onClick={handlePrint}
          disabled={loading || Boolean(errorMsg)}
          style={{
            border: 0,
            background: "#0f172a",
            color: "#ffffff",
            borderRadius: "10px",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            minHeight: "44px",
          }}
        >
          🖨️ Print slip
        </button>
      </div>

      {loading && (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            color: "#64748b",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Loading credit note...
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && note && (
        <div
          className="tapx-bill-print-sheet"
          style={{
            ...sheetWidthStyle,
            boxSizing: "border-box",
            margin: "0 auto",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: paper === "a4" ? "28px" : "16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
            color: "#0f172a",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: paper === "58mm" ? "11px" : "12.5px",
            lineHeight: 1.4,
          }}
        >
          {/* Shop Header */}
          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <div style={{ fontSize: "1.25em", fontWeight: 800, color: "#0f172a" }}>
              {business?.name || "Store"}
            </div>
            {business?.address && (
              <div style={{ fontSize: "0.9em", color: "#475569", marginTop: "2px", whiteSpace: "pre-wrap" }}>
                {business.address}
              </div>
            )}
            {business?.phone && (
              <div style={{ fontSize: "0.9em", color: "#475569", marginTop: "2px" }}>
                Phone: {business.phone}
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px dashed #94a3b8", margin: "8px 0" }} />

          {/* Heading */}
          <div style={{ textAlign: "center", margin: "6px 0" }}>
            <div
              style={{
                fontSize: "1.15em",
                fontWeight: 900,
                letterSpacing: "0.08em",
                color: "#0f172a",
              }}
            >
              CREDIT NOTE
            </div>
            <div style={{ fontSize: "1.05em", fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>
              {note.note_no_text}
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #94a3b8", margin: "8px 0" }} />

          {/* Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "0.92em" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
              <span style={{ color: "#64748b" }}>Date:</span>
              <span>{formatBillDateTime(note.created_at)}</span>
            </div>

            {(billNo || note.original_bill_id) && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                <span style={{ color: "#64748b" }}>Against Bill:</span>
                <span style={{ fontWeight: 600 }}>{billNo || note.original_bill_id}</span>
              </div>
            )}

            {(note.customer_name || note.customer_phone) && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                <span style={{ color: "#64748b" }}>Customer:</span>
                <span style={{ fontWeight: 600 }}>
                  {[note.customer_name, note.customer_phone].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}

            {note.reason && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                <span style={{ color: "#64748b" }}>Reason:</span>
                <span style={{ textAlign: "right", maxWidth: "65%", wordBreak: "break-word" }}>
                  {note.reason}
                </span>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px dashed #94a3b8", margin: "8px 0" }} />

          {/* Items Table */}
          <div style={{ margin: "6px 0" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "8px",
                fontWeight: 700,
                fontSize: "0.88em",
                color: "#475569",
                borderBottom: "1px dashed #cbd5e1",
                paddingBottom: "4px",
                marginBottom: "4px",
              }}
            >
              <span>ITEM</span>
              <span style={{ textAlign: "right" }}>QTY</span>
              <span style={{ textAlign: "right" }}>CREDIT</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {items.map((item, idx) => {
                const name = item.item_name || item.name || `Item ${idx + 1}`;
                const qty = item.quantity ?? item.qty ?? 1;
                const creditAmt =
                  item.credit_amount ??
                  item.amount ??
                  ((item.credit_per_unit || 0) * (item.quantity || 1));
                return (
                  <div
                    key={item.id || idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: "8px",
                      fontSize: "0.92em",
                      alignItems: "baseline",
                    }}
                  >
                    <span style={{ wordBreak: "break-word" }}>{name}</span>
                    <span style={{ textAlign: "right" }}>{qty}</span>
                    <span style={{ textAlign: "right", fontWeight: 600 }}>
                      {formatMoney(creditAmt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #94a3b8", margin: "8px 0" }} />

          {/* Totals */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "6px 0" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontSize: "1.1em",
                fontWeight: 800,
              }}
            >
              <span>TOTAL CREDIT</span>
              <span>{formatMoney(note.amount)}</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.9em",
                color: "#475569",
                marginTop: "2px",
              }}
            >
              <span>Validity:</span>
              <span style={{ fontWeight: 600 }}>
                {note.expires_on ? `Valid until ${formatExpiryDate(note.expires_on)}` : "No expiry"}
              </span>
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #94a3b8", margin: "8px 0" }} />

          {/* Footer Notice */}
          <div
            style={{
              textAlign: "center",
              fontSize: "0.85em",
              color: "#64748b",
              marginTop: "6px",
              lineHeight: 1.35,
            }}
          >
            Valid for use at this shop only.
          </div>
        </div>
      )}
    </div>
  );
}
