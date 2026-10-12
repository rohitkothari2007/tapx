"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";

interface UpiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  upiId?: string | null;
  paymentUrl?: string | null;
  upiQrUrl?: string | null;
  initialAmount?: number | null;
  orderNumber?: string | null;
}

export default function UpiPaymentModal({
  isOpen,
  onClose,
  businessName,
  upiId,
  paymentUrl,
  upiQrUrl,
  initialAmount,
  orderNumber,
}: UpiPaymentModalProps) {
  const [amountStr, setAmountStr] = useState<string>(
    initialAmount && initialAmount > 0 ? String(initialAmount) : ""
  );
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [qrLoading, setQrLoading] = useState(false);

  // Sync initialAmount if changed
  useEffect(() => {
    if (initialAmount && initialAmount > 0) {
      setAmountStr(String(initialAmount));
    }
  }, [initialAmount]);

  const cleanUpiId = (upiId || "").trim();
  const parsedAmount = parseFloat(amountStr);
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : null;

  // Build standard NPCI-compliant UPI URI
  const buildUpiUri = (scheme: string = "upi") => {
    if (!cleanUpiId) return "";
    let uri = `${scheme}://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(businessName)}&cu=INR&mode=02`;
    if (validAmount) {
      uri += `&am=${validAmount.toFixed(2)}`;
    }
    if (orderNumber) {
      uri += `&tn=${encodeURIComponent(`Order ${orderNumber}`)}`;
    }
    return uri;
  };

  const standardUpiUri = buildUpiUri("upi");
  const phonePeUri = buildUpiUri("phonepe");
  const paytmUri = buildUpiUri("paytmmp");
  const gpayUri = buildUpiUri("tez");

  // Generate dynamic QR code whenever amount or UPI ID changes
  useEffect(() => {
    if (!isOpen || !cleanUpiId) {
      setQrCodeDataUrl("");
      return;
    }

    let isMounted = true;
    setQrLoading(true);

    const uri = standardUpiUri;
    QRCode.toDataURL(uri, {
      width: 400,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (isMounted) {
          setQrCodeDataUrl(url);
          setQrLoading(false);
        }
      })
      .catch((err) => {
        console.error("QR Code generation error:", err);
        if (isMounted) setQrLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, cleanUpiId, standardUpiUri]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!cleanUpiId) return;
    try {
      await navigator.clipboard.writeText(cleanUpiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textArea = document.createElement("textarea");
      textArea.value = cleanUpiId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const qrToDisplay = upiQrUrl || qrCodeDataUrl;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0",
        animation: "fadeIn 200ms ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#ffffff",
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.25)",
          maxHeight: "92vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          padding: "20px 20px 32px 20px",
          position: "relative",
          animation: "slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Top Drag Handle */}
        <div
          style={{
            width: "44px",
            height: "5px",
            backgroundColor: "#e2e8f0",
            borderRadius: "999px",
            margin: "0 auto 16px auto",
          }}
        />

        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase" }}>
              Pay Business
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: "2px 0 0 0" }}>
              {businessName}
            </h3>
            {orderNumber && (
              <div style={{ fontSize: "13px", color: "#2563eb", fontWeight: 600, marginTop: "2px" }}>
                Order #{orderNumber}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#475569",
              fontSize: "18px",
              fontWeight: 700,
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Amount Section */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "14px 16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Amount to Pay</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f172a" }}>
              ₹{validAmount ? validAmount.toFixed(0) : "0"}
            </div>
          </div>
          {!initialAmount && (
            <div style={{ width: "120px" }}>
              <input
                type="number"
                placeholder="Enter ₹"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1.5px solid #cbd5e1",
                  fontSize: "15px",
                  fontWeight: 700,
                  outline: "none",
                  textAlign: "right",
                }}
              />
            </div>
          )}
        </div>

        {/* Dynamic / Scannable QR Code */}
        {qrToDisplay && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "#ffffff",
              border: "1.5px solid #f1f5f9",
              borderRadius: "20px",
              padding: "16px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "180px",
                height: "180px",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                overflow: "hidden",
              }}
            >
              {qrLoading ? (
                <div style={{ fontSize: "12px", color: "#64748b" }}>Generating QR...</div>
              ) : (
                <img
                  src={qrToDisplay}
                  alt="UPI QR Code"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              )}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, marginTop: "8px", textAlign: "center" }}>
              Scan with any UPI Scanner or camera
            </div>
          </div>
        )}

        {/* UPI Apps Chooser Buttons */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#475569",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>⚡</span>
            <span>CHOOSE YOUR UPI APP</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {/* PhonePe - Recommended */}
            <a
              href={phonePeUri}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "#f5f3ff",
                border: "1.5px solid #ddd6fe",
                color: "#5b21b6",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "14px",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "20px" }}>🟣</span>
              <div>
                <div>PhonePe</div>
                <div style={{ fontSize: "10px", color: "#7c3aed", fontWeight: 600 }}>Fast & Safe</div>
              </div>
            </a>

            {/* Paytm */}
            <a
              href={paytmUri}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "#f0fdf4",
                border: "1.5px solid #bbf7d0",
                color: "#166534",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "14px",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "20px" }}>🟢</span>
              <div>
                <div>Paytm</div>
                <div style={{ fontSize: "10px", color: "#15803d", fontWeight: 600 }}>Instant UPI</div>
              </div>
            </a>

            {/* Google Pay */}
            <a
              href={gpayUri}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "#f8fafc",
                border: "1.5px solid #e2e8f0",
                color: "#1e293b",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "14px",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "20px" }}>🔴</span>
              <div>
                <div>Google Pay</div>
                <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 600 }}>GPay UPI</div>
              </div>
            </a>

            {/* Other UPI Apps (BHIM, Cred, Navi, etc.) */}
            <a
              href={standardUpiUri}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "#eff6ff",
                border: "1.5px solid #bfdbfe",
                color: "#1e40af",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "14px",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "20px" }}>📱</span>
              <div>
                <div>Other UPI</div>
                <div style={{ fontSize: "10px", color: "#2563eb", fontWeight: 600 }}>Cred, BHIM, etc.</div>
              </div>
            </a>
          </div>

          {/* External Gateway / Custom Payment URL if present */}
          {paymentUrl && !paymentUrl.startsWith("upi://") && (
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "13px",
                borderRadius: "14px",
                background: "#0f172a",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "14px",
                marginTop: "10px",
              }}
            >
              <span>💳</span>
              <span>Open Online Payment Gateway</span>
            </a>
          )}
        </div>

        {/* Copy UPI ID Box */}
        {cleanUpiId && (
          <div
            style={{
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "14px",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div style={{ minWidth: 0, marginRight: "10px" }}>
              <div style={{ fontSize: "10.5px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                Merchant UPI ID
              </div>
              <div
                style={{
                  fontSize: "13px",
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
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.2s ease",
              }}
            >
              {copied ? "✓ Copied!" : "📋 Copy ID"}
            </button>
          </div>
        )}

        {/* Friendly Safety Tip Banner */}
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fef3c7",
            borderRadius: "12px",
            padding: "10px 12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "16px" }}>💡</span>
          <div style={{ fontSize: "11.5px", lineHeight: "1.4", color: "#92400e" }}>
            <strong>Payment Tip:</strong> If Google Pay shows a safety lock or security notice, simply tap <strong>PhonePe</strong> or <strong>Paytm</strong> above, or scan the QR code to complete payment in 2 seconds.
          </div>
        </div>
      </div>
    </div>
  );
}
