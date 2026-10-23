"use client";

import React, { useState, useEffect, useMemo } from "react";
import { normalizePhone, formatWhatsAppUrl } from "../lib/whatsapp";

export type LoyaltyWhatsAppMember = {
  id: string;
  customer_id?: string;
  visits?: number | null;
  updated_at?: string | null;
  customer?: {
    name?: string | null;
    phone?: string | null;
  } | null;
};

export type LoyaltyWhatsAppModalProps = {
  isOpen: boolean;
  onClose: () => void;
  member: LoyaltyWhatsAppMember | null;
  businessName?: string;
  milestoneReward?: string;
  hasRewardReady?: boolean;
};

type TemplateId = "thank_you" | "reward_ready" | "we_miss_you" | "offer" | "custom";

type TemplateDefinition = {
  id: TemplateId;
  label: string;
  rawTemplate: string;
};

const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  thank_you: {
    id: "thank_you",
    label: "Thank you for visiting",
    rawTemplate:
      "Hi {name}, thank you for visiting {business}! You have visited us {visits} times. We truly appreciate your support and look forward to welcoming you back soon!",
  },
  reward_ready: {
    id: "reward_ready",
    label: "Reward ready",
    rawTemplate:
      "Hi {name}! You have a reward ready to claim at {business}: {reward}! Show this message on your next visit to redeem it. Thank you for visiting us {visits} times!",
  },
  we_miss_you: {
    id: "we_miss_you",
    label: "We miss you",
    rawTemplate:
      "Hi {name}, we miss seeing you at {business}! Visit us soon to continue your loyalty rewards journey and enjoy your next visit with us.",
  },
  offer: {
    id: "offer",
    label: "Offer or announcement",
    rawTemplate:
      "Hi {name}, special update from {business}: [Enter your offer or announcement here]. We hope to see you soon!",
  },
  custom: {
    id: "custom",
    label: "Custom",
    rawTemplate: "",
  },
};

function fillPlaceholders(
  template: string,
  context: {
    name?: string | null;
    business?: string | null;
    visits?: number | null;
    reward?: string | null;
  }
): string {
  const name = context.name?.trim() || "Valued Customer";
  const business = context.business?.trim() || "our business";
  const visits =
    typeof context.visits === "number" && !isNaN(context.visits)
      ? String(context.visits)
      : "0";
  const reward = context.reward?.trim() || "special reward";

  return template
    .replace(/\{name\}/gi, name)
    .replace(/\{business\}/gi, business)
    .replace(/\{visits\}/gi, visits)
    .replace(/\{reward\}/gi, reward)
    // Clean any unrecognised placeholder cleanly without undefined/null
    .replace(/\{[a-zA-Z0-9_-]+\}/g, "");
}

export function ChatIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ExternalIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function LoyaltyWhatsAppModal({
  isOpen,
  onClose,
  member,
  businessName,
  milestoneReward,
  hasRewardReady,
}: LoyaltyWhatsAppModalProps) {
  const [activeTemplateId, setActiveTemplateId] = useState<TemplateId>("thank_you");
  const [message, setMessage] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [lastMemberId, setLastMemberId] = useState<string | null>(null);

  // Template ordering: Offer "Reward ready" first when the member has a reward ready or reached milestone
  const templateList = useMemo(() => {
    if (hasRewardReady) {
      return [
        TEMPLATES.reward_ready,
        TEMPLATES.thank_you,
        TEMPLATES.we_miss_you,
        TEMPLATES.offer,
        TEMPLATES.custom,
      ];
    }
    return [
      TEMPLATES.thank_you,
      TEMPLATES.reward_ready,
      TEMPLATES.we_miss_you,
      TEMPLATES.offer,
      TEMPLATES.custom,
    ];
  }, [hasRewardReady]);

  // Synchronize initial template selection only when a new member is opened.
  // This guarantees that realtime background refreshes (which pass the same member.id)
  // will NOT overwrite any text typed by the owner.
  useEffect(() => {
    if (!isOpen || !member) {
      setLastMemberId(null);
      return;
    }

    if (member.id !== lastMemberId) {
      const initialTemplateId: TemplateId = hasRewardReady ? "reward_ready" : "thank_you";
      setActiveTemplateId(initialTemplateId);
      const initialText = fillPlaceholders(TEMPLATES[initialTemplateId].rawTemplate, {
        name: member.customer?.name,
        business: businessName,
        visits: member.visits,
        reward: milestoneReward,
      });
      setMessage(initialText);
      setCopied(false);
      setLastMemberId(member.id);
    }
  }, [isOpen, member, lastMemberId, hasRewardReady, businessName, milestoneReward]);

  if (!isOpen || !member) {
    return null;
  }

  const rawPhone = member.customer?.phone || "";
  const normalizedPhone = normalizePhone(rawPhone);
  const customerName = member.customer?.name?.trim() || "Customer";
  const charCount = message.length;
  const isOverLimit = charCount > 1500;
  const isSendDisabled = !normalizedPhone || isOverLimit || message.trim().length === 0;

  const handleSelectTemplate = (tplId: TemplateId) => {
    setActiveTemplateId(tplId);
    setCopied(false);
    const populated = fillPlaceholders(TEMPLATES[tplId].rawTemplate, {
      name: member.customer?.name,
      business: businessName,
      visits: member.visits,
      reward: milestoneReward,
    });
    setMessage(populated);
  };

  const handleCopy = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Could not copy message:", err);
    }
  };

  const handleOpenWhatsApp = () => {
    if (isSendDisabled || !normalizedPhone) return;
    const url = formatWhatsAppUrl(normalizedPhone, message.trim());
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loyalty-whatsapp-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          maxWidth: "580px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              Direct customer message
            </div>
            <h2
              id="loyalty-whatsapp-modal-title"
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: 1.3,
              }}
            >
              {customerName}
            </h2>
            <div
              style={{
                fontSize: "13px",
                color: normalizedPhone ? "#475569" : "#dc2626",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{rawPhone || "No phone number registered"}</span>
              {normalizedPhone && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "#166534",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    fontWeight: 600,
                  }}
                >
                  +{normalizedPhone}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              padding: "6px",
              background: "#f1f5f9",
              border: "none",
              borderRadius: "8px",
              color: "#64748b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* TEMPLATE PICKER */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "#334155",
                marginBottom: "8px",
              }}
            >
              Choose message template
            </label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              {templateList.map((tpl) => {
                const isSelected = activeTemplateId === tpl.id;
                const isRewardBadge = tpl.id === "reward_ready" && hasRewardReady;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: isSelected ? 700 : 600,
                      cursor: "pointer",
                      border: isSelected
                        ? "1px solid #0f172a"
                        : isRewardBadge
                        ? "1px solid #bbf7d0"
                        : "1px solid #e2e8f0",
                      background: isSelected
                        ? "#0f172a"
                        : isRewardBadge
                        ? "#f0fdf4"
                        : "#ffffff",
                      color: isSelected
                        ? "#ffffff"
                        : isRewardBadge
                        ? "#166534"
                        : "#475569",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tpl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* EDITABLE TEXTAREA */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "6px",
              }}
            >
              <label
                htmlFor="loyalty-message-textarea"
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#334155",
                }}
              >
                Edit message
              </label>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: isOverLimit ? "#dc2626" : "#64748b",
                }}
              >
                {charCount} / 1500 characters
              </span>
            </div>
            <textarea
              id="loyalty-message-textarea"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setCopied(false);
              }}
              maxLength={1500}
              rows={4}
              placeholder="Type your message to the customer..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: isOverLimit ? "1px solid #ef4444" : "1px solid #cbd5e1",
                fontSize: "13px",
                lineHeight: "1.5",
                color: "#0f172a",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* LIVE PREVIEW BOX */}
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "6px",
              }}
            >
              Live customer preview
            </div>
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "14px 16px",
                fontSize: "13px",
                lineHeight: "1.55",
                color: message.trim() ? "#1e293b" : "#94a3b8",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                minHeight: "56px",
              }}
            >
              {message.trim() || "Preview will appear here as you type..."}
            </div>
          </div>

          {/* ADVISORY DISCLAIMER */}
          <div
            style={{
              padding: "10px 12px",
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#64748b",
              lineHeight: "1.4",
            }}
          >
            Message only customers who agreed to hear from you.
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #f1f5f9",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleCopy}
            disabled={!message.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: copied ? "#f0fdf4" : "#ffffff",
              color: copied ? "#166534" : "#0f172a",
              fontSize: "13px",
              fontWeight: 600,
              cursor: message.trim() ? "pointer" : "not-allowed",
              opacity: message.trim() ? 1 : 0.6,
              transition: "all 0.15s ease",
            }}
          >
            <CopyIcon size={14} />
            <span>{copied ? "Copied" : "Copy message"}</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: "#64748b",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={isSendDisabled}
              title={
                !normalizedPhone
                  ? "Invalid phone number"
                  : isOverLimit
                  ? "Message exceeds 1500 characters"
                  : !message.trim()
                  ? "Message is empty"
                  : "Open chat in WhatsApp"
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 18px",
                borderRadius: "8px",
                border: "none",
                background: isSendDisabled ? "#94a3b8" : "#166534",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: isSendDisabled ? "not-allowed" : "pointer",
                transition: "background 0.15s ease",
              }}
            >
              <ExternalIcon size={14} />
              <span>Open WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
