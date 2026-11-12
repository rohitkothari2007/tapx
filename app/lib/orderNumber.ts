/**
 * Shared helper for order number & order day display.
 * Generic and independent of business category.
 *
 * Rule: Displays "#<n>" when order_number exists, otherwise "#<first 6 uppercase id chars>".
 * Lists spanning multiple days append " · <D Mon>" when order_day is not today (IST).
 */

export type OrderNumberInput = {
  id?: string;
  order_number?: number | string | null;
  order_day?: string | null;
  created_at?: string | null;
} | null;

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Returns YYYY-MM-DD in Asia/Kolkata (IST) for comparing against order_day. */
export function getISTDateStr(dateInput: Date | string = new Date()): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Resolves an order's YYYY-MM-DD business day from order_day or created_at (IST). */
export function getOrderBusinessDay(order?: OrderNumberInput): string {
  if (!order) return "";
  if (order.order_day && /^\d{4}-\d{2}-\d{2}/.test(String(order.order_day))) {
    return String(order.order_day).slice(0, 10);
  }
  if (order.created_at) {
    return getISTDateStr(order.created_at);
  }
  return "";
}

export function isOrderFromToday(order?: OrderNumberInput): boolean {
  const day = getOrderBusinessDay(order);
  if (!day) return true;
  return day === getISTDateStr();
}

export function formatOrderDayShort(dayStr?: string | null): string {
  if (!dayStr) return "";
  const match = String(dayStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const day = parseInt(match[3], 10);
  const monthIdx = parseInt(match[2], 10) - 1;
  const month = MONTH_NAMES_SHORT[monthIdx] || "";
  if (!day || !month) return "";
  return `${day} ${month}`;
}

export function formatOrderNumber(order?: OrderNumberInput): string {
  if (!order) return "";
  if (
    order.order_number !== undefined &&
    order.order_number !== null &&
    String(order.order_number).trim() !== ""
  ) {
    const raw = String(order.order_number).trim();
    return raw.startsWith("#") ? raw : `#${raw}`;
  }
  if (order.id) {
    return `#${order.id.slice(0, 6).toUpperCase()}`;
  }
  return "";
}

export function formatOrderLabel(
  order?: OrderNumberInput,
  options?: { showDayIfNotToday?: boolean }
): string {
  const num = formatOrderNumber(order);
  if (!num) return "";
  if (options?.showDayIfNotToday && !isOrderFromToday(order)) {
    const dayShort = formatOrderDayShort(getOrderBusinessDay(order));
    if (dayShort) {
      return `${num} · ${dayShort}`;
    }
  }
  return num;
}

export function formatOrderNumberWithHash(order?: OrderNumberInput): string {
  return formatOrderNumber(order);
}

export function formatPaymentMethodLabel(method?: string | null): string {
  if (!method) return "";
  const m = String(method).trim().toLowerCase();
  if (m === "upi") return "UPI";
  if (m === "cash") return "Cash";
  if (m === "card") return "Card";
  return m.charAt(0).toUpperCase() + m.slice(1);
}
