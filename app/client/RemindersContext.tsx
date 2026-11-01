"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { normalizePhone } from "../lib/whatsapp";
import {
  LoyaltyMemberData,
  LoyaltyRewardData,
  OfferData,
  OccasionData,
  OccasionReminderItem,
  ActiveOccasionGroup,
  PastOccasionSummary,
  MessageLogRow,
  computeReminders,
  DEFAULT_TEMPLATES,
  getIndiaYMD,
  WelcomeReminderItem,
  RewardReminderItem,
  OfferReminderItem,
  SentHistoryItem,
} from "../lib/reminders";

export interface RemindersData {
  loading: boolean;
  isTableMissing: boolean;
  isOccasionsMissing: boolean;
  totalPendingCount: number;
  badge: string | number | undefined;
  welcomePending: WelcomeReminderItem[];
  welcomeSent: WelcomeReminderItem[];
  rewardPending: RewardReminderItem[];
  rewardSent: RewardReminderItem[];
  offerPending: OfferReminderItem[];
  offerSent: OfferReminderItem[];
  liveOffersCount: number;
  occasions: OccasionData[];
  activeOccasionGroups: ActiveOccasionGroup[];
  pastOccasions: PastOccasionSummary[];
  totalOccasionPending: number;
  sentHistory: SentHistoryItem[];
  templates: {
    welcome: string;
    reward: string;
    offer: string;
  };
  setTemplate: (type: "welcome" | "reward" | "offer", text: string) => void;
  createOccasion: (params: {
    title: string;
    message: string;
    occasion_date: string;
    remind_days_before: number;
  }) => Promise<{ success: boolean; error?: string; occasion?: OccasionData }>;
  updateOccasion: (
    id: string,
    params: {
      title: string;
      message: string;
      occasion_date: string;
      remind_days_before: number;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  deleteOccasion: (id: string) => Promise<{ success: boolean; error?: string }>;
  markAsSent: (params: {
    membershipId: string;
    messageType: "welcome" | "reward" | "offer" | "occasion";
    refId: string;
  }) => Promise<{ success: boolean; error?: string }>;
  markAsNotSent: (params: {
    membershipId: string;
    messageType: "welcome" | "reward" | "offer" | "occasion";
    refId: string;
  }) => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

/**
 * Shared hook managing single-instance realtime data and state for Reminders.
 * Used by ClientPortalPage to drive both the sidebar live count badge
 * and the RemindersPage without duplicate subscriptions.
 */
export function useRemindersData({
  businessId,
  hasLoyalty,
  hasOffers,
}: {
  businessId?: string | null;
  hasLoyalty: boolean;
  hasOffers: boolean;
}): RemindersData {
  const [loading, setLoading] = useState(true);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [isOccasionsMissing, setIsOccasionsMissing] = useState(false);
  const [members, setMembers] = useState<LoyaltyMemberData[]>([]);
  const [rewards, setRewards] = useState<LoyaltyRewardData[]>([]);
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [occasions, setOccasions] = useState<OccasionData[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLogRow[]>([]);
  const [nowDate, setNowDate] = useState<Date>(new Date());

  const [templates, setTemplates] = useState({
    welcome: DEFAULT_TEMPLATES.welcome,
    reward: DEFAULT_TEMPLATES.reward,
    offer: DEFAULT_TEMPLATES.offer,
  });

  const setTemplate = useCallback((type: "welcome" | "reward" | "offer", text: string) => {
    setTemplates((prev) => ({
      ...prev,
      [type]: text.slice(0, 1000),
    }));
  }, []);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);

  // Load data from DB using the same reads as Loyalty & Offers
  const loadData = useCallback(async () => {
    if (!businessId || (!hasLoyalty && !hasOffers)) {
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // 1. Fetch Members if loyalty is enabled
      let loadedMembers: LoyaltyMemberData[] = [];
      if (hasLoyalty) {
        try {
          const { data: memberData, error: memberErr } = await supabase
            .from("loyalty_memberships")
            .select(`
              id,
              customer_id,
              visits,
              redemption_count,
              reward_claimed,
              created_at,
              updated_at,
              customer:customers(name, phone)
            `)
            .eq("business_id", businessId)
            .order("visits", { ascending: false });

          if (memberErr) {
            console.error("Error loading loyalty members for reminders:", memberErr);
          } else if (memberData) {
            loadedMembers = memberData as LoyaltyMemberData[];
          }
        } catch (err) {
          console.error("Error in members query:", err);
        }
      }

      // 2. Fetch Unclaimed / Pending Rewards if loyalty is enabled
      let loadedRewards: LoyaltyRewardData[] = [];
      if (hasLoyalty) {
        try {
          const { data: rewardData, error: rewardErr } = await supabase
            .from("loyalty_rewards")
            .select(`
              id,
              business_id,
              membership_id,
              visit_count_at_reward,
              reward_description,
              status,
              created_at,
              customer:customers(name, phone)
            `)
            .eq("business_id", businessId)
            .eq("status", "pending")
            .order("created_at", { ascending: false });

          if (rewardErr) {
            console.error("Error loading loyalty rewards for reminders:", rewardErr);
          } else if (rewardData) {
            loadedRewards = rewardData as LoyaltyRewardData[];
          }
        } catch (err) {
          console.error("Error in rewards query:", err);
        }
      }

      // 3. Fetch Offers from module configs
      let loadedOffers: OfferData[] = [];
      if (hasOffers) {
        try {
          const { data: offerCfg } = await supabase
            .from("business_module_configs")
            .select("config")
            .eq("business_id", businessId)
            .or("module_key.eq.offers,module_key.eq.offers_promotions")
            .maybeSingle();

          if (offerCfg?.config?.offers && Array.isArray(offerCfg.config.offers)) {
            loadedOffers = offerCfg.config.offers;
          }
        } catch (err) {
          console.error("Error loading offers for reminders:", err);
        }
      }

      // 4. Fetch Message Logs from tapx_message_log
      let loadedLogs: MessageLogRow[] = [];
      try {
        const { data: logs, error: logErr } = await supabase
          .from("tapx_message_log")
          .select("id, business_id, membership_id, message_type, ref_id, sent_at, sent_by")
          .eq("business_id", businessId);

        if (logErr) {
          console.warn("tapx_message_log read note:", logErr.message || logErr);
          if (
            logErr.code === "42P01" ||
            logErr.code === "42501" ||
            logErr.message?.includes("does not exist") ||
            logErr.code === "PGRST204"
          ) {
            setIsTableMissing(true);
          }
        } else if (logs) {
          loadedLogs = logs;
          setIsTableMissing(false);
        }
      } catch (err: any) {
        console.error("Error reading tapx_message_log:", err?.message || err);
        setIsTableMissing(true);
      }

      // 5. Fetch Occasions from tapx_occasions
      let loadedOccasions: OccasionData[] = [];
      try {
        const { data: occData, error: occErr } = await supabase
          .from("tapx_occasions")
          .select("id, business_id, title, message, occasion_date, remind_days_before, created_at, created_by")
          .eq("business_id", businessId)
          .order("occasion_date", { ascending: true });

        if (occErr) {
          console.warn("tapx_occasions read note:", occErr.message || occErr);
          if (
            occErr.code === "42P01" ||
            occErr.code === "42501" ||
            occErr.message?.includes("does not exist") ||
            occErr.code === "PGRST204"
          ) {
            setIsOccasionsMissing(true);
          }
        } else if (occData) {
          loadedOccasions = occData as OccasionData[];
          setIsOccasionsMissing(false);
        }
      } catch (err: any) {
        console.error("Error reading tapx_occasions:", err?.message || err);
        setIsOccasionsMissing(true);
      }

      setMembers(loadedMembers);
      setRewards(loadedRewards);
      setOffers(loadedOffers);
      setOccasions(loadedOccasions);
      setMessageLogs(loadedLogs);
      setNowDate(new Date());
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [businessId, hasLoyalty, hasOffers]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription with 300ms debounce & cleanup
  useEffect(() => {
    if (!businessId || (!hasLoyalty && !hasOffers)) return;

    let isSubscribed = true;

    const triggerDebouncedLoad = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        if (isSubscribed) {
          loadData();
        }
      }, 300);
    };

    const channelName = `reminders_realtime_${businessId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loyalty_memberships",
          filter: `business_id=eq.${businessId}`,
        },
        triggerDebouncedLoad
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loyalty_rewards",
          filter: `business_id=eq.${businessId}`,
        },
        triggerDebouncedLoad
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tapx_message_log",
          filter: `business_id=eq.${businessId}`,
        },
        triggerDebouncedLoad
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tapx_occasions",
          filter: `business_id=eq.${businessId}`,
        },
        triggerDebouncedLoad
      )
      .subscribe();

    // 60-second fallback polling interval in case realtime websocket connection drops
    const fallbackInterval = setInterval(() => {
      if (isSubscribed) {
        loadData();
      }
    }, 60000);

    // Midnight rollover timer in India Time (Asia/Kolkata)
    // Recalculates reminders right after midnight IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    const msUntilMidnightIST =
      (24 - nowIST.getUTCHours() - 1) * 3600000 +
      (60 - nowIST.getUTCMinutes() - 1) * 60000 +
      (60 - nowIST.getUTCSeconds()) * 1000 +
      2000; // +2 sec buffer past midnight

    const midnightTimer = setTimeout(() => {
      if (isSubscribed) {
        setNowDate(new Date());
        loadData();
      }
    }, Math.max(10000, msUntilMidnightIST));

    return () => {
      isSubscribed = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      clearInterval(fallbackInterval);
      clearTimeout(midnightTimer);
      supabase.removeChannel(channel);
    };
  }, [businessId, hasLoyalty, hasOffers, loadData]);

  // Create an occasion
  const createOccasion = useCallback(
    async (params: {
      title: string;
      message: string;
      occasion_date: string;
      remind_days_before: number;
    }): Promise<{ success: boolean; error?: string; occasion?: OccasionData }> => {
      if (!businessId) {
        return { success: false, error: "Business ID is required." };
      }
      if (isOccasionsMissing) {
        return { success: false, error: "Occasions are not available yet." };
      }
      if (occasions.length >= 20) {
        return {
          success: false,
          error: "Maximum limit of 20 occasions reached. Please delete an older occasion first.",
        };
      }

      const title = params.title.trim();
      if (!title || title.length > 80) {
        return { success: false, error: "Title is required (1-80 characters)." };
      }

      const message = params.message.trim();
      if (!message || message.length > 1000) {
        return { success: false, error: "Message is required (1-1000 characters)." };
      }

      const occasion_date = params.occasion_date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(occasion_date)) {
        return { success: false, error: "Invalid occasion date format (YYYY-MM-DD)." };
      }

      const todayIST = getIndiaYMD(new Date());
      if (occasion_date < todayIST) {
        return { success: false, error: "Occasion date cannot be in the past." };
      }

      const remind_days_before = Math.max(
        0,
        Math.min(30, Math.floor(Number(params.remind_days_before ?? 3)))
      );

      try {
        const { data, error } = await supabase
          .from("tapx_occasions")
          .insert({
            business_id: businessId,
            title,
            message,
            occasion_date,
            remind_days_before,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setOccasions((prev) => {
            const updated = [...prev, data as OccasionData];
            updated.sort((a, b) => (a.occasion_date || "").localeCompare(b.occasion_date || ""));
            return updated;
          });
        }
        return { success: true, occasion: data as OccasionData };
      } catch (err: any) {
        console.error("Error creating occasion:", err?.message || err);
        return {
          success: false,
          error: err?.message || "Failed to create occasion.",
        };
      }
    },
    [businessId, isOccasionsMissing, occasions.length]
  );

  // Update an occasion
  const updateOccasion = useCallback(
    async (
      id: string,
      params: {
        title: string;
        message: string;
        occasion_date: string;
        remind_days_before: number;
      }
    ): Promise<{ success: boolean; error?: string }> => {
      if (!businessId) {
        return { success: false, error: "Business ID is required." };
      }
      if (isOccasionsMissing) {
        return { success: false, error: "Occasions are not available yet." };
      }

      const title = params.title.trim();
      if (!title || title.length > 80) {
        return { success: false, error: "Title is required (1-80 characters)." };
      }

      const message = params.message.trim();
      if (!message || message.length > 1000) {
        return { success: false, error: "Message is required (1-1000 characters)." };
      }

      const occasion_date = params.occasion_date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(occasion_date)) {
        return { success: false, error: "Invalid occasion date format (YYYY-MM-DD)." };
      }

      const remind_days_before = Math.max(
        0,
        Math.min(30, Math.floor(Number(params.remind_days_before ?? 3)))
      );

      try {
        const { data, error } = await supabase
          .from("tapx_occasions")
          .update({
            title,
            message,
            occasion_date,
            remind_days_before,
          })
          .eq("id", id)
          .eq("business_id", businessId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setOccasions((prev) =>
            prev
              .map((o) => (o.id === id ? (data as OccasionData) : o))
              .sort((a, b) => (a.occasion_date || "").localeCompare(b.occasion_date || ""))
          );
        }
        return { success: true };
      } catch (err: any) {
        console.error("Error updating occasion:", err?.message || err);
        return {
          success: false,
          error: err?.message || "Failed to update occasion.",
        };
      }
    },
    [businessId, isOccasionsMissing]
  );

  // Delete an occasion
  const deleteOccasion = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      if (!businessId) {
        return { success: false, error: "Business ID is required." };
      }
      if (isOccasionsMissing) {
        return { success: false, error: "Occasions are not available yet." };
      }

      // Note: Sent log rows in tapx_message_log are preserved. They will show as 'Occasion deleted' in Sent history.
      try {
        const { error } = await supabase
          .from("tapx_occasions")
          .delete()
          .eq("id", id)
          .eq("business_id", businessId);

        if (error) {
          throw error;
        }

        setOccasions((prev) => prev.filter((o) => o.id !== id));
        return { success: true };
      } catch (err: any) {
        console.error("Error deleting occasion:", err?.message || err);
        return {
          success: false,
          error: err?.message || "Failed to delete occasion.",
        };
      }
    },
    [businessId, isOccasionsMissing]
  );

  // Mark a reminder message as sent (Inserts log row; handles 23505 unique conflict safely)
  const markAsSent = useCallback(
    async (params: {
      membershipId: string;
      messageType: "welcome" | "reward" | "offer" | "occasion";
      refId: string;
    }): Promise<{ success: boolean; error?: string }> => {
      if (!businessId || isTableMissing) {
        return { success: false, error: "Reminders are not available yet." };
      }

      const { membershipId, messageType, refId } = params;
      const sentAt = new Date().toISOString();

      // Optimistic update
      const tempId = `opt_${Date.now()}_${Math.random()}`;
      const newLogRow: MessageLogRow = {
        id: tempId,
        business_id: businessId,
        membership_id: membershipId,
        message_type: messageType,
        ref_id: refId,
        sent_at: sentAt,
      };

      setMessageLogs((prev) => [newLogRow, ...prev]);

      try {
        const { data, error } = await supabase
          .from("tapx_message_log")
          .insert({
            business_id: businessId,
            membership_id: membershipId,
            message_type: messageType,
            ref_id: refId,
            sent_at: sentAt,
          })
          .select("id")
          .single();

        if (error) {
          // Unique violation (Postgres error code 23505): row already exists, treat as already sent
          if (error.code === "23505" || error.message?.includes("duplicate key")) {
            return { success: true };
          }
          throw error;
        }

        // Replace optimistic tempId with real DB id
        if (data?.id) {
          setMessageLogs((prev) =>
            prev.map((r) => (r.id === tempId ? { ...r, id: data.id } : r))
          );
        }
        return { success: true };
      } catch (err: any) {
        console.error("Error inserting into tapx_message_log:", err?.message || err);
        // Roll back optimistic row
        setMessageLogs((prev) => prev.filter((r) => r.id !== tempId));
        return {
          success: false,
          error: "Could not save message status. Please try again.",
        };
      }
    },
    [businessId, isTableMissing]
  );

  // Mark as not sent / Undo (Deletes log row from tapx_message_log)
  const markAsNotSent = useCallback(
    async (params: {
      membershipId: string;
      messageType: "welcome" | "reward" | "offer" | "occasion";
      refId: string;
    }): Promise<{ success: boolean; error?: string }> => {
      if (!businessId || isTableMissing) {
        return { success: false, error: "Reminders are not available yet." };
      }

      const { membershipId, messageType, refId } = params;

      // Keep backup for optimistic rollback
      const previousLogs = [...messageLogs];

      // Optimistic delete
      setMessageLogs((prev) =>
        prev.filter(
          (r) =>
            !(
              r.membership_id === membershipId &&
              r.message_type === messageType &&
              (r.ref_id || "") === (refId || "")
            )
        )
      );

      try {
        const { error } = await supabase
          .from("tapx_message_log")
          .delete()
          .eq("business_id", businessId)
          .eq("membership_id", membershipId)
          .eq("message_type", messageType)
          .eq("ref_id", refId);

        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.error("Error deleting from tapx_message_log:", err?.message || err);
        // Revert to previous logs on failure
        setMessageLogs(previousLogs);
        return {
          success: false,
          error: "Could not revert message status. Please try again.",
        };
      }
    },
    [businessId, isTableMissing, messageLogs]
  );

  // Compute pending and sent lists using pure function in India time
  const computed = computeReminders({
    members,
    rewards,
    offers,
    occasions,
    messageLogs,
    now: nowDate,
    normalizePhoneFn: normalizePhone,
  });

  const badge =
    computed.totalPendingCount > 99
      ? "99+"
      : computed.totalPendingCount > 0
      ? computed.totalPendingCount
      : undefined;

  return {
    loading,
    isTableMissing,
    isOccasionsMissing,
    totalPendingCount: computed.totalPendingCount,
    badge,
    welcomePending: computed.welcomePending,
    welcomeSent: computed.welcomeSent,
    rewardPending: computed.rewardPending,
    rewardSent: computed.rewardSent,
    offerPending: computed.offerPending,
    offerSent: computed.offerSent,
    liveOffersCount: computed.liveOffersCount,
    occasions,
    activeOccasionGroups: computed.activeOccasionGroups,
    pastOccasions: computed.pastOccasions,
    totalOccasionPending: computed.totalOccasionPending,
    sentHistory: computed.sentHistory,
    templates,
    setTemplate,
    createOccasion,
    updateOccasion,
    deleteOccasion,
    markAsSent,
    markAsNotSent,
    refresh: loadData,
  };
}
