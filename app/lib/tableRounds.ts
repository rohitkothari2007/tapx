/**
 * Helpers for "rounds": several orders placed from the same table during one visit.
 * Pure functions, no database access.
 */

/** Two orders on the same table more than this many minutes apart belong to different visits. */
export const ROUND_VISIT_GAP_MINUTES = 150;
/** Orders older than this never count towards rounds. */
export const ROUND_MAX_AGE_HOURS = 18;
/** On the guest phone, earlier orders older than this are hidden. */
export const GUEST_ROUND_WINDOW_HOURS = 6;
/** Statuses that mean "the kitchen still has work to do". */
export const KITCHEN_STATUSES = ["pending", "accepted", "preparing", "ready"];

export type RoundOrderLike = {
  id: string;
  table_number: number | null;
  status: string;
  created_at: string;
  archived_at?: string | null;
  payment_status?: string | null;
  order_number?: number | null;
};

export type RoundInfo = {
  /** 1 for the first order of a visit, 2 for the next, and so on. */
  round: number;
  /** Id of the previous round on the same table and visit, or null for round 1. */
  prevOrderId: string | null;
};

type BillLinks = Record<string, unknown> | null | undefined;

function ts(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isTableNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isOpenTableOrder(o: RoundOrderLike, billLinks: BillLinks): boolean {
  if (!o || !o.id) return false;
  if (o.archived_at) return false;
  if (o.status === "cancelled") return false;
  if (!isTableNumber(o.table_number)) return false;
  if (billLinks && billLinks[o.id]) return false;
  if (o.payment_status === "paid") return false;
  return true;
}

function compareOrders(a: RoundOrderLike, b: RoundOrderLike): number {
  const d = ts(a.created_at) - ts(b.created_at);
  if (d !== 0) return d;
  const na = typeof a.order_number === "number" ? a.order_number : 0;
  const nb = typeof b.order_number === "number" ? b.order_number : 0;
  if (na !== nb) return na - nb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Works out the round number of every open table order.
 * Orders that are cancelled, archived, billed, paid, without a table, or older than
 * ROUND_MAX_AGE_HOURS are ignored (they are not in the result).
 * A new visit starts when two orders on the same table are more than
 * ROUND_VISIT_GAP_MINUTES apart.
 */
export function computeTableRounds<T extends RoundOrderLike>(
  orders: T[],
  billLinks: BillLinks,
  nowMs: number = Date.now()
): Map<string, RoundInfo> {
  const result = new Map<string, RoundInfo>();
  const maxAgeMs = ROUND_MAX_AGE_HOURS * 3600000;
  const gapMs = ROUND_VISIT_GAP_MINUTES * 60000;

  const byTable = new Map<number, T[]>();
  for (const o of orders || []) {
    if (!isOpenTableOrder(o, billLinks)) continue;
    if (nowMs - ts(o.created_at) > maxAgeMs) continue;
    const list = byTable.get(o.table_number as number) || [];
    list.push(o);
    byTable.set(o.table_number as number, list);
  }

  for (const list of byTable.values()) {
    const sorted = [...list].sort(compareOrders);
    let round = 0;
    let prev: T | null = null;
    for (const o of sorted) {
      if (prev && ts(o.created_at) - ts(prev.created_at) <= gapMs) {
        round += 1;
        result.set(o.id, { round, prevOrderId: prev.id });
      } else {
        round = 1;
        result.set(o.id, { round, prevOrderId: null });
      }
      prev = o;
    }
  }
  return result;
}

/**
 * For each table number, how many open (unbilled, unpaid, not cancelled, not archived)
 * orders are still with the kitchen (pending, accepted, preparing or ready).
 * Tables with zero are not in the map.
 */
export function countInKitchenByTable(
  orders: RoundOrderLike[],
  billLinks: BillLinks
): Map<number, number> {
  const out = new Map<number, number>();
  for (const o of orders || []) {
    if (!isOpenTableOrder(o, billLinks)) continue;
    if (!KITCHEN_STATUSES.includes(o.status)) continue;
    const t = o.table_number as number;
    out.set(t, (out.get(t) || 0) + 1);
  }
  return out;
}

/** true when an order is recent enough to show in the guest's "earlier orders" list. */
export function isGuestRoundFresh(createdAt: string, nowMs: number = Date.now()): boolean {
  const t = ts(createdAt);
  if (!t) return false;
  return nowMs - t <= GUEST_ROUND_WINDOW_HOURS * 3600000;
}

/** Sum of order totals, rounded to 2 decimals. Ignores non-numbers. */
export function sumOrderTotals(totals: Array<number | null | undefined>): number {
  const raw = (totals || []).reduce<number>((s, v) => s + (Number(v) || 0), 0);
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11 -> "11th", 21 -> "21st". Invalid -> "". */
export function ordinalLabel(n: number): string {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return "";
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  switch (v % 10) {
    case 1:
      return `${v}st`;
    case 2:
      return `${v}nd`;
    case 3:
      return `${v}rd`;
    default:
      return `${v}th`;
  }
}

/** Text of the add-on badge on kitchen cards. The first order of a visit has no badge (""). */
export function addOnBadgeText(round: number): string {
  if (!(round >= 2)) return "";
  return `ADD-ON · ${ordinalLabel(round)} order`;
}

/** First `max` item names joined by commas, then "+N more". Empty names are ignored. */
export function summarizeItemNames(
  names: Array<string | null | undefined>,
  max: number = 2
): string {
  const clean = (names || []).map((n) => (n || "").trim()).filter(Boolean);
  if (clean.length === 0) return "";
  const shown = clean.slice(0, max);
  const rest = clean.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest} more` : shown.join(", ");
}
