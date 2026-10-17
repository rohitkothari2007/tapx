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
  const [trValue, setTrValue] = useState("");

  useEffect(() => {
    // Generate transaction reference client-side only
    setTrValue(`TAPXTEST${Date.now()}`);
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

  const pa = encodeURIComponent((upiId || "").trim());
  const pn = encodeURIComponent((businessName || "").trim());
  const cu = "INR";
  const tr = encodeURIComponent(trValue);
  const tn = encodeURIComponent("TAPX test");

  const v1Link = `upi://pay?pa=${pa}&pn=${pn}&cu=${cu}`;
  const v2Link = `upi://pay?pa=${pa}&pn=${pn}&am=10.00&cu=${cu}`;
  const v3Link = `upi://pay?pa=${pa}&pn=${pn}&am=10.00&cu=${cu}&tr=${tr}&tn=${tn}`;

  return (
    <main
      style={{
        maxWidth: "600px",
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
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
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
              <strong>UPI ID:</strong> {upiId || "(none configured)"}
            </div>
            <div>
              <strong>Generated tr:</strong> {trValue}
            </div>
          </div>

          {/* Variant 1 */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "18px",
              background: "#ffffff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px", color: "#1e293b" }}>
              Variant 1: Raw QR Match (No Amount)
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>
              pa, pn, cu only
            </div>

            <a
              href={v1Link}
              style={{
                display: "block",
                textAlign: "center",
                padding: "14px 20px",
                background: "#2563eb",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "16px",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
              }}
            >
              Test V1 Link
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
              {v1Link}
            </div>
          </div>

          {/* Variant 2 */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "18px",
              background: "#ffffff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px", color: "#1e293b" }}>
              Variant 2: Current Pay Link (+ am=10.00)
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>
              pa, pn, am=10.00, cu
            </div>

            <a
              href={v2Link}
              style={{
                display: "block",
                textAlign: "center",
                padding: "14px 20px",
                background: "#0891b2",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "16px",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(8, 145, 178, 0.25)",
              }}
            >
              Test V2 Link (₹10)
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
              {v2Link}
            </div>
          </div>

          {/* Variant 3 */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "18px",
              background: "#ffffff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px", color: "#1e293b" }}>
              Variant 3: V2 + Reference &amp; Note (+ tr &amp; tn)
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>
              pa, pn, am=10.00, cu, tr=TAPXTEST..., tn=TAPX test
            </div>

            <a
              href={v3Link}
              style={{
                display: "block",
                textAlign: "center",
                padding: "14px 20px",
                background: "#4f46e5",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "16px",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
              }}
            >
              Test V3 Link (₹10 + tr + tn)
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
              {v3Link}
            </div>
          </div>
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
