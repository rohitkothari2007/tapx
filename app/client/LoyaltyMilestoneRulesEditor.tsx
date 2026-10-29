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
  const [rules, setRules] = useState<Array<{ every: string | number; reward: string }>>([
    { every: 5, reward: "10% off next visit" },
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Load existing config on mount or businessId change
  useEffect(() => {
    let isCancelled = false;

    async function loadConfig() {
      if (initialConfig && typeof initialConfig === "object") {
        const parsed = parseLoyaltyRules(initialConfig);
        if (!isCancelled) {
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

  const handleRuleChange = (index: number, field: "every" | "reward", value: string) => {
    setMessage(null);
    setRules((prev) => {
      const next = [...prev];
      if (field === "every") {
        next[index] = { ...next[index], every: value };
      } else {
        next[index] = { ...next[index], reward: value };
      }
      return next;
    });
  };

  const addRule = () => {
    if (rules.length >= MAX_MILESTONE_RULES) return;
    setMessage(null);
    setRules((prev) => {
      // Pick a reasonable default interval greater than previous
      const lastInterval = Number(prev[prev.length - 1]?.every) || 5;
      const nextInterval = Math.min(MAX_INTERVAL, lastInterval + 5);
      return [...prev, { every: nextInterval, reward: "" }];
    });
  };

  const removeRule = (index: number) => {
    if (rules.length <= 1) return;
    setMessage(null);
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (rules.length === 0) {
      setMessage({ text: "At least one milestone rule is required.", type: "error" });
      return;
    }

    const cleanRules: LoyaltyMilestoneRule[] = [];
    const seenIntervals = new Set<number>();

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const everyNum = typeof r.every === "number" ? r.every : Number(String(r.every).trim());

      if (!Number.isInteger(everyNum) || everyNum < MIN_INTERVAL || everyNum > MAX_INTERVAL) {
        setMessage({
          text: `Rule ${i + 1}: Milestone visits must be a whole number between ${MIN_INTERVAL} and ${MAX_INTERVAL}.`,
          type: "error",
        });
        return;
      }

      if (seenIntervals.has(everyNum)) {
        setMessage({
          text: `Duplicate milestone interval (${everyNum} visits). Each rule must have a unique interval.`,
          type: "error",
        });
        return;
      }
      seenIntervals.add(everyNum);

      const trimmedReward = String(r.reward || "").trim();
      if (!trimmedReward) {
        setMessage({
          text: `Rule ${i + 1}: Reward description is required.`,
          type: "error",
        });
        return;
      }

      if (trimmedReward.length > MAX_REWARD_LENGTH) {
        setMessage({
          text: `Rule ${i + 1}: Reward description must be at most ${MAX_REWARD_LENGTH} characters.`,
          type: "error",
        });
        return;
      }

      cleanRules.push({
        every: everyNum,
        reward: trimmedReward,
      });
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

      setMessage({ text: "✓ Loyalty milestone rules saved!", type: "success" });
      onSaved?.(cleanRules);
    } catch (err: any) {
      console.error("Failed to save milestone rules:", err);
      setMessage({
        text: err?.message || "Failed to save milestone rules.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: "20px",
        border: "1px solid #e2e8f0",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "16px" }}>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: "16px",
            fontWeight: 700,
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

      {message && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "16px",
            background: message.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            color: message.type === "success" ? "#166534" : "#dc2626",
          }}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#64748b", fontSize: "14px" }}>Loading rules...</p>
      ) : (
        <form onSubmit={handleSave}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "16px" }}>
            {rules.map((rule, index) => {
              const ruleNum = index + 1;
              return (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "14px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: "0 0 160px", minWidth: "140px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#475569",
                        marginBottom: "4px",
                      }}
                    >
                      Rule {ruleNum}: Every N visits
                    </label>
                    <input
                      type="number"
                      min={MIN_INTERVAL}
                      max={MAX_INTERVAL}
                      value={rule.every}
                      onChange={(e) => handleRuleChange(index, "every", e.target.value)}
                      placeholder="e.g. 5"
                      required
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                    <span style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px", display: "block" }}>
                      Repeats every {rule.every || "N"} visits
                    </span>
                  </div>

                  <div style={{ flex: "1 1 260px", minWidth: "200px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#475569",
                        marginBottom: "4px",
                      }}
                    >
                      Reward Description
                    </label>
                    <input
                      type="text"
                      maxLength={MAX_REWARD_LENGTH}
                      value={rule.reward}
                      onChange={(e) => handleRuleChange(index, "reward", e.target.value)}
                      placeholder="e.g. 10% off next visit"
                      required
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                    <span style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px", display: "block" }}>
                      Max {MAX_REWARD_LENGTH} chars
                    </span>
                  </div>

                  {rules.length > 1 && (
                    <div style={{ alignSelf: "center", marginTop: "16px" }}>
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        style={{
                          padding: "8px 12px",
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {rules.length < MAX_MILESTONE_RULES && (
              <button
                type="button"
                onClick={addRule}
                style={{
                  padding: "9px 14px",
                  background: "#f1f5f9",
                  color: "#0f172a",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Add rule
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 18px",
                background: "#0f172a",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Milestone Rules"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
