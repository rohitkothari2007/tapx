/**
 * Pure functions for TAPX Client Portal Reminders.
 *
 * Rules:
 * - All date and time calculations are strictly in India Standard Time (Asia/Kolkata, UTC+5:30).
 * - No Supabase calls or network requests inside this module.
 * - No business-specific names, IDs, phones, or device codes.
 */

export interface LoyaltyMemberCustomer {
  name?: string | null;
  phone?: string | null;
}

export interface LoyaltyMemberData {
  id: string;
  customer_id?: string;
  visits?: number | null;
  redemption_count?: number | null;
  reward_claimed?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  customer?: LoyaltyMemberCustomer | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  [key: string]: any;
}

export interface LoyaltyRewardData {
  id: string;
  business_id?: string;
  customer_id?: string;
  membership_id: string;
  visit_count_at_reward?: number | null;
  reward_description?: string | null;
  status?: string | null;
  created_at?: string | null;
  customer?: LoyaltyMemberCustomer | null;
  [key: string]: any;
}

export interface OfferData {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  discount?: string;
  start_date?: string;
  end_date?: string;
  active_days?: string[];
  active_time_start?: string;
  active_time_end?: string;
  [key: string]: any;
}

export interface MessageLogRow {
  id?: string;
  business_id: string;
  membership_id: string;
  message_type: "welcome" | "reward" | "offer" | "occasion";
  ref_id: string;
  sent_at: string;
  sent_by?: string | null;
}

export interface WelcomeReminderItem {
  type: "welcome";
  membershipId: string;
  customerName: string;
  customerPhone: string;
  phoneDigits: string | null;
  joinedAt: string;
  refId: "";
  logRow?: MessageLogRow | null;
  isSent: boolean;
  sentAt?: string | null;
}

export interface RewardReminderItem {
  type: "reward";
  membershipId: string;
  rewardId: string;
  customerName: string;
  customerPhone: string;
  phoneDigits: string | null;
  rewardDescription: string;
  visitCountAtReward: number;
  rewardCreatedAt: string;
  refId: string;
  logRow?: MessageLogRow | null;
  isSent: boolean;
  sentAt?: string | null;
}

export interface OfferReminderItem {
  type: "offer";
  membershipId: string;
  offerId: string;
  offerTitle: string;
  offerDescription: string;
  customerName: string;
  customerPhone: string;
  phoneDigits: string | null;
  refId: string;
  logRow?: MessageLogRow | null;
  isSent: boolean;
  sentAt?: string | null;
}

export interface SentHistoryItem {
  id: string;
  membershipId: string;
  customerName: string;
  customerPhone: string;
  messageType: "welcome" | "reward" | "offer" | "occasion";
  refId: string;
  sentAt: string;
  detailLabel: string;
}

export const DEFAULT_TEMPLATES = {
  welcome:
    "Hi {name}, welcome to {business}! Thank you for visiting us. We are delighted to have you as part of our community and look forward to seeing you again soon!",
  reward:
    "Hi {name}, congratulations! You have earned a loyalty reward at {business}: {reward}! Show this message on your next visit to redeem it.",
  offer:
    "Hi {name}, special offer from {business}: {offer}! Visit us today to claim this limited-time promotion.",
};

/**
 * Returns India Standard Time (Asia/Kolkata) date string formatted as YYYY-MM-DD.
 */
export function getIndiaYMD(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    // Fallback if Intl fails
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffset);
    return istDate.toISOString().slice(0, 10);
  }
}

/**
 * Returns India Standard Time (Asia/Kolkata) time formatted as HH:mm (24-hour).
 */
export function getIndiaHHMM(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffset);
    return istDate.toISOString().slice(11, 16);
  }
}

/**
 * Returns India Standard Time (Asia/Kolkata) 3-letter lowercase day of the week ('sun'..'sat').
 */
export function getIndiaDayOfWeek(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
    })
      .format(d)
      .toLowerCase()
      .slice(0, 3);
  } catch {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffset);
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return days[istDate.getUTCDay()];
  }
}

/**
 * Formats timestamp to Asia/Kolkata DD-MMM HH:mm (e.g. "31-Oct 14:05").
 */
export function formatIndiaSentTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);

    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const hour = parts.find((p) => p.type === "hour")?.value || "";
    const minute = parts.find((p) => p.type === "minute")?.value || "";
    return `${day}-${month} ${hour}:${minute}`;
  } catch {
    return d.toISOString().slice(5, 16).replace("T", " ");
  }
}

/**
 * Formats timestamp to Asia/Kolkata DD-MMM-YYYY (e.g. "31-Oct-2026").
 */
export function formatIndiaDateOnly(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).formatToParts(d);

    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const year = parts.find((p) => p.type === "year")?.value || "";
    return `${day}-${month}-${year}`;
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Calculates start of 7 days ago in Asia/Kolkata (midnight 00:00:00 IST of (today - 7 days)).
 */
export function getIndiaMidnight7DaysAgoMs(now: Date = new Date()): number {
  const todayYMD = getIndiaYMD(now); // e.g. "2026-10-31"
  // Construct midnight IST today: "2026-10-31T00:00:00+05:30"
  const midnightTodayIST = new Date(`${todayYMD}T00:00:00+05:30`).getTime();
  if (isNaN(midnightTodayIST)) {
    // Fallback: 7 full 24h days from now
    return now.getTime() - 7 * 24 * 60 * 60 * 1000;
  }
  return midnightTodayIST - 7 * 24 * 60 * 60 * 1000;
}

/**
 * Checks if a member joined within the last 7 days in India time.
 */
export function isJoinedWithinLast7Days(
  createdAtStr: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!createdAtStr) return false;
  const joinedTime = new Date(createdAtStr).getTime();
  if (isNaN(joinedTime)) return false;

  const thresholdMs = getIndiaMidnight7DaysAgoMs(now);
  const nowMs = now.getTime();
  // Within last 7 days and not in the distant future (+1 minute buffer for clock drift)
  return joinedTime >= thresholdMs && joinedTime <= nowMs + 60000;
}

/**
 * Checks if an offer is currently live now in India Standard Time.
 * Follows the existing logic used in Offers portal:
 * 1. start_date check (YYYY-MM-DD)
 * 2. end_date check (YYYY-MM-DD)
 * 3. active_days check (array of days: 'mon', 'tue', etc.)
 * 4. active_time_start check (HH:mm)
 * 5. active_time_end check (HH:mm)
 */
export function isOfferLiveNow(offer: OfferData | null | undefined, now: Date = new Date()): boolean {
  if (!offer) return false;

  const todayYMD = getIndiaYMD(now);
  const currentDay = getIndiaDayOfWeek(now);
  const currentHHMM = getIndiaHHMM(now);

  if (offer.start_date && todayYMD < offer.start_date) {
    return false;
  }
  if (offer.end_date && todayYMD > offer.end_date) {
    return false;
  }
  if (Array.isArray(offer.active_days) && offer.active_days.length > 0) {
    const normalizedDays = offer.active_days.map((d: any) =>
      String(d).toLowerCase().trim().slice(0, 3)
    );
    if (!normalizedDays.includes(currentDay)) {
      return false;
    }
  }
  if (offer.active_time_start && currentHHMM < offer.active_time_start) {
    return false;
  }
  if (offer.active_time_end && currentHHMM > offer.active_time_end) {
    return false;
  }

  return true;
}

/**
 * Generates a stable ref_id for an offer.
 * Uses offer.id if present, otherwise combines name/title and start_date.
 */
export function getOfferRefId(offer: OfferData): string {
  if (offer.id && String(offer.id).trim()) {
    return String(offer.id).trim();
  }
  const title = String(offer.title || offer.name || "offer").trim().toLowerCase();
  const startDate = String(offer.start_date || "").trim();
  return `${title}_${startDate}`.replace(/[\s\W]+/g, "_").slice(0, 80);
}

/**
 * Interpolates variables into template string without ever outputting 'undefined' or 'null'.
 * Clamped to 1000 characters.
 */
export function renderTemplate(
  template: string,
  variables: {
    name?: string | null;
    business?: string | null;
    reward?: string | null;
    offer?: string | null;
  }
): string {
  const name = variables.name?.trim() || "Customer";
  const business = variables.business?.trim() || "TAPX Business";
  const reward = variables.reward?.trim() || "Loyalty Reward";
  const offer = variables.offer?.trim() || "Special Offer";

  const rendered = (template || "")
    .replace(/\{name\}/gi, name)
    .replace(/\{business\}/gi, business)
    .replace(/\{reward\}/gi, reward)
    .replace(/\{offer\}/gi, offer);

  return rendered.slice(0, 1000);
}

/**
 * Computes the pending and sent lists across Welcome, Rewards, and Offers,
 * as well as the 30-day sent history list.
 */
export function computeReminders(params: {
  members: LoyaltyMemberData[];
  rewards: LoyaltyRewardData[];
  offers: OfferData[];
  messageLogs: MessageLogRow[];
  now?: Date;
  normalizePhoneFn: (input: string | null | undefined) => string | null;
}) {
  const {
    members,
    rewards,
    offers,
    messageLogs,
    now = new Date(),
    normalizePhoneFn,
  } = params;

  // Build lookup map for log rows: key = `${membership_id}__${message_type}__${ref_id}`
  const logMap = new Map<string, MessageLogRow>();
  for (const log of messageLogs) {
    const key = `${log.membership_id}__${log.message_type}__${log.ref_id || ""}`;
    // Keep the most recent if duplicate exists
    const existing = logMap.get(key);
    if (!existing || new Date(log.sent_at).getTime() > new Date(existing.sent_at).getTime()) {
      logMap.set(key, log);
    }
  }

  // Members lookup by membership id
  const memberMap = new Map<string, LoyaltyMemberData>();
  for (const m of members) {
    if (m.id) {
      memberMap.set(m.id, m);
    }
  }

  // Helper to extract customer name and phone
  function extractMemberContact(m: LoyaltyMemberData | undefined) {
    const cust = Array.isArray(m?.customer) ? m?.customer[0] : m?.customer;
    const name = cust?.name || m?.customer_name || "Customer";
    const rawPhone = cust?.phone || m?.customer_phone || "";
    const phoneDigits = normalizePhoneFn(rawPhone);
    return { name, rawPhone, phoneDigits };
  }

  // -------------------------------------------------------------
  // 1. WELCOME REMINDERS
  // Members joined in last 7 days in India time
  // -------------------------------------------------------------
  const welcomeAll: WelcomeReminderItem[] = [];

  for (const m of members) {
    if (!m.id) continue;
    if (!isJoinedWithinLast7Days(m.created_at, now)) continue;

    const { name, rawPhone, phoneDigits } = extractMemberContact(m);
    const key = `${m.id}__welcome__`;
    const logRow = logMap.get(key) || null;
    const isSent = Boolean(logRow);

    welcomeAll.push({
      type: "welcome",
      membershipId: m.id,
      customerName: name,
      customerPhone: rawPhone,
      phoneDigits,
      joinedAt: m.created_at || "",
      refId: "",
      logRow,
      isSent,
      sentAt: logRow?.sent_at || null,
    });
  }

  // Sort newest first by joinedAt
  welcomeAll.sort((a, b) => {
    const tA = new Date(a.joinedAt).getTime() || 0;
    const tB = new Date(b.joinedAt).getTime() || 0;
    return tB - tA;
  });

  const welcomePending = welcomeAll.filter((item) => !item.isSent);
  const welcomeSent = welcomeAll.filter((item) => item.isSent);

  // -------------------------------------------------------------
  // 2. REWARD REMINDERS
  // Loyalty rewards with status 'pending' (ref_id = reward.id)
  // -------------------------------------------------------------
  const rewardAll: RewardReminderItem[] = [];

  for (const r of rewards) {
    if (!r.id || !r.membership_id) continue;
    // Rewards with status 'pending'
    if (String(r.status || "").toLowerCase() !== "pending") continue;

    const m = memberMap.get(r.membership_id);
    const cust = Array.isArray(r.customer) ? r.customer[0] : r.customer;
    const mCust = Array.isArray(m?.customer) ? m?.customer[0] : m?.customer;
    const name = cust?.name || mCust?.name || m?.customer_name || "Customer";
    const rawPhone = cust?.phone || mCust?.phone || m?.customer_phone || "";
    const phoneDigits = normalizePhoneFn(rawPhone);

    const refId = r.id;
    const key = `${r.membership_id}__reward__${refId}`;
    const logRow = logMap.get(key) || null;
    const isSent = Boolean(logRow);

    rewardAll.push({
      type: "reward",
      membershipId: r.membership_id,
      rewardId: r.id,
      customerName: name,
      customerPhone: rawPhone,
      phoneDigits,
      rewardDescription: r.reward_description || "Loyalty Reward",
      visitCountAtReward: r.visit_count_at_reward || 0,
      rewardCreatedAt: r.created_at || "",
      refId,
      logRow,
      isSent,
      sentAt: logRow?.sent_at || null,
    });
  }

  // Sort newest rewards first
  rewardAll.sort((a, b) => {
    const tA = new Date(a.rewardCreatedAt).getTime() || 0;
    const tB = new Date(b.rewardCreatedAt).getTime() || 0;
    return tB - tA;
  });

  const rewardPending = rewardAll.filter((item) => !item.isSent);
  const rewardSent = rewardAll.filter((item) => item.isSent);

  // -------------------------------------------------------------
  // 3. LIVE OFFERS REMINDERS
  // For each offer live now, members with valid phone
  // (ref_id = offer's id or stable key)
  // -------------------------------------------------------------
  const offerAll: OfferReminderItem[] = [];
  const liveOffers = offers.filter((o) => isOfferLiveNow(o, now));

  for (const offer of liveOffers) {
    const offerRefId = getOfferRefId(offer);
    const offerTitle = offer.title || offer.name || "Special Offer";
    const offerDesc = offer.description || offer.discount || "";

    for (const m of members) {
      if (!m.id) continue;
      const { name, rawPhone, phoneDigits } = extractMemberContact(m);

      const key = `${m.id}__offer__${offerRefId}`;
      const logRow = logMap.get(key) || null;
      const isSent = Boolean(logRow);

      offerAll.push({
        type: "offer",
        membershipId: m.id,
        offerId: offerRefId,
        offerTitle,
        offerDescription: offerDesc,
        customerName: name,
        customerPhone: rawPhone,
        phoneDigits,
        refId: offerRefId,
        logRow,
        isSent,
        sentAt: logRow?.sent_at || null,
      });
    }
  }

  const offerPending = offerAll.filter((item) => !item.isSent);
  const offerSent = offerAll.filter((item) => item.isSent);

  // -------------------------------------------------------------
  // 4. SENT HISTORY (Last 30 days)
  // -------------------------------------------------------------
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const cutoffTime = now.getTime() - thirtyDaysMs;

  const sentHistory: SentHistoryItem[] = [];
  for (const log of messageLogs) {
    const sentTime = new Date(log.sent_at).getTime();
    if (isNaN(sentTime) || sentTime < cutoffTime) continue;

    const m = memberMap.get(log.membership_id);
    const customerName = m ? (m.customer?.name || m.customer_name || "Customer") : "Member removed";
    const customerPhone = m ? (m.customer?.phone || m.customer_phone || "") : "";

    let detailLabel = "";
    if (log.message_type === "welcome") {
      detailLabel = "Welcome Message";
    } else if (log.message_type === "reward") {
      const matchedReward = rewards.find((r) => r.id === log.ref_id);
      detailLabel = matchedReward?.reward_description || "Loyalty Reward";
    } else if (log.message_type === "offer") {
      const matchedOffer = offers.find((o) => getOfferRefId(o) === log.ref_id);
      detailLabel = matchedOffer?.title || matchedOffer?.name || log.ref_id || "Offer";
    } else {
      detailLabel = "Special Message";
    }

    sentHistory.push({
      id: log.id || `${log.membership_id}_${log.message_type}_${log.ref_id}_${log.sent_at}`,
      membershipId: log.membership_id,
      customerName,
      customerPhone,
      messageType: log.message_type,
      refId: log.ref_id,
      sentAt: log.sent_at,
      detailLabel,
    });
  }

  sentHistory.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  // -------------------------------------------------------------
  // Total pending count
  // -------------------------------------------------------------
  const totalPendingCount = welcomePending.length + rewardPending.length + offerPending.length;

  return {
    welcomePending,
    welcomeSent,
    rewardPending,
    rewardSent,
    offerPending,
    offerSent,
    liveOffersCount: liveOffers.length,
    sentHistory,
    totalPendingCount,
  };
}
