"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  BillingPaperSize,
  getCurrentIndianFY,
  parseBillingSettings,
} from "../../lib/billing";

type Props = {
  businessId: string;
  upiId?: string | null;
  moduleConfigs?: Array<{ module_key: string; config: Record<string, any> | null }>;
  onSaved?: () => void | Promise<void>;
};

export default function BillingSettingsCard({
  businessId,
  upiId,
  moduleConfigs,
  onSaved,
}: Props) {
  const cachedBillingConfig = moduleConfigs?.find(
    (m) => String(m.module_key || "").trim().toLowerCase() === "billing"
  )?.config;

  const initialParsed = parseBillingSettings(cachedBillingConfig);

  const [prefix, setPrefix] = useState(initialParsed.prefix);
  const [paper, setPaper] = useState<BillingPaperSize>(initialParsed.paper);
  const [footer, setFooter] = useState(initialParsed.footer);
  const [serviceChargeInput, setServiceChargeInput] = useState(
    initialParsed.service_charge_pct !== null
      ? String(initialParsed.service_charge_pct)
      : ""
  );
  const [roundOff, setRoundOff] = useState(initialParsed.round_off);
  const [showUpiQr, setShowUpiQr] = useState(initialParsed.show_upi_qr);
  const [showLogo, setShowLogo] = useState(initialParsed.show_logo);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const applyConfigToForm = useCallback((raw?: Record<string, any> | null) => {
    const parsed = parseBillingSettings(raw);
    setPrefix(parsed.prefix);
    setPaper(parsed.paper);
    setFooter(parsed.footer);
    setServiceChargeInput(
      parsed.service_charge_pct !== null ? String(parsed.service_charge_pct) : ""
    );
    setRoundOff(parsed.round_off);
    setShowUpiQr(parsed.show_upi_qr);
    setShowLogo(parsed.show_logo);
  }, []);

  const loadFromDb = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_module_configs")
        .select("config")
        .eq("business_id", businessId)
        .eq("module_key", "billing")
        .maybeSingle();
      if (error) {
        setErrorMsg(error.message || "Could not load billing settings.");
        return;
      }
      applyConfigToForm((data?.config as Record<string, any> | null) ?? null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not load billing settings.");
    } finally {
      setLoading(false);
    }
  }, [businessId, applyConfigToForm]);

  useEffect(() => {
    void loadFromDb();
  }, [loadFromDb]);

  const handleSave = async () => {
    if (!businessId || saving) return;
    setSavedMsg("");
    setErrorMsg("");

    const cleanPrefix = prefix
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);

    const scTrimmed = serviceChargeInput.trim();
    let parsedSc: number | null = null;
    if (scTrimmed !== "") {
      const n = Number(scTrimmed);
      if (!Number.isFinite(n) || n < 0 || n > 30) {
        setErrorMsg("Default service charge % must be between 0 and 30.");
        return;
      }
      parsedSc = Math.round(n * 100) / 100;
    }

    const cleanFooter = footer.slice(0, 200);

    setSaving(true);
    try {
      const { error: rpcErr } = await supabase.rpc(
        "set_tapx_billing_settings",
        {
          p_business_id: businessId,
          p_settings: {
            prefix: cleanPrefix,
            paper,
            footer: cleanFooter,
            service_charge_pct: parsedSc,
            round_off: roundOff,
            show_upi_qr: showUpiQr,
            show_logo: showLogo,
          },
        }
      );

      if (rpcErr) {
        setErrorMsg(rpcErr.message || "Failed to save billing settings.");
        return;
      }

      await loadFromDb();
      if (onSaved) {
        await onSaved();
      }
      setSavedMsg("Billing settings saved.");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save billing settings.");
    } finally {
      setSaving(false);
    }
  };

  const currentFy = getCurrentIndianFY();
  const previewNumber = `${prefix || "BILL"}/${currentFy}/0001`;
  const hasUpiId = Boolean(upiId && upiId.trim().length > 0);

  return (
    <div
      className="settings-card"
      style={{ gridColumn: "1 / -1" }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement)?.tagName === "INPUT") {
          e.preventDefault();
        }
      }}
    >
      <div className="settings-heading">
        <div>
          <h3>Billing Settings</h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
            Configure receipt paper size, bill prefix, service charge default, and payment QR display.
          </p>
        </div>
        <span>BILLING</span>
      </div>

      {savedMsg && (
        <div
          style={{
            marginBottom: "14px",
            padding: "10px 12px",
            borderRadius: "10px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: "12.5px",
            fontWeight: 600,
          }}
        >
          ✓ {savedMsg}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            marginBottom: "14px",
            padding: "10px 12px",
            borderRadius: "10px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "12.5px",
            fontWeight: 600,
          }}
        >
          {errorMsg}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Bill Prefix (up to 8 letters/numbers)</label>
          <input
            type="text"
            value={prefix}
            maxLength={8}
            disabled={loading || saving}
            onChange={(e) => {
              const cleaned = e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 8);
              setPrefix(cleaned);
            }}
            placeholder="e.g. INV"
          />
          <div style={{ marginTop: "6px", fontSize: "11.5px", color: "#475569" }}>
            Preview only: <strong>{previewNumber}</strong>
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Paper Size</label>
          <select
            value={paper}
            disabled={loading || saving}
            onChange={(e) => setPaper(e.target.value as BillingPaperSize)}
          >
            <option value="80mm">80 mm receipt</option>
            <option value="58mm">58 mm receipt</option>
            <option value="a4">A4</option>
          </select>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Default Service Charge % (0–30)</label>
          <input
            type="number"
            min={0}
            max={30}
            step="0.01"
            value={serviceChargeInput}
            disabled={loading || saving}
            onChange={(e) => setServiceChargeInput(e.target.value)}
            placeholder="Leave empty for none"
          />
        </div>
      </div>

      <div className="input-group" style={{ marginTop: "16px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <label style={{ marginBottom: 0 }}>Footer Note</label>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
            {footer.length}/200
          </span>
        </div>
        <textarea
          rows={2}
          maxLength={200}
          disabled={loading || saving}
          value={footer}
          onChange={(e) => setFooter(e.target.value.slice(0, 200))}
          placeholder="Optional note printed at the bottom of bills"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            color: "#0f172a",
            fontSize: "13px",
            fontWeight: 500,
            boxSizing: "border-box",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
        }}
      >
        <label style={switchBoxStyle}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
            Round total to nearest rupee
          </span>
          <input
            type="checkbox"
            checked={roundOff}
            disabled={loading || saving}
            onChange={(e) => setRoundOff(e.target.checked)}
            style={checkboxInputStyle}
          />
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={switchBoxStyle}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
              Show UPI QR on unpaid bills
            </span>
            <input
              type="checkbox"
              checked={showUpiQr}
              disabled={loading || saving}
              onChange={(e) => setShowUpiQr(e.target.checked)}
              style={checkboxInputStyle}
            />
          </label>
          {showUpiQr && !hasUpiId && (
            <div style={{ fontSize: "11.5px", color: "#b45309", paddingLeft: "4px" }}>
              Add your UPI ID in Business Profile to show a payment QR
            </div>
          )}
        </div>

        <label style={switchBoxStyle}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
            Show logo on bill
          </span>
          <input
            type="checkbox"
            checked={showLogo}
            disabled={loading || saving}
            onChange={(e) => setShowLogo(e.target.checked)}
            style={checkboxInputStyle}
          />
        </label>
      </div>

      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          disabled={loading || saving}
          onClick={handleSave}
          className="save-btn"
        >
          {saving ? "Saving..." : "Save billing settings"}
        </button>
      </div>
    </div>
  );
}

const switchBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  padding: "11px 12px",
  background: "#f8fafc",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  cursor: "pointer",
};

const checkboxInputStyle: React.CSSProperties = {
  width: "18px",
  height: "18px",
  cursor: "pointer",
  accentColor: "#0f172a",
};
