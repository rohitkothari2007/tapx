"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PublicBillPayload } from "../../lib/billing";
import BillDocument, {
  toBillDocumentDataFromPublic,
} from "../../components/billing/BillDocument";

export default function PublicBillClient({ token }: { token: string }) {
  const [payload, setPayload] = useState<PublicBillPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let active = true;
    const cleanToken = decodeURIComponent(token || "").trim();

    async function loadPublicBill() {
      if (!cleanToken) {
        setPayload(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg("");
      try {
        const { data, error } = await supabase.rpc("get_public_bill", {
          p_token: cleanToken,
        });

        if (!active) return;

        if (error) {
          setErrorMsg(error.message || "Could not load this bill.");
          setPayload(null);
        } else if (!data || typeof data !== "object") {
          setPayload(null);
        } else {
          setPayload(data as PublicBillPayload);
        }
      } catch (err: any) {
        if (active) {
          setErrorMsg(err?.message || "Could not load this bill.");
          setPayload(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPublicBill();

    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <main style={pageShellStyle}>
        <div style={cardMessageStyle}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
            Loading bill...
          </div>
          <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
            Please wait a moment.
          </div>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main style={pageShellStyle}>
        <div style={cardMessageStyle}>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#b91c1c" }}>
            Unable to load bill
          </div>
          <div style={{ fontSize: "13.5px", color: "#475569", marginTop: "6px" }}>
            {errorMsg}
          </div>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main style={pageShellStyle}>
        <div style={cardMessageStyle}>
          <div style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
            This bill link is not valid
          </div>
          <div style={{ fontSize: "13.5px", color: "#64748b", marginTop: "6px", lineHeight: 1.5 }}>
            Please check the link with the business or request a fresh copy.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={pageShellStyle}>
      <div style={{ width: "100%", maxWidth: "780px", margin: "0 auto" }}>
        <BillDocument
          mode="public"
          data={toBillDocumentDataFromPublic(payload, decodeURIComponent(token || "").trim())}
        />
      </div>
    </main>
  );
}

const pageShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f1f5f9",
  color: "#0f172a",
  padding: "16px 12px 36px",
  boxSizing: "border-box",
};

const cardMessageStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  margin: "48px auto 0",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "24px 20px",
  textAlign: "center",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};
