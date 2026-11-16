import { formatMoney, isAutoTableName, normalizeWhatsAppPhone } from "./billing";
import { formatOrderDayShort } from "./orderNumber";

/** Columns needed from tapx_bills for the unpaid list. */
export const UNPAID_BILL_COLUMNS =
  "id, bill_no_text, bill_day, created_at, customer_name, customer_phone, table_number, total, share_token";

export type UnpaidBillRow = {
  id: string;
  bill_no_text: string;
  bill_day: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  table_number: number | null;
  total: number;
  share_token: string | null;
};

export type UnpaidGroup = {
  key: string;
  name: string;
  /** The customer's real name, or null when we only have a phone / table / nothing. Use this in messages. */
  contactName: string | null;
  phone: string | null;
  waPhone: string | null;
  /** true when the customer can be recognised (phone or real name). */
  identified: boolean;
  bills: UnpaidBillRow[]; // oldest first
  total: number;
  oldestCreatedAt: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function realName(name?: string | null): string {
  const clean = (name || "").trim();
  return clean && !isAutoTableName(clean) ? clean : "";
}

function ts(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Groups unpaid bills by customer.
 * Same valid phone => same customer. Else same real name (case-insensitive).
 * Bills with neither stay separate (never merge unknown customers).
 * Bills with nothing due (total <= 0) are ignored.
 * Groups are sorted with the longest-overdue customer first.
 */
export function groupUnpaidBills(rows: UnpaidBillRow[]): UnpaidGroup[] {
  const buckets = new Map<string, UnpaidBillRow[]>();
  for (const r of rows || []) {
    if (!r || !(Number(r.total) > 0)) continue;
    const wa = normalizeWhatsAppPhone(r.customer_phone);
    const nm = realName(r.customer_name);
    const key = wa ? `p:${wa}` : nm ? `n:${nm.toLowerCase()}` : `b:${r.id}`;
    const list = buckets.get(key) || [];
    list.push(r);
    buckets.set(key, list);
  }

  const groups: UnpaidGroup[] = [];
  for (const [key, list] of buckets.entries()) {
    const oldestFirst = [...list].sort((a, b) => ts(a.created_at) - ts(b.created_at));
    const newestFirst = [...oldestFirst].reverse();
    const nameFromBills = newestFirst.map((b) => realName(b.customer_name)).find(Boolean) || "";
    const phone = newestFirst.map((b) => (b.customer_phone || "").trim()).find(Boolean) || null;
    const waPhone = normalizeWhatsAppPhone(phone);
    const tbl = newestFirst.find((b) => typeof b.table_number === "number")?.table_number;
    const fallbackName = typeof tbl === "number" ? `Table ${tbl}` : "Walk-in customer";
    groups.push({
      key,
      name: nameFromBills || fallbackName,
      contactName: nameFromBills || null,
      phone,
      waPhone,
      identified: Boolean(waPhone || nameFromBills),
      bills: oldestFirst,
      total: round2(oldestFirst.reduce((s, b) => s + (Number(b.total) || 0), 0)),
      oldestCreatedAt: oldestFirst[0]?.created_at || "",
    });
  }
  groups.sort((a, b) => ts(a.oldestCreatedAt) - ts(b.oldestCreatedAt));
  return groups;
}

export function daysSince(iso: string, nowMs: number = Date.now()): number {
  const t = ts(iso);
  if (!t) return 0;
  return Math.max(0, Math.floor((nowMs - t) / 86400000));
}

export function formatDueAge(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function buildDuesReminderMessage(params: {
  customerName?: string | null;
  businessName?: string | null;
  bills: Pick<UnpaidBillRow, "bill_no_text" | "bill_day" | "total" | "share_token">[];
  origin?: string | null;
  upiId?: string | null;
}): string {
  const name = realName(params.customerName);
  const biz = (params.businessName || "").trim();
  const bills = params.bills || [];
  const total = round2(bills.reduce((s, b) => s + (Number(b.total) || 0), 0));
  const origin = (params.origin || "").replace(/\/+$/, "");
  const upi = (params.upiId || "").trim();

  const lines: string[] = [];
  lines.push(name ? `Hello ${name},` : "Hello,");
  lines.push(
    biz ? `This is a friendly reminder from ${biz}.` : "This is a friendly reminder."
  );
  lines.push(`You have ${formatMoney(total)} pending:`);
  const shown = bills.slice(0, 3);
  for (const b of shown) {
    const day = formatOrderDayShort(b.bill_day);
    lines.push(`• ${b.bill_no_text}${day ? ` (${day})` : ""}: ${formatMoney(b.total)}`);
    if (origin && b.share_token) lines.push(`${origin}/bill/${b.share_token}`);
  }
  if (bills.length > shown.length) {
    const more = bills.length - shown.length;
    lines.push(`+ ${more} more ${more === 1 ? "bill" : "bills"}`);
  }
  if (upi) lines.push(`You can pay by UPI: ${upi}`);
  lines.push("Thank you!");
  return lines.join("\n");
}
