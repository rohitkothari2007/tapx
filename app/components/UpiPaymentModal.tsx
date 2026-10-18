"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export type UpiPaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  upiId?: string | null;
  paymentUrl?: string | null;
  amount?: number | string | null;
  onTrackAction?: (type: string) => void;
};

export default function UpiPaymentModal({
  isOpen,
  onClose,
  businessName,
  upiId,
  paymentUrl,
  amount,
  onTrackAction,
}: UpiPaymentModalProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedAmount, setCopiedAmount] = useState<boolean>(false);
  const [savedQr, setSavedQr] = useState<boolean>(false);

  const cleanUpiId = (upiId || "").trim();
  const cleanBusinessName = (businessName || "Business").trim();
  const numAmount = amount ? Number(amount) : null;

  // Build standard universal NPCI UPI QR string (for direct camera scan)
  const standardUpiUri = cleanUpiId
    ? `upi://pay?pa=${cleanUpiId}&pn=${cleanBusinessName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "%20")}${
        numAmount && numAmount > 0 ? `&am=${numAmount.toFixed(2)}` : ""
      }&cu=INR`
    : "";

  // Generate dynamic QR code data URL whenever upiId or amount changes
  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !cleanUpiId) {
      setQrCodeDataUrl("");
      return;
    }

    QRCode.toDataURL(standardUpiUri, {
      width: 220,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (isMounted) setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate UPI QR code:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, cleanUpiId, standardUpiUri]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    if (!text) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const handleCopyUpiId = () => {
    if (!cleanUpiId) return;
    copyToClipboard(cleanUpiId);
    setCopiedId(true);
    if (onTrackAction) onTrackAction("upi_id_copied");
    setTimeout(() => setCopiedId(false), 2500);
  };

  const handleCopyAmount = () => {
    if (!numAmount || numAmount <= 0) return;
    copyToClipboard(numAmount.toFixed(2));
    setCopiedAmount(true);
    if (onTrackAction) onTrackAction("amount_copied");
    setTimeout(() => setCopiedAmount(false), 2500);
  };

  const handleDownloadQr = () => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement("a");
    link.href = qrCodeDataUrl;
    link.download = `${cleanBusinessName.replace(/[^a-zA-Z0-9]/g, "_")}-upi-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSavedQr(true);
    if (onTrackAction) onTrackAction("upi_qr_downloaded");
    setTimeout(() => setSavedQr(false), 3000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "tapxPayFadeIn 0.2s ease-out forwards",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @keyframes tapxPayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tapxPayPopIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .tapx-action-btn:active {
          transform: scale(0.98);
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          borderRadius: "24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
          animation: "tapxPayPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fafafa",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: "18px",
                flexShrink: 0,
              }}
            >
              💳
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "#0f172a",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Pay {cleanBusinessName}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#16a34a",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <span>✓</span>
                <span>Pay with any UPI App</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "none",
              background: "#e2e8f0",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 700,
              flexShrink: 0,
              transition: "background 0.15s ease",
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: "18px 20px 22px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            flex: 1,
          }}
        >
          {/* Amount to Pay (when there is an order total) */}
          {numAmount && numAmount > 0 && (
            <div
              style={{
                background: "#f8fafc",
                border: "1.5px solid #e2e8f0",
                borderRadius: "16px",
                padding: "14px 16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Amount to Pay
                </div>
                <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px" }}>
                  ₹{numAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyAmount}
                className="tapx-action-btn"
                style={{
                  background: copiedAmount ? "#16a34a" : "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "9px 14px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {copiedAmount ? "✓ Amount Copied" : "📋 Copy Amount"}
              </button>
            </div>
          )}

          {/* Business UPI ID Section in Large Text */}
          {cleanUpiId ? (
            <div
              style={{
                background: "#f8fafc",
                border: "1.5px solid #e2e8f0",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Business UPI ID
                </span>
                <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>
                  ✓ Direct Transfer
                </span>
              </div>

              {/* UPI ID in Large Text */}
              <div
                style={{
                  fontSize: "17px",
                  fontWeight: 800,
                  color: "#0f172a",
                  wordBreak: "break-all",
                  fontFamily: "monospace, -apple-system, BlinkMacSystemFont, sans-serif",
                  letterSpacing: "0.2px",
                  marginBottom: "12px",
                  padding: "12px 14px",
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  userSelect: "all",
                }}
              >
                {cleanUpiId}
              </div>

              {/* Copy UPI ID Button */}
              <button
                type="button"
                onClick={handleCopyUpiId}
                className="tapx-action-btn"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "13px 18px",
                  background: copiedId ? "#16a34a" : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: copiedId
                    ? "0 4px 12px rgba(22, 163, 74, 0.25)"
                    : "0 4px 12px rgba(37, 99, 235, 0.25)",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{copiedId ? "✓" : "📋"}</span>
                <span>{copiedId ? "UPI ID Copied!" : "Copy UPI ID"}</span>
              </button>
            </div>
          ) : (
            <div style={{ padding: "16px 0", color: "#64748b", fontSize: "13px", textAlign: "center" }}>
              No UPI ID configured for this business.
            </div>
          )}

          {/* Three Short Steps to Pay */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "14px 16px",
              marginBottom: "16px",
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontSize: "12.5px",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>📲</span>
              <span>How to pay with any UPI app</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Step 1 */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontSize: "12px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div style={{ fontSize: "12px", color: "#334155", lineHeight: 1.45 }}>
                  Open any UPI app (<strong>GPay</strong>, <strong>PhonePe</strong>, <strong>Paytm</strong>, <strong>BHIM</strong>)
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontSize: "12px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div style={{ fontSize: "12px", color: "#334155", lineHeight: 1.45 }}>
                  Choose <strong>&quot;Pay to UPI ID&quot;</strong> (or &quot;To UPI ID&quot;)
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontSize: "12px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div style={{ fontSize: "12px", color: "#334155", lineHeight: 1.45 }}>
                  Paste the ID and enter{" "}
                  {numAmount && numAmount > 0 ? (
                    <strong>₹{numAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  ) : (
                    "the amount"
                  )}{" "}
                  to complete payment
                </div>
              </div>
            </div>
          </div>

          {/* On-Screen QR Code (Secondary Camera / Gallery Scan Option) */}
          {cleanUpiId && qrCodeDataUrl && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: "14px",
                padding: "12px",
                marginBottom: paymentUrl && !paymentUrl.startsWith("upi://") ? "12px" : "4px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                textAlign: "left",
              }}
            >
              <img
                src={qrCodeDataUrl}
                alt="UPI QR Code"
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                  Or Scan QR with Camera
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  Scan directly or save to gallery
                </div>
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  style={{
                    marginTop: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: savedQr ? "#dcfce7" : "#ffffff",
                    color: savedQr ? "#15803d" : "#334155",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <span>{savedQr ? "✓" : "📥"}</span>
                  <span>{savedQr ? "Saved to Photos!" : "Save QR"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Payment Gateway Fallback Link if Available */}
          {paymentUrl && !paymentUrl.startsWith("upi://") && (
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onTrackAction && onTrackAction("payment_gateway_click")}
              className="tapx-action-btn"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                width: "100%",
                padding: "11px 14px",
                background: "#f1f5f9",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "13px",
                marginTop: "10px",
              }}
            >
              <span>🌐</span>
              <span>Pay via Gateway / Card / NetBanking</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
