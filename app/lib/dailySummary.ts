import { formatMoney } from "./billing";
import { formatOrderDayShort } from "./orderNumber";

export type DailySummaryInput = {
  businessName?: string | null;
  rangeLabel: string;
  bills: number;
  revenue: number;
  avgBill: number;
  unpaidCount: number;
  unpaidTotal: number;
  cash: number;
  upi: number;
  card: number;
  topItems: { name: string; quantity: number }[];
  returns?: { notes_count: number; notes_total: number } | null;
  /** All unpaid bills ever (not only this range). */
  outstanding?: { count: number; total: number; capped: boolean } | null;
};

export function formatRangeLabel(from: string, to: string, todayStr: string): string {
  const f = formatOrderDayShort(from);
  const t = formatOrderDayShort(to);
  if (from === to) return from === todayStr ? `Today, ${f}` : f;
  return `${f} – ${t}`;
}

function qty(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return String(v);
}

export function buildDailySummaryMessage(i: DailySummaryInput): string {
  const biz = (i.businessName || "").trim();
  const lines: string[] = [];
  lines.push(`📊 *${biz || "Sales summary"}* – ${i.rangeLabel}`);

  if (!(i.bills > 0)) {
    lines.push("No bills in this period.");
  } else {
    lines.push(`💰 Collected: ${formatMoney(i.revenue)}`);
    lines.push(`🧾 Bills: ${i.bills} · Average ${formatMoney(i.avgBill)}`);
    const pay: string[] = [];
    if (i.cash > 0) pay.push(`Cash ${formatMoney(i.cash)}`);
    if (i.upi > 0) pay.push(`UPI ${formatMoney(i.upi)}`);
    if (i.card > 0) pay.push(`Card ${formatMoney(i.card)}`);
    if (pay.length) lines.push(`💳 ${pay.join(" · ")}`);
    if (i.unpaidTotal > 0) {
      lines.push(
        `⏳ Unpaid in this period: ${formatMoney(i.unpaidTotal)} (${i.unpaidCount} ${
          i.unpaidCount === 1 ? "bill" : "bills"
        })`
      );
    }
    if (i.returns && i.returns.notes_count > 0) {
      lines.push(
        `🔁 Returns: ${i.returns.notes_count} credit ${
          i.returns.notes_count === 1 ? "note" : "notes"
        } · ${formatMoney(i.returns.notes_total)}`
      );
    }
    const top = (i.topItems || []).filter((t) => t && t.name).slice(0, 3);
    if (top.length) {
      lines.push(`⭐ Top sellers: ${top.map((t) => `${t.name} (${qty(t.quantity)})`).join(", ")}`);
    }
  }

  if (i.outstanding && i.outstanding.total > 0) {
    const n = i.outstanding.count;
    lines.push(
      `📌 All pending dues: ${formatMoney(i.outstanding.total)} (${n}${
        i.outstanding.capped ? "+" : ""
      } ${n === 1 && !i.outstanding.capped ? "bill" : "bills"})`
    );
  }
  lines.push("— Sent from TAPX");
  return lines.join("\n");
}
