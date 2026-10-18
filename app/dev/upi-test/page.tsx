"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

function UpiTestContent() {
  const searchParams = useSearchParams();
  const deviceCode = searchParams.get("device") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    // Generate timestamp client-side only
    setTimestamp(Date.now().toString());
  }, []);

  useEffect(() => {
    if (!deviceCode) {
      setError("Please provide a ?device= query parameter (e.g. ?device=TAPX003)");
      setLoading(false);
      return;
    }

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const { data, error: rpcError } = await supabase.rpc("resolve_tap_device", {
          p_device_code: deviceCode,
        });

        if (rpcError) throw rpcError;

        if (!data || !data.business) {
          setError(`Device "${deviceCode}" or associated business was not found.`);
          setLoading(false);
          return;
        }

        setBusinessName(data.business.name || "");
        setUpiId(data.business.upi_id || "");
      } catch (err: any) {
        setError(err?.message || "Failed to resolve device");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [deviceCode]);

  // Formatted parameters
  const upiIdRaw = (upiId || "").trim();
  const cleanName = (businessName || "Business").trim();
  const paEncoded = encodeURIComponent(upiIdRaw);
  const pnEncoded = encodeURIComponent(cleanName);
  const cu = "INR";

  // V4: %20 for spaces, stripped of special characters
  const nameWithPercent20 = cleanName
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, "%20");

  // V5 & V6: stripped of spaces and special characters
  const nameWithoutSpaces = cleanName.replace(/[^a-zA-Z0-9]/g, "");

  // Client-side generated transaction references
  const clientTimestamp = timestamp || Date.now().toString();
  const trV3 = encodeURIComponent(`TAPXTEST${clientTimestamp}`);
  const trV6 = `TAPX${clientTimestamp}`;

  // Link definitions
  const v1Link = `upi://pay?pa=${paEncoded}&pn=${pnEncoded}&cu=${cu}`;
  const v2Link = `upi://pay?pa=${paEncoded}&pn=${pnEncoded}&am=10.00&cu=${cu}`;
  const v3Link = `upi://pay?pa=${paEncoded}&pn=${pnEncoded}&am=10.00&cu=${cu}&tr=${trV3}&tn=TAPX%20test`;
  const v4Link = `upi://pay?pa=${upiIdRaw}&pn=${nameWithPercent20}&cu=${cu}`;
  const v5Link = `upi://pay?pa=${upiIdRaw}&pn=${nameWithoutSpaces}&cu=${cu}`;
  const v6Link = `upi://pay?pa=${upiIdRaw}&pn=${nameWithoutSpaces}&am=1.00&cu=${cu}&tr=${trV6}`;

  const variants = [
    {
      id: "V1",
      title: "Variant 1: Raw QR Match (encodeURIComponent, No Amount)",
      subtitle: "pa (encoded), pn (encoded), cu",
      link: v1Link,
      btnColor: "#2563eb",
      label: "Test V1 Link",
    },
    {
      id: "V2",
      title: "Variant 2: Current Pay Link (encodeURIComponent + am=10.00)",
      subtitle: "pa (encoded), pn (encoded), am=10.00, cu",
      link: v2Link,
      btnColor: "#0891b2",
      label: "Test V2 Link (₹10)",
    },
    {
      id: "V3",
      title: "Variant 3: V2 + tr + tn (encodeURIComponent)",
      subtitle: "pa (encoded), pn (encoded), am=10.00, cu, tr, tn",
      link: v3Link,
      btnColor: "#4f46e5",
      label: "Test V3 Link (₹10 + tr + tn)",
    },
    {
      id: "V4",
      title: "Variant 4: Literal @ in pa + %20 for spaces in pn",
      subtitle: "pa (literal @), pn (spaces as %20), cu=INR",
      link: v4Link,
      btnColor: "#059669",
      label: "Test V4 Link (Literal @ in pa)",
    },
    {
      id: "V5",
      title: "Variant 5: Literal @ in pa + pn without spaces",
      subtitle: "pa (literal @), pn (no spaces / alphanumeric only), cu=INR",
      link: v5Link,
      btnColor: "#d97706",
      label: "Test V5 Link (No spaces in pn)",
    },
    {
      id: "V6",
      title: "Variant 6: Literal @ in pa + pn without spaces + am=1.00 + plain tr",
      subtitle: "pa (literal @), pn (no spaces), am=1.00, cu=INR, tr=TAPX{timestamp}",
      link: v6Link,
      btnColor: "#dc2626",
      label: "Test V6 Link (₹1 + plain tr)",
    },
  ];

  return (
    <main
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        padding: "24px 16px 48px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* Top note */}
      <div
        style={{
          background: "#fef3c7",
          border: "1px solid #f59e0b",
          color: "#92400e",
          padding: "10px 14px",
          borderRadius: "8px",
          fontWeight: 700,
          fontSize: "13px",
          marginBottom: "20px",
          textAlign: "center",
        }}
      >
        ⚠️ Test page - delete after use
      </div>

      <h1 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "4px" }}>
        UPI Intent Link Tester
      </h1>
      <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
        Device: <strong>{deviceCode || "(none)"}</strong>
      </p>

      {loading && (
        <div style={{ padding: "20px 0", color: "#64748b", fontSize: "14px" }}>
          Loading device and business details...
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #ef4444",
            color: "#b91c1c",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "13px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "14px",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            <div>
              <strong>Business:</strong> {businessName}
            </div>
            <div>
              <strong>UPI ID (raw):</strong> {upiIdRaw || "(none configured)"}
            </div>
            <div>
              <strong>pn (no spaces):</strong> {nameWithoutSpaces}
            </div>
            <div>
              <strong>tr (V6):</strong> {trV6}
            </div>
          </div>

          {variants.map((v) => (
            <div
              key={v.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "18px",
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  marginBottom: "4px",
                  color: "#1e293b",
                }}
              >
                {v.title}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#64748b",
                  marginBottom: "12px",
                }}
              >
                {v.subtitle}
              </div>

              <a
                href={v.link}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "14px 20px",
                  background: v.btnColor,
                  color: "#ffffff",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "16px",
                  borderRadius: "12px",
                  boxShadow: `0 4px 12px ${v.btnColor}40`,
                }}
              >
                {v.label}
              </a>

              <div
                style={{
                  marginTop: "12px",
                  background: "#f1f5f9",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                  color: "#334155",
                }}
              >
                {v.link}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function DevUpiTestPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
          Loading...
        </div>
      }
    >
      <UpiTestContent />
    </Suspense>
  );
}
