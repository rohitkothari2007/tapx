"use client";

import React, { useState, useEffect } from "react";
import { useRemindersData, RemindersData } from "./RemindersContext";
import OccasionsManager from "./OccasionsManager";
import {
  renderTemplate,
  formatIndiaSentTime,
  formatIndiaDateOnly,
  WelcomeReminderItem,
  RewardReminderItem,
  OfferReminderItem,
  OccasionReminderItem,
  SentHistoryItem,
} from "../lib/reminders";
import { formatWhatsAppUrl, normalizePhone } from "../lib/whatsapp";

export { useRemindersData, type RemindersData } from "./RemindersContext";

interface RemindersPageProps {
  businessId: string;
  businessName?: string;
  hasLoyalty: boolean;
  hasOffers: boolean;
  remindersData?: RemindersData;
}

type TabFilter = "pending" | "sent" | "history";

export default function RemindersPage({
  businessId,
  businessName,
  hasLoyalty,
  hasOffers,
  remindersData,
}: RemindersPageProps) {
  const fallbackData = useRemindersData({
    businessId: remindersData ? null : businessId,
    hasLoyalty,
    hasOffers,
  });

  const {
    loading,
    isTableMissing,
    isOccasionsMissing,
    welcomePending,
    welcomeSent,
    rewardPending,
    rewardSent,
    offerPending,
    offerSent,
    liveOffersCount,
    occasions,
    activeOccasionGroups,
    pastOccasions,
    totalOccasionPending,
    sentHistory,
    templates,
    setTemplate,
    createOccasion,
    updateOccasion,
    deleteOccasion,
    markAsSent,
    markAsNotSent,
    refresh,
  } = remindersData || fallbackData;

  const [activeTab, setActiveTab] = useState<TabFilter>("pending");
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Undo notification state (5 second active window)
  const [undoItem, setUndoItem] = useState<{
    membershipId: string;
    messageType: "welcome" | "reward" | "offer" | "occasion";
    refId: string;
    label: string;
  } | null>(null);

  // Row display limits (10 rows max per section by default)
  const [showAllWelcome, setShowAllWelcome] = useState(false);
  const [showAllReward, setShowAllReward] = useState(false);
  const [showAllOffer, setShowAllOffer] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllOccasionMembers, setShowAllOccasionMembers] = useState<Record<string, boolean>>({});

  // Template editor toggle states
  const [editTemplateSection, setEditTemplateSection] = useState<"welcome" | "reward" | "offer" | null>(
    null
  );

  // Manage Occasions modal state
  const [isOccasionsModalOpen, setIsOccasionsModalOpen] = useState(false);
  const [expandedPastOccasions, setExpandedPastOccasions] = useState(false);

  // Per-member custom message editor state (for sending custom message for that send only)
  const [editingMessagePerMember, setEditingMessagePerMember] = useState<Record<string, string>>({});
  const [expandedCustomizePerMember, setExpandedCustomizePerMember] = useState<Record<string, boolean>>({});

  // Clear undo state after 5 seconds
  useEffect(() => {
    if (!undoItem) return;
    const timer = setTimeout(() => {
      setUndoItem(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [undoItem]);

  // Handle "Send" via WhatsApp (Opens window, then inserts log row)
  async function handleSendWhatsApp(params: {
    phoneDigits: string | null;
    rawMessage: string;
    membershipId: string;
    messageType: "welcome" | "reward" | "offer" | "occasion";
    refId: string;
    customerName: string;
  }) {
    const { phoneDigits, rawMessage, membershipId, messageType, refId, customerName } = params;

    if (!phoneDigits) {
      setFeedbackMessage({ text: "Cannot send: Invalid phone number.", type: "error" });
      return;
    }

    const itemKey = `${membershipId}__${messageType}__${refId}`;
    setProcessingKey(itemKey);

    try {
      const waUrl = formatWhatsAppUrl(phoneDigits, rawMessage);
      // Open in new tab with security attributes
      window.open(waUrl, "_blank", "noopener,noreferrer");

      const res = await markAsSent({ membershipId, messageType, refId });
      if (res.success) {
        setUndoItem({
          membershipId,
          messageType,
          refId,
          label: `${customerName} (${messageType})`,
        });
        setFeedbackMessage({
          text: `WhatsApp opened for ${customerName}. Marked as sent.`,
          type: "success",
        });
      } else {
        setFeedbackMessage({
          text: res.error || "Failed to record message status.",
          type: "error",
        });
      }
    } finally {
      setProcessingKey(null);
    }
  }

  // Handle "Mark as sent" (no WhatsApp redirect)
  async function handleMarkAsSentOnly(params: {
    membershipId: string;
    messageType: "welcome" | "reward" | "offer" | "occasion";
    refId: string;
    customerName: string;
  }) {
    const { membershipId, messageType, refId, customerName } = params;
    const itemKey = `${membershipId}__${messageType}__${refId}`;
    setProcessingKey(itemKey);

    try {
      const res = await markAsSent({ membershipId, messageType, refId });
      if (res.success) {
        setUndoItem({
          membershipId,
          messageType,
          refId,
          label: `${customerName} (${messageType})`,
        });
        setFeedbackMessage({
          text: `Marked as sent for ${customerName}.`,
          type: "success",
        });
      } else {
        setFeedbackMessage({
          text: res.error || "Failed to mark as sent.",
          type: "error",
        });
      }
    } finally {
      setProcessingKey(null);
    }
  }

  // Handle "Mark as not sent" / Undo action
  async function handleMarkAsNotSent(params: {
    membershipId: string;
    messageType: "welcome" | "reward" | "offer" | "occasion";
    refId: string;
    customerName: string;
  }) {
    const { membershipId, messageType, refId, customerName } = params;
    const itemKey = `${membershipId}__${messageType}__${refId}`;
    setProcessingKey(itemKey);

    try {
      const res = await markAsNotSent({ membershipId, messageType, refId });
      if (res.success) {
        if (undoItem?.membershipId === membershipId && undoItem?.refId === refId) {
          setUndoItem(null);
        }
        setFeedbackMessage({
          text: `Marked as not sent for ${customerName}.`,
          type: "success",
        });
      } else {
        setFeedbackMessage({
          text: res.error || "Failed to revert message status.",
          type: "error",
        });
      }
    } finally {
      setProcessingKey(null);
    }
  }

  // Trigger undo from undo notification bar
  async function handleTriggerUndo() {
    if (!undoItem) return;
    await handleMarkAsNotSent({
      membershipId: undoItem.membershipId,
      messageType: undoItem.messageType,
      refId: undoItem.refId,
      customerName: undoItem.label,
    });
  }

  // Section item counts
  const currentWelcomeList = activeTab === "pending" ? welcomePending : welcomeSent;
  const currentRewardList = activeTab === "pending" ? rewardPending : rewardSent;
  const currentOfferList = activeTab === "pending" ? offerPending : offerSent;

  const currentOccasionPendingCount = totalOccasionPending;
  const currentOccasionSentCount = activeOccasionGroups.reduce(
    (acc, g) => acc + g.sentItems.length,
    0
  );
  const currentOccasionCount =
    activeTab === "pending" ? currentOccasionPendingCount : currentOccasionSentCount;

  const totalCurrentSectionCount =
    currentWelcomeList.length +
    currentRewardList.length +
    currentOfferList.length +
    currentOccasionCount;

  return (
    <div
      key={businessId}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        maxWidth: "1280px",
        margin: "0 auto",
      }}
    >
      {/* HEADER BAR */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 6px",
              fontSize: "24px",
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            Reminders
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
            Track pending customer WhatsApp messages and record who has been contacted.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setIsOccasionsModalOpen(true)}
            style={{
              padding: "8px 16px",
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            Manage occasions ({occasions.length}/20)
          </button>

          <button
            type="button"
            onClick={() => refresh()}
            disabled={loading}
            style={{
              padding: "8px 16px",
              background: "#ffffff",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* TABLE MISSING BANNER */}
      {isTableMissing && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            padding: "16px 20px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Reminders are not available yet. Message logging table is initializing.
        </div>
      )}

      {/* DELIVERY DISCLAIMER (Required) */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          color: "#475569",
          padding: "12px 16px",
          borderRadius: "10px",
          fontSize: "13px",
          lineHeight: "1.4",
        }}
      >
        Sent means you opened WhatsApp and marked it. TAPX cannot confirm delivery.
      </div>

      {/* FEEDBACK MESSAGE */}
      {feedbackMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: feedbackMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: feedbackMessage.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${
              feedbackMessage.type === "success" ? "#a7f3d0" : "#fecaca"
            }`,
          }}
        >
          <span>{feedbackMessage.text}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {undoItem && (
              <button
                type="button"
                onClick={handleTriggerUndo}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#047857",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e2e8f0",
          gap: "8px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "pending" ? "2px solid #2563eb" : "2px solid transparent",
            color: activeTab === "pending" ? "#2563eb" : "#64748b",
            fontWeight: activeTab === "pending" ? 700 : 500,
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>Pending</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: 700,
              background: activeTab === "pending" ? "#eff6ff" : "#f1f5f9",
              color: activeTab === "pending" ? "#2563eb" : "#64748b",
            }}
          >
            {welcomePending.length + rewardPending.length + offerPending.length + totalOccasionPending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sent")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "sent" ? "2px solid #2563eb" : "2px solid transparent",
            color: activeTab === "sent" ? "#2563eb" : "#64748b",
            fontWeight: activeTab === "sent" ? 700 : 500,
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>Sent</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: 700,
              background: activeTab === "sent" ? "#eff6ff" : "#f1f5f9",
              color: activeTab === "sent" ? "#2563eb" : "#64748b",
            }}
          >
            {welcomeSent.length + rewardSent.length + offerSent.length + currentOccasionSentCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "history" ? "2px solid #2563eb" : "2px solid transparent",
            color: activeTab === "history" ? "#2563eb" : "#64748b",
            fontWeight: activeTab === "history" ? 700 : 500,
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>Sent history (30 days)</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: 700,
              background: activeTab === "history" ? "#eff6ff" : "#f1f5f9",
              color: activeTab === "history" ? "#2563eb" : "#64748b",
            }}
          >
            {sentHistory.length}
          </span>
        </button>
      </div>

      {/* =========================================================
          SENT HISTORY TAB VIEW
      ========================================================= */}
      {activeTab === "history" && (
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            padding: "20px",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              Sent history
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              Log of all customer messages recorded in the last 30 days.
            </p>
          </div>

          {sentHistory.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "14px", margin: "16px 0" }}>
              No messages have been sent or recorded in the last 30 days.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(showAllHistory ? sentHistory : sentHistory.slice(0, 10)).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "13px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div>
                    <strong style={{ color: "#0f172a", display: "inline-block", marginRight: "8px" }}>
                      {item.customerName}
                    </strong>
                    <span style={{ color: "#64748b" }}>{item.customerPhone || "No phone"}</span>
                    <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                      <span
                        style={{
                          textTransform: "capitalize",
                          fontWeight: 600,
                          color: "#2563eb",
                          marginRight: "6px",
                        }}
                      >
                        [{item.messageType}]
                      </span>
                      {item.detailLabel}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "10px",
                        background: "#ecfdf5",
                        color: "#059669",
                        border: "1px solid #a7f3d0",
                      }}
                    >
                      Sent {formatIndiaSentTime(item.sentAt)}
                    </span>
                  </div>
                </div>
              ))}

              {sentHistory.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllHistory((prev) => !prev)}
                  style={{
                    padding: "8px 12px",
                    background: "transparent",
                    border: "none",
                    color: "#2563eb",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "center",
                    marginTop: "8px",
                  }}
                >
                  {showAllHistory ? "Show less" : `Show all (${sentHistory.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          PENDING & SENT TAB SECTIONS
      ========================================================= */}
      {activeTab !== "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {totalCurrentSectionCount === 0 && !loading && (
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
                {activeTab === "pending"
                  ? "No pending reminders right now."
                  : "No sent reminders recorded yet."}
              </p>
            </div>
          )}

          {/* 1. WELCOME SECTION (Only if Loyalty is enabled) */}
          {hasLoyalty && (
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: "0 0 4px",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Welcome reminders ({currentWelcomeList.length})
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    New customers who joined loyalty in the last 7 days.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditTemplateSection((prev) => (prev === "welcome" ? null : "welcome"))
                  }
                  style={{
                    padding: "6px 12px",
                    background: "#f1f5f9",
                    color: "#334155",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {editTemplateSection === "welcome" ? "Close template" : "Edit template"}
                </button>
              </div>

              {/* Template Editor Box */}
              {editTemplateSection === "welcome" && (
                <div
                  style={{
                    background: "#f8fafc",
                    padding: "16px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "16px",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#475569",
                      marginBottom: "6px",
                    }}
                  >
                    Welcome message template (max 1000 characters)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={templates.welcome}
                    onChange={(e) => setTemplate("welcome", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "#64748b",
                      marginTop: "4px",
                    }}
                  >
                    <span>Placeholders: {"{name}"}, {"{business}"}</span>
                    <span>{templates.welcome.length}/1000</span>
                  </div>
                </div>
              )}

              {/* Welcome Rows List */}
              {currentWelcomeList.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
                  {activeTab === "pending"
                    ? "No pending welcome messages. All recent members have been greeted."
                    : "No welcome messages sent in the last 7 days."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(showAllWelcome ? currentWelcomeList : currentWelcomeList.slice(0, 10)).map(
                    (item) => {
                      const itemKey = `${item.membershipId}__welcome__`;
                      const isProcessing = processingKey === itemKey;
                      const hasValidPhone = Boolean(item.phoneDigits);

                      const messageText = renderTemplate(templates.welcome, {
                        name: item.customerName,
                        business: businessName,
                      });

                      return (
                        <div
                          key={itemKey}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            background: "#f8fafc",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            flexWrap: "wrap",
                            gap: "12px",
                          }}
                        >
                          <div>
                            <strong
                              style={{ fontSize: "14px", color: "#0f172a", display: "block" }}
                            >
                              {item.customerName}
                            </strong>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                              {item.customerPhone || "No phone"} &bull; Joined{" "}
                              {formatIndiaDateOnly(item.joinedAt)}
                            </span>
                            <div style={{ marginTop: "4px" }}>
                              {item.isSent ? (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: "10px",
                                    background: "#ecfdf5",
                                    color: "#059669",
                                    border: "1px solid #a7f3d0",
                                  }}
                                >
                                  Sent {formatIndiaSentTime(item.sentAt)}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: "10px",
                                    background: "#fef3c7",
                                    color: "#b45309",
                                    border: "1px solid #fde68a",
                                  }}
                                >
                                  Not sent
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexShrink: 0,
                            }}
                          >
                            {!item.isSent ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSendWhatsApp({
                                      phoneDigits: item.phoneDigits,
                                      rawMessage: messageText,
                                      membershipId: item.membershipId,
                                      messageType: "welcome",
                                      refId: "",
                                      customerName: item.customerName,
                                    })
                                  }
                                  disabled={!hasValidPhone || isProcessing || isTableMissing}
                                  title={!hasValidPhone ? "Invalid phone number" : "Open WhatsApp"}
                                  style={{
                                    padding: "6px 14px",
                                    background: hasValidPhone ? "#2563eb" : "#94a3b8",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor:
                                      !hasValidPhone || isProcessing ? "not-allowed" : "pointer",
                                  }}
                                >
                                  {isProcessing ? "Saving..." : "Send"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleMarkAsSentOnly({
                                      membershipId: item.membershipId,
                                      messageType: "welcome",
                                      refId: "",
                                      customerName: item.customerName,
                                    })
                                  }
                                  disabled={isProcessing || isTableMissing}
                                  style={{
                                    padding: "6px 12px",
                                    background: "#ffffff",
                                    color: "#475569",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: isProcessing ? "not-allowed" : "pointer",
                                  }}
                                >
                                  Mark as sent
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleMarkAsNotSent({
                                    membershipId: item.membershipId,
                                    messageType: "welcome",
                                    refId: "",
                                    customerName: item.customerName,
                                  })
                                }
                                disabled={isProcessing || isTableMissing}
                                style={{
                                  padding: "6px 12px",
                                  background: "#ffffff",
                                  color: "#dc2626",
                                  border: "1px solid #fecaca",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: isProcessing ? "not-allowed" : "pointer",
                                }}
                              >
                                Mark as not sent
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}

                  {currentWelcomeList.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllWelcome((prev) => !prev)}
                      style={{
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        color: "#2563eb",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      {showAllWelcome ? "Show less" : `Show all (${currentWelcomeList.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. REWARDS SECTION (Only if Loyalty is enabled) */}
          {hasLoyalty && (
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: "0 0 4px",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Reward reminders ({currentRewardList.length})
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    Members who have earned an unclaimed loyalty milestone reward.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditTemplateSection((prev) => (prev === "reward" ? null : "reward"))
                  }
                  style={{
                    padding: "6px 12px",
                    background: "#f1f5f9",
                    color: "#334155",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {editTemplateSection === "reward" ? "Close template" : "Edit template"}
                </button>
              </div>

              {/* Template Editor Box */}
              {editTemplateSection === "reward" && (
                <div
                  style={{
                    background: "#f8fafc",
                    padding: "16px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "16px",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#475569",
                      marginBottom: "6px",
                    }}
                  >
                    Reward message template (max 1000 characters)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={templates.reward}
                    onChange={(e) => setTemplate("reward", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "#64748b",
                      marginTop: "4px",
                    }}
                  >
                    <span>Placeholders: {"{name}"}, {"{business}"}, {"{reward}"}</span>
                    <span>{templates.reward.length}/1000</span>
                  </div>
                </div>
              )}

              {/* Reward Rows List */}
              {currentRewardList.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
                  {activeTab === "pending"
                    ? "No pending reward reminders. All members with earned rewards have been contacted."
                    : "No reward reminders sent yet."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(showAllReward ? currentRewardList : currentRewardList.slice(0, 10)).map(
                    (item) => {
                      const itemKey = `${item.membershipId}__reward__${item.refId}`;
                      const isProcessing = processingKey === itemKey;
                      const hasValidPhone = Boolean(item.phoneDigits);

                      const messageText = renderTemplate(templates.reward, {
                        name: item.customerName,
                        business: businessName,
                        reward: item.rewardDescription,
                      });

                      return (
                        <div
                          key={itemKey}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            background: "#f8fafc",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            flexWrap: "wrap",
                            gap: "12px",
                          }}
                        >
                          <div>
                            <strong
                              style={{ fontSize: "14px", color: "#0f172a", display: "block" }}
                            >
                              {item.customerName}
                            </strong>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                              {item.customerPhone || "No phone"} &bull; Reward:{" "}
                              <strong style={{ color: "#0f172a" }}>
                                {item.rewardDescription}
                              </strong>
                            </span>
                            <div style={{ marginTop: "4px" }}>
                              {item.isSent ? (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: "10px",
                                    background: "#ecfdf5",
                                    color: "#059669",
                                    border: "1px solid #a7f3d0",
                                  }}
                                >
                                  Sent {formatIndiaSentTime(item.sentAt)}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: "10px",
                                    background: "#fef3c7",
                                    color: "#b45309",
                                    border: "1px solid #fde68a",
                                  }}
                                >
                                  Not sent
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexShrink: 0,
                            }}
                          >
                            {!item.isSent ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSendWhatsApp({
                                      phoneDigits: item.phoneDigits,
                                      rawMessage: messageText,
                                      membershipId: item.membershipId,
                                      messageType: "reward",
                                      refId: item.refId,
                                      customerName: item.customerName,
                                    })
                                  }
                                  disabled={!hasValidPhone || isProcessing || isTableMissing}
                                  title={!hasValidPhone ? "Invalid phone number" : "Open WhatsApp"}
                                  style={{
                                    padding: "6px 14px",
                                    background: hasValidPhone ? "#2563eb" : "#94a3b8",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor:
                                      !hasValidPhone || isProcessing ? "not-allowed" : "pointer",
                                  }}
                                >
                                  {isProcessing ? "Saving..." : "Send"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleMarkAsSentOnly({
                                      membershipId: item.membershipId,
                                      messageType: "reward",
                                      refId: item.refId,
                                      customerName: item.customerName,
                                    })
                                  }
                                  disabled={isProcessing || isTableMissing}
                                  style={{
                                    padding: "6px 12px",
                                    background: "#ffffff",
                                    color: "#475569",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: isProcessing ? "not-allowed" : "pointer",
                                  }}
                                >
                                  Mark as sent
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleMarkAsNotSent({
                                    membershipId: item.membershipId,
                                    messageType: "reward",
                                    refId: item.refId,
                                    customerName: item.customerName,
                                  })
                                }
                                disabled={isProcessing || isTableMissing}
                                style={{
                                  padding: "6px 12px",
                                  background: "#ffffff",
                                  color: "#dc2626",
                                  border: "1px solid #fecaca",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: isProcessing ? "not-allowed" : "pointer",
                                }}
                              >
                                Mark as not sent
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}

                  {currentRewardList.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllReward((prev) => !prev)}
                      style={{
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        color: "#2563eb",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      {showAllReward ? "Show less" : `Show all (${currentRewardList.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. LIVE OFFERS SECTION (Only if Offers is enabled) */}
          {hasOffers && (
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: "0 0 4px",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Live offers reminders ({currentOfferList.length})
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    Active campaigns ({liveOffersCount} live now) sent to members.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditTemplateSection((prev) => (prev === "offer" ? null : "offer"))
                  }
                  style={{
                    padding: "6px 12px",
                    background: "#f1f5f9",
                    color: "#334155",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {editTemplateSection === "offer" ? "Close template" : "Edit template"}
                </button>
              </div>

              {/* Compliance note (Required) */}
              <p
                style={{
                  fontSize: "12px",
                  color: "#d97706",
                  fontWeight: 600,
                  margin: "0 0 16px",
                }}
              >
                Message only customers who agreed to hear from you.
              </p>

              {/* Template Editor Box */}
              {editTemplateSection === "offer" && (
                <div
                  style={{
                    background: "#f8fafc",
                    padding: "16px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "16px",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#475569",
                      marginBottom: "6px",
                    }}
                  >
                    Offer message template (max 1000 characters)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={templates.offer}
                    onChange={(e) => setTemplate("offer", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "#64748b",
                      marginTop: "4px",
                    }}
                  >
                    <span>Placeholders: {"{name}"}, {"{business}"}, {"{offer}"}</span>
                    <span>{templates.offer.length}/1000</span>
                  </div>
                </div>
              )}

              {/* Offers Rows List */}
              {currentOfferList.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
                  {liveOffersCount === 0
                    ? "No offers are currently live now. Create or schedule offers in the Offers tab."
                    : activeTab === "pending"
                    ? "All eligible members have been notified for current live offers."
                    : "No offer reminders sent yet."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(showAllOffer ? currentOfferList : currentOfferList.slice(0, 10)).map((item) => {
                    const itemKey = `${item.membershipId}__offer__${item.refId}`;
                    const isProcessing = processingKey === itemKey;
                    const hasValidPhone = Boolean(item.phoneDigits);

                    const messageText = renderTemplate(templates.offer, {
                      name: item.customerName,
                      business: businessName,
                      offer: item.offerTitle,
                    });

                    return (
                      <div
                        key={itemKey}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          background: "#f8fafc",
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          flexWrap: "wrap",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>
                            {item.customerName}
                          </strong>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            {item.customerPhone || "No phone"} &bull; {item.offerTitle}
                          </span>
                          <div style={{ marginTop: "4px" }}>
                            {item.isSent ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                  background: "#ecfdf5",
                                  color: "#059669",
                                  border: "1px solid #a7f3d0",
                                }}
                              >
                                Sent {formatIndiaSentTime(item.sentAt)}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  border: "1px solid #fde68a",
                                }}
                              >
                                Not sent
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                          {!item.isSent ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSendWhatsApp({
                                    phoneDigits: item.phoneDigits,
                                    rawMessage: messageText,
                                    membershipId: item.membershipId,
                                    messageType: "offer",
                                    refId: item.refId,
                                    customerName: item.customerName,
                                  })
                                }
                                disabled={!hasValidPhone || isProcessing || isTableMissing}
                                title={!hasValidPhone ? "Invalid phone number" : "Open WhatsApp"}
                                style={{
                                  padding: "6px 14px",
                                  background: hasValidPhone ? "#2563eb" : "#94a3b8",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: !hasValidPhone || isProcessing ? "not-allowed" : "pointer",
                                }}
                              >
                                {isProcessing ? "Saving..." : "Send"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleMarkAsSentOnly({
                                    membershipId: item.membershipId,
                                    messageType: "offer",
                                    refId: item.refId,
                                    customerName: item.customerName,
                                  })
                                }
                                disabled={isProcessing || isTableMissing}
                                style={{
                                  padding: "6px 12px",
                                  background: "#ffffff",
                                  color: "#475569",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: isProcessing ? "not-allowed" : "pointer",
                                }}
                              >
                                Mark as sent
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleMarkAsNotSent({
                                  membershipId: item.membershipId,
                                  messageType: "offer",
                                  refId: item.refId,
                                  customerName: item.customerName,
                                })
                              }
                              disabled={isProcessing || isTableMissing}
                              style={{
                                padding: "6px 12px",
                                background: "#ffffff",
                                color: "#dc2626",
                                border: "1px solid #fecaca",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: isProcessing ? "not-allowed" : "pointer",
                              }}
                            >
                              Mark as not sent
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {currentOfferList.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllOffer((prev) => !prev)}
                      style={{
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        color: "#2563eb",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      {showAllOffer ? "Show less" : `Show all (${currentOfferList.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. OCCASIONS SECTION */}
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "8px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: "0 0 4px",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Occasions reminders ({currentOccasionCount})
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Festival greetings, wishes and notices ({activeOccasionGroups.length} active now).
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOccasionsModalOpen(true)}
                style={{
                  padding: "6px 12px",
                  background: "#f1f5f9",
                  color: "#334155",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Manage occasions
              </button>
            </div>

            {/* Compliance note (Required) */}
            <p
              style={{
                fontSize: "12px",
                color: "#d97706",
                fontWeight: 600,
                margin: "0 0 16px",
              }}
            >
              Message only customers who agreed to hear from you.
            </p>

            {/* If occasions table cannot be read */}
            {isOccasionsMissing && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  color: "#991b1b",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "16px",
                }}
              >
                Occasions are not available yet.
              </div>
            )}

            {/* ACTIVE OCCASIONS LIST (Under Pending or Sent) */}
            {activeOccasionGroups.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
                {occasions.length === 0
                  ? "No occasions configured yet. Click 'Manage occasions' to add festival wishes or notices."
                  : activeTab === "pending"
                  ? "No occasions are active for reminders today. Click 'Manage occasions' to view or schedule."
                  : "No occasion reminders sent yet."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {activeOccasionGroups.map((group) => {
                  const displayItems =
                    activeTab === "pending" ? group.pendingItems : group.sentItems;
                  const isExpandedAll = Boolean(showAllOccasionMembers[group.occasion.id]);
                  const visibleItems = isExpandedAll
                    ? displayItems
                    : displayItems.slice(0, 10);

                  const progressPercent =
                    group.totalEligibleCount > 0
                      ? Math.round((group.messagedCount / group.totalEligibleCount) * 100)
                      : 0;

                  return (
                    <div
                      key={group.occasion.id}
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "16px",
                      }}
                    >
                      {/* Occasion block header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          gap: "8px",
                          marginBottom: "12px",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                              {group.occasion.title}
                            </strong>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                background: "#ecfdf5",
                                color: "#059669",
                                border: "1px solid #a7f3d0",
                                borderRadius: "10px",
                                padding: "2px 8px",
                              }}
                            >
                              Date: {formatIndiaDateOnly(group.occasion.occasion_date)}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                            {group.messagedCount} of {group.totalEligibleCount} members messaged
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ width: "160px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "11px",
                              color: "#64748b",
                              marginBottom: "2px",
                            }}
                          >
                            <span>Progress</span>
                            <span>{progressPercent}%</span>
                          </div>
                          <div
                            style={{
                              width: "100%",
                              height: "6px",
                              background: "#e2e8f0",
                              borderRadius: "3px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${progressPercent}%`,
                                height: "100%",
                                background: "#2563eb",
                                transition: "width 0.3s ease",
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Members list under this occasion */}
                      {displayItems.length === 0 ? (
                        <p style={{ color: "#64748b", fontSize: "13px", margin: "8px 0" }}>
                          {activeTab === "pending"
                            ? "All eligible members have been messaged for this occasion."
                            : "No messages sent yet for this occasion."}
                        </p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {visibleItems.map((item) => {
                            const itemKey = `${item.membershipId}__occasion__${item.refId}`;
                            const isProcessing = processingKey === itemKey;
                            const hasValidPhone = Boolean(item.phoneDigits);

                            // Default rendered message
                            const defaultMessage = renderTemplate(group.occasion.message, {
                              name: item.customerName,
                              business: businessName,
                              occasion: group.occasion.title,
                            });

                            // Use customized message if owner edited it before sending
                            const activeMessage =
                              editingMessagePerMember[itemKey] !== undefined
                                ? editingMessagePerMember[itemKey]
                                : defaultMessage;

                            const isCustomizeOpen = Boolean(expandedCustomizePerMember[itemKey]);

                            return (
                              <div
                                key={itemKey}
                                style={{
                                  background: "white",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "8px",
                                  padding: "12px 14px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "8px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: "10px",
                                  }}
                                >
                                  <div>
                                    <strong
                                      style={{
                                        fontSize: "13px",
                                        color: "#0f172a",
                                        display: "block",
                                      }}
                                    >
                                      {item.customerName}
                                    </strong>
                                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                                      {item.customerPhone || "No phone"}
                                    </span>
                                    <div style={{ marginTop: "4px" }}>
                                      {item.isSent ? (
                                        <span
                                          style={{
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            padding: "2px 8px",
                                            borderRadius: "10px",
                                            background: "#ecfdf5",
                                            color: "#059669",
                                            border: "1px solid #a7f3d0",
                                          }}
                                        >
                                          Sent {formatIndiaSentTime(item.sentAt)}
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            padding: "2px 8px",
                                            borderRadius: "10px",
                                            background: "#fef3c7",
                                            color: "#b45309",
                                            border: "1px solid #fde68a",
                                          }}
                                        >
                                          Not sent
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {!item.isSent ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedCustomizePerMember((prev) => ({
                                              ...prev,
                                              [itemKey]: !prev[itemKey],
                                            }))
                                          }
                                          style={{
                                            padding: "6px 10px",
                                            background: isCustomizeOpen ? "#e2e8f0" : "#f1f5f9",
                                            color: "#334155",
                                            border: "none",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontWeight: 600,
                                            cursor: "pointer",
                                          }}
                                        >
                                          {isCustomizeOpen ? "Close edit" : "Customize"}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleSendWhatsApp({
                                              phoneDigits: item.phoneDigits,
                                              rawMessage: activeMessage,
                                              membershipId: item.membershipId,
                                              messageType: "occasion",
                                              refId: item.refId,
                                              customerName: item.customerName,
                                            })
                                          }
                                          disabled={
                                            !hasValidPhone || isProcessing || isTableMissing
                                          }
                                          title={
                                            !hasValidPhone
                                              ? "Invalid phone number"
                                              : "Open WhatsApp"
                                          }
                                          style={{
                                            padding: "6px 14px",
                                            background: hasValidPhone ? "#2563eb" : "#94a3b8",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            cursor:
                                              !hasValidPhone || isProcessing
                                                ? "not-allowed"
                                                : "pointer",
                                          }}
                                        >
                                          {isProcessing ? "Saving..." : "Send"}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleMarkAsSentOnly({
                                              membershipId: item.membershipId,
                                              messageType: "occasion",
                                              refId: item.refId,
                                              customerName: item.customerName,
                                            })
                                          }
                                          disabled={isProcessing || isTableMissing}
                                          style={{
                                            padding: "6px 12px",
                                            background: "#ffffff",
                                            color: "#475569",
                                            border: "1px solid #cbd5e1",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontWeight: 600,
                                            cursor: isProcessing ? "not-allowed" : "pointer",
                                          }}
                                        >
                                          Mark as sent
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMarkAsNotSent({
                                            membershipId: item.membershipId,
                                            messageType: "occasion",
                                            refId: item.refId,
                                            customerName: item.customerName,
                                          })
                                        }
                                        disabled={isProcessing || isTableMissing}
                                        style={{
                                          padding: "6px 12px",
                                          background: "#ffffff",
                                          color: "#dc2626",
                                          border: "1px solid #fecaca",
                                          borderRadius: "6px",
                                          fontSize: "12px",
                                          fontWeight: 600,
                                          cursor: isProcessing ? "not-allowed" : "pointer",
                                        }}
                                      >
                                        Mark as not sent
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Expandable inline message editor for that send only */}
                                {isCustomizeOpen && !item.isSent && (
                                  <div
                                    style={{
                                      background: "#f8fafc",
                                      padding: "10px",
                                      borderRadius: "6px",
                                      border: "1px solid #cbd5e1",
                                      marginTop: "4px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        color: "#475569",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      Edit message for {item.customerName} (this send only):
                                    </div>
                                    <textarea
                                      rows={2}
                                      maxLength={1000}
                                      value={activeMessage}
                                      onChange={(e) =>
                                        setEditingMessagePerMember((prev) => ({
                                          ...prev,
                                          [itemKey]: e.target.value.slice(0, 1000),
                                        }))
                                      }
                                      style={{
                                        width: "100%",
                                        padding: "6px 8px",
                                        borderRadius: "6px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "12px",
                                        boxSizing: "border-box",
                                        fontFamily: "inherit",
                                      }}
                                    />
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: "10px",
                                        color: "#64748b",
                                        marginTop: "2px",
                                      }}
                                    >
                                      <span>Editing does not change the stored template.</span>
                                      <span>{activeMessage.length}/1000</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {displayItems.length > 10 && (
                            <button
                              type="button"
                              onClick={() =>
                                setShowAllOccasionMembers((prev) => ({
                                  ...prev,
                                  [group.occasion.id]: !prev[group.occasion.id],
                                }))
                              }
                              style={{
                                padding: "8px 12px",
                                background: "transparent",
                                border: "none",
                                color: "#2563eb",
                                fontSize: "13px",
                                fontWeight: 700,
                                cursor: "pointer",
                                textAlign: "center",
                              }}
                            >
                              {isExpandedAll
                                ? "Show less"
                                : `Show all (${displayItems.length})`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Past occasions collapsible section */}
            {pastOccasions.length > 0 && (
              <div
                style={{
                  marginTop: "24px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "14px 16px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedPastOccasions((prev) => !prev)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#475569" }}>
                    Past occasions ({pastOccasions.length})
                  </span>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>
                    {expandedPastOccasions ? "Hide ▲" : "Show ▼"}
                  </span>
                </button>

                {expandedPastOccasions && (
                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {pastOccasions.map((p) => (
                      <div
                        key={p.occasion.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 12px",
                          background: "white",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          fontSize: "13px",
                          flexWrap: "wrap",
                          gap: "6px",
                        }}
                      >
                        <div>
                          <strong style={{ color: "#0f172a", display: "inline-block", marginRight: "8px" }}>
                            {p.occasion.title}
                          </strong>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            Date: {formatIndiaDateOnly(p.occasion.occasion_date)}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#2563eb",
                            background: "#eff6ff",
                            padding: "2px 8px",
                            borderRadius: "10px",
                          }}
                        >
                          {p.messagedCount} of {p.totalEligibleCount} messaged
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OCCASIONS MANAGER MODAL */}
      <OccasionsManager
        isOpen={isOccasionsModalOpen}
        onClose={() => setIsOccasionsModalOpen(false)}
        occasions={occasions}
        businessName={businessName}
        isOccasionsMissing={isOccasionsMissing}
        onCreateOccasion={createOccasion}
        onUpdateOccasion={updateOccasion}
        onDeleteOccasion={deleteOccasion}
      />
    </div>
  );
}
