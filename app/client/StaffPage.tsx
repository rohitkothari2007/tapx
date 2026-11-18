"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getPublicSiteUrl } from "../lib/siteUrl";
import { formatWhatsAppUrl } from "../lib/whatsapp";
import { supabase } from "../lib/supabase";

export type StaffMember = {
  id: string;
  name: string;
  phone: string;
  role: "waiter" | "kitchen" | "cashier";
  is_active: boolean;
  last_login_at: string | null;
  locked_until: string | null;
  created_at: string;
};

type Props = {
  business: {
    id: string;
    name: string;
  };
  tableOrderingConfig?: Record<string, unknown> | null;
  onTableOrderingConfigUpdated?: () => void;
};

export default function StaffPage({
  business,
  tableOrderingConfig,
  onTableOrderingConfigUpdated,
}: Props) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [serverNotice, setServerNotice] = useState("");

  // Modals & Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"waiter" | "kitchen">("waiter");
  const [newPin, setNewPin] = useState("");
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addFormError, setAddFormError] = useState("");

  // Success credential panel (shown once after create or PIN reset)
  const [createdCredential, setCreatedCredential] = useState<{
    name: string;
    phone: string;
    pin: string;
  } | null>(null);

  // Edit role modal
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editRole, setEditRole] = useState<"waiter" | "kitchen">("waiter");
  const [submittingEditRole, setSubmittingEditRole] = useState(false);

  // Reset PIN modal
  const [resetPinStaff, setResetPinStaff] = useState<StaffMember | null>(null);
  const [manualResetPin, setManualResetPin] = useState("");
  const [submittingResetPin, setSubmittingResetPin] = useState(false);

  // Packing charge setting
  const initialPackingCharge = typeof tableOrderingConfig?.packing_charge === "number"
    ? tableOrderingConfig.packing_charge
    : Number(tableOrderingConfig?.packing_charge || 0);

  const [customPackingCharge, setCustomPackingCharge] = useState<number | null>(null);
  const packingCharge = customPackingCharge !== null ? customPackingCharge : initialPackingCharge;
  const [savingPackingCharge, setSavingPackingCharge] = useState(false);
  const [packingChargeFeedback, setPackingChargeFeedback] = useState<string>("");
  const [now] = useState(() => Date.now());

  // Auth helper
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  // Fetch staff list
  const fetchStaff = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        setErrorMsg("Please sign in to view staff.");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/staff?businessId=${encodeURIComponent(business.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to load staff.");
      } else {
        if (data.warning) {
          setServerNotice(data.warning);
        }
        setStaffList(data.staff || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading staff";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [business.id, getAuthToken]);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (!ignore) {
        await fetchStaff();
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fetchStaff]);

  // Quick PIN generator for the modal
  const handleGeneratePin = () => {
    const num = Math.floor(100000 + Math.random() * 900000);
    setNewPin(num.toString());
  };

  // Add staff submission
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError("");

    const cleanPhone = newPhone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setAddFormError("Enter a valid 10-digit Indian mobile number starting with 6-9.");
      return;
    }

    if (!newName.trim()) {
      setAddFormError("Please enter staff member's name.");
      return;
    }

    if (newPin && !/^\d{6}$/.test(newPin.trim())) {
      setAddFormError("PIN must be exactly 6 numeric digits.");
      return;
    }

    setSubmittingAdd(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessId: business.id,
          name: newName.trim(),
          phone: cleanPhone,
          role: newRole,
          pin: newPin.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add staff member.");
      }

      // Success
      setShowAddModal(false);
      setNewName("");
      setNewPhone("");
      setNewPin("");
      setCreatedCredential({
        name: data.staff.name,
        phone: data.staff.phone,
        pin: data.pin,
      });

      await fetchStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating staff";
      setAddFormError(msg);
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Toggle active status (deactivate / reactivate)
  const handleToggleActive = async (staff: StaffMember) => {
    const actionWord = staff.is_active ? "deactivate" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${actionWord} ${staff.name}?`)) {
      return;
    }

    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !staff.is_active }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `Failed to ${actionWord} staff.`);
        return;
      }
      await fetchStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Operation failed";
      alert(msg);
    }
  };

  // Change role submit
  const handleUpdateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setSubmittingEditRole(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/staff/${editingStaff.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: editRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update role.");
        return;
      }
      setEditingStaff(null);
      await fetchStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating role";
      alert(msg);
    } finally {
      setSubmittingEditRole(false);
    }
  };

  // Reset PIN submit
  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinStaff) return;

    if (manualResetPin && !/^\d{6}$/.test(manualResetPin.trim())) {
      alert("PIN must be exactly 6 numeric digits.");
      return;
    }

    setSubmittingResetPin(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/staff/${resetPinStaff.id}/reset-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: manualResetPin.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to reset PIN.");
        return;
      }

      setCreatedCredential({
        name: resetPinStaff.name,
        phone: resetPinStaff.phone,
        pin: data.pin,
      });
      setResetPinStaff(null);
      setManualResetPin("");
      await fetchStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error resetting PIN";
      alert(msg);
    } finally {
      setSubmittingResetPin(false);
    }
  };

  // Save packing charge in table_ordering module config
  const handleSavePackingCharge = async () => {
    setSavingPackingCharge(true);
    setPackingChargeFeedback("");
    try {
      const val = Math.max(0, Number(packingCharge) || 0);

      // 1. Read existing config first to preserve other fields
      const { data: existingRow, error: fetchErr } = await supabase
        .from("business_module_configs")
        .select("id, config")
        .eq("business_id", business.id)
        .eq("module_key", "table_ordering")
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const currentConfig = (existingRow?.config && typeof existingRow.config === "object"
        ? existingRow.config
        : {}) as Record<string, unknown>;

      const updatedConfig = {
        ...currentConfig,
        packing_charge: val,
      };

      if (existingRow?.id) {
        const { error: updateErr } = await supabase
          .from("business_module_configs")
          .update({ config: updatedConfig })
          .eq("id", existingRow.id);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from("business_module_configs")
          .insert({
            business_id: business.id,
            module_key: "table_ordering",
            config: updatedConfig,
            status: "active",
          });

        if (insertErr) throw insertErr;
      }

      setCustomPackingCharge(val);
      setPackingChargeFeedback("✓ Packing charge saved successfully.");
      onTableOrderingConfigUpdated?.();
      setTimeout(() => setPackingChargeFeedback(""), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save packing charge";
      setPackingChargeFeedback(`Error: ${msg}`);
    } finally {
      setSavingPackingCharge(false);
    }
  };

  // Helper formatting
  const formatPhone = (phone: string) => {
    if (phone.length === 10) {
      return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
    }
    return phone;
  };

  const staffLoginUrl = `${getPublicSiteUrl()}/staff`;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "16px 12px 60px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#1c1410", margin: "0 0 4px" }}>
            👥 Staff Accounts
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Manage waiters and kitchen staff access for {business.name}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAddFormError("");
            setNewName("");
            setNewPhone("");
            setNewPin("");
            setShowAddModal(true);
          }}
          style={{
            minHeight: "44px",
            padding: "10px 18px",
            background: "#f97316",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 2px 8px rgba(249, 115, 22, 0.25)",
          }}
        >
          <span>＋</span> Add staff
        </button>
      </div>

      {/* Server Notice / Warning */}
      {serverNotice && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fef3c7",
            color: "#b45309",
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "13.5px",
            fontWeight: 600,
            marginBottom: "16px",
          }}
        >
          ℹ️ {serverNotice}
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "13.5px",
            fontWeight: 600,
            marginBottom: "16px",
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Credential Notification Banner (Shown once after add or reset) */}
      {createdCredential && (
        <div
          style={{
            background: "#fffaf3",
            border: "2px solid #f97316",
            borderRadius: "14px",
            padding: "18px 20px",
            marginBottom: "24px",
            boxShadow: "0 4px 14px rgba(249, 115, 22, 0.12)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#1c1410", marginBottom: "4px" }}>
                🔑 Staff Login Credentials for {createdCredential.name}
              </div>
              <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#ea580c", marginBottom: "12px" }}>
                ⚠️ Notice: The PIN is displayed only once. Share it with your staff member now.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreatedCredential(null)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "18px",
                cursor: "pointer",
                color: "#94a3b8",
                padding: "4px 8px",
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #fed7aa",
              borderRadius: "10px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "14px",
              marginBottom: "14px",
            }}
          >
            <div>
              <strong style={{ color: "#64748b" }}>Staff App Link:</strong>{" "}
              <a href={staffLoginUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#f97316", fontWeight: 700 }}>
                {staffLoginUrl}
              </a>
            </div>
            <div>
              <strong style={{ color: "#64748b" }}>Mobile Number:</strong>{" "}
              <span style={{ fontWeight: 800, color: "#0f172a" }}>{createdCredential.phone}</span>
            </div>
            <div>
              <strong style={{ color: "#64748b" }}>6-Digit PIN:</strong>{" "}
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 900,
                  letterSpacing: "0.18em",
                  color: "#ea580c",
                  background: "#fff7ed",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  border: "1px solid #fdba74",
                  display: "inline-block",
                }}
              >
                {createdCredential.pin}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <a
              href={formatWhatsAppUrl(
                `91${createdCredential.phone}`,
                `Hi ${createdCredential.name}, your TAPX staff login for ${business.name}: ${staffLoginUrl} · Mobile: ${createdCredential.phone} · PIN: ${createdCredential.pin}. Open the link and tap Add to Home Screen.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                minHeight: "44px",
                padding: "10px 16px",
                background: "#25d366",
                color: "#ffffff",
                borderRadius: "10px",
                textDecoration: "none",
                fontSize: "13.5px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>💬</span> Share on WhatsApp
            </a>
            <button
              type="button"
              onClick={() => {
                const text = `Hi ${createdCredential.name}, your TAPX staff login for ${business.name}: ${staffLoginUrl} · Mobile: ${createdCredential.phone} · PIN: ${createdCredential.pin}`;
                navigator.clipboard?.writeText(text);
                alert("Login info copied to clipboard!");
              }}
              style={{
                minHeight: "44px",
                padding: "10px 16px",
                background: "#ffffff",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📋 Copy details
            </button>
          </div>
        </div>
      )}

      {/* Order Settings Card: Packing Charge */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "18px 20px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ fontSize: "16px", fontWeight: 800, color: "#1c1410", marginBottom: "4px" }}>
          ⚙️ Takeaway Order Settings
        </div>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 14px" }}>
          Set a standard packing fee charged on takeaway orders created by staff or guests.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label htmlFor="packing_charge_input" style={{ fontSize: "13.5px", fontWeight: 700, color: "#334155" }}>
              Packing charge for takeaway (₹):
            </label>
            <input
              id="packing_charge_input"
              type="number"
              min="0"
              step="1"
              value={packingCharge}
              onChange={(e) => setCustomPackingCharge(Math.max(0, Number(e.target.value) || 0))}
              style={{
                width: "90px",
                minHeight: "44px",
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: 700,
                color: "#0f172a",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            type="button"
            disabled={savingPackingCharge}
            onClick={handleSavePackingCharge}
            style={{
              minHeight: "44px",
              padding: "10px 18px",
              background: "#1c1410",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: savingPackingCharge ? "not-allowed" : "pointer",
              opacity: savingPackingCharge ? 0.7 : 1,
            }}
          >
            {savingPackingCharge ? "Saving..." : "Save packing charge"}
          </button>
        </div>

        {packingChargeFeedback && (
          <div
            style={{
              marginTop: "10px",
              fontSize: "13px",
              fontWeight: 600,
              color: packingChargeFeedback.startsWith("✓") ? "#16a34a" : "#dc2626",
            }}
          >
            {packingChargeFeedback}
          </div>
        )}
      </div>

      {/* Staff List Section */}
      <div>
        <div style={{ fontSize: "15px", fontWeight: 800, color: "#475569", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Active & Inactive Staff ({staffList.length})
        </div>

        {loading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
            Loading staff members...
          </div>
        ) : staffList.length === 0 ? (
          <div
            style={{
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "14px",
              padding: "36px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>👥</div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#1c1410", marginBottom: "6px" }}>
              No staff added yet
            </div>
            <p style={{ fontSize: "13.5px", color: "#64748b", maxWidth: "440px", margin: "0 auto 16px" }}>
              Add your waiters and kitchen staff so they can take orders, view table status, and manage kitchen prep right from their own phones.
            </p>
            <button
              type="button"
              onClick={() => {
                setAddFormError("");
                setShowAddModal(true);
              }}
              style={{
                minHeight: "44px",
                padding: "10px 20px",
                background: "#f97316",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ＋ Add your first staff member
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
            {staffList.map((st) => {
              const isLocked = st.locked_until && new Date(st.locked_until).getTime() > now;
              return (
                <div
                  key={st.id}
                  style={{
                    background: "#ffffff",
                    border: `1px solid ${st.is_active ? "#e2e8f0" : "#f1f5f9"}`,
                    borderRadius: "14px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    opacity: st.is_active ? 1 : 0.65,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    {/* Top: Name & Badges */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#1c1410" }}>
                        {st.name}
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {/* Role Chip */}
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: st.role === "kitchen" ? "#ffedd5" : "#e0e7ff",
                            color: st.role === "kitchen" ? "#9a3412" : "#3730a3",
                          }}
                        >
                          {st.role === "kitchen" ? "🍳 Kitchen" : "🍽️ Waiter"}
                        </span>

                        {/* Status Chip */}
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: isLocked
                              ? "#fee2e2"
                              : st.is_active
                              ? "#dcfce7"
                              : "#f1f5f9",
                            color: isLocked
                              ? "#991b1b"
                              : st.is_active
                              ? "#166534"
                              : "#64748b",
                          }}
                        >
                          {isLocked ? "🔒 Locked" : st.is_active ? "● Active" : "○ Inactive"}
                        </span>
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div style={{ fontSize: "13.5px", color: "#334155", fontWeight: 600, marginBottom: "4px" }}>
                      📱 {formatPhone(st.phone)}
                    </div>

                    {/* Last Login */}
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Last login:{" "}
                      {st.last_login_at
                        ? new Date(st.last_login_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Never"}
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div
                    style={{
                      borderTop: "1px solid #f1f5f9",
                      paddingTop: "10px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setResetPinStaff(st);
                        setManualResetPin("");
                      }}
                      style={{
                        minHeight: "44px",
                        padding: "6px 12px",
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#334155",
                        cursor: "pointer",
                        flex: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      🔑 Reset PIN
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingStaff(st);
                        setEditRole(st.role === "kitchen" ? "kitchen" : "waiter");
                      }}
                      style={{
                        minHeight: "44px",
                        padding: "6px 12px",
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#334155",
                        cursor: "pointer",
                        flex: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      🔄 Change role
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(st)}
                      style={{
                        minHeight: "44px",
                        padding: "6px 12px",
                        background: st.is_active ? "#fff1f2" : "#f0fdf4",
                        border: `1px solid ${st.is_active ? "#fecdd3" : "#bbf7d0"}`,
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: st.is_active ? "#e11d48" : "#16a34a",
                        cursor: "pointer",
                        flex: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {st.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: ADD STAFF */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1c1410", margin: 0 }}>
                ➕ Add New Staff Member
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            {addFormError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "14px",
                }}
              >
                ⚠️ {addFormError}
              </div>
            )}

            <form onSubmit={handleAddStaffSubmit}>
              {/* Name */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    padding: "10px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Mobile */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Mobile Number (10 digits) *
                </label>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      minHeight: "44px",
                      padding: "10px 12px",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRight: "none",
                      borderRadius: "8px 0 0 8px",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#64748b",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))}
                    style={{
                      width: "100%",
                      minHeight: "44px",
                      padding: "10px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0 8px 8px 0",
                      fontSize: "15px",
                      fontWeight: 700,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Role Picker */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                  Role *
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: `1.5px solid ${newRole === "waiter" ? "#f97316" : "#e2e8f0"}`,
                      background: newRole === "waiter" ? "#fffaf3" : "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="waiter"
                      checked={newRole === "waiter"}
                      onChange={() => setNewRole("waiter")}
                      style={{ marginTop: "3px" }}
                    />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "#1c1410" }}>
                        🍽️ Waiter
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        Takes orders for tables & takeaway, views table status, marks orders as served, handles guest requests.
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: `1.5px solid ${newRole === "kitchen" ? "#f97316" : "#e2e8f0"}`,
                      background: newRole === "kitchen" ? "#fffaf3" : "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="kitchen"
                      checked={newRole === "kitchen"}
                      onChange={() => setNewRole("kitchen")}
                      style={{ marginTop: "3px" }}
                    />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "#1c1410" }}>
                        🍳 Kitchen
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        Views kitchen orders board, updates order prep status (Accept / Preparing / Ready), prints slips.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* PIN Field */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                    6-Digit Login PIN (optional)
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePin}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#f97316",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    🎲 Generate random PIN
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Leave empty to auto-generate"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    padding: "10px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 700,
                    letterSpacing: newPin ? "0.15em" : "normal",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "4px" }}>
                  If left blank, a random 6-digit PIN will be generated and shown after creation.
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    minHeight: "44px",
                    flex: 1,
                    padding: "10px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  style={{
                    minHeight: "44px",
                    flex: 1.5,
                    padding: "10px",
                    background: "#f97316",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: submittingAdd ? "not-allowed" : "pointer",
                    opacity: submittingAdd ? 0.7 : 1,
                  }}
                >
                  {submittingAdd ? "Creating..." : "Save staff member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE ROLE */}
      {editingStaff && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1c1410", margin: "0 0 8px" }}>
              Change Role for {editingStaff.name}
            </h3>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px" }}>
              Select a new role for this staff member.
            </p>

            <form onSubmit={handleUpdateRoleSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: `1.5px solid ${editRole === "waiter" ? "#f97316" : "#e2e8f0"}`,
                    background: editRole === "waiter" ? "#fffaf3" : "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="editRole"
                    value="waiter"
                    checked={editRole === "waiter"}
                    onChange={() => setEditRole("waiter")}
                  />
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#1c1410" }}>
                    🍽️ Waiter
                  </span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: `1.5px solid ${editRole === "kitchen" ? "#f97316" : "#e2e8f0"}`,
                    background: editRole === "kitchen" ? "#fffaf3" : "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="editRole"
                    value="kitchen"
                    checked={editRole === "kitchen"}
                    onChange={() => setEditRole("kitchen")}
                  />
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#1c1410" }}>
                    🍳 Kitchen
                  </span>
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  style={{
                    minHeight: "44px",
                    flex: 1,
                    padding: "10px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEditRole}
                  style={{
                    minHeight: "44px",
                    flex: 1,
                    padding: "10px",
                    background: "#f97316",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: submittingEditRole ? "not-allowed" : "pointer",
                  }}
                >
                  {submittingEditRole ? "Saving..." : "Update role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PIN */}
      {resetPinStaff && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1c1410", margin: "0 0 8px" }}>
              Reset PIN for {resetPinStaff.name}
            </h3>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px" }}>
              Enter a new 6-digit PIN, or leave blank to automatically generate one.
            </p>

            <form onSubmit={handleResetPinSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Auto-generate 6-digit PIN"
                  value={manualResetPin}
                  onChange={(e) => setManualResetPin(e.target.value.replace(/\D/g, ""))}
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    padding: "10px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 700,
                    letterSpacing: manualResetPin ? "0.15em" : "normal",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setResetPinStaff(null)}
                  style={{
                    minHeight: "44px",
                    flex: 1,
                    padding: "10px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResetPin}
                  style={{
                    minHeight: "44px",
                    flex: 1.5,
                    padding: "10px",
                    background: "#f97316",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: submittingResetPin ? "not-allowed" : "pointer",
                  }}
                >
                  {submittingResetPin ? "Resetting..." : "Reset PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
