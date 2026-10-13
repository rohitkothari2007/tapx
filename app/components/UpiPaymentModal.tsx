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
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(true);

  const cleanUpiId = (upiId || "").trim();
  const cleanBusinessName = (businessName || "Business").trim();
  const numAmount = amount ? Number(amount) : null;

  // Build standard universal NPCI UPI intent URI
  const standardUpiUri = cleanUpiId
    ? `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanBusinessName)}${
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

    setIsGeneratingQr(true);
    QRCode.toDataURL(standardUpiUri, {
      width: 240,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (isMounted) {
          setQrCodeDataUrl(url);
          setIsGeneratingQr(false);
        }
      })
      .catch((err) => {
        console.error("Failed to generate UPI QR code:", err);
        if (isMounted) setIsGeneratingQr(false);
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

  const handleCopy = () => {
    if (!cleanUpiId) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(cleanUpiId);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = cleanUpiId;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    if (onTrackAction) onTrackAction("upi_id_copied");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleIntentClick = () => {
    if (onTrackAction) onTrackAction("upi_intent_click");
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
        .tapx-pay-button:active {
          transform: scale(0.98);
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: "380px",
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
            padding: "18px 20px 14px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fafafa",
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
                  fontWeight: 700,
                  color: "#0f172a",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {cleanBusinessName}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#16a34a",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <span>✓</span>
                <span>Verified Direct UPI</span>
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

        {/* Modal Body */}
        <div style={{ padding: "20px 20px 22px", textAlign: "center" }}>
          {/* Optional Amount Display */}
          {numAmount && numAmount > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                Amount to Pay
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
                ₹{numAmount.toLocaleString("en-IN")}
              </div>
            </div>
          )}

          {/* QR Code Frame */}
          {cleanUpiId ? (
            <div
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                background: "#f8fafc",
                border: "1.5px solid #e2e8f0",
                borderRadius: "20px",
                padding: "14px",
                marginBottom: "16px",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  width: "190px",
                  height: "190px",
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {isGeneratingQr ? (
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>Generating QR...</div>
                ) : qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="UPI QR Code"
                    style={{ width: "100%", height: "100%", display: "block" }}
                  />
                ) : (
                  <div style={{ fontSize: "12px", color: "#ef4444" }}>QR Unavailable</div>
                )}
              </div>

              <div
                style={{
                  marginTop: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>📷</span>
                <span>Scan with any UPI Scanner or camera</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px 0", color: "#64748b", fontSize: "13px" }}>
              No UPI ID configured for this business.
            </div>
          )}

          {/* Action 1: 1-Tap Universal App Intent Button */}
          {cleanUpiId && standardUpiUri && (
            <a
              href={standardUpiUri}
              onClick={handleIntentClick}
              className="tapx-pay-button"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                width: "100%",
                padding: "13px 16px",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#ffffff",
                borderRadius: "14px",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "14px",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                marginBottom: "10px",
                transition: "all 0.15s ease",
              }}
            >
              <span>⚡</span>
              <span>Open in Any UPI App</span>
            </a>
          )}

          {/* Action 2: Copy UPI ID Chip */}
          {cleanUpiId && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: "12px",
                marginBottom: paymentUrl && !paymentUrl.startsWith("upi://") ? "10px" : "14px",
              }}
            >
              <div style={{ minWidth: 0, textAlign: "left", marginRight: "8px" }}>
                <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  UPI ID
                </div>
                <div
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 700,
                    color: "#0f172a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cleanUpiId}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                style={{
                  background: copied ? "#16a34a" : "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "7px 12px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s ease",
                  flexShrink: 0,
                }}
              >
                {copied ? "✓ Copied!" : "📋 Copy ID"}
              </button>
            </div>
          )}

          {/* Action 3: Payment Gateway Fallback Link if Available */}
          {paymentUrl && !paymentUrl.startsWith("upi://") && (
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onTrackAction && onTrackAction("payment_gateway_click")}
              className="tapx-pay-button"
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
                marginBottom: "14px",
              }}
            >
              <span>🌐</span>
              <span>Pay via Gateway / Card / NetBanking</span>
            </a>
          )}

          {/* Subtitle / Universal App Support Badge */}
          <div
            style={{
              fontSize: "11px",
              lineHeight: 1.4,
              color: "#64748b",
              background: "#f8fafc",
              padding: "8px 12px",
              borderRadius: "10px",
              border: "1px solid #f1f5f9",
            }}
          >
            Works with <strong>GPay, PhonePe, Paytm, BHIM, FamPay, BharatPe</strong> & all banks.
          </div>
        </div>
      </div>
    </div>
  );
}
