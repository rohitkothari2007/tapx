"use client";

import React, { useState, useEffect, useMemo } from "react";
import { normalizePhone } from "../lib/whatsapp";
import { ChatIcon } from "./LoyaltyWhatsAppModal";

export type LoyaltyMember = {
  id: string;
  customer_id?: string;
  visits?: number | null;
  redemption_count?: number | null;
  reward_claimed?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  customer?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  [key: string]: any;
};

export type LoyaltyMemberListsProps = {
  members: LoyaltyMember[];
  searchText: string;
  recordingId: string | null;
  removingId: string | null;
  onRecordVisit: (member: LoyaltyMember) => void;
  onRemoveMember: (member: LoyaltyMember) => void;
  onOpenWhatsApp: (member: LoyaltyMember) => void;
};

export type TabKey = "recent" | "most" | "fewest" | "rewards";

/**
 * Formats a timestamp into relative time and Asia/Kolkata DD-MMM-YYYY HH:mm.
 * Returns null if the date is missing or invalid.
 */
export function formatJoinedDate(
  dateStr: string | null | undefined
): { relative: string; absolute: string } | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;

  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative = "";
  if (diffSec < 60) {
    relative = "Just now";
  } else if (diffMin === 1) {
    relative = "1 minute ago";
  } else if (diffMin < 60) {
    relative = `${diffMin} minutes ago`;
  } else if (diffHours === 1) {
    relative = "1 hour ago";
  } else if (diffHours < 24) {
    relative = `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    relative = "Yesterday";
  } else if (diffDays < 30) {
    relative = `${diffDays} days ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    relative = months === 1 ? "1 month ago" : `${months} months ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    relative = years === 1 ? "1 year ago" : `${years} years ago`;
  }

  // Absolute date in Asia/Kolkata timezone: DD-MMM-YYYY HH:mm
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  let day = "";
  let month = "";
  let year = "";
  let hour = "";
  let minute = "";

  for (const part of parts) {
    if (part.type === "day") day = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "year") year = part.value;
    else if (part.type === "hour") hour = part.value;
    else if (part.type === "minute") minute = part.value;
  }

  const absolute = `${day}-${month}-${year} ${hour}:${minute}`;
  return { relative, absolute };
}

export default function LoyaltyMemberLists({
  members,
  searchText,
  recordingId,
  removingId,
  onRecordVisit,
  onRemoveMember,
  onOpenWhatsApp,
}: LoyaltyMemberListsProps) {
  // Only one panel open at a time; nothing open by default
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);

  // When searchText becomes non-empty, close any open panel
  useEffect(() => {
    if (searchText && searchText.trim().length > 0) {
      setActiveTab(null);
    }
  }, [searchText]);

  // 1. "Recently joined": created_at descending (ties: name A-Z; missing/invalid created_at last)
  const recentEligible = useMemo(() => {
    return [...members].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : NaN;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : NaN;
      const hasA = !isNaN(timeA);
      const hasB = !isNaN(timeB);

      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      if (hasA && hasB && timeA !== timeB) {
        return timeB - timeA;
      }

      const nameA = (a.customer?.name || "").trim().toLowerCase();
      const nameB = (b.customer?.name || "").trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members]);

  // 2. "Most visits": visits descending (ties: updated_at descending, then name). Missing visits count as 0.
  const mostEligible = useMemo(() => {
    return [...members].sort((a, b) => {
      const visitsA = typeof a.visits === "number" && !isNaN(a.visits) ? a.visits : 0;
      const visitsB = typeof b.visits === "number" && !isNaN(b.visits) ? b.visits : 0;
      if (visitsA !== visitsB) {
        return visitsB - visitsA;
      }

      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : NaN;
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : NaN;
      const hasA = !isNaN(timeA);
      const hasB = !isNaN(timeB);

      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      if (hasA && hasB && timeA !== timeB) {
        return timeB - timeA;
      }

      const nameA = (a.customer?.name || "").trim().toLowerCase();
      const nameB = (b.customer?.name || "").trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members]);

  // 3. "Fewest visits": visits ascending, including 0 (ties: created_at ascending, then name). Missing visits count as 0.
  const fewestEligible = useMemo(() => {
    return [...members].sort((a, b) => {
      const visitsA = typeof a.visits === "number" && !isNaN(a.visits) ? a.visits : 0;
      const visitsB = typeof b.visits === "number" && !isNaN(b.visits) ? b.visits : 0;
      if (visitsA !== visitsB) {
        return visitsA - visitsB;
      }

      const timeA = a.created_at ? new Date(a.created_at).getTime() : NaN;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : NaN;
      const hasA = !isNaN(timeA);
      const hasB = !isNaN(timeB);

      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      if (hasA && hasB && timeA !== timeB) {
        return timeA - timeB;
      }

      const nameA = (a.customer?.name || "").trim().toLowerCase();
      const nameB = (b.customer?.name || "").trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members]);

  // 4. "Rewards redeemed": redemption_count > 0, descending (ties: updated_at descending, then name). Missing redemption_count counts as 0.
  const rewardsEligible = useMemo(() => {
    const filtered = members.filter((m) => {
      const red = typeof m.redemption_count === "number" && !isNaN(m.redemption_count) ? m.redemption_count : 0;
      return red > 0;
    });

    return filtered.sort((a, b) => {
      const redA = typeof a.redemption_count === "number" && !isNaN(a.redemption_count) ? a.redemption_count : 0;
      const redB = typeof b.redemption_count === "number" && !isNaN(b.redemption_count) ? b.redemption_count : 0;
      if (redA !== redB) {
        return redB - redA;
      }

      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : NaN;
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : NaN;
      const hasA = !isNaN(timeA);
      const hasB = !isNaN(timeB);

      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      if (hasA && hasB && timeA !== timeB) {
        return timeB - timeA;
      }

      const nameA = (a.customer?.name || "").trim().toLowerCase();
      const nameB = (b.customer?.name || "").trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members]);

  // Top 10 slices for display
  const recentTop10 = useMemo(() => recentEligible.slice(0, 10), [recentEligible]);
  const mostTop10 = useMemo(() => mostEligible.slice(0, 10), [mostEligible]);
  const fewestTop10 = useMemo(() => fewestEligible.slice(0, 10), [fewestEligible]);
  const rewardsTop10 = useMemo(() => rewardsEligible.slice(0, 10), [rewardsEligible]);

  const tabs: {
    key: TabKey;
    label: string;
    count: number;
    items: LoyaltyMember[];
    emptyText: string;
  }[] = [
    {
      key: "recent",
      label: "Recently joined",
      count: recentEligible.length,
      items: recentTop10,
      emptyText: "No members have joined yet.",
    },
    {
      key: "most",
      label: "Most visits",
      count: mostEligible.length,
      items: mostTop10,
      emptyText: "No members yet.",
    },
    {
      key: "fewest",
      label: "Fewest visits",
      count: fewestEligible.length,
      items: fewestTop10,
      emptyText: "No members yet.",
    },
    {
      key: "rewards",
      label: "Rewards redeemed",
      count: rewardsEligible.length,
      items: rewardsTop10,
      emptyText: "No rewards have been redeemed yet.",
    },
  ];

  const currentTab = tabs.find((t) => t.key === activeTab);

  const handleToggle = (tabKey: TabKey) => {
    setActiveTab((prev) => (prev === tabKey ? null : tabKey));
  };

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        .loyalty-member-lists-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          width: 100%;
        }
        @media (min-width: 768px) {
          .loyalty-member-lists-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>

      {/* FOUR LIST BUTTONS */}
      <div
        className="loyalty-member-lists-grid"
        style={{ marginBottom: activeTab ? "12px" : "0" }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleToggle(tab.key)}
              aria-expanded={isActive}
              aria-controls={`loyalty-list-panel-${tab.key}`}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "9px 8px",
                background: isActive ? "#0f172a" : "#f8fafc",
                color: isActive ? "#ffffff" : "#0f172a",
                border: isActive ? "1px solid #0f172a" : "1px solid #e2e8f0",
                borderRadius: "8px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12px",
                fontWeight: 600,
                transition: "all 0.15s ease",
                boxSizing: "border-box",
                whiteSpace: "nowrap",
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: isActive ? "#ffffff" : "#475569",
                  background: isActive ? "#334155" : "#e2e8f0",
                  padding: "2px 7px",
                  borderRadius: "10px",
                  lineHeight: 1.2,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* EXPANDED LIST PANEL */}
      {currentTab && (
        <div
          id={`loyalty-list-panel-${currentTab.key}`}
          role="region"
          aria-label={currentTab.label}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            background: "#ffffff",
            padding: "16px",
          }}
        >
          {currentTab.items.length === 0 ? (
            <p
              style={{
                color: "#64748b",
                fontSize: "13px",
                margin: "4px 0",
              }}
            >
              {currentTab.emptyText}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {currentTab.items.map((member) => {
                const phoneDigits = normalizePhone(member.customer?.phone);
                const isValidPhone = Boolean(phoneDigits);
                const dateInfo = formatJoinedDate(member.created_at);
                const visits =
                  typeof member.visits === "number" && !isNaN(member.visits) ? member.visits : 0;
                const redemptions =
                  typeof member.redemption_count === "number" && !isNaN(member.redemption_count)
                    ? member.redemption_count
                    : 0;
                const isRecording = recordingId === member.id;
                const isRemoving = removingId === member.id;
                const isBusy = isRecording || isRemoving;

                return (
                  <div
                    key={member.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "#f8fafc",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    {/* MEMBER INFO */}
                    <div style={{ minWidth: "180px", flex: "1 1 220px" }}>
                      <strong
                        style={{
                          fontSize: "13px",
                          color: "#0f172a",
                          display: "block",
                        }}
                      >
                        {member.customer?.name || "Customer"}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        {member.customer?.phone || "No phone"}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          marginTop: "4px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#2563eb",
                            fontWeight: 700,
                          }}
                        >
                          {visits} verified visit{visits === 1 ? "" : "s"}
                        </span>
                        {currentTab.key === "recent" && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#475569",
                              background: "#f1f5f9",
                              border: "1px solid #e2e8f0",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontWeight: 500,
                            }}
                          >
                            {dateInfo
                              ? `Joined ${dateInfo.relative} · ${dateInfo.absolute}`
                              : "Date unavailable"}
                          </span>
                        )}
                        {currentTab.key === "rewards" && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#166534",
                              background: "#f0fdf4",
                              border: "1px solid #bbf7d0",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontWeight: 700,
                            }}
                          >
                            {redemptions} {redemptions === 1 ? "reward" : "rewards"} redeemed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ACTION BUTTONS (SAME AS MAIN LIST) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexShrink: 0,
                        flexWrap: "wrap",
                      }}
                    >
                      {/* RECORD VISIT */}
                      <button
                        type="button"
                        onClick={() => onRecordVisit(member)}
                        disabled={isBusy}
                        style={{
                          padding: "8px 14px",
                          background: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isRecording ? 0.6 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isRecording ? "Recording..." : "+ Record Visit"}
                      </button>

                      {/* WHATSAPP */}
                      <button
                        type="button"
                        onClick={() => onOpenWhatsApp(member)}
                        disabled={!isValidPhone || isBusy}
                        title={!isValidPhone ? "Invalid phone number" : "Message on WhatsApp"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 12px",
                          background: isValidPhone ? "#f0fdf4" : "#f8fafc",
                          color: isValidPhone ? "#166534" : "#94a3b8",
                          border: `1px solid ${isValidPhone ? "#bbf7d0" : "#e2e8f0"}`,
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: isValidPhone && !isBusy ? "pointer" : "not-allowed",
                          opacity: isValidPhone ? 1 : 0.6,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <ChatIcon size={14} />
                        <span>WhatsApp</span>
                      </button>

                      {/* REMOVE */}
                      <button
                        type="button"
                        onClick={() => onRemoveMember(member)}
                        disabled={isBusy}
                        style={{
                          padding: "8px 12px",
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isRemoving ? 0.6 : 1,
                          whiteSpace: "nowrap",
                        }}
                        title="Remove Member"
                      >
                        {isRemoving ? "Removing..." : "🗑️ Remove"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {currentTab.count > 10 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "10px 0 2px",
                    fontSize: "12px",
                    color: "#64748b",
                    fontWeight: 600,
                  }}
                >
                  Showing 10 of {currentTab.count}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
