"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  BillingBusinessProfile,
  BillingPaperSize,
  BillingSettings,
  BillPaymentStatus,
  BillStatus,
  PaymentMethod,
  PublicBillPayload,
  TapxBill,
  TapxBillItem,
  buildUpiPayUri,
  buildWhatsAppShareUrl,
  formatBillDateTime,
  formatBillPaymentLabel,
  formatMoney,
  formatQuantity,
  formatSignedMoney,
} from "../../lib/billing";
import {
  downloadPdfBlob,
  generateBillPdfBlob,
  getBillPdfFileName,
  sharePdfOnWhatsApp,
} from "../../lib/billPdf";

export type BillDocumentData = {
  id?: string;
  bill_no_text: string;
  status: BillStatus;
  created_at: string;
  bill_day: string;
  table_number: number | null;
  customer_name: string | null;
  customer_phone?: string | null;
  subtotal: number;
  discount_amount: number;
  discount_note: string | null;
  service_charge_pct: number;
  service_charge: number;
  tax_mode: string | null;
  tax_total: number;
  round_off: number;
  total: number;
  payment_status: BillPaymentStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  void_reason?: string | null;
  voided_at?: string | null;
  notes?: string | null;
  share_token?: string;
  items: Array<{
    item_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }>;
  business: BillingBusinessProfile;
  settings: {
    paper: BillingPaperSize;
    footer: string;
    show_upi_qr: boolean;
    show_logo: boolean;
  };
};

export function toBillDocumentDataFromDashboard(
  bill: TapxBill,
  items: TapxBillItem[],
  business: BillingBusinessProfile,
  settings: BillingSettings
): BillDocumentData {
  return {
    id: bill.id,
    bill_no_text: bill.bill_no_text,
    status: bill.status,
    created_at: bill.created_at,
    bill_day: bill.bill_day,
    table_number: bill.table_number,
    customer_name: bill.customer_name,
    customer_phone: bill.customer_phone,
    subtotal: Number(bill.subtotal || 0),
    discount_amount: Number(bill.discount_amount || 0),
    discount_note: bill.discount_note,
    service_charge_pct: Number(bill.service_charge_pct || 0),
    service_charge: Number(bill.service_charge || 0),
    tax_mode: bill.tax_mode,
    tax_total: Number(bill.tax_total || 0),
    round_off: Number(bill.round_off || 0),
    total: Number(bill.total || 0),
    payment_status: bill.payment_status,
    payment_method: bill.payment_method,
    paid_at: bill.paid_at,
    void_reason: bill.void_reason,
    voided_at: bill.voided_at,
    notes: bill.notes,
    share_token: bill.share_token,
    items: (items || []).map((item) => ({
      item_name: item.item_name,
      unit_price: Number(item.unit_price || 0),
      quantity: Number(item.quantity || 0),
      line_total: Number(item.line_total || 0),
    })),
    business,
    settings: {
      paper: settings.paper,
      footer: settings.footer,
      show_upi_qr: settings.show_upi_qr,
      show_logo: settings.show_logo,
    },
  };
}

export function toBillDocumentDataFromPublic(
  payload: PublicBillPayload,
  shareToken: string
): BillDocumentData {
  const paperRaw = String(payload.settings?.paper || "").toLowerCase();
  const paper: BillingPaperSize =
    paperRaw === "58mm" || paperRaw === "a4" ? paperRaw : "80mm";
  return {
    bill_no_text: payload.bill_no_text,
    status: payload.status,
    created_at: payload.created_at,
    bill_day: payload.bill_day,
    table_number: payload.table_number,
    customer_name: payload.customer_name,
    customer_phone: null,
    subtotal: Number(payload.subtotal || 0),
    discount_amount: Number(payload.discount_amount || 0),
    discount_note: payload.discount_note,
    service_charge_pct: Number(payload.service_charge_pct || 0),
    service_charge: Number(payload.service_charge || 0),
    tax_mode: payload.tax_mode,
    tax_total: Number(payload.tax_total || 0),
    round_off: Number(payload.round_off || 0),
    total: Number(payload.total || 0),
    payment_status: payload.payment_status,
    payment_method: payload.payment_method,
    paid_at: payload.paid_at,
    share_token: shareToken,
    items: (payload.items || []).map((item) => ({
      item_name: item.item_name,
      unit_price: Number(item.unit_price || 0),
      quantity: Number(item.quantity || 0),
      line_total: Number(item.line_total || 0),
    })),
    business: payload.business || { name: "" },
    settings: {
      paper,
      footer: typeof payload.settings?.footer === "string" ? payload.settings.footer : "",
      show_upi_qr: payload.settings?.show_upi_qr !== false,
      show_logo: payload.settings?.show_logo !== false,
    },
  };
}

type Props = {
  data: BillDocumentData;
  mode: "dashboard" | "public";
  onBack?: () => void;
  onMarkPaid?: (method: PaymentMethod) => Promise<void>;
  onMarkUnpaid?: () => Promise<void>;
  onVoid?: (reason: string) => Promise<void>;
};

export default function BillDocument({
  data,
  mode,
  onBack,
  onMarkPaid,
  onMarkUnpaid,
  onVoid,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPayChooser, setShowPayChooser] = useState(false);
  const [showVoidBox, setShowVoidBox] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfInstruction, setPdfInstruction] = useState("");

  const paper = data.settings.paper || "80mm";
  const isThermal = paper === "80mm" || paper === "58mm";
  const isVoid = data.status === "void";
  const cleanUpiId = (data.business?.upi_id || "").trim();
  const shouldShowUpiQr =
    data.payment_status === "unpaid" &&
    data.settings.show_upi_qr &&
    Boolean(cleanUpiId) &&
    data.status === "issued";

  const publicUrl =
    typeof window !== "undefined"
      ? data.share_token
        ? `${window.location.origin}/bill/${data.share_token}`
        : window.location.href
      : "";

  const addressParts = [
    data.business?.address?.trim(),
    data.business?.city?.trim(),
    data.business?.state?.trim(),
  ].filter(Boolean);

  // Generate UPI QR data URL for unpaid issued bills when enabled & business has UPI ID
  useEffect(() => {
    let active = true;
    if (!shouldShowUpiQr) {
      setQrDataUrl("");
      return;
    }
    const upiUri = buildUpiPayUri({
      upiId: cleanUpiId,
      businessName: data.business?.name || "Business",
      total: data.total,
      billNoText: data.bill_no_text,
    });
    QRCode.toDataURL(upiUri, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [shouldShowUpiQr, cleanUpiId, data.business?.name, data.total, data.bill_no_text]);

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

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCopyLink = async () => {
    if (!publicUrl || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    setActionError("");
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      setActionError("Could not copy the bill link automatically.");
    }
  };

  // Pre-generate vector PDF Blob in background on view open
  useEffect(() => {
    let active = true;
    setPdfGenerating(true);
    generateBillPdfBlob(data, { mode })
      .then((blob) => {
        if (active) {
          setPdfBlob(blob);
          setPdfGenerating(false);
        }
      })
      .catch((err) => {
        console.error("Failed to generate bill PDF in background:", err);
        if (active) {
          setPdfGenerating(false);
        }
      });
    return () => {
      active = false;
    };
  }, [data, mode]);

  const handleDownloadPdf = async () => {
    const fileName = getBillPdfFileName(data.bill_no_text);
    if (pdfBlob) {
      downloadPdfBlob(pdfBlob, fileName);
      return;
    }
    setPdfGenerating(true);
    try {
      const blob = await generateBillPdfBlob(data, { mode });
      setPdfBlob(blob);
      downloadPdfBlob(blob, fileName);
    } catch (err: any) {
      setActionError(err?.message || "Could not generate PDF. Please try again.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleSendPdfWhatsApp = async () => {
    const fileName = getBillPdfFileName(data.bill_no_text);
    let blob = pdfBlob;
    if (!blob) {
      setPdfGenerating(true);
      try {
        blob = await generateBillPdfBlob(data, { mode });
        setPdfBlob(blob);
      } catch (err: any) {
        setActionError(err?.message || "Could not generate PDF. Please try again.");
        setPdfGenerating(false);
        return;
      } finally {
        setPdfGenerating(false);
      }
    }
    if (!blob) return;

    const baseMessage = `${data.business?.name || "Business"} - Bill ${data.bill_no_text}\nTotal: ${formatMoney(data.total)}`;
    await sharePdfOnWhatsApp({
      blob,
      fileName,
      messageText: baseMessage,
      customerPhone: data.customer_phone,
      onInstructionNeeded: (name) => {
        setPdfInstruction(`PDF downloaded. In WhatsApp, tap the paperclip → Document and choose ${name}.`);
      },
    });
  };

  const handleWhatsAppShare = () => {
    if (!publicUrl || typeof window === "undefined") return;
    const url = buildWhatsAppShareUrl({
      businessName: data.business?.name || "Business",
      billNoText: data.bill_no_text,
      total: data.total,
      publicUrl,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const runAction = async (key: string, fn: () => Promise<void>) => {
    if (busyAction) return;
    setActionError("");
    setBusyAction(key);
    try {
      await fn();
      setShowPayChooser(false);
      setShowVoidBox(false);
      setVoidReason("");
    } catch (err: any) {
      setActionError(err?.message || "Action failed. Please try again.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleVoidSubmit = async () => {
    if (!onVoid) return;
    const trimmed = voidReason.trim();
    if (trimmed.length < 3 || trimmed.length > 200) {
      setActionError("Please enter a void reason (3 to 200 characters).");
      return;
    }
    await runAction("void", () => onVoid(trimmed));
  };

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

      {/* SCREEN-ONLY ACTION BAR */}
      <div
        className="tapx-bill-no-print"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {pdfInstruction && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              fontSize: "12.5px",
              color: "#1e40af",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <span>ℹ️ {pdfInstruction}</span>
            <button
              type="button"
              onClick={() => setPdfInstruction("")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#1e40af",
                fontWeight: 700,
                fontSize: "13px",
                padding: "2px 4px",
              }}
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            {mode === "dashboard" && onBack && (
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={onBack}
                style={btnSecondaryStyle}
              >
                ← Back to bills
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              title="Choose Save as PDF to make a PDF"
              style={btnPrimaryStyle}
            >
              🖨️ Print
            </button>

            <button
              type="button"
              disabled={pdfGenerating || Boolean(busyAction)}
              onClick={handleDownloadPdf}
              style={{
                ...btnSecondaryStyle,
                cursor: pdfGenerating ? "wait" : "pointer",
              }}
              title="Download vector PDF"
            >
              {pdfGenerating ? "⏳ Preparing PDF…" : "📥 Download PDF"}
            </button>

            {mode === "dashboard" && (
              <button
                type="button"
                onClick={handleSendPdfWhatsApp}
                disabled={Boolean(busyAction)}
                style={btnSecondaryStyle}
                title="Send PDF file on WhatsApp"
              >
                📄 Send PDF on WhatsApp
              </button>
            )}

            {mode === "dashboard" && (
              <button
                type="button"
                onClick={handleWhatsAppShare}
                style={btnSecondaryStyle}
                title="Send bill link on WhatsApp"
              >
                💬 Send link on WhatsApp
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              style={btnSecondaryStyle}
            >
              {copiedLink ? "✓ Link copied" : "🔗 Copy link"}
            </button>
          </div>

          {mode === "dashboard" && data.status === "issued" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              {data.payment_status === "paid" ? (
                onMarkUnpaid && (
                  <button
                    type="button"
                    disabled={Boolean(busyAction)}
                    onClick={() => runAction("unpaid", onMarkUnpaid)}
                    style={btnSecondaryStyle}
                  >
                    {busyAction === "unpaid" ? "Saving..." : "Mark unpaid"}
                  </button>
                )
              ) : (
                onMarkPaid && (
                  <button
                    type="button"
                    disabled={Boolean(busyAction)}
                    onClick={() => {
                      setShowVoidBox(false);
                      setShowPayChooser((v) => !v);
                    }}
                    style={btnSuccessStyle}
                  >
                    {busyAction === "paid" ? "Saving..." : "Mark paid"}
                  </button>
                )
              )}

              {onVoid && (
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => {
                    setShowPayChooser(false);
                    setShowVoidBox((v) => !v);
                  }}
                  style={btnDangerOutlineStyle}
                >
                  Void bill
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
          Tip: Choose <strong>Save as PDF</strong> in the Print dialog to save a PDF copy ({paper.toUpperCase()} layout).
        </div>

        {/* INLINE PAYMENT METHOD CHOOSER */}
        {mode === "dashboard" && showPayChooser && onMarkPaid && data.status === "issued" && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#166534", marginRight: "4px" }}>
              Select payment method:
            </span>
            {(["cash", "upi", "card"] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => runAction("paid", () => onMarkPaid(method))}
                style={btnSuccessStyle}
              >
                {method === "upi" ? "UPI" : method === "cash" ? "Cash" : "Card"}
              </button>
            ))}
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={() => setShowPayChooser(false)}
              style={btnSecondaryStyle}
            >
              Cancel
            </button>
          </div>
        )}

        {/* INLINE VOID CONFIRMATION */}
        {mode === "dashboard" && showVoidBox && onVoid && data.status === "issued" && (
          <div
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#991b1b" }}>
              Void this bill?
            </div>
            <div style={{ fontSize: "12px", color: "#7f1d1d" }}>
              The bill stays on record marked VOID. Its number is not reused.
            </div>
            <input
              type="text"
              value={voidReason}
              maxLength={200}
              disabled={Boolean(busyAction)}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding (3–200 characters)"
              style={{
                width: "100%",
                padding: "9px 10px",
                borderRadius: "8px",
                border: "1px solid #fca5a5",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={handleVoidSubmit}
                style={btnDangerStyle}
              >
                {busyAction === "void" ? "Voiding..." : "Confirm void"}
              </button>
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => {
                  setShowVoidBox(false);
                  setActionError("");
                }}
                style={btnSecondaryStyle}
              >
                Keep bill
              </button>
            </div>
          </div>
        )}

        {actionError && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: "8px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: "12.5px",
              fontWeight: 600,
            }}
          >
            {actionError}
          </div>
        )}
      </div>

      {/* PRINTABLE BILL SHEET */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <article
          className="tapx-bill-print-sheet"
          style={{
            ...sheetWidthStyle,
            background: "#ffffff",
            color: "#0f172a",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
            padding: paper === "a4" ? "28px 30px" : paper === "58mm" ? "14px 10px" : "18px 16px",
            fontFamily: isThermal
              ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
              : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: paper === "58mm" ? "11.5px" : paper === "a4" ? "14px" : "12.5px",
            lineHeight: 1.45,
            position: "relative",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {/* VOID BANNER / WATERMARK */}
          {isVoid && (
            <div
              style={{
                border: "2px solid #dc2626",
                background: "#fef2f2",
                color: "#b91c1c",
                textAlign: "center",
                fontWeight: 800,
                padding: "6px 8px",
                borderRadius: "6px",
                marginBottom: "12px",
                letterSpacing: "0.08em",
              }}
            >
              <div style={{ fontSize: paper === "58mm" ? "13px" : "15px" }}>VOID</div>
              {mode === "dashboard" && data.void_reason && (
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "normal",
                    marginTop: "2px",
                    color: "#7f1d1d",
                  }}
                >
                  Reason: {data.void_reason}
                </div>
              )}
            </div>
          )}

          {/* HEADER: LOGO & BUSINESS PROFILE */}
          <div style={{ textAlign: "center", marginBottom: "12px" }}>
            {data.settings.show_logo && data.business?.logo_url && (
              <div style={{ marginBottom: "8px", display: "flex", justifyContent: "center" }}>
                <img
                  src={data.business.logo_url}
                  alt={data.business.name || "Business logo"}
                  style={{
                    maxHeight: paper === "a4" ? "58px" : "44px",
                    maxWidth: "120px",
                    objectFit: "contain",
                    borderRadius: "6px",
                  }}
                />
              </div>
            )}
            <div
              style={{
                fontWeight: 800,
                fontSize: paper === "58mm" ? "14px" : paper === "a4" ? "20px" : "16px",
                letterSpacing: "0.01em",
              }}
            >
              {data.business?.name}
            </div>
            {addressParts.length > 0 && (
              <div style={{ color: "#475569", fontSize: "0.9em", marginTop: "2px" }}>
                {addressParts.join(", ")}
              </div>
            )}
            {data.business?.phone && (
              <div style={{ color: "#475569", fontSize: "0.9em", marginTop: "1px" }}>
                Tel: {data.business.phone}
              </div>
            )}
          </div>

          <div style={dashedDividerStyle} />

          {/* BILL META */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              fontSize: "0.94em",
              margin: "8px 0",
            }}
          >
            <div style={metaRowStyle}>
              <span style={{ color: "#64748b" }}>Bill No:</span>
              <strong>{data.bill_no_text}</strong>
            </div>
            <div style={metaRowStyle}>
              <span style={{ color: "#64748b" }}>Date:</span>
              <span>{formatBillDateTime(data.created_at) || data.bill_day}</span>
            </div>
            {data.table_number != null && (
              <div style={metaRowStyle}>
                <span style={{ color: "#64748b" }}>Table:</span>
                <strong>Table {data.table_number}</strong>
              </div>
            )}
            {data.customer_name && (
              <div style={metaRowStyle}>
                <span style={{ color: "#64748b" }}>Customer:</span>
                <span>{data.customer_name}</span>
              </div>
            )}
          </div>

          <div style={dashedDividerStyle} />

          {/* ITEMS TABLE */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              margin: "8px 0",
              fontSize: "0.94em",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #cbd5e1", color: "#475569" }}>
                <th style={{ textAlign: "left", padding: "4px 2px", fontWeight: 700 }}>Item</th>
                <th style={{ textAlign: "right", padding: "4px 4px", fontWeight: 700, whiteSpace: "nowrap" }}>
                  Qty × Rate
                </th>
                <th style={{ textAlign: "right", padding: "4px 0 4px 4px", fontWeight: 700, whiteSpace: "nowrap" }}>
                  Amt
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, idx) => (
                <tr key={`${item.item_name}-${idx}`} style={{ borderBottom: "1px dashed #e2e8f0" }}>
                  <td style={{ padding: "5px 4px 5px 0", verticalAlign: "top", wordBreak: "break-word" }}>
                    {item.item_name}
                  </td>
                  <td
                    style={{
                      padding: "5px 4px",
                      textAlign: "right",
                      verticalAlign: "top",
                      whiteSpace: "nowrap",
                      color: "#475569",
                    }}
                  >
                    {formatQuantity(item.quantity)} × {formatMoney(item.unit_price)}
                  </td>
                  <td
                    style={{
                      padding: "5px 0 5px 4px",
                      textAlign: "right",
                      verticalAlign: "top",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatMoney(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={dashedDividerStyle} />

          {/* TOTALS BREAKDOWN */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "8px 0", fontSize: "0.95em" }}>
            <div style={metaRowStyle}>
              <span>Subtotal</span>
              <span>{formatMoney(data.subtotal)}</span>
            </div>

            {data.discount_amount > 0 && (
              <div style={{ ...metaRowStyle, color: "#15803d" }}>
                <span>
                  Discount{data.discount_note ? ` (${data.discount_note})` : ""}
                </span>
                <span>-{formatMoney(data.discount_amount)}</span>
              </div>
            )}

            {data.service_charge > 0 && (
              <div style={metaRowStyle}>
                <span>
                  Service charge ({Number(data.service_charge_pct || 0)}%)
                </span>
                <span>{formatMoney(data.service_charge)}</span>
              </div>
            )}

            {data.round_off !== 0 && (
              <div style={metaRowStyle}>
                <span>Round-off</span>
                <span>{formatSignedMoney(data.round_off)}</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: "2px solid #0f172a", borderBottom: "2px solid #0f172a", padding: "8px 0", margin: "8px 0" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontWeight: 900,
                fontSize: paper === "58mm" ? "15px" : paper === "a4" ? "20px" : "17px",
              }}
            >
              <span>TOTAL</span>
              <span>{formatMoney(data.total)}</span>
            </div>
          </div>

          {/* PAYMENT LINE */}
          <div
            style={{
              textAlign: "center",
              fontWeight: 700,
              fontSize: "0.92em",
              padding: "4px 6px",
              borderRadius: "6px",
              background: data.payment_status === "paid" ? "#f0fdf4" : "#f8fafc",
              color: data.payment_status === "paid" ? "#166534" : "#475569",
              marginTop: "6px",
            }}
          >
            {formatBillPaymentLabel(data.payment_status, data.payment_method, data.paid_at)}
          </div>

          {/* UPI QR FOR UNPAID ISSUED BILLS */}
          {shouldShowUpiQr && qrDataUrl && (
            <div
              style={{
                marginTop: "12px",
                paddingTop: "10px",
                borderTop: "1px dashed #cbd5e1",
                textAlign: "center",
              }}
            >
              <img
                src={qrDataUrl}
                alt={`Scan to pay ${formatMoney(data.total)}`}
                style={{
                  width: paper === "58mm" ? "116px" : "140px",
                  height: paper === "58mm" ? "116px" : "140px",
                  display: "inline-block",
                }}
              />
              <div style={{ fontWeight: 700, fontSize: "0.92em", marginTop: "4px" }}>
                Scan to pay {formatMoney(data.total)}
              </div>
            </div>
          )}

          {/* OWNER FOOTER NOTE (only when set) */}
          {data.settings.footer?.trim() && (
            <div
              style={{
                marginTop: "12px",
                paddingTop: "8px",
                borderTop: "1px dashed #cbd5e1",
                textAlign: "center",
                fontSize: "0.9em",
                color: "#475569",
                whiteSpace: "pre-line",
              }}
            >
              {data.settings.footer.trim()}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

const dashedDividerStyle: React.CSSProperties = {
  borderTop: "1px dashed #cbd5e1",
  margin: "6px 0",
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
};

const btnBaseStyle: React.CSSProperties = {
  borderRadius: "9px",
  padding: "8px 13px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid transparent",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const btnPrimaryStyle: React.CSSProperties = {
  ...btnBaseStyle,
  background: "#0f172a",
  color: "#ffffff",
};

const btnSecondaryStyle: React.CSSProperties = {
  ...btnBaseStyle,
  background: "#ffffff",
  color: "#1e293b",
  borderColor: "#cbd5e1",
};

const btnSuccessStyle: React.CSSProperties = {
  ...btnBaseStyle,
  background: "#15803d",
  color: "#ffffff",
};

const btnDangerOutlineStyle: React.CSSProperties = {
  ...btnBaseStyle,
  background: "#ffffff",
  color: "#dc2626",
  borderColor: "#fca5a5",
};

const btnDangerStyle: React.CSSProperties = {
  ...btnBaseStyle,
  background: "#dc2626",
  color: "#ffffff",
};
