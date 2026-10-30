"use client";

import React, { useState, useEffect } from "react";
import { useRemindersData, RemindersData } from "./RemindersContext";
import {
  renderTemplate,
  formatIndiaSentTime,
  WelcomeReminderItem,
  RewardReminderItem,
  OfferReminderItem,
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
    welcomePending,
    welcomeSent,
    rewardPending,
    rewardSent,
    offerPending,
    offerSent,
    liveOffersCount,
    sentHistory,
    templates,
    setTemplate,
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

  // Template editor toggle states
  const [editTemplateSection, setEditTemplateSection] = useState<"welcome" | "reward" | "offer" | null>(
    null
  );

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

  // Undo button click handler
  async function handleUndoClick() {
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

  const totalCurrentSectionCount =
    currentWelcomeList.length + currentRewardList.length + currentOfferList.length;

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
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            background: feedbackMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${feedbackMessage.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            color: feedbackMessage.type === "success" ? "#047857" : "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{feedbackMessage.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              fontSize: "16px",
              cursor: "pointer",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* UNDO TOAST NOTIFICATION */}
      {undoItem && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 1000,
            background: "#0f172a",
            color: "white",
            padding: "14px 20px",
            borderRadius: "10px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "14px",
            maxWidth: "90vw",
          }}
        >
          <span>Marked as sent for {undoItem.label}</span>
          <button
            type="button"
            onClick={handleUndoClick}
            style={{
              background: "#38bdf8",
              color: "#0f172a",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Undo
          </button>
        </div>
      )}

      {/* FILTER TABS */}
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
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: 700,
            color: activeTab === "pending" ? "#2563eb" : "#64748b",
            borderBottom: activeTab === "pending" ? "2px solid #2563eb" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          Pending
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sent")}
          style={{
            padding: "10px 16px",
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: 700,
            color: activeTab === "sent" ? "#2563eb" : "#64748b",
            borderBottom: activeTab === "sent" ? "2px solid #2563eb" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          Sent
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          style={{
            padding: "10px 16px",
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: 700,
            color: activeTab === "history" ? "#2563eb" : "#64748b",
            borderBottom: activeTab === "history" ? "2px solid #2563eb" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          Sent history (30 days)
        </button>
      </div>

      {/* =========================================================
          SENT HISTORY VIEW (30 DAYS)
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
              Messages marked as sent in the last 30 days.
            </p>
          </div>

          {sentHistory.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "14px", margin: "16px 0" }}>
              No messages marked as sent in the last 30 days.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(showAllHistory ? sentHistory : sentHistory.slice(0, 10)).map((item) => (
                <div
                  key={item.id}
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
                      {item.customerPhone || "No phone"} &bull; {item.detailLabel}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "12px",
                        background: "#ecfdf5",
                        color: "#059669",
                        border: "1px solid #a7f3d0",
                      }}
                    >
                      Sent {formatIndiaSentTime(item.sentAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleMarkAsNotSent({
                          membershipId: item.membershipId,
                          messageType: item.messageType,
                          refId: item.refId,
                          customerName: item.customerName,
                        })
                      }
                      disabled={isTableMissing || processingKey === `${item.membershipId}__${item.messageType}__${item.refId}`}
                      style={{
                        padding: "4px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: "#f1f5f9",
                        color: "#475569",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      Mark as not sent
                    </button>
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
                  marginBottom: "16px",
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
                    Welcome messages ({currentWelcomeList.length})
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    Members who joined in the last 7 days.
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
                    ? "No members joined in the last 7 days awaiting welcome message."
                    : "No welcome messages sent yet."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(showAllWelcome ? currentWelcomeList : currentWelcomeList.slice(0, 10)).map(
                    (item) => {
                      const itemKey = `${item.membershipId}__welcome__${item.refId}`;
                      const isProcessing = processingKey === itemKey;
                      const hasValidPhone = Boolean(item.phoneDigits);

                      const messageText = renderTemplate(templates.welcome, {
                        name: item.customerName,
                        business: businessName,
                      });

                      return (
                        <div
                          key={item.membershipId}
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
                                      messageType: "welcome",
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
                                      messageType: "welcome",
                                      refId: item.refId,
                                      customerName: item.customerName,
                                    })
                                  }
                                  disabled={isProcessing || isTableMissing}
                                  style={{
                                    padding: "6px 12px",
                                    background: "#ffffff",
                                    color: "#334155",
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
                    Reward notifications ({currentRewardList.length})
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    Milestone rewards with status pending.
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

              {/* Rewards Rows List */}
              {currentRewardList.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
                  {activeTab === "pending"
                    ? "No pending milestone rewards awaiting notification."
                    : "No reward notifications sent yet."}
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
                          key={item.rewardId}
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
                              {item.customerPhone || "No phone"} &bull; {item.rewardDescription}
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
                                      messageType: "reward",
                                      refId: item.refId,
                                      customerName: item.customerName,
                                    })
                                  }
                                  disabled={isProcessing || isTableMissing}
                                  style={{
                                    padding: "6px 12px",
                                    background: "#ffffff",
                                    color: "#334155",
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
                                  color: "#334155",
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
        </div>
      )}
    </div>
  );
}
