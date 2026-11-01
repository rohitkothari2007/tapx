"use client";

import React, { useState, useEffect } from "react";
import {
  OccasionData,
  formatIndiaDateOnly,
  getIndiaYMD,
  isOccasionActive,
  isOccasionPast,
  renderTemplate,
} from "../lib/reminders";

const QUICK_FILL_CHIPS = [
  "Diwali",
  "Eid",
  "Holi",
  "Christmas",
  "New Year",
  "Shop closed",
  "Custom",
] as const;

const DEFAULT_OCCASION_MESSAGE =
  "Wishing you a joyful and wonderful {occasion} from all of us at {business}! Visit us soon for exclusive celebration offers.";

interface OccasionsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  occasions: OccasionData[];
  businessName?: string;
  isOccasionsMissing?: boolean;
  onCreateOccasion: (params: {
    title: string;
    message: string;
    occasion_date: string;
    remind_days_before: number;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdateOccasion: (
    id: string,
    params: {
      title: string;
      message: string;
      occasion_date: string;
      remind_days_before: number;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteOccasion: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export default function OccasionsManager({
  isOpen,
  onClose,
  occasions,
  businessName,
  isOccasionsMissing,
  onCreateOccasion,
  onUpdateOccasion,
  onDeleteOccasion,
}: OccasionsManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [occasionDate, setOccasionDate] = useState("");
  const [remindDaysBefore, setRemindDaysBefore] = useState<number>(3);
  const [message, setMessage] = useState(DEFAULT_OCCASION_MESSAGE);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const todayIST = getIndiaYMD(new Date());

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setOccasionDate("");
    setRemindDaysBefore(3);
    setMessage(DEFAULT_OCCASION_MESSAGE);
    setErrorMsg(null);
    setIsFormOpen(false);
  };

  // Open form for Create
  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  // Open form for Edit
  const handleOpenEdit = (occ: OccasionData) => {
    setEditingId(occ.id);
    setTitle(occ.title);
    setOccasionDate(occ.occasion_date);
    setRemindDaysBefore(occ.remind_days_before ?? 3);
    setMessage(occ.message);
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  // Quick fill chip handler (plain text title only, never touches date)
  const handleQuickChip = (chip: string) => {
    if (chip === "Custom") {
      setTitle("");
    } else {
      setTitle(chip);
    }
  };

  // Save form handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg("Title is required (1-80 characters).");
      return;
    }
    if (trimmedTitle.length > 80) {
      setErrorMsg("Title must be 80 characters or less.");
      return;
    }

    if (!occasionDate) {
      setErrorMsg("Please select an occasion date.");
      return;
    }

    if (!editingId && occasionDate < todayIST) {
      setErrorMsg("Occasion date cannot be in the past.");
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setErrorMsg("Message is required (1-1000 characters).");
      return;
    }
    if (trimmedMessage.length > 1000) {
      setErrorMsg("Message must be 1000 characters or less.");
      return;
    }

    const days = Math.max(0, Math.min(30, Math.floor(Number(remindDaysBefore || 0))));

    setIsSaving(true);
    try {
      if (editingId) {
        const res = await onUpdateOccasion(editingId, {
          title: trimmedTitle,
          message: trimmedMessage,
          occasion_date: occasionDate,
          remind_days_before: days,
        });
        if (!res.success) {
          setErrorMsg(res.error || "Failed to update occasion.");
          return;
        }
      } else {
        const res = await onCreateOccasion({
          title: trimmedTitle,
          message: trimmedMessage,
          occasion_date: occasionDate,
          remind_days_before: days,
        });
        if (!res.success) {
          setErrorMsg(res.error || "Failed to create occasion.");
          return;
        }
      }
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  // Delete handler
  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await onDeleteOccasion(deletingId);
      if (!res.success) {
        alert(res.error || "Failed to delete occasion.");
      } else {
        setDeletingId(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const isLimitReached = occasions.length >= 20;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving && !isDeleting) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              Manage occasions
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
              Festival wishes, holiday greetings and shop notices ({occasions.length}/20 configured)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isDeleting}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
              fontWeight: 700,
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Missing Table / RLS Warning */}
          {isOccasionsMissing && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "12px 16px",
                color: "#991b1b",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Occasions are not available yet.
            </div>
          )}

          {/* Compliance note */}
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fef3c7",
              borderRadius: "10px",
              padding: "12px 16px",
              color: "#92400e",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            <strong>Note:</strong> Message only customers who agreed to hear from you. Occasions will
            appear in the Pending tab from (date minus remind days) until midnight on the occasion date.
          </div>

          {/* Create New Occasion Button (when form is closed) */}
          {!isFormOpen && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>
                Configured occasions
              </span>
              <button
                type="button"
                onClick={handleOpenCreate}
                disabled={isLimitReached || isOccasionsMissing}
                style={{
                  padding: "8px 16px",
                  background: isLimitReached || isOccasionsMissing ? "#94a3b8" : "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: isLimitReached || isOccasionsMissing ? "not-allowed" : "pointer",
                }}
              >
                + Create occasion
              </button>
            </div>
          )}

          {/* Limit reached warning */}
          {isLimitReached && !isFormOpen && (
            <p style={{ margin: 0, fontSize: "12px", color: "#b45309" }}>
              Maximum limit of 20 occasions reached. Please delete an older occasion to add a new one.
            </p>
          )}

          {/* FORM (CREATE OR EDIT) */}
          {isFormOpen && (
            <form
              onSubmit={handleSave}
              style={{
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                  {editingId ? "Edit occasion" : "Create new occasion"}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    fontSize: "12px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Cancel
                </button>
              </div>

              {/* Error feedback */}
              {errorMsg && (
                <div
                  style={{
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    color: "#b91c1c",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {/* Quick Fill Chips */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                  Quick fill title
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {QUICK_FILL_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleQuickChip(chip)}
                      style={{
                        padding: "4px 10px",
                        background: title === chip ? "#2563eb" : "#ffffff",
                        color: title === chip ? "#ffffff" : "#334155",
                        border: "1px solid #cbd5e1",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title Field */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    Occasion title *
                  </label>
                  <span style={{ fontSize: "11px", color: title.length > 80 ? "#dc2626" : "#64748b" }}>
                    {title.length}/80
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Diwali greetings or Shop closed on Saturday"
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Date & Remind Days Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Occasion date *
                  </label>
                  <input
                    type="date"
                    min={editingId ? undefined : todayIST}
                    value={occasionDate}
                    onChange={(e) => setOccasionDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Start reminding days before
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={remindDaysBefore}
                    onChange={(e) => setRemindDaysBefore(Number(e.target.value))}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>
                    0 - 30 days (default 3)
                  </span>
                </div>
              </div>

              {/* Message Field */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    WhatsApp message text *
                  </label>
                  <span style={{ fontSize: "11px", color: message.length > 1000 ? "#dc2626" : "#64748b" }}>
                    {message.length}/1000
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>
                  Placeholders: {"{name}"}, {"{business}"}, {"{occasion}"}
                </span>
              </div>

              {/* Live Preview */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "12px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
                  Message live preview:
                </div>
                <div style={{ fontSize: "12px", color: "#1e293b", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                  {renderTemplate(message, {
                    name: "Customer",
                    business: businessName || "TAPX Business",
                    occasion: title.trim() || "Special Occasion",
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving}
                  style={{
                    padding: "8px 16px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: "8px 20px",
                    background: "#2563eb",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "white",
                    cursor: isSaving ? "not-allowed" : "pointer",
                  }}
                >
                  {isSaving ? "Saving..." : editingId ? "Update occasion" : "Save occasion"}
                </button>
              </div>
            </form>
          )}

          {/* Delete confirmation dialog */}
          {deletingId && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#991b1b" }}>
                Confirm deletion
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#7f1d1d" }}>
                Are you sure you want to delete this occasion? Existing sent records will remain in
                history as &quot;Occasion deleted&quot;.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  disabled={isDeleting}
                  style={{
                    padding: "6px 12px",
                    background: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  style={{
                    padding: "6px 14px",
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: isDeleting ? "not-allowed" : "pointer",
                  }}
                >
                  {isDeleting ? "Deleting..." : "Delete occasion"}
                </button>
              </div>
            </div>
          )}

          {/* OCCASIONS LIST */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {occasions.length === 0 ? (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "12px",
                  padding: "24px",
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                No occasions configured yet. Click &quot;+ Create occasion&quot; above to add your first
                festival greeting or shop notice.
              </div>
            ) : (
              occasions.map((occ) => {
                const isActive = isOccasionActive(occ);
                const isPast = isOccasionPast(occ);

                return (
                  <div
                    key={occ.id}
                    style={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "14px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "1 1 300px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                          {occ.title}
                        </span>
                        {isActive && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              background: "#ecfdf5",
                              color: "#059669",
                              border: "1px solid #a7f3d0",
                              borderRadius: "12px",
                              padding: "2px 8px",
                            }}
                          >
                            Active now
                          </span>
                        )}
                        {isPast && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              background: "#f1f5f9",
                              color: "#64748b",
                              borderRadius: "12px",
                              padding: "2px 8px",
                            }}
                          >
                            Past
                          </span>
                        )}
                        {!isActive && !isPast && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              background: "#eff6ff",
                              color: "#2563eb",
                              borderRadius: "12px",
                              padding: "2px 8px",
                            }}
                          >
                            Upcoming
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
                        Date: <strong>{formatIndiaDateOnly(occ.occasion_date)}</strong> &bull; Start reminding:{" "}
                        <strong>{occ.remind_days_before ?? 3} days before</strong>
                      </div>

                      <div
                        style={{
                          fontSize: "12px",
                          color: "#334155",
                          background: "#f8fafc",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          lineHeight: 1.4,
                        }}
                      >
                        {occ.message}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginTop: "2px" }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(occ)}
                        disabled={isSaving || isDeleting}
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
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(occ.id)}
                        disabled={isSaving || isDeleting}
                        style={{
                          padding: "6px 12px",
                          background: "#fee2e2",
                          color: "#dc2626",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            background: "#f8fafc",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isDeleting}
            style={{
              padding: "8px 18px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
