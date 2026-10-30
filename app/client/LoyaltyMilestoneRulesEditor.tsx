"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  LoyaltyMilestoneRule,
  parseLoyaltyRules,
  MAX_MILESTONE_RULES,
  MAX_REWARD_LENGTH,
  MIN_INTERVAL,
  MAX_INTERVAL,
} from "../lib/loyaltyMilestones";

export interface LoyaltyMilestoneRulesEditorProps {
  businessId: string;
  initialConfig?: any;
  onSaved?: (rules: LoyaltyMilestoneRule[]) => void;
}

export default function LoyaltyMilestoneRulesEditor({
  businessId,
  initialConfig,
  onSaved,
}: LoyaltyMilestoneRulesEditorProps) {
  const [rules, setRules] = useState<LoyaltyMilestoneRule[]>([
    { every: 5, reward: "10% off next visit" },
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modal form states
  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [modalEvery, setModalEvery] = useState<string>("5");
  const [modalReward, setModalReward] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);

  // Load existing config on mount or businessId change
  useEffect(() => {
    let isCancelled = false;

    async function loadConfig() {
      if (initialConfig && typeof initialConfig === "object") {
        const parsed = parseLoyaltyRules(initialConfig);
        if (!isCancelled) {
          // If modal is currently open, avoid overriding active user typing
          setRules(parsed);
        }
        return;
      }

      if (!businessId) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from("business_module_configs")
          .select("config")
          .eq("business_id", businessId)
          .eq("module_key", "loyalty")
          .maybeSingle();

        if (!isCancelled && data?.config) {
          const parsed = parseLoyaltyRules(data.config);
          setRules(parsed);
        }
      } catch (err) {
        console.error("Error loading loyalty milestone rules:", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadConfig();
    return () => {
      isCancelled = true;
    };
  }, [businessId, initialConfig]);

  // Merge and persist helper - preserves all other config keys and mirrors rule 1
  async function persistRules(cleanRules: LoyaltyMilestoneRule[]): Promise<boolean> {
    if (!businessId) {
      setMessage({ text: "Missing business ID.", type: "error" });
      return false;
    }
    setSaving(true);
    try {
      // 1. Read existing config to merge safely without overwriting other keys
      const { data: existingRow } = await supabase
        .from("business_module_configs")
        .select("id, config, feature_id")
        .eq("business_id", businessId)
        .eq("module_key", "loyalty")
        .maybeSingle();

      const mergedConfig = {
        ...(existingRow?.config || {}),
        milestones: cleanRules,
        // Mirror rule 1 for backwards compatibility with legacy code
        milestone_interval: cleanRules[0].every,
        milestone_reward: cleanRules[0].reward,
      };

      const resolvedFeatureId = existingRow?.feature_id || "loyalty";

      const { error } = await supabase
        .from("business_module_configs")
        .upsert(
          {
            business_id: businessId,
            feature_id: resolvedFeatureId,
            module_key: "loyalty",
            config: mergedConfig,
            status: "active",
          },
          { onConflict: "business_id,module_key" }
        );

      if (error) throw error;

      setRules(cleanRules);
      setMessage({ text: "✓ Loyalty milestone rules saved!", type: "success" });
      onSaved?.(cleanRules);
      return true;
    } catch (err: any) {
      console.error("Failed to save milestone rules:", err);
      setMessage({
        text: err?.message || "Failed to save milestone rules.",
        type: "error",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openCreateModal() {
    if (rules.length >= MAX_MILESTONE_RULES) {
      setMessage({
        text: `Maximum of ${MAX_MILESTONE_RULES} milestone rules allowed.`,
        type: "error",
      });
      return;
    }
    setMessage(null);
    setEditIndex(null);

    // Pick a suggested interval greater than previous rule
    const lastInterval = Number(rules[rules.length - 1]?.every) || 5;
    const nextInterval = Math.min(MAX_INTERVAL, lastInterval + 5);

    setModalEvery(String(nextInterval));
    setModalReward("");
    setModalError(null);
    setShowModal(true);
  }

  function openEditModal(index: number) {
    const targetRule = rules[index];
    if (!targetRule) return;

    setMessage(null);
    setEditIndex(index);
    setModalEvery(String(targetRule.every));
    setModalReward(targetRule.reward);
    setModalError(null);
    setShowModal(true);
  }

  async function handleDelete(index: number) {
    setMessage(null);
    if (rules.length <= 1) {
      setMessage({
        text: "At least one milestone rule is required. You cannot delete the only remaining rule.",
        type: "error",
      });
      return;
    }

    const targetRule = rules[index];
    const ruleNum = index + 1;
    if (
      !confirm(
        `Are you sure you want to delete Rule ${ruleNum} (Every ${targetRule.every} visits: "${targetRule.reward}")?`
      )
    ) {
      return;
    }

    const updatedRules = rules.filter((_, i) => i !== index);
    const cleanUpdated: LoyaltyMilestoneRule[] = updatedRules.map((r) => ({
      every: Number(r.every),
      reward: String(r.reward).trim(),
    }));

    await persistRules(cleanUpdated);
  }

  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);

    // Guard: max 3 rules on creation
    if (editIndex === null && rules.length >= MAX_MILESTONE_RULES) {
      setModalError(`Maximum of ${MAX_MILESTONE_RULES} milestone rules allowed.`);
      return;
    }

    const everyNum = Number(String(modalEvery).trim());
    if (!Number.isInteger(everyNum) || everyNum < MIN_INTERVAL || everyNum > MAX_INTERVAL) {
      setModalError(
        `Milestone visits must be a whole number between ${MIN_INTERVAL} and ${MAX_INTERVAL}.`
      );
      return;
    }

    // Guard: unique intervals
    const isDuplicate = rules.some(
      (r, idx) => idx !== editIndex && Number(r.every) === everyNum
    );
    if (isDuplicate) {
      setModalError(
        `Duplicate milestone interval (${everyNum} visits). Each rule must have a unique interval.`
      );
      return;
    }

    const trimmedReward = String(modalReward || "").trim();
    if (!trimmedReward) {
      setModalError("Reward description is required.");
      return;
    }

    if (trimmedReward.length > MAX_REWARD_LENGTH) {
      setModalError(
        `Reward description must be at most ${MAX_REWARD_LENGTH} characters.`
      );
      return;
    }

    let updatedRules: LoyaltyMilestoneRule[];
    if (editIndex !== null) {
      updatedRules = rules.map((r, i) =>
        i === editIndex ? { every: everyNum, reward: trimmedReward } : r
      );
    } else {
      updatedRules = [...rules, { every: everyNum, reward: trimmedReward }];
    }

    const success = await persistRules(updatedRules);
    if (success) {
      setShowModal(false);
      setModalError(null);
    }
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: "20px",
        border: "1px solid #e2e8f0",
        padding: "24px",
      }}
    >
      {/* SECTION HEADER: Title & '+ Create New Milestone' Button */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 6px",
              fontSize: "18px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            ⚙ Loyalty Milestone Rules
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Define up to {MAX_MILESTONE_RULES} milestone rules. Each rule repeats every N visits.
          </p>
          <span
            style={{
              display: "block",
              fontSize: "12px",
              color: "#2563eb",
              fontWeight: 600,
              marginTop: "4px",
            }}
          >
            ℹ If two rules fall on the same visit, the customer gets the larger one.
          </span>
        </div>

        {rules.length < MAX_MILESTONE_RULES && (
          <button
            type="button"
            onClick={openCreateModal}
            disabled={saving}
            style={{
              padding: "10px 18px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "14px",
              cursor: saving ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              opacity: saving ? 0.7 : 1,
            }}
          >
            + Create New Milestone
          </button>
        )}
      </div>

      {/* FEEDBACK MESSAGE */}
      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            marginBottom: "20px",
            background: message.type === "success" ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${message.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            color: message.type === "success" ? "#047857" : "#dc2626",
          }}
        >
          {message.text}
        </div>
      )}

      {/* RULES CARDS LIST */}
      {loading ? (
        <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>Loading rules...</p>
      ) : rules.length === 0 ? (
        <div
          style={{
            background: "#f8fafc",
            borderRadius: "16px",
            border: "1px dashed #cbd5e1",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#64748b", margin: 0, fontSize: "14px" }}>
            No milestone rules configured yet. Click &quot;+ Create New Milestone&quot; to add your first rule.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {rules.map((rule, index) => {
            const ruleNum = index + 1;
            return (
              <div
                key={index}
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div>
                  {/* Card Title & Badge */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                      gap: "8px",
                    }}
                  >
                    <strong style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                      Rule {ruleNum}
                    </strong>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "20px",
                        background: "#eff6ff",
                        color: "#2563eb",
                        border: "1px solid #bfdbfe",
                        fontSize: "12px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      ● Every {rule.every} visit{rule.every === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Reward text */}
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#334155",
                      margin: "0 0 12px",
                      lineHeight: "1.4",
                      fontWeight: 500,
                    }}
                  >
                    {rule.reward}
                  </p>

                  {/* Rule details summary */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      fontSize: "12px",
                      color: "#475569",
                      background: "#f8fafc",
                      padding: "10px 12px",
                      borderRadius: "8px",
                    }}
                  >
                    <div>
                      🎁 <strong>Reward:</strong> {rule.reward}
                    </div>
                    <div>
                      🔄 <strong>Frequency:</strong> Repeats every {rule.every} visit{rule.every === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {/* Card Actions: Edit & Delete */}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                    paddingTop: "12px",
                    borderTop: "1px solid #f1f5f9",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openEditModal(index)}
                    disabled={saving}
                    style={{
                      padding: "6px 12px",
                      background: "#f1f5f9",
                      color: "#334155",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    disabled={saving}
                    style={{
                      padding: "6px 12px",
                      background: "#fef2f2",
                      color: "#dc2626",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setShowModal(false);
            }
          }}
        >
          <form
            onSubmit={handleModalSubmit}
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "24px",
              maxWidth: "480px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: "18px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {editIndex !== null
                ? `Edit Milestone Rule ${editIndex + 1}`
                : "Create New Milestone Rule"}
            </h3>

            {modalError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "14px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                }}
              >
                {modalError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Every N visits */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#475569",
                    marginBottom: "4px",
                  }}
                >
                  Milestone Interval (Visits) *
                </label>
                <input
                  type="number"
                  min={MIN_INTERVAL}
                  max={MAX_INTERVAL}
                  value={modalEvery}
                  onChange={(e) => {
                    setModalError(null);
                    setModalEvery(e.target.value);
                  }}
                  placeholder="e.g. 5"
                  required
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    marginTop: "3px",
                    display: "block",
                  }}
                >
                  Whole number between {MIN_INTERVAL} and {MAX_INTERVAL}. Repeats every N visits.
                </span>
              </div>

              {/* Reward description */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#475569",
                    marginBottom: "4px",
                  }}
                >
                  Reward Description *
                </label>
                <input
                  type="text"
                  maxLength={MAX_REWARD_LENGTH}
                  value={modalReward}
                  onChange={(e) => {
                    setModalError(null);
                    setModalReward(e.target.value);
                  }}
                  placeholder="e.g. 10% off next visit"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    marginTop: "3px",
                    display: "block",
                  }}
                >
                  Max {MAX_REWARD_LENGTH} characters. Text sent to customer upon reaching milestone.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setModalError(null);
                }}
                disabled={saving}
                style={{
                  padding: "10px 16px",
                  background: "#f1f5f9",
                  color: "#334155",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "10px 18px",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editIndex !== null
                  ? "Save Changes"
                  : "Save Milestone"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
