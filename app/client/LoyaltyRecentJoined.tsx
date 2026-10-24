"use client";

import React, { useState, useMemo } from "react";
import { normalizePhone } from "../lib/whatsapp";
import { ChatIcon } from "./LoyaltyWhatsAppModal";

export type LoyaltyRecentJoinedProps = {
  members: any[];
  recordingId: string | null;
  removingId: string | null;
  onRecordVisit: (member: any) => void;
  onRemoveMember: (member: any) => void;
  onOpenWhatsApp: (member: any) => void;
};

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

  // Relative time calculated on render
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

export default function LoyaltyRecentJoined({
  members,
  recordingId,
  removingId,
  onRecordVisit,
  onRemoveMember,
  onOpenWhatsApp,
}: LoyaltyRecentJoinedProps) {
  // Collapsed by default
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Top 10 most recently joined members by created_at desc (ties: name A-Z)
  // Missing or invalid created_at sorts last
  const recentMembers = useMemo(() => {
    return [...members]
      .sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : NaN;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : NaN;
        const hasA = !isNaN(timeA);
        const hasB = !isNaN(timeB);

        // Missing or invalid created_at sorts last
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (hasA && hasB && timeA !== timeB) {
          return timeB - timeA; // Most recent first
        }

        // Tie-breaker: customer name A-Z
        const nameA = (a.customer?.name || "").trim().toLowerCase();
        const nameB = (b.customer?.name || "").trim().toLowerCase();
        return nameA.localeCompare(nameB);
      })
      .slice(0, 10);
  }, [members]);

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      {/* COLLAPSIBLE TOGGLE BAR */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-controls="loyalty-recently-joined-content"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          background: isExpanded ? "#f1f5f9" : "#f8fafc",
          border: "none",
          borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          transition: "background 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: "-0.01em",
            }}
          >
            Recently joined
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#475569",
              background: "#e2e8f0",
              padding: "2px 8px",
              borderRadius: "10px",
              lineHeight: 1.3,
            }}
          >
            {recentMembers.length}
          </span>
        </div>

        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#64748b"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            display: "block",
          }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* EXPANDED CONTENT LIST */}
      {isExpanded && (
        <div
          id="loyalty-recently-joined-content"
          style={{
            padding: "12px 16px",
            background: "#ffffff",
          }}
        >
          {recentMembers.length === 0 ? (
            <p
              style={{
                color: "#64748b",
                fontSize: "13px",
                margin: "4px 0",
              }}
            >
              No members have joined yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentMembers.map((member) => {
                const phoneDigits = normalizePhone(member.customer?.phone);
                const isValidPhone = Boolean(phoneDigits);
                const dateInfo = formatJoinedDate(member.created_at);
                const visits = typeof member.visits === "number" && !isNaN(member.visits) ? member.visits : 0;
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
                          gap: "12px",
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
