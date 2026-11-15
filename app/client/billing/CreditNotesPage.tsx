"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  BillingBusinessProfile,
  BillingSettings,
  CreditNoteSearchItem,
  TapxCreditNoteItemRow,
  TapxCreditNoteRow,
  formatBillDateTime,
  formatMoney,
} from "../../lib/billing";
import { getISTDateStr } from "../../lib/orderNumber";
import CreditNoteSlip from "./CreditNoteSlip";

function formatExpiryDate(dateStr?: string | null): string {
  if (!dateStr) return "No expiry";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// 1. CreditNotePickerSheet (Bottom sheet on phone, centered modal on desktop)
// ---------------------------------------------------------------------------

export interface CreditNotePickerSheetProps {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (note: CreditNoteSearchItem) => void;
}

export function CreditNotePickerSheet({
  businessId,
  isOpen,
  onClose,
  onSelect,
}: CreditNotePickerSheetProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CreditNoteSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const reqCountRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotes = useCallback(
    async (searchText: string) => {
      if (!businessId) return;
      const reqId = ++reqCountRef.current;
      setLoading(true);
      setErrorMsg("");

      try {
        const qParam = searchText.trim() ? searchText.trim() : null;
        const { data, error } = await supabase.rpc("find_tapx_credit_notes", {
          p_business_id: businessId,
          p_query: qParam,
        });

        if (reqId !== reqCountRef.current) return;

        if (error) {
          setErrorMsg(error.message || "Failed to search credit notes. Please try again.");
          setResults([]);
          return;
        }

        setResults(Array.isArray(data) ? (data as CreditNoteSearchItem[]) : []);
      } catch (err: any) {
        if (reqId !== reqCountRef.current) return;
        setErrorMsg(err?.message || "Failed to search credit notes. Please try again.");
        setResults([]);
      } finally {
        if (reqId === reqCountRef.current) {
          setLoading(false);
        }
      }
    },
    [businessId]
  );

  // When sheet opens: reset search and load latest
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      void fetchNotes("");
    } else {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    }
  }, [isOpen, fetchNotes]);

  // Handle typing with 300ms debounce
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void fetchNotes(val);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="credit-note-picker-sheet"
        style={{
          background: "#ffffff",
          width: "100%",
          maxWidth: "540px",
          borderTopLeftRadius: "18px",
          borderTopRightRadius: "18px",
          padding: "16px 16px calc(16px + env(safe-area-inset-bottom))",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          boxSizing: "border-box",
          boxShadow: "0 -8px 30px rgba(0, 0, 0, 0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @media (min-width: 640px) {
            .credit-note-picker-sheet {
              border-radius: 18px !important;
              margin: auto !important;
              max-height: 80vh !important;
            }
          }
        `}</style>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
            Select Credit Note
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: 0,
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              fontSize: "16px",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Search input */}
        <div>
          <input
            type="search"
            value={query}
            onChange={handleQueryChange}
            placeholder="Phone, name or credit note number"
            autoFocus
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px",
              fontSize: "16px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              color: "#0f172a",
              outline: "none",
              minHeight: "44px",
            }}
          />
        </div>

        {/* Content list */}
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            paddingRight: "2px",
            minHeight: "180px",
          }}
        >
          {loading && (
            <div
              style={{
                textAlign: "center",
                padding: "32px 16px",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Searching credit notes...
            </div>
          )}

          {!loading && errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "12px",
                color: "#991b1b",
                fontSize: "13px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div>{errorMsg}</div>
              <button
                type="button"
                onClick={() => void fetchNotes(query)}
                style={{
                  alignSelf: "flex-start",
                  background: "#dc2626",
                  color: "#ffffff",
                  border: 0,
                  borderRadius: "6px",
                  padding: "6px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: "36px",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !errorMsg && results.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "36px 16px",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              No credit notes found.
            </div>
          )}

          {!loading &&
            !errorMsg &&
            results.map((note) => {
              const isExpired = Boolean(note.expired);

              return (
                <div
                  key={note.id}
                  onClick={() => {
                    if (isExpired) return;
                    onSelect(note);
                    onClose();
                  }}
                  style={{
                    border: isExpired ? "1px solid #e2e8f0" : "1px solid #cbd5e1",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    background: isExpired ? "#f8fafc" : "#ffffff",
                    opacity: isExpired ? 0.6 : 1,
                    cursor: isExpired ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s, transform 0.1s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "15px", color: isExpired ? "#64748b" : "#0f172a" }}>
                        {note.note_no_text}
                      </strong>
                      {isExpired && (
                        <span
                          style={{
                            background: "#fee2e2",
                            color: "#991b1b",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "999px",
                          }}
                        >
                          Expired
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "12px", color: "#64748b", marginRight: "4px" }}>
                        Balance:
                      </span>
                      <strong
                        style={{
                          fontSize: "15px",
                          color: isExpired ? "#64748b" : "#16a34a",
                        }}
                      >
                        {formatMoney(note.balance)}
                      </strong>
                    </div>
                  </div>

                  {/* Customer info */}
                  {(note.customer_name || note.customer_phone) && (
                    <div style={{ fontSize: "13px", color: "#475569" }}>
                      {[note.customer_name, note.customer_phone].filter(Boolean).join(" • ")}
                    </div>
                  )}

                  {/* Expiry and original bill */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      fontSize: "12px",
                      color: "#64748b",
                      marginTop: "2px",
                      gap: "6px",
                    }}
                  >
                    {note.original_bill_no_text && (
                      <span>Bill: {note.original_bill_no_text}</span>
                    )}
                    {note.expires_on && (
                      <span>Valid until {formatExpiryDate(note.expires_on)}</span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. CreditNotesPage
// ---------------------------------------------------------------------------

type FilterTab = "open" | "used_up" | "expired" | "cancelled" | "all";

interface CreditNotesPageProps {
  business: BillingBusinessProfile;
  billingSettings: BillingSettings;
}

export default function CreditNotesPage({
  business,
  billingSettings,
}: CreditNotesPageProps) {
  const businessId = business.id;
  const todayIST = getISTDateStr();

  const [notes, setNotes] = useState<TapxCreditNoteRow[]>([]);
  const [billsMap, setBillsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("open");

  // Expanded cards and cached items
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, TapxCreditNoteItemRow[]>>({});
  const [loadingItemsFor, setLoadingItemsFor] = useState<string | null>(null);

  // Modals
  const [printingNote, setPrintingNote] = useState<TapxCreditNoteRow | null>(null);
  const [refundNote, setRefundNote] = useState<TapxCreditNoteRow | null>(null);
  const [voidNote, setVoidNote] = useState<TapxCreditNoteRow | null>(null);

  // Form states for refund
  const [refundMethod, setRefundMethod] = useState<"cash" | "upi" | "card">("cash");
  const [refundNoteText, setRefundNoteText] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  // Form states for void
  const [voidReasonText, setVoidReasonText] = useState("");

  const PAGE_SIZE = 50;

  // Derive status
  const deriveStatus = useCallback(
    (note: TapxCreditNoteRow): "Cancelled" | "Expired" | "Used up" | "Paid back" | "Open" => {
      if (note.status === "void") return "Cancelled";
      const balance = Number(note.amount || 0) - Number(note.used_amount || 0) - Number(note.refunded_amount || 0);
      const refunded = Number(note.refunded_amount || 0);
      if (balance > 0 && note.expires_on && note.expires_on < todayIST) {
        return "Expired";
      }
      if (balance <= 0 && refunded === 0) {
        return "Used up";
      }
      if (balance <= 0 && refunded > 0) {
        return "Paid back";
      }
      return "Open";
    },
    [todayIST]
  );

  // Fetch initial notes
  const fetchNotes = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error, count } = await supabase
        .from("tapx_credit_notes")
        .select(
          "id, business_id, note_no_text, note_day, original_bill_id, customer_name, customer_phone, reason, expires_on, amount, used_amount, refunded_amount, status, refund_method, refunded_at, refund_note, void_reason, voided_at, created_at",
          { count: "exact" }
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (error) throw error;

      const loadedNotes = (data as TapxCreditNoteRow[]) || [];
      setNotes(loadedNotes);
      setHasMore(count !== null ? loadedNotes.length < count : loadedNotes.length === PAGE_SIZE);

      // Fetch original bills
      const billIds = Array.from(
        new Set(loadedNotes.map((n) => n.original_bill_id).filter(Boolean) as string[])
      );
      if (billIds.length > 0) {
        const { data: billsData } = await supabase
          .from("tapx_bills")
          .select("id, bill_no_text")
          .in("id", billIds);

        if (billsData) {
          const map: Record<string, string> = {};
          for (const b of billsData) {
            map[b.id] = b.bill_no_text;
          }
          setBillsMap(map);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load credit notes. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  // Load more
  const handleLoadMore = async () => {
    if (!businessId || loadingMore) return;
    setLoadingMore(true);
    const offset = notes.length;

    try {
      const { data, error, count } = await supabase
        .from("tapx_credit_notes")
        .select(
          "id, business_id, note_no_text, note_day, original_bill_id, customer_name, customer_phone, reason, expires_on, amount, used_amount, refunded_amount, status, refund_method, refunded_at, refund_note, void_reason, voided_at, created_at",
          { count: "exact" }
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const moreNotes = (data as TapxCreditNoteRow[]) || [];
      const combined = [...notes, ...moreNotes];
      setNotes(combined);
      setHasMore(count !== null ? combined.length < count : moreNotes.length === PAGE_SIZE);

      // Fetch bills for newly loaded notes
      const billIds = Array.from(
        new Set(moreNotes.map((n) => n.original_bill_id).filter(Boolean) as string[])
      ).filter((id) => !billsMap[id]);

      if (billIds.length > 0) {
        const { data: billsData } = await supabase
          .from("tapx_bills")
          .select("id, bill_no_text")
          .in("id", billIds);

        if (billsData) {
          const mapUpdates: Record<string, string> = {};
          for (const b of billsData) {
            mapUpdates[b.id] = b.bill_no_text;
          }
          setBillsMap((prev) => ({ ...prev, ...mapUpdates }));
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load more notes.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Toggle card expansion and load items
  const handleToggleExpand = async (noteId: string) => {
    if (expandedNoteId === noteId) {
      setExpandedNoteId(null);
      return;
    }

    setExpandedNoteId(noteId);

    if (!itemsCache[noteId]) {
      setLoadingItemsFor(noteId);
      try {
        const { data, error } = await supabase
          .from("tapx_credit_note_items")
          .select("*")
          .eq("credit_note_id", noteId);

        if (!error && data) {
          setItemsCache((prev) => ({ ...prev, [noteId]: data as TapxCreditNoteItemRow[] }));
        }
      } finally {
        setLoadingItemsFor(null);
      }
    }
  };

  // Submit refund
  const handleConfirmRefund = async () => {
    if (!refundNote || actionSubmitting) return;
    setActionSubmitting(true);
    setActionError("");

    try {
      const { error } = await supabase.rpc("refund_tapx_credit_note", {
        p_note_id: refundNote.id,
        p_method: refundMethod,
        p_note: refundNoteText.trim() ? refundNoteText.trim().slice(0, 200) : null,
      });

      if (error) {
        setActionError(error.message || "Failed to process refund.");
        return;
      }

      setRefundNote(null);
      setRefundNoteText("");
      void fetchNotes();
    } catch (err: any) {
      setActionError(err?.message || "Failed to process refund.");
    } finally {
      setActionSubmitting(false);
    }
  };

  // Submit void
  const handleConfirmVoid = async () => {
    if (!voidNote || actionSubmitting) return;
    const reason = voidReasonText.trim();
    if (reason.length < 3) {
      setActionError("Reason must be at least 3 characters.");
      return;
    }
    setActionSubmitting(true);
    setActionError("");

    try {
      const { error } = await supabase.rpc("void_tapx_credit_note", {
        p_note_id: voidNote.id,
        p_reason: reason.slice(0, 200),
      });

      if (error) {
        setActionError(error.message || "Failed to cancel credit note.");
        return;
      }

      setVoidNote(null);
      setVoidReasonText("");
      void fetchNotes();
    } catch (err: any) {
      setActionError(err?.message || "Failed to cancel credit note.");
    } finally {
      setActionSubmitting(false);
    }
  };

  // Client-side filtering
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return notes.filter((n) => {
      const derived = deriveStatus(n);

      if (filterTab === "open" && derived !== "Open") return false;
      if (filterTab === "used_up" && derived !== "Used up" && derived !== "Paid back") return false;
      if (filterTab === "expired" && derived !== "Expired") return false;
      if (filterTab === "cancelled" && derived !== "Cancelled") return false;

      if (!q) return true;

      const num = (n.note_no_text || "").toLowerCase();
      const name = (n.customer_name || "").toLowerCase();
      const phone = (n.customer_phone || "").toLowerCase();
      return num.includes(q) || name.includes(q) || phone.includes(q);
    });
  }, [notes, filterTab, searchQuery, deriveStatus]);

  return (
    <div
      className="credit-notes-page-root"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        paddingBottom: "80px",
      }}
    >
      <style>{`
        .credit-notes-page-root {
          font-family: inherit;
        }
        .filter-chip-btn {
          min-height: 44px;
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .filter-chip-btn.active {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>
            Credit notes
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#64748b" }}>
            Manage credit notes issued from returned items and customer exchanges.
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by note number, customer name, phone..."
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            fontSize: "16px",
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            outline: "none",
            minHeight: "44px",
          }}
        />
      </div>

      {/* Filter Chips */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "4px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <button
          type="button"
          onClick={() => setFilterTab("open")}
          className={`filter-chip-btn ${filterTab === "open" ? "active" : ""}`}
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => setFilterTab("used_up")}
          className={`filter-chip-btn ${filterTab === "used_up" ? "active" : ""}`}
        >
          Used up
        </button>
        <button
          type="button"
          onClick={() => setFilterTab("expired")}
          className={`filter-chip-btn ${filterTab === "expired" ? "active" : ""}`}
        >
          Expired
        </button>
        <button
          type="button"
          onClick={() => setFilterTab("cancelled")}
          className={`filter-chip-btn ${filterTab === "cancelled" ? "active" : ""}`}
        >
          Cancelled
        </button>
        <button
          type="button"
          onClick={() => setFilterTab("all")}
          className={`filter-chip-btn ${filterTab === "all" ? "active" : ""}`}
        >
          All
        </button>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "10px",
            padding: "14px",
            color: "#991b1b",
            fontSize: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div>{errorMsg}</div>
          <button
            type="button"
            onClick={() => void fetchNotes()}
            style={{
              alignSelf: "flex-start",
              background: "#dc2626",
              color: "#ffffff",
              border: 0,
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              minHeight: "44px",
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "48px 16px",
            textAlign: "center",
            color: "#64748b",
            fontSize: "15px",
          }}
        >
          Loading credit notes...
        </div>
      )}

      {/* Empty states */}
      {!loading && !errorMsg && notes.length === 0 && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "48px 16px",
            textAlign: "center",
            color: "#64748b",
            fontSize: "15px",
          }}
        >
          No credit notes yet.
        </div>
      )}

      {!loading && !errorMsg && notes.length > 0 && filteredNotes.length === 0 && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "40px 16px",
            textAlign: "center",
            color: "#64748b",
            fontSize: "14px",
          }}
        >
          No credit notes match your filter or search.
        </div>
      )}

      {/* Notes List */}
      {!loading && !errorMsg && filteredNotes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredNotes.map((note) => {
            const derived = deriveStatus(note);
            const balance =
              Number(note.amount || 0) -
              Number(note.used_amount || 0) -
              Number(note.refunded_amount || 0);
            const refunded = Number(note.refunded_amount || 0);
            const isExpanded = expandedNoteId === note.id;

            // Status chip badge styles
            let statusBg = "#dcfce7";
            let statusColor = "#166534";
            if (derived === "Cancelled") {
              statusBg = "#fee2e2";
              statusColor = "#991b1b";
            } else if (derived === "Expired") {
              statusBg = "#fef3c7";
              statusColor = "#92400e";
            } else if (derived === "Used up") {
              statusBg = "#f1f5f9";
              statusColor = "#475569";
            } else if (derived === "Paid back") {
              statusBg = "#f3e8ff";
              statusColor = "#7e22ce";
            }

            // Can give money back:
            // "only when exchange_cash_back is on AND status is open AND balance > 0"
            const canRefund =
              Boolean(billingSettings.exchange_cash_back) &&
              note.status === "open" &&
              balance > 0;

            // Can cancel credit note:
            // "only when status is open AND used_amount == 0 AND refunded_amount == 0"
            const canVoid =
              note.status === "open" &&
              Number(note.used_amount || 0) === 0 &&
              Number(note.refunded_amount || 0) === 0;

            const originalBillNo = note.original_bill_id ? billsMap[note.original_bill_id] : null;

            return (
              <div
                key={note.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "16px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  transition: "box-shadow 0.15s",
                }}
              >
                {/* Top Row: Note number & Status chip */}
                <div
                  onClick={() => void handleToggleExpand(note.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                      {note.note_no_text}
                    </strong>
                    <span
                      style={{
                        background: statusBg,
                        color: statusColor,
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "2px 9px",
                        borderRadius: "999px",
                      }}
                    >
                      {derived}
                    </span>
                  </div>
                  <span style={{ fontSize: "14px", color: "#94a3b8" }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>

                {/* Customer name and phone */}
                {(note.customer_name || note.customer_phone) && (
                  <div style={{ fontSize: "14px", color: "#334155" }}>
                    {[note.customer_name, note.customer_phone].filter(Boolean).join(" • ")}
                  </div>
                )}

                {/* Meta details: Issued date, reason, original bill, valid until */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px 16px",
                    fontSize: "13px",
                    color: "#64748b",
                  }}
                >
                  <span>Issued {formatBillDateTime(note.created_at)}</span>
                  {originalBillNo && <span>Bill: {originalBillNo}</span>}
                  {note.expires_on && <span>Valid until {formatExpiryDate(note.expires_on)}</span>}
                  {note.reason && (
                    <span style={{ fontStyle: "italic", color: "#475569" }}>
                      Reason: {note.reason}
                    </span>
                  )}
                </div>

                {/* Three small stats: Amount, Used, Balance (+ Paid back) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: refunded > 0 ? "repeat(4, 1fr)" : "repeat(3, 1fr)",
                    gap: "8px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    marginTop: "2px",
                    textAlign: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Amount</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                      {formatMoney(note.amount)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Used</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                      {formatMoney(note.used_amount)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Balance</div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: balance > 0 ? "#16a34a" : "#64748b",
                      }}
                    >
                      {formatMoney(balance)}
                    </div>
                  </div>
                  {refunded > 0 && (
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Paid back</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#7e22ce" }}>
                        {formatMoney(refunded)}
                      </div>
                    </div>
                  )}
                </div>

                {/* EXPANDED SECTION */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: "1px dashed #e2e8f0",
                      paddingTop: "12px",
                      marginTop: "6px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {/* Cancellation reason */}
                    {note.status === "void" && note.void_reason && (
                      <div
                        style={{
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          padding: "10px 12px",
                          fontSize: "13px",
                          color: "#991b1b",
                        }}
                      >
                        <strong>Cancellation reason:</strong> {note.void_reason}
                      </div>
                    )}

                    {/* Refund info */}
                    {refunded > 0 && (
                      <div
                        style={{
                          background: "#faf5ff",
                          border: "1px solid #f3e8ff",
                          borderRadius: "8px",
                          padding: "10px 12px",
                          fontSize: "13px",
                          color: "#6b21a8",
                        }}
                      >
                        <strong>Paid back:</strong> {formatMoney(refunded)}
                        {note.refund_method ? ` via ${note.refund_method.toUpperCase()}` : ""}
                        {note.refund_note ? ` • Note: ${note.refund_note}` : ""}
                      </div>
                    )}

                    {/* Returned items */}
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#475569",
                          marginBottom: "6px",
                        }}
                      >
                        Returned Items
                      </div>

                      {loadingItemsFor === note.id && (
                        <div style={{ fontSize: "13px", color: "#64748b" }}>Loading items...</div>
                      )}

                      {itemsCache[note.id] && itemsCache[note.id].length === 0 && (
                        <div style={{ fontSize: "13px", color: "#64748b" }}>
                          No items listed for this note.
                        </div>
                      )}

                      {itemsCache[note.id] && itemsCache[note.id].length > 0 && (
                        <div
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            overflow: "hidden",
                          }}
                        >
                          {itemsCache[note.id].map((it, idx) => (
                            <div
                              key={it.id || idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "8px 12px",
                                background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                                fontSize: "13px",
                                borderBottom:
                                  idx < itemsCache[note.id].length - 1 ? "1px solid #f1f5f9" : "none",
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600, color: "#0f172a" }}>
                                  {it.item_name}
                                </span>
                                <span style={{ color: "#64748b", marginLeft: "6px" }}>
                                  × {it.quantity}
                                </span>
                              </div>
                              <strong style={{ color: "#0f172a" }}>
                                {formatMoney(it.credit_amount)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action buttons (min 44px height on phone) */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        paddingTop: "4px",
                      }}
                    >
                      {/* Print slip */}
                      <button
                        type="button"
                        onClick={() => setPrintingNote(note)}
                        style={{
                          flex: "1 1 140px",
                          minHeight: "44px",
                          border: "1px solid #cbd5e1",
                          background: "#f8fafc",
                          color: "#0f172a",
                          borderRadius: "10px",
                          fontSize: "14px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        🖨️ Print slip
                      </button>

                      {/* Give money back */}
                      {canRefund && (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundNote(note);
                            setRefundMethod("cash");
                            setRefundNoteText("");
                            setActionError("");
                          }}
                          style={{
                            flex: "1 1 140px",
                            minHeight: "44px",
                            border: 0,
                            background: "#7c3aed",
                            color: "#ffffff",
                            borderRadius: "10px",
                            fontSize: "14px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                        >
                          💵 Give money back
                        </button>
                      )}

                      {/* Cancel credit note */}
                      {canVoid && (
                        <button
                          type="button"
                          onClick={() => {
                            setVoidNote(note);
                            setVoidReasonText("");
                            setActionError("");
                          }}
                          style={{
                            flex: "1 1 140px",
                            minHeight: "44px",
                            border: "1px solid #fca5a5",
                            background: "#fff1f2",
                            color: "#be123c",
                            borderRadius: "10px",
                            fontSize: "14px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                        >
                          🚫 Cancel credit note
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Button */}
      {!loading && !errorMsg && hasMore && (
        <div style={{ textAlign: "center", marginTop: "8px" }}>
          <button
            type="button"
            disabled={loadingMore}
            onClick={handleLoadMore}
            style={{
              minHeight: "44px",
              padding: "10px 24px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              fontSize: "14px",
              fontWeight: 700,
              cursor: loadingMore ? "not-allowed" : "pointer",
              opacity: loadingMore ? 0.6 : 1,
            }}
          >
            {loadingMore ? "Loading more..." : "Load more"}
          </button>
        </div>
      )}

      {/* Print Slip Modal */}
      {printingNote && (
        <CreditNoteSlip
          creditNoteId={printingNote.id}
          business={business}
          originalBillNo={billsMap[printingNote.original_bill_id || ""] || null}
          onClose={() => setPrintingNote(null)}
        />
      )}

      {/* Give Money Back Modal */}
      {refundNote && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionSubmitting) setRefundNote(null);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              width: "100%",
              maxWidth: "440px",
              borderRadius: "16px",
              padding: "20px",
              boxSizing: "border-box",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              Give money back
            </h3>

            <p style={{ margin: 0, fontSize: "14px", color: "#475569" }}>
              Refund remaining balance on{" "}
              <strong>{refundNote.note_no_text}</strong>.
            </p>

            {/* Whole balance amount */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "14px", color: "#64748b" }}>Refund Amount:</span>
              <strong style={{ fontSize: "18px", color: "#7c3aed" }}>
                {formatMoney(
                  Number(refundNote.amount || 0) -
                    Number(refundNote.used_amount || 0) -
                    Number(refundNote.refunded_amount || 0)
                )}
              </strong>
            </div>

            {/* Payment Method Selection */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Payment method *
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {(["cash", "upi", "card"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setRefundMethod(m)}
                    style={{
                      minHeight: "44px",
                      borderRadius: "8px",
                      border: refundMethod === m ? "2px solid #7c3aed" : "1px solid #cbd5e1",
                      background: refundMethod === m ? "#faf5ff" : "#ffffff",
                      color: refundMethod === m ? "#7c3aed" : "#334155",
                      fontWeight: 700,
                      fontSize: "14px",
                      cursor: "pointer",
                      textTransform: "uppercase",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional note */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Optional note
              </label>
              <input
                type="text"
                value={refundNoteText}
                onChange={(e) => setRefundNoteText(e.target.value.slice(0, 200))}
                placeholder="Reason or reference (max 200 chars)"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  fontSize: "16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  outline: "none",
                  minHeight: "44px",
                }}
              />
            </div>

            {/* Error box */}
            {actionError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "#991b1b",
                  fontSize: "13px",
                }}
              >
                {actionError}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                disabled={actionSubmitting}
                onClick={() => setRefundNote(null)}
                style={{
                  flex: 1,
                  minHeight: "44px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: actionSubmitting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionSubmitting}
                onClick={handleConfirmRefund}
                style={{
                  flex: 1,
                  minHeight: "44px",
                  border: 0,
                  background: "#7c3aed",
                  color: "#ffffff",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: actionSubmitting ? "not-allowed" : "pointer",
                  opacity: actionSubmitting ? 0.6 : 1,
                }}
              >
                {actionSubmitting ? "Processing..." : "Confirm refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Credit Note Modal */}
      {voidNote && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionSubmitting) setVoidNote(null);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              width: "100%",
              maxWidth: "440px",
              borderRadius: "16px",
              padding: "20px",
              boxSizing: "border-box",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#991b1b" }}>
              Cancel credit note
            </h3>

            <p style={{ margin: 0, fontSize: "14px", color: "#475569" }}>
              Are you sure you want to cancel{" "}
              <strong>{voidNote.note_no_text}</strong>? This cannot be undone.
            </p>

            {/* Reason input */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Reason for cancellation * (min 3 chars)
              </label>
              <textarea
                value={voidReasonText}
                onChange={(e) => setVoidReasonText(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="Why is this credit note being cancelled?"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  fontSize: "16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", textAlign: "right" }}>
                {voidReasonText.trim().length} / 200
              </div>
            </div>

            {/* Error box */}
            {actionError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "#991b1b",
                  fontSize: "13px",
                }}
              >
                {actionError}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                disabled={actionSubmitting}
                onClick={() => setVoidNote(null)}
                style={{
                  flex: 1,
                  minHeight: "44px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: actionSubmitting ? "not-allowed" : "pointer",
                }}
              >
                Close
              </button>
              <button
                type="button"
                disabled={actionSubmitting || voidReasonText.trim().length < 3}
                onClick={handleConfirmVoid}
                style={{
                  flex: 1,
                  minHeight: "44px",
                  border: 0,
                  background: "#dc2626",
                  color: "#ffffff",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor:
                    actionSubmitting || voidReasonText.trim().length < 3
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    actionSubmitting || voidReasonText.trim().length < 3 ? 0.6 : 1,
                }}
              >
                {actionSubmitting ? "Cancelling..." : "Cancel credit note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
