"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

/* ==============================================================================
   TYPES
   ============================================================================== */

export interface AnalyticsBusiness {
  id: string;
  name: string;
  category?: string | null;
  email?: string | null;
  google_review_url?: string | null;
  instagram_url?: string | null;
  whatsapp_number?: string | null;
  phone?: string | null;
  [key: string]: any;
}

export interface AnalyticsFeature {
  id: string;
  feature_key: string;
  name: string;
  icon?: string | null;
  is_paid?: boolean;
  [key: string]: any;
}

export interface AnalyticsOrder {
  id: string;
  business_id: string;
  order_number?: number | null;
  status: string;
  total_amount?: number | null;
  created_at: string;
  [key: string]: any;
}

export interface AnalyticsDayData {
  dateStr: string; // YYYY-MM-DD in Asia/Kolkata
  dayLabel: string; // "Oct 20"
  dayName: string; // "Tue"
  label: string; // "Tue 20"
  taps: number; // nfc_tap
  reviews: number; // google_review_click
  insta: number; // instagram_click
  whatsapp: number; // whatsapp_click
  call: number; // call_click
  location: number; // location_click
  loyaltyVisits: number; // loyalty visits recorded that day
  loyaltyRegistrations: number; // new loyalty memberships enrolled that day
  totalTaps: number; // taps only
  totalActions: number; // all interactions combined
}

export interface WeekSummary {
  label: string;
  taps: number;
  totalActions: number;
}

/* ==============================================================================
   ASIA/KOLKATA TIMEZONE HELPERS
   ============================================================================== */

/**
 * Returns YYYY-MM-DD for a date or ISO string in Asia/Kolkata (IST = UTC+05:30).
 */
export function getISTDateStr(dateInput: Date | string = new Date()): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Generates an array of exactly 30 consecutive calendar days ending with Today in IST.
 */
export function getPast30DaysIST(referenceDate: Date = new Date()): Array<{
  dateStr: string;
  dayLabel: string;
  dayName: string;
  label: string;
}> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(referenceDate);
  const pMap: Record<string, number> = {};
  parts.forEach((p) => {
    if (p.type !== "literal") pMap[p.type] = Number(p.value);
  });

  const days: Array<{
    dateStr: string;
    dayLabel: string;
    dayName: string;
    label: string;
  }> = [];

  for (let i = 29; i >= 0; i--) {
    // 06:30 UTC is 12:00 noon IST of that calendar day
    const utcNoon = Date.UTC(pMap.year, pMap.month - 1, pMap.day - i, 6, 30, 0);
    const d = new Date(utcNoon);

    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      month: "short",
      day: "numeric",
      weekday: "short",
    });
    const dParts = dtf.formatToParts(d);
    const mParts: Record<string, string> = {};
    dParts.forEach((p) => {
      mParts[p.type] = p.value;
    });

    const isoDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

    days.push({
      dateStr: isoDateStr,
      dayLabel: `${mParts.month} ${mParts.day}`,
      dayName: mParts.weekday,
      label: `${mParts.weekday} ${mParts.day}`,
    });
  }

  return days;
}

/**
 * Calculates milliseconds until 00:00:01 of the next calendar day in Asia/Kolkata.
 */
export function getMsUntilNextMidnightIST(): number {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = istFormatter.formatToParts(now);
  const m: Record<string, number> = {};
  parts.forEach((p) => {
    if (p.type !== "literal") m[p.type] = Number(p.value);
  });

  // Today in IST
  const secondsSinceMidnight = m.hour * 3600 + m.minute * 60 + m.second;
  const secondsInDay = 86400;
  const secondsLeft = Math.max(secondsInDay - secondsSinceMidnight + 1, 1);
  return secondsLeft * 1000;
}

/**
 * Format relative or exact IST time
 */
export function formatISTTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Calculate growth percentage safely
 */
export function calcGrowth(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? "+100%" : "0%";
  const pct = Math.round(((curr - prev) / prev) * 100);
  return (pct >= 0 ? "+" : "") + pct + "%";
}

/* ==============================================================================
   SINGLE SHARED DATASET HOOK (ONE SOURCE OF TRUTH)
   ============================================================================== */

export function useBusinessAnalytics({
  businessId,
  hasLoyalty,
}: {
  businessId?: string;
  hasLoyalty: boolean;
}) {
  const [days, setDays] = useState<AnalyticsDayData[]>(() => {
    return getPast30DaysIST().map((d) => ({
      ...d,
      taps: 0,
      reviews: 0,
      insta: 0,
      whatsapp: 0,
      call: 0,
      location: 0,
      loyaltyVisits: 0,
      loyaltyRegistrations: 0,
      totalTaps: 0,
      totalActions: 0,
    }));
  });

  const [isLive, setIsLive] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);

  // Fetch 30-day dataset once in Asia/Kolkata days
  const fetch30DayDataset = useCallback(async () => {
    if (!businessId || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const past30 = getPast30DaysIST();
      const startDateStr = past30[0].dateStr; // e.g. "2026-09-21"
      // Convert to UTC ISO boundary for 00:00:00 IST
      const startUtcIso = new Date(`${startDateStr}T00:00:00+05:30`).toISOString();

      // Query 1: Interactions for this business in the last 30 IST days
      const interactionsPromise = supabase
        .from("interactions")
        .select("id, business_id, interaction_type, created_at")
        .eq("business_id", businessId)
        .gte("created_at", startUtcIso);

      // Query 2: Loyalty memberships (if loyalty feature is enabled)
      const loyaltyPromise = hasLoyalty
        ? supabase
            .from("loyalty_memberships")
            .select("id, visits, created_at, updated_at")
            .eq("business_id", businessId)
        : Promise.resolve({ data: [] as any[], error: null });

      const [interactionsRes, loyaltyRes] = await Promise.all([
        interactionsPromise,
        loyaltyPromise,
      ]);

      if (interactionsRes.error) {
        console.warn("[TAPX Analytics] interactions query warning:", interactionsRes.error.message);
      }

      // Initialize day map with exact 30 IST days
      const dayMap = new Map<string, AnalyticsDayData>();
      past30.forEach((d) => {
        dayMap.set(d.dateStr, {
          ...d,
          taps: 0,
          reviews: 0,
          insta: 0,
          whatsapp: 0,
          call: 0,
          location: 0,
          loyaltyVisits: 0,
          loyaltyRegistrations: 0,
          totalTaps: 0,
          totalActions: 0,
        });
      });

      // Populate interactions
      if (Array.isArray(interactionsRes.data)) {
        interactionsRes.data.forEach((item: any) => {
          if (!item.created_at) return;
          const istDate = getISTDateStr(item.created_at);
          const bucket = dayMap.get(istDate);
          if (!bucket) return;

          const type = (item.interaction_type || "").toLowerCase();
          if (type === "nfc_tap") {
            bucket.taps += 1;
          } else if (type === "google_review_click") {
            bucket.reviews += 1;
          } else if (type === "instagram_click") {
            bucket.insta += 1;
          } else if (type === "whatsapp_click") {
            bucket.whatsapp += 1;
          } else if (type === "call_click") {
            bucket.call += 1;
          } else if (type === "location_click") {
            bucket.location += 1;
          }
        });
      }

      // Populate loyalty
      if (hasLoyalty && Array.isArray(loyaltyRes.data)) {
        loyaltyRes.data.forEach((mem: any) => {
          // New member enrollment
          if (mem.created_at) {
            const regDate = getISTDateStr(mem.created_at);
            const bucket = dayMap.get(regDate);
            if (bucket) {
              bucket.loyaltyRegistrations += 1;
            }
          }
          // Loyalty visit
          if (mem.updated_at && (mem.visits || 0) > 0) {
            const visitDate = getISTDateStr(mem.updated_at);
            const bucket = dayMap.get(visitDate);
            if (bucket) {
              bucket.loyaltyVisits += 1;
            }
          }
        });
      }

      // Calculate totals for each day
      dayMap.forEach((bucket) => {
        bucket.totalTaps = bucket.taps;
        bucket.totalActions =
          bucket.taps +
          bucket.reviews +
          bucket.insta +
          bucket.whatsapp +
          bucket.call +
          bucket.location +
          bucket.loyaltyVisits +
          bucket.loyaltyRegistrations;
      });

      setDays(Array.from(dayMap.values()));
      setLastUpdated(new Date());
    } catch (err) {
      console.error("[TAPX Analytics] Failed to fetch 30-day dataset:", err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [businessId, hasLoyalty]);

  // Debounced refetch (300ms) to coalesce bursts
  const triggerDebouncedRefetch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetch30DayDataset();
    }, 300);
  }, [fetch30DayDataset]);

  // Setup Realtime subscriptions, fallback polling, and midnight IST rollover
  useEffect(() => {
    if (!businessId) return;

    let isMounted = true;
    let pollingTimer: NodeJS.Timeout | null = null;
    let midnightTimer: NodeJS.Timeout | null = null;

    // Initial fetch
    fetch30DayDataset();

    // Unique channel name for React Strict Mode safety
    const channelName = `analytics_channel_${businessId}_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase.channel(channelName);

    // 1. Subscribe to interactions (taps, review clicks, insta clicks, etc.)
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "interactions",
        filter: `business_id=eq.${businessId}`,
      },
      () => {
        if (!isMounted) return;
        triggerDebouncedRefetch();
      }
    );

    // 2. Subscribe to loyalty_memberships (new registrations & visits)
    if (hasLoyalty) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loyalty_memberships",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          if (!isMounted) return;
          triggerDebouncedRefetch();
        }
      );
    }

    // Subscription status tracking & reconnect handling
    channel.subscribe((status: string) => {
      if (!isMounted) return;
      if (status === "SUBSCRIBED") {
        setIsLive(true);
        setIsReconnecting(false);
        // Ensure fresh data on every connect/reconnect
        triggerDebouncedRefetch();
      } else if (
        status === "TIMED_OUT" ||
        status === "CHANNEL_ERROR" ||
        status === "CLOSED"
      ) {
        setIsLive(false);
        setIsReconnecting(true);
      }
    });

    // 3. Fallback polling: polls every 20 seconds
    pollingTimer = setInterval(() => {
      if (!isMounted) return;
      fetch30DayDataset();
    }, 20000);

    // 4. Automatic midnight IST day-rollover timer (zero reload)
    function setupMidnightTimer() {
      const ms = getMsUntilNextMidnightIST();
      midnightTimer = setTimeout(() => {
        if (!isMounted) return;
        fetch30DayDataset();
        setupMidnightTimer();
      }, ms);
    }
    setupMidnightTimer();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (pollingTimer) clearInterval(pollingTimer);
      if (midnightTimer) clearTimeout(midnightTimer);
      supabase.removeChannel(channel);
    };
  }, [businessId, hasLoyalty, fetch30DayDataset, triggerDebouncedRefetch]);

  // Derived figures: ALL strictly calculated from the single `days` dataset
  const derived = useMemo(() => {
    // 7-day dataset: exact last 7 days (indices 23 to 29)
    const last7DaysData = days.slice(-7);
    const todayData = days[days.length - 1] || {
      taps: 0,
      reviews: 0,
      insta: 0,
      whatsapp: 0,
      call: 0,
      location: 0,
      loyaltyVisits: 0,
      loyaltyRegistrations: 0,
      totalTaps: 0,
      totalActions: 0,
    };

    // Week metrics (last 7 days vs previous 7 days: days 16..22)
    const thisWeekTaps = last7DaysData.reduce((acc, d) => acc + d.taps, 0);
    const thisWeekActions = last7DaysData.reduce((acc, d) => acc + d.totalActions, 0);

    const prev7DaysData = days.slice(16, 23);
    const lastWeekTaps = prev7DaysData.reduce((acc, d) => acc + d.taps, 0);
    const lastWeekActions = prev7DaysData.reduce((acc, d) => acc + d.totalActions, 0);

    const weeklyTapsGrowth = calcGrowth(thisWeekTaps, lastWeekTaps);
    const weeklyActionsGrowth = calcGrowth(thisWeekActions, lastWeekActions);

    // Month metrics (all 30 days)
    const thisMonthTaps = days.reduce((acc, d) => acc + d.taps, 0);
    const thisMonthActions = days.reduce((acc, d) => acc + d.totalActions, 0);

    // 4-Week aggregated comparison (strictly 4 equal 7-day chunks = 28 days)
    // Week 1: days 2..8 (7 days)
    // Week 2: days 9..15 (7 days)
    // Week 3: days 16..22 (7 days, identical to prev7DaysData)
    // This week: days 23..29 (7 days, identical to last7DaysData)
    const w1 = days.slice(2, 9);
    const w2 = days.slice(9, 16);
    const w3 = days.slice(16, 23);
    const w4 = days.slice(23, 30);

    const monthlyWeeksData: WeekSummary[] = [
      {
        label: "Week 1 (28-22d ago)",
        taps: w1.reduce((acc, d) => acc + d.taps, 0),
        totalActions: w1.reduce((acc, d) => acc + d.totalActions, 0),
      },
      {
        label: "Week 2 (21-15d ago)",
        taps: w2.reduce((acc, d) => acc + d.taps, 0),
        totalActions: w2.reduce((acc, d) => acc + d.totalActions, 0),
      },
      {
        label: "Week 3 (14-8d ago)",
        taps: w3.reduce((acc, d) => acc + d.taps, 0),
        totalActions: w3.reduce((acc, d) => acc + d.totalActions, 0),
      },
      {
        label: "This week (last 7d)",
        taps: w4.reduce((acc, d) => acc + d.taps, 0),
        totalActions: w4.reduce((acc, d) => acc + d.totalActions, 0),
      },
    ];

    // Peak totals for graph Y-axis scaling
    const max7DaysActions = Math.max(...last7DaysData.map((d) => d.totalActions), 1);
    const max7DaysTaps = Math.max(...last7DaysData.map((d) => d.taps), 1);

    const max30DaysActions = Math.max(...days.map((d) => d.totalActions), 1);
    const max30DaysTaps = Math.max(...days.map((d) => d.taps), 1);

    const maxMonthlyActions = Math.max(...monthlyWeeksData.map((w) => w.totalActions), 1);
    const maxMonthlyTaps = Math.max(...monthlyWeeksData.map((w) => w.taps), 1);

    // Channel distribution (all 30 days)
    const channelCounts = {
      taps: thisMonthTaps,
      reviews: days.reduce((acc, d) => acc + d.reviews, 0),
      insta: days.reduce((acc, d) => acc + d.insta, 0),
      whatsapp: days.reduce((acc, d) => acc + d.whatsapp, 0),
      call: days.reduce((acc, d) => acc + d.call, 0),
      location: days.reduce((acc, d) => acc + d.location, 0),
      loyaltyVisits: days.reduce((acc, d) => acc + d.loyaltyVisits, 0),
      loyaltyRegistrations: days.reduce((acc, d) => acc + d.loyaltyRegistrations, 0),
    };

    const totalChannelInteractions = Math.max(
      channelCounts.taps +
        channelCounts.reviews +
        channelCounts.insta +
        channelCounts.whatsapp +
        channelCounts.call +
        channelCounts.location +
        channelCounts.loyaltyVisits +
        channelCounts.loyaltyRegistrations,
      1
    );

    return {
      last7DaysData,
      todayData,
      thisWeekTaps,
      thisWeekActions,
      lastWeekTaps,
      lastWeekActions,
      weeklyTapsGrowth,
      weeklyActionsGrowth,
      thisMonthTaps,
      thisMonthActions,
      monthlyWeeksData,
      max7DaysActions,
      max7DaysTaps,
      max30DaysActions,
      max30DaysTaps,
      maxMonthlyActions,
      maxMonthlyTaps,
      channelCounts,
      totalChannelInteractions,
    };
  }, [days]);

  return {
    days,
    derived,
    isLive,
    isReconnecting,
    lastUpdated,
    loading,
    refetch: fetch30DayDataset,
  };
}

/* ==============================================================================
   SVG PATH GENERATION HELPERS
   ============================================================================== */

function getBezierPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) * 0.18;
    const cp1y = p1.y + (p2.y - p0.y) * 0.18;
    const cp2x = p2.x - (p3.x - p1.x) * 0.18;
    const cp2y = p2.y - (p3.y - p1.y) * 0.18;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return path;
}

function getAreaPath(points: { x: number; y: number }[], bottomY: number) {
  if (points.length === 0) return "";
  const linePath = getBezierPath(points);
  const firstX = points[0].x.toFixed(1);
  const lastX = points[points.length - 1].x.toFixed(1);
  return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
}

/* ==============================================================================
   FLOATING TOOLTIP COMPONENT (CLAMPED & BAR-SAFE)
   ============================================================================== */

interface TooltipProps {
  day: AnalyticsDayData;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  hasReviews: boolean;
  hasInstagram: boolean;
  hasLoyalty: boolean;
  metric: "actions" | "taps";
}

function ChartTooltip({
  day,
  xPercent,
  yPercent,
  hasReviews,
  hasInstagram,
  hasLoyalty,
  metric,
}: TooltipProps) {
  // Clamp horizontal positioning so tooltip never clips outside the chart container
  // Near left edge (0-28%): align to left
  // Near right edge (72-100%): align to right
  // Middle: center
  let transform = "translateX(-50%)";
  let leftPos = `${xPercent}%`;

  if (xPercent < 28) {
    transform = "translateX(0%)";
    leftPos = `max(8px, ${xPercent}%)`;
  } else if (xPercent > 72) {
    transform = "translateX(-100%)";
    leftPos = `min(calc(100% - 8px), ${xPercent}%)`;
  }

  // Bar-safe vertical positioning:
  // Must NEVER cover the bar or the hovered node.
  // When yPercent > 38%, tooltip sits safely ABOVE the bar top with margin.
  // When bar is tall (yPercent <= 38%), tooltip flips to the side or sits offset so it doesn't obscure the top.
  let topStyle: React.CSSProperties = {
    top: `${yPercent}%`,
    transform: `${transform} translateY(calc(-100% - 14px))`,
  };

  if (yPercent < 38) {
    // Bar is near top margin: position below the top point or alongside
    if (xPercent < 50) {
      topStyle = {
        top: `${Math.max(yPercent, 12)}%`,
        transform: `translateX(18px) translateY(-50%)`,
      };
    } else {
      topStyle = {
        top: `${Math.max(yPercent, 12)}%`,
        transform: `translateX(calc(-100% - 18px)) translateY(-50%)`,
      };
    }
  }

  return (
    <div
      className="chart-tooltip-bubble"
      style={{
        position: "absolute",
        left: leftPos,
        ...topStyle,
        pointerEvents: "none",
        zIndex: 40,
        background: "#0f172a",
        color: "#ffffff",
        borderRadius: "12px",
        padding: "10px 14px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.25)",
        minWidth: "170px",
        maxWidth: "230px",
        fontSize: "12px",
        lineHeight: "1.4",
        border: "1px solid rgba(255, 255, 255, 0.12)",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>
        {day.dayLabel} ({day.dayName})
      </div>

      <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", marginBottom: "6px" }}>
        {metric === "taps" ? (
          <span>{day.taps} taps</span>
        ) : (
          <span>Total: {day.totalActions} actions</span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "11px" }}>
        {metric === "actions" && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#60a5fa" }}>
            <span>Taps</span>
            <strong>{day.taps}</strong>
          </div>
        )}

        {hasReviews && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#34d399" }}>
            <span>Reviews</span>
            <strong>{day.reviews}</strong>
          </div>
        )}

        {hasInstagram && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#f472b6" }}>
            <span>Instagram</span>
            <strong>{day.insta}</strong>
          </div>
        )}

        {hasLoyalty && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#fbbf24" }}>
              <span>Loyalty visits</span>
              <strong>{day.loyaltyVisits}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#a78bfa" }}>
              <span>New registrations</span>
              <strong>{day.loyaltyRegistrations}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ==============================================================================
   7-DAY WEEKLY CHART COMPONENT
   ============================================================================== */

function WeeklyTrendChart({
  data,
  maxVal,
  metric,
  hasReviews,
  hasInstagram,
  hasLoyalty,
}: {
  data: AnalyticsDayData[];
  maxVal: number;
  metric: "actions" | "taps";
  hasReviews: boolean;
  hasInstagram: boolean;
  hasLoyalty: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const viewBoxWidth = 600;
  const viewBoxHeight = 220;
  const leftMargin = 38;
  const rightMargin = 20;
  const topMargin = 32;
  const bottomMargin = 175;
  const chartWidth = viewBoxWidth - leftMargin - rightMargin;
  const chartHeight = bottomMargin - topMargin;

  const yMax = Math.max(maxVal, 4);
  const colWidth = chartWidth / Math.max(data.length, 1);

  const gridSteps = [0, 0.33, 0.66, 1];

  const points = data.map((day, i) => {
    const val = metric === "taps" ? day.taps : day.totalActions;
    const x = leftMargin + (i + 0.5) * colWidth;
    const y = bottomMargin - (val / yMax) * chartHeight;
    return { x, y, val, day };
  });

  const lineD = getBezierPath(points);
  const areaD = getAreaPath(points, bottomMargin);

  const hoveredPoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onClick={() => setHoveredIndex(null)}
    >
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", overflow: "visible", display: "block" }}
      >
        <defs>
          <linearGradient id="weeklyAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
          </linearGradient>

          <linearGradient id="weeklyBarGradActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="weeklyBarGradInactive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.8" />
          </linearGradient>

          <filter id="shadowWeekly" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* HORIZONTAL GRID LINES & Y-AXIS LABELS */}
        {gridSteps.map((step) => {
          const val = Math.round(yMax * step);
          const lineY = bottomMargin - step * chartHeight;
          return (
            <g key={step}>
              <line
                x1={leftMargin}
                y1={lineY}
                x2={viewBoxWidth - rightMargin}
                y2={lineY}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={leftMargin - 8}
                y={lineY + 4}
                fill="#94a3b8"
                fontSize="11"
                fontWeight="600"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* CURVED AREA FILL */}
        <path d={areaD} fill="url(#weeklyAreaGrad)" />

        {/* BARS FOR EACH DAY */}
        {data.map((day, i) => {
          const pt = points[i];
          const barW = Math.min(colWidth * 0.44, 30);
          const barX = pt.x - barW / 2;
          const barH = Math.max(bottomMargin - pt.y, 4);
          const isToday = i === data.length - 1;
          const isHovered = hoveredIndex === i;

          return (
            <g
              key={day.dateStr}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onTouchStart={(e) => {
                e.stopPropagation();
                setHoveredIndex(i);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setHoveredIndex(isHovered ? null : i);
              }}
              style={{ cursor: "pointer" }}
            >
              {/* Invisible touch/hover hit zone */}
              <rect
                x={pt.x - colWidth / 2}
                y={topMargin}
                width={colWidth}
                height={chartHeight + 30}
                fill="transparent"
              />

              {/* Bar element */}
              <rect
                className="analytics-bar"
                x={barX}
                y={pt.y}
                width={barW}
                height={barH}
                rx="6"
                ry="6"
                fill={
                  isHovered
                    ? "#1d4ed8"
                    : isToday
                    ? "url(#weeklyBarGradActive)"
                    : "url(#weeklyBarGradInactive)"
                }
                style={{
                  transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />

              {/* X-Axis day name label */}
              <text
                x={pt.x}
                y={bottomMargin + 20}
                fill={isToday ? "#2563eb" : "#64748b"}
                fontSize="12"
                fontWeight={isToday ? "800" : "600"}
                textAnchor="middle"
              >
                {day.dayName}
              </text>

              {/* Bar top value label */}
              <text
                className="analytics-value"
                x={pt.x}
                y={Math.max(pt.y - 7, topMargin - 4)}
                fill={isToday ? "#1d4ed8" : "#334155"}
                fontSize="11"
                fontWeight="800"
                textAnchor="middle"
              >
                {pt.val}
              </text>
            </g>
          );
        })}

        {/* SMOOTH SPLINE CURVE LINE */}
        <path
          d={lineD}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#shadowWeekly)"
        />

        {/* DATA NODES */}
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={hoveredIndex === i ? "6" : "4"}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth="2.5"
            style={{ transition: "all 0.2s ease", pointerEvents: "none" }}
          />
        ))}
      </svg>

      {/* CLAMPED FLOATING TOOLTIP */}
      {hoveredPoint && (
        <ChartTooltip
          day={hoveredPoint.day}
          xPercent={(hoveredPoint.x / viewBoxWidth) * 100}
          yPercent={(hoveredPoint.y / viewBoxHeight) * 100}
          hasReviews={hasReviews}
          hasInstagram={hasInstagram}
          hasLoyalty={hasLoyalty}
          metric={metric}
        />
      )}
    </div>
  );
}

/* ==============================================================================
   30-DAY MONTHLY CONTINUOUS AREA CHART COMPONENT
   ============================================================================== */

function MonthlyTrendChart({
  data,
  maxVal,
  metric,
  hasReviews,
  hasInstagram,
  hasLoyalty,
}: {
  data: AnalyticsDayData[];
  maxVal: number;
  metric: "actions" | "taps";
  hasReviews: boolean;
  hasInstagram: boolean;
  hasLoyalty: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const viewBoxWidth = 650;
  const viewBoxHeight = 220;
  const leftMargin = 38;
  const rightMargin = 20;
  const topMargin = 32;
  const bottomMargin = 175;
  const chartWidth = viewBoxWidth - leftMargin - rightMargin;
  const chartHeight = bottomMargin - topMargin;

  const yMax = Math.max(maxVal, 4);

  const points = data.map((day, i) => {
    const val = metric === "taps" ? day.taps : day.totalActions;
    const x = leftMargin + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const y = bottomMargin - (val / yMax) * chartHeight;
    return { x, y, val, day };
  });

  const lineD = getBezierPath(points);
  const areaD = getAreaPath(points, bottomMargin);

  const gridSteps = [0, 0.33, 0.66, 1];
  const hoveredPoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onClick={() => setHoveredIndex(null)}
    >
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", overflow: "visible", display: "block" }}
      >
        <defs>
          <linearGradient id="monthlyAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.0" />
          </linearGradient>

          <filter id="shadowPurple" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.14" />
          </filter>
        </defs>

        {/* HORIZONTAL GRID LINES & Y-AXIS LABELS */}
        {gridSteps.map((step) => {
          const val = Math.round(yMax * step);
          const lineY = bottomMargin - step * chartHeight;
          return (
            <g key={step}>
              <line
                x1={leftMargin}
                y1={lineY}
                x2={viewBoxWidth - rightMargin}
                y2={lineY}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={leftMargin - 8}
                y={lineY + 4}
                fill="#94a3b8"
                fontSize="11"
                fontWeight="600"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* CONTINUOUS AREA GRADIENT */}
        <path d={areaD} fill="url(#monthlyAreaGrad)" />

        {/* CONTINUOUS LINE CURVE */}
        <path
          d={lineD}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#shadowPurple)"
        />

        {/* INTERACTIVE TOUCH/HOVER ZONES & EVENLY SPACED X-AXIS LABELS */}
        {data.map((day, i) => {
          const pt = points[i];
          // Evenly spaced labels at 0, 7, 14, 21, and 29 (Today)
          const isTick = i === 0 || i === 7 || i === 14 || i === 21 || i === data.length - 1;
          const isToday = i === data.length - 1;
          const isHovered = hoveredIndex === i;

          return (
            <g
              key={day.dateStr}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onTouchStart={(e) => {
                e.stopPropagation();
                setHoveredIndex(i);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setHoveredIndex(isHovered ? null : i);
              }}
              style={{ cursor: "pointer" }}
            >
              {/* Hit zone */}
              <rect
                x={pt.x - chartWidth / 60}
                y={topMargin}
                width={chartWidth / 30}
                height={chartHeight + 25}
                fill="transparent"
              />

              {/* X-axis tick labels */}
              {isTick && (
                <text
                  x={pt.x}
                  y={bottomMargin + 20}
                  fill={isToday ? "#7c3aed" : "#64748b"}
                  fontSize="11"
                  fontWeight={isToday ? "800" : "600"}
                  textAnchor="middle"
                >
                  {day.dayLabel}
                </text>
              )}

              {/* Node dot on curve */}
              {(pt.val > 0 || isHovered || isTick) && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? "6" : pt.val > 0 ? "4" : "2.5"}
                  fill={isHovered ? "#7c3aed" : "#ffffff"}
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  style={{ transition: "all 0.2s ease" }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* CLAMPED FLOATING TOOLTIP */}
      {hoveredPoint && (
        <ChartTooltip
          day={hoveredPoint.day}
          xPercent={(hoveredPoint.x / viewBoxWidth) * 100}
          yPercent={(hoveredPoint.y / viewBoxHeight) * 100}
          hasReviews={hasReviews}
          hasInstagram={hasInstagram}
          hasLoyalty={hasLoyalty}
          metric={metric}
        />
      )}
    </div>
  );
}

/* ==============================================================================
   ANALYTICS CARD & LINE COMPONENTS
   ============================================================================== */

function StatMetricCard({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string | number;
  note: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="stat-metric-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span className="stat-card-title">{title}</span>
        {icon && <div className="stat-card-icon">{icon}</div>}
      </div>
      <strong className="stat-card-value">{value}</strong>
      <small className="stat-card-note">{note}</small>

      <style jsx>{`
        .stat-metric-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
        }
        .stat-card-title {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .stat-card-icon {
          color: #94a3b8;
        }
        .stat-card-value {
          display: block;
          margin-top: 12px;
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.03em;
        }
        .stat-card-note {
          display: block;
          color: #94a3b8;
          margin-top: 6px;
          font-size: 11px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderTop: "1px solid #f1f5f9",
        fontSize: "13px",
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>
      <strong style={{ color: "#0f172a", fontWeight: 700 }}>{value}</strong>
    </div>
  );
}

/* ==============================================================================
   MAIN REAL-TIME ANALYTICS PAGE COMPONENT
   ============================================================================== */

export default function AnalyticsPage({
  business,
  hasLoyalty = false,
  orders = [],
  todayOrders = [],
  pendingOrders = [],
  completedOrders = [],
  todayRevenue = 0,
  completedRevenue = 0,
  enabledPaidFeatures = [],
  hasOrders = false,
}: {
  business?: AnalyticsBusiness | null;
  hasLoyalty?: boolean;
  orders?: AnalyticsOrder[];
  todayOrders?: AnalyticsOrder[];
  pendingOrders?: AnalyticsOrder[];
  completedOrders?: AnalyticsOrder[];
  todayRevenue?: number;
  completedRevenue?: number;
  enabledPaidFeatures?: AnalyticsFeature[];
  hasOrders?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"both" | "weekly" | "monthly">("both");
  const [metricMode, setMetricMode] = useState<"actions" | "taps">("actions");

  const businessId = business?.id;
  const hasReviews = Boolean(business?.google_review_url);
  const hasInstagram = Boolean(business?.instagram_url);

  // Single Shared Store & Real-time Hook
  const { days, derived, isLive, isReconnecting, lastUpdated } = useBusinessAnalytics({
    businessId,
    hasLoyalty,
  });

  const averageOrderValue =
    completedOrders.length > 0 ? completedRevenue / completedOrders.length : 0;

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return (
    <div className="analytics-page">
      {/* INTRO & REALTIME STATUS HEADER */}
      <div className="analytics-intro">
        <div>
          <div className="eyebrow-container">
            <span className="eyebrow">Business performance & growth</span>

            {/* LIVE / RECONNECTING INDICATOR */}
            <span
              className={`live-badge ${isLive ? "live" : "reconnecting"}`}
              title={
                isLive
                  ? "Connected to live database stream"
                  : "Connecting or polling in progress"
              }
            >
              <span className="status-dot" />
              {isLive ? "Live realtime" : isReconnecting ? "Reconnecting..." : "Connecting"}
            </span>

            {lastUpdated && (
              <span className="last-updated-text">
                Updated {formatISTTime(lastUpdated)} IST
              </span>
            )}
          </div>

          <h1 className="analytics-title">Analytics & growth dashboard</h1>

          <p className="analytics-subtitle">
            Real-time analytics powered by live NFC taps, QR scans, and customer interactions.
          </p>
        </div>

        {/* CONTROLS (TABS & METRIC TOGGLE) */}
        <div className="controls-group">
          {/* METRIC TOGGLE: ALL ACTIONS vs TAPS ONLY */}
          <div className="toggle-pill">
            <button
              type="button"
              onClick={() => setMetricMode("actions")}
              className={`toggle-btn ${metricMode === "actions" ? "active" : ""}`}
            >
              All actions
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("taps")}
              className={`toggle-btn ${metricMode === "taps" ? "active" : ""}`}
            >
              Taps only
            </button>
          </div>

          {/* VIEW TABS */}
          <div className="toggle-pill">
            <button
              type="button"
              onClick={() => setActiveTab("both")}
              className={`toggle-btn ${activeTab === "both" ? "active" : ""}`}
            >
              Both graphs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("weekly")}
              className={`toggle-btn ${activeTab === "weekly" ? "active" : ""}`}
            >
              7-day weekly
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("monthly")}
              className={`toggle-btn ${activeTab === "monthly" ? "active" : ""}`}
            >
              30-day monthly
            </button>
          </div>
        </div>
      </div>

      {/* TODAY'S ACTION SUMMARY CARDS (DERIVED DIRECTLY FROM SHARED STORE'S TODAY BUCKET) */}
      <section className="analytics-today-actions">
        <div className="section-eyebrow">Today&apos;s customer actions</div>
        <h2 className="section-title">Today&apos;s action summary</h2>

        <div className="analytics-actions-grid">
          <StatMetricCard
            title="Total taps today"
            value={derived.todayData.taps}
            note="NFC and QR page opens today"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
          />

          {hasReviews && (
            <StatMetricCard
              title="Google reviews today"
              value={derived.todayData.reviews}
              note="Review us button clicks"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              }
            />
          )}

          {hasInstagram && (
            <StatMetricCard
              title="Instagram visits today"
              value={derived.todayData.insta}
              note="Instagram profile visits"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              }
            />
          )}

          {hasLoyalty && (
            <>
              <StatMetricCard
                title="Loyalty visits today"
                value={derived.todayData.loyaltyVisits}
                note="Customer check-ins recorded today"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                }
              />

              <StatMetricCard
                title="New loyalty members"
                value={derived.todayData.loyaltyRegistrations}
                note="New enrollments joined today"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                }
              />
            </>
          )}

          <StatMetricCard
            title="Total actions today"
            value={derived.todayData.totalActions}
            note="All customer interactions combined"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          />
        </div>
      </section>

      {/* VISUAL GROWTH TREND GRAPHS (7-DAY & 30-DAY) */}
      <section className="analytics-graphs-section">
        <div className="section-eyebrow">Visual growth analytics</div>
        <h2 className="section-title">Weekly & monthly visual trend graphs</h2>

        <div className={`graphs-grid ${activeTab === "both" ? "two-col" : "one-col"}`}>
          {/* 7-DAY WEEKLY GRAPH CARD */}
          {(activeTab === "both" || activeTab === "weekly") && (
            <div className="graph-card">
              <div className="graph-card-header">
                <div>
                  <span className="card-badge weekly-badge">7-day weekly trend</span>
                  <h3 className="card-title">Weekly growth graph</h3>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="card-metric-value weekly-color">
                    {metricMode === "taps" ? derived.thisWeekTaps : derived.thisWeekActions}
                  </span>
                  <div className="card-metric-sub">
                    {metricMode === "taps" ? "Taps" : "Actions"} this week ({metricMode === "taps" ? derived.weeklyTapsGrowth : derived.weeklyActionsGrowth})
                  </div>
                </div>
              </div>

              {/* Chart container with fixed aspect ratio */}
              <div className="chart-wrapper">
                <WeeklyTrendChart
                  data={derived.last7DaysData}
                  maxVal={metricMode === "taps" ? derived.max7DaysTaps : derived.max7DaysActions}
                  metric={metricMode}
                  hasReviews={hasReviews}
                  hasInstagram={hasInstagram}
                  hasLoyalty={hasLoyalty}
                />
              </div>

              <div className="graph-card-footer">
                <span>Hover or tap bars for detailed breakdown</span>
                <span className="footer-status">
                  <span className="status-dot green" />
                  Real-time sync
                </span>
              </div>
            </div>
          )}

          {/* 30-DAY MONTHLY CONTINUOUS GRAPH CARD */}
          {(activeTab === "both" || activeTab === "monthly") && (
            <div className="graph-card">
              <div className="graph-card-header">
                <div>
                  <span className="card-badge monthly-badge">30-day monthly trend</span>
                  <h3 className="card-title">Monthly growth graph</h3>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="card-metric-value monthly-color">
                    {metricMode === "taps" ? derived.thisMonthTaps : derived.thisMonthActions}
                  </span>
                  <div className="card-metric-sub">
                    {metricMode === "taps" ? "Taps" : "Actions"} in last 30 days
                  </div>
                </div>
              </div>

              {/* Chart container with fixed aspect ratio */}
              <div className="chart-wrapper">
                <MonthlyTrendChart
                  data={days}
                  maxVal={metricMode === "taps" ? derived.max30DaysTaps : derived.max30DaysActions}
                  metric={metricMode}
                  hasReviews={hasReviews}
                  hasInstagram={hasInstagram}
                  hasLoyalty={hasLoyalty}
                />
              </div>

              {/* 4-WEEK AGGREGATED BREAKDOWN (EXACTLY 4 EQUAL 7-DAY CHUNKS) */}
              <div className="four-week-container">
                <div className="four-week-title">4-week aggregated comparison</div>
                <div className="four-week-grid">
                  {derived.monthlyWeeksData.map((week, idx) => {
                    const isCurrentWeek = idx === 3;
                    const val = metricMode === "taps" ? week.taps : week.totalActions;
                    const maxMonthly = metricMode === "taps" ? derived.maxMonthlyTaps : derived.maxMonthlyActions;
                    const widthPct = Math.max(Math.round((val / maxMonthly) * 100), 8);

                    return (
                      <div
                        key={week.label}
                        className={`four-week-box ${isCurrentWeek ? "current" : ""}`}
                      >
                        <div className="four-week-label">{week.label}</div>
                        <div className="four-week-num">
                          {val}{" "}
                          <small className="four-week-unit">
                            {metricMode === "taps" ? "taps" : "actions"}
                          </small>
                        </div>
                        <div className="four-week-bar-bg">
                          <div
                            className={`four-week-bar-fill ${isCurrentWeek ? "purple" : "slate"}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="graph-card-footer">
                <span>Hover or tap curve nodes for daily breakdown</span>
                <span className="footer-status">
                  <span className="status-dot green" />
                  Real-time sync
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CHANNEL BREAKDOWN */}
      <section className="analytics-card-section">
        <div className="section-eyebrow">Channel breakdown</div>
        <h3 className="section-title">Customer action distribution</h3>

        <div className="channel-distribution-list">
          <div>
            <div className="channel-row">
              <span style={{ color: "#2563eb", fontWeight: 700 }}>NFC and QR taps</span>
              <span>
                {derived.channelCounts.taps} ({Math.round((derived.channelCounts.taps / derived.totalChannelInteractions) * 100)}%)
              </span>
            </div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.round((derived.channelCounts.taps / derived.totalChannelInteractions) * 100)}%`,
                  background: "#2563eb",
                }}
              />
            </div>
          </div>

          {hasReviews && (
            <div>
              <div className="channel-row">
                <span style={{ color: "#059669", fontWeight: 700 }}>Google review taps</span>
                <span>
                  {derived.channelCounts.reviews} ({Math.round((derived.channelCounts.reviews / derived.totalChannelInteractions) * 100)}%)
                </span>
              </div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.round((derived.channelCounts.reviews / derived.totalChannelInteractions) * 100)}%`,
                    background: "#059669",
                  }}
                />
              </div>
            </div>
          )}

          {hasInstagram && (
            <div>
              <div className="channel-row">
                <span style={{ color: "#d97706", fontWeight: 700 }}>Instagram profile visits</span>
                <span>
                  {derived.channelCounts.insta} ({Math.round((derived.channelCounts.insta / derived.totalChannelInteractions) * 100)}%)
                </span>
              </div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.round((derived.channelCounts.insta / derived.totalChannelInteractions) * 100)}%`,
                    background: "#d97706",
                  }}
                />
              </div>
            </div>
          )}

          {hasLoyalty && (
            <>
              <div>
                <div className="channel-row">
                  <span style={{ color: "#b45309", fontWeight: 700 }}>Loyalty visits recorded</span>
                  <span>
                    {derived.channelCounts.loyaltyVisits} ({Math.round((derived.channelCounts.loyaltyVisits / derived.totalChannelInteractions) * 100)}%)
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.round((derived.channelCounts.loyaltyVisits / derived.totalChannelInteractions) * 100)}%`,
                      background: "#b45309",
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="channel-row">
                  <span style={{ color: "#7c3aed", fontWeight: 700 }}>New loyalty enrollments</span>
                  <span>
                    {derived.channelCounts.loyaltyRegistrations} ({Math.round((derived.channelCounts.loyaltyRegistrations / derived.totalChannelInteractions) * 100)}%)
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.round((derived.channelCounts.loyaltyRegistrations / derived.totalChannelInteractions) * 100)}%`,
                      background: "#7c3aed",
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <div className="channel-row">
              <span style={{ color: "#475569", fontWeight: 700 }}>Direct contact (WhatsApp and calls)</span>
              <span>
                {derived.channelCounts.whatsapp + derived.channelCounts.call + derived.channelCounts.location} (
                {Math.round(((derived.channelCounts.whatsapp + derived.channelCounts.call + derived.channelCounts.location) / derived.totalChannelInteractions) * 100)}%)
              </span>
            </div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.round(((derived.channelCounts.whatsapp + derived.channelCounts.call + derived.channelCounts.location) / derived.totalChannelInteractions) * 100)}%`,
                  background: "#64748b",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ORDERS & SERVICES OVERVIEW (IF MODULE IS ENABLED) */}
      {hasOrders && (
        <section className="analytics-orders-section">
          <div className="analytics-grid">
            <StatMetricCard
              title="Today's revenue"
              value={formatCurrency(todayRevenue)}
              note={`${todayOrders.length} orders created today`}
            />

            <StatMetricCard
              title="Today's orders"
              value={String(todayOrders.length)}
              note={pendingOrders.length ? `${pendingOrders.length} need attention` : "No pending orders"}
            />

            <StatMetricCard
              title="Active orders"
              value={String(pendingOrders.length)}
              note="Orders requiring attention"
            />

            <StatMetricCard
              title="Average order"
              value={formatCurrency(averageOrderValue)}
              note="Based on completed orders"
            />
          </div>

          <div className="analytics-panels">
            <div className="analytics-panel">
              <h3 className="panel-title">Order performance</h3>
              <StatLine label="Total orders" value={orders.length} />
              <StatLine label="Completed orders" value={completedOrders.length} />
              <StatLine label="Active orders" value={pendingOrders.length} />
            </div>

            <div className="analytics-panel">
              <h3 className="panel-title">Enabled services</h3>
              {enabledPaidFeatures.length === 0 ? (
                <p className="analytics-empty">No paid modules are currently enabled.</p>
              ) : (
                enabledPaidFeatures.map((feature) => (
                  <div className="analytics-service" key={feature.id}>
                    <span className="service-icon">{feature.icon || "✦"}</span>
                    <strong className="service-name">{feature.name}</strong>
                    <em className="service-badge">Active</em>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* COMPONENT SCOPED CSS STYLES (PHASE 4 DESIGN TOKENS) */}
      <style jsx>{`
        .analytics-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .analytics-intro {
          display: flex;
          justifyContent: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
        }

        .eyebrow-container {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .eyebrow {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
        }

        .live-badge.live {
          background: #dcfce7;
          color: #15803d;
        }

        .live-badge.reconnecting {
          background: #fef3c7;
          color: #b45309;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
        }

        .live-badge.live .status-dot {
          background: #22c55e;
          box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
        }

        .live-badge.reconnecting .status-dot {
          background: #f59e0b;
        }

        .status-dot.green {
          background: #22c55e;
        }

        .last-updated-text {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
        }

        .analytics-title {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.03em;
        }

        .analytics-subtitle {
          color: #64748b;
          font-size: 13px;
          margin: 6px 0 0;
          line-height: 1.5;
        }

        .controls-group {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .toggle-pill {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 12px;
          gap: 4px;
          border: 1px solid #e2e8f0;
        }

        .toggle-btn {
          border: 0;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          background: transparent;
          color: #64748b;
          transition: all 0.15s ease;
        }

        .toggle-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          font-weight: 700;
        }

        .analytics-today-actions {
          margin-top: 28px;
        }

        .section-eyebrow {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .section-title {
          font-size: 18px;
          font-weight: 800;
          margin: 2px 0 14px;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .analytics-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .analytics-graphs-section {
          margin-top: 32px;
        }

        .graphs-grid {
          display: grid;
          gap: 20px;
          align-items: stretch;
        }

        .graphs-grid.two-col {
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        }

        .graphs-grid.one-col {
          grid-template-columns: 1fr;
        }

        .graph-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          height: 100%;
        }

        .graph-card-header {
          display: flex;
          justifyContent: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .card-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 9999px;
          display: inline-block;
        }

        .weekly-badge {
          color: #2563eb;
          background: #eff6ff;
        }

        .monthly-badge {
          color: #7c3aed;
          background: #f5f3ff;
        }

        .card-title {
          margin: 6px 0 0;
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .card-metric-value {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .weekly-color {
          color: #2563eb;
        }

        .monthly-color {
          color: #7c3aed;
        }

        .card-metric-sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }

        .chart-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          min-height: 200px;
          display: flex;
          align-items: center;
        }

        .graph-card-footer {
          display: flex;
          justifyContent: space-between;
          align-items: center;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #f1f5f9;
          font-size: 11px;
          color: #64748b;
        }

        .footer-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
        }

        .four-week-container {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }

        .four-week-title {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 10px;
        }

        .four-week-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .four-week-box {
          background: #f8fafc;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
        }

        .four-week-box.current {
          background: #faf5ff;
          border-color: #ddd6fe;
        }

        .four-week-label {
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
        }

        .four-week-box.current .four-week-label {
          color: #7c3aed;
        }

        .four-week-num {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 4px;
        }

        .four-week-box.current .four-week-num {
          color: #7c3aed;
        }

        .four-week-unit {
          font-size: 10px;
          font-weight: 500;
          color: #94a3b8;
        }

        .four-week-bar-bg {
          height: 4px;
          background: #e2e8f0;
          border-radius: 4px;
          margin-top: 8px;
          overflow: hidden;
        }

        .four-week-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .four-week-bar-fill.purple {
          background: #7c3aed;
        }

        .four-week-bar-fill.slate {
          background: #94a3b8;
        }

        .analytics-card-section {
          margin-top: 28px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }

        .channel-distribution-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .channel-row {
          display: flex;
          justifyContent: space-between;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .progress-bar-bg {
          height: 8px;
          background: #f1f5f9;
          border-radius: 10px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: 10px;
          transition: width 0.4s ease;
        }

        .analytics-orders-section {
          margin-top: 24px;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 20px;
        }

        .analytics-panels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 16px;
        }

        .analytics-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 24px;
        }

        .panel-title {
          margin: 0 0 16px;
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
        }

        .analytics-service {
          min-height: 48px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .service-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: #f1f5f9;
          display: grid;
          place-items: center;
          font-size: 12px;
        }

        .service-name {
          flex: 1;
          font-size: 12px;
          color: #0f172a;
        }

        .service-badge {
          color: #15803d;
          font-size: 10px;
          font-style: normal;
          font-weight: 700;
          background: #dcfce7;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .analytics-empty {
          color: #94a3b8;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .analytics-grid {
            grid-template-columns: 1fr 1fr;
          }
          .analytics-panels {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 550px) {
          .analytics-actions-grid {
            grid-template-columns: 1fr;
          }
          .analytics-grid {
            grid-template-columns: 1fr;
          }
          .four-week-grid {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .analytics-title {
            font-size: 24px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .progress-bar-fill,
          .four-week-bar-fill,
          .toggle-btn {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
