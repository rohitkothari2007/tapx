"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { normalizePhone } from "../lib/whatsapp";
import {
  LoyaltyMemberData,
  LoyaltyRewardData,
  OfferData,
  MessageLogRow,
  computeReminders,
  DEFAULT_TEMPLATES,
  WelcomeReminderItem,
  RewardReminderItem,
  OfferReminderItem,
  SentHistoryItem,
} from "../lib/reminders";

export interface RemindersData {
  loading: boolean;
  isTableMissing: boolean;
  totalPendingCount: number;
  badge: string | number | undefined;
  welcomePending: WelcomeReminderItem[];
  welcomeSent: WelcomeReminderItem[];
  rewardPending: RewardReminderItem[];
  rewardSent: RewardReminderItem[];
  offerPending: OfferReminderItem[];
  offerSent: OfferReminderItem[];
  liveOffersCount: number;
  sentHistory: SentHistoryItem[];
  templates: {
    welcome: string;
    reward: string;
    offer: string;
  };
  setTemplate: (type: "welcome" | "reward" | "offer", text: string) => void;
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
  const [members, setMembers] = useState<LoyaltyMemberData[]>([]);
  const [rewards, setRewards] = useState<LoyaltyRewardData[]>([]);
  const [offers, setOffers] = useState<OfferData[]>([]);
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
          const { data: rpcMembers, error: rpcErr } = await supabase.rpc(
            "get_tapx_loyalty_members",
            { p_business_id: businessId }
          );

          if (!rpcErr && Array.isArray(rpcMembers)) {
            loadedMembers = rpcMembers;
          } else {
            const { data: memberData } = await supabase
              .from("loyalty_memberships")
              .select(
                "id, customer_id, visits, redemption_count, reward_claimed, created_at, updated_at, customer:customers(name, phone)"
              )
              .eq("business_id", businessId)
              .order("updated_at", { ascending: false });

            if (memberData) loadedMembers = memberData as unknown as LoyaltyMemberData[];
          }
        } catch (err) {
          console.error("Error loading loyalty members for reminders:", err);
        }
      }

      // 2. Fetch Rewards if loyalty is enabled
      let loadedRewards: LoyaltyRewardData[] = [];
      if (hasLoyalty) {
        try {
          const { data: rewardData } = await supabase
            .from("loyalty_rewards")
            .select(
              "id, business_id, customer_id, membership_id, visit_count_at_reward, reward_description, status, created_at, customer:customers(name, phone)"
            )
            .eq("business_id", businessId)
            .order("created_at", { ascending: false });

          if (rewardData) loadedRewards = rewardData as unknown as LoyaltyRewardData[];
        } catch (err) {
          console.error("Error loading loyalty rewards for reminders:", err);
        }
      }

      // 3. Fetch Offers if offers is enabled
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
          // If table doesn't exist or RLS denies
          if (
            logErr.code === "42P01" ||
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

      setMembers(loadedMembers);
      setRewards(loadedRewards);
      setOffers(loadedOffers);
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
    // Current IST hours/minutes
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
    totalPendingCount: computed.totalPendingCount,
    badge,
    welcomePending: computed.welcomePending,
    welcomeSent: computed.welcomeSent,
    rewardPending: computed.rewardPending,
    rewardSent: computed.rewardSent,
    offerPending: computed.offerPending,
    offerSent: computed.offerSent,
    liveOffersCount: computed.liveOffersCount,
    sentHistory: computed.sentHistory,
    templates,
    setTemplate,
    markAsSent,
    markAsNotSent,
    refresh: loadData,
  };
}
