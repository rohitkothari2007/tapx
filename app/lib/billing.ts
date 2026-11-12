import {
  formatOrderDayShort,
  formatPaymentMethodLabel,
  getISTDateStr,
} from "./orderNumber";

export type BillingPaperSize = "80mm" | "58mm" | "a4";
export type PaymentMethod = "cash" | "upi" | "card";
export type BillStatus = "issued" | "void";
export type BillPaymentStatus = "unpaid" | "paid";

export type BillingSettings = {
  prefix: string;
  paper: BillingPaperSize;
  footer: string;
  service_charge_pct: number | null;
  round_off: boolean;
  show_upi_qr: boolean;
  show_logo: boolean;
};

export type BillingBusinessProfile = {
  id?: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  upi_id?: string | null;
};

export type TapxBill = {
  id: string;
  business_id: string;
  financial_year: string;
  bill_number: number;
  bill_no_text: string;
  bill_day: string;
  status: BillStatus;
  source: "order" | "manual";
  customer_name: string | null;
  customer_phone: string | null;
  table_number: number | null;
  subtotal: number;
  discount_amount: number;
  discount_note: string | null;
  service_charge_pct: number;
  service_charge: number;
  tax_mode: string | null;
  tax_total: number;
  round_off: number;
  total: number;
  payment_status: BillPaymentStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  void_reason: string | null;
  voided_at: string | null;
  notes: string | null;
  share_token: string;
  created_at: string;
};

export type TapxBillItem = {
  id?: string;
  bill_id?: string;
  line_no?: number;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type TapxBillSummary = {
  from: string;
  to: string;
  billed_count: number;
  billed_total: number;
  paid_count: number;
  paid_total: number;
  unpaid_count: number;
  unpaid_total: number;
  void_count: number;
  void_total: number;
  cash_total: number;
  upi_total: number;
  card_total: number;
  discount_total: number;
};

export type PublicBillPayload = {
  bill_no_text: string;
  status: BillStatus;
  created_at: string;
  bill_day: string;
  table_number: number | null;
  customer_name: string | null;
  subtotal: number;
  discount_amount: number;
  discount_note: string | null;
  service_charge_pct: number;
  service_charge: number;
  tax_mode: string | null;
  tax_total: number;
  round_off: number;
  total: number;
  payment_status: BillPaymentStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  items: Array<{
    item_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }>;
  business: BillingBusinessProfile;
  settings: {
    paper?: BillingPaperSize;
    footer?: string | null;
    show_upi_qr?: boolean;
    show_logo?: boolean;
  };
};

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  prefix: "",
  paper: "80mm",
  footer: "",
  service_charge_pct: null,
  round_off: false,
  show_upi_qr: true,
  show_logo: true,
};

export function parseBillingSettings(
  raw?: Record<string, any> | null
): BillingSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_BILLING_SETTINGS };
  }
  const paperRaw = String(raw.paper || "").trim().toLowerCase();
  const paper: BillingPaperSize =
    paperRaw === "58mm" || paperRaw === "a4" ? paperRaw : "80mm";
  const prefix =
    typeof raw.prefix === "string"
      ? raw.prefix
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 8)
      : "";
  const footer =
    typeof raw.footer === "string" ? raw.footer.slice(0, 200) : "";
  const scRaw = raw.service_charge_pct;
  const service_charge_pct =
    typeof scRaw === "number" && Number.isFinite(scRaw) && scRaw >= 0 && scRaw <= 30
      ? scRaw
      : null;

  return {
    prefix,
    paper,
    footer,
    service_charge_pct,
    round_off: Boolean(raw.round_off),
    show_upi_qr: raw.show_upi_qr !== false,
    show_logo: raw.show_logo !== false,
  };
}

/**
 * Shared INR money formatter across all billing views (Intl en-IN).
 * Shows 2 decimals unless the amount is a whole number.
 */
const CURRENCY_WHOLE_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const CURRENCY_DECIMALS_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return CURRENCY_WHOLE_FORMATTER.format(0);
  const abs = Math.abs(num);
  const isWhole = Math.abs(abs - Math.round(abs)) < 0.0001;
  return isWhole
    ? CURRENCY_WHOLE_FORMATTER.format(Math.round(num))
    : CURRENCY_DECIMALS_FORMATTER.format(num);
}

export function formatSignedMoney(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num === 0) return formatMoney(0);
  return num > 0 ? `+${formatMoney(num)}` : `-${formatMoney(Math.abs(num))}`;
}

export function formatQuantity(qty: number | string | null | undefined): string {
  const num = Number(qty ?? 0);
  if (!Number.isFinite(num)) return "0";
  return Number(num.toFixed(3)).toString();
}

export function formatBillDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatBillTimeShort(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatBillDayLabel(billDay?: string | null): string {
  return formatOrderDayShort(billDay);
}

export function formatBillPaymentLabel(
  status?: string | null,
  method?: string | null,
  paidAt?: string | null
): string {
  if (status === "paid") {
    const methodLabel = formatPaymentMethodLabel(method);
    const base = methodLabel ? `PAID · ${methodLabel}` : "PAID";
    const datePart = paidAt ? formatBillDateTime(paidAt) : "";
    return datePart ? `${base} · ${datePart}` : base;
  }
  return "UNPAID";
}

/** Returns current Indian Financial Year in IST, e.g. "26-27". */
export function getCurrentIndianFY(dateInput: Date = new Date()): string {
  const ist = getISTDateStr(dateInput);
  const match = ist.match(/^(\d{4})-(\d{2})-/);
  if (!match) return "26-27";
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  const yy1 = String(startYear).slice(-2);
  const yy2 = String(endYear).slice(-2);
  return `${yy1}-${yy2}`;
}

/** Shifts an IST YYYY-MM-DD date string by deltaDays without local-timezone drift. */
export function shiftISTDate(yyyyMmDd: string, deltaDays: number): string {
  const m = yyyyMmDd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return getISTDateStr();
  const utc = new Date(
    Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))
  );
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return utc.toISOString().slice(0, 10);
}

export function daysBetweenIST(from: string, to: string): number {
  const fMatch = from.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tMatch = to.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!fMatch || !tMatch) return 0;
  const fMs = Date.UTC(
    parseInt(fMatch[1], 10),
    parseInt(fMatch[2], 10) - 1,
    parseInt(fMatch[3], 10)
  );
  const tMs = Date.UTC(
    parseInt(tMatch[1], 10),
    parseInt(tMatch[2], 10) - 1,
    parseInt(tMatch[3], 10)
  );
  return Math.round((tMs - fMs) / 86400000);
}

export function hasAtMostDecimals(value: number, maxDecimals: number): boolean {
  if (!Number.isFinite(value)) return false;
  const factor = Math.pow(10, maxDecimals);
  return Math.abs(Math.round(value * factor) - value * factor) < 1e-6;
}

export function buildUpiPayUri(params: {
  upiId: string;
  businessName: string;
  total: number;
  billNoText: string;
}): string {
  const pa = encodeURIComponent(params.upiId.trim());
  const pn = encodeURIComponent((params.businessName || "Business").trim());
  const am = Number(params.total || 0).toFixed(2);
  const tn = encodeURIComponent(params.billNoText || "");
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
}

/**
 * Platform default country calling code (used when normalizing 10-digit local numbers
 * for WhatsApp links, matching the platform's Asia/Kolkata default).
 */
export const DEFAULT_COUNTRY_CODE = "91";

export type SavedMenuItem = {
  id: string;
  name: string;
  price: number;
};

export type LiveOrderBillLink = {
  billId: string;
  billNoText: string;
};

export type LiveOrderBillLinkMap = Record<string, LiveOrderBillLink>;

export type BillableOrderLike = {
  id: string;
  business_id?: string;
  table_number: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal?: number | null;
  total: number | null;
  status: string;
  created_at: string;
  order_number?: number | null;
  order_day?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  archived_at?: string | null;
  notes?: string | null;
};

export type BillableOrderItemLike = {
  id: string;
  order_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  special_request?: string | null;
};

export type UnbilledTableGroup<T extends BillableOrderLike = BillableOrderLike> = {
  tableNumber: number | null;
  orders: T[];
  orderCount: number;
  itemsCount: number;
  unbilledTotal: number;
  oldestCreatedAt: string;
};

export function parseSavedItemsFromConfig(
  config: Record<string, any> | null | undefined
): SavedMenuItem[] {
  const rawItems = Array.isArray(config?.items) ? config.items : [];
  const parsed: SavedMenuItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.available === false) continue;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) continue;
    const priceRaw = String(raw.price ?? "").replace(/[^0-9.]/g, "");
    const priceNum = priceRaw === "" ? 0 : Number(priceRaw);
    const unitPrice =
      Number.isFinite(priceNum) && priceNum >= 0
        ? Math.round(priceNum * 100) / 100
        : 0;
    parsed.push({
      id: typeof raw.id === "string" ? raw.id : name,
      name: name.slice(0, 120),
      price: unitPrice,
    });
  }
  return parsed;
}

/**
 * Returns true for placeholder customer names auto-generated by table ordering,
 * such as "Table 4" or "table 12" (case-insensitive, optional spaces).
 */
export function isAutoTableName(name?: string | null): boolean {
  if (!name) return false;
  return /^table\s*\d+$/i.test(name.trim());
}

/**
 * Normalizes a customer phone number for wa.me links without guessing beyond rules:
 * strip non-digits; 10 digits -> prefix DEFAULT_COUNTRY_CODE;
 * 11..15 digits not starting with 0 -> use as is; otherwise null.
 */
export function normalizeWhatsAppPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith("0")) {
    return digits;
  }
  return null;
}

export function buildCustomerBillMessage(params: {
  customerName?: string | null;
  businessName: string;
  billNoText: string;
  total: number;
  publicUrl: string;
}): string {
  const cleanName = (params.customerName || "").trim();
  const realName = cleanName && !isAutoTableName(cleanName) ? cleanName : "";
  const greeting = realName ? `Hello ${realName},` : "Hello,";
  const biz = (params.businessName || "").trim();
  const thanksLine = biz
    ? `Thank you for visiting ${biz}!`
    : "Thank you for visiting!";

  return [
    greeting,
    thanksLine,
    `Your bill ${params.billNoText}: ${formatMoney(params.total)}`,
    `View your bill: ${params.publicUrl}`,
  ].join("\n");
}

export function formatRelativeAgeShort(iso?: string | null): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const elapsedSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (elapsedSec < 45) return "Just now";
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHours = Math.floor(elapsedMin / 60);
  const remMin = elapsedMin % 60;
  if (elapsedHours < 24) {
    return remMin > 0 ? `${elapsedHours}h ${remMin}m ago` : `${elapsedHours}h ago`;
  }
  return `${Math.floor(elapsedHours / 24)}d ago`;
}

export function isOrderBillable(
  order: Pick<BillableOrderLike, "id" | "status" | "archived_at">,
  liveBillLinks: LiveOrderBillLinkMap
): boolean {
  if (!order?.id) return false;
  if (order.archived_at) return false;
  if (order.status === "cancelled") return false;
  if (liveBillLinks && liveBillLinks[order.id]) return false;
  return true;
}

export function groupBillableOrdersByTable<T extends BillableOrderLike>(
  orders: T[],
  orderItems: BillableOrderItemLike[],
  liveBillLinks: LiveOrderBillLinkMap,
  options?: { statuses?: string[] }
): UnbilledTableGroup<T>[] {
  const allowedStatuses = options?.statuses
    ? new Set(options.statuses.map((s) => s.toLowerCase()))
    : null;

  const itemsQtyByOrder = new Map<string, number>();
  for (const item of orderItems || []) {
    if (!item?.order_id) continue;
    const q = Number(item.quantity);
    const add = Number.isFinite(q) && q > 0 ? q : 1;
    itemsQtyByOrder.set(item.order_id, (itemsQtyByOrder.get(item.order_id) || 0) + add);
  }

  const buckets = new Map<string, { tableNumber: number | null; orders: T[] }>();
  for (const order of orders || []) {
    if (!isOrderBillable(order, liveBillLinks)) continue;
    if (allowedStatuses && !allowedStatuses.has(String(order.status || "").toLowerCase())) {
      continue;
    }
    const tbl =
      typeof order.table_number === "number" && Number.isFinite(order.table_number)
        ? order.table_number
        : null;
    const key = tbl !== null ? `t:${tbl}` : "none";
    const bucket = buckets.get(key) || { tableNumber: tbl, orders: [] };
    bucket.orders.push(order);
    buckets.set(key, bucket);
  }

  const groups: UnbilledTableGroup<T>[] = [];
  for (const bucket of buckets.values()) {
    const sortedOrders = [...bucket.orders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    let total = 0;
    let itemsCount = 0;
    for (const ord of sortedOrders) {
      total += Number(ord.total ?? ord.subtotal ?? 0);
      itemsCount += itemsQtyByOrder.get(ord.id) || 0;
    }
    groups.push({
      tableNumber: bucket.tableNumber,
      orders: sortedOrders,
      orderCount: sortedOrders.length,
      itemsCount: Math.round(itemsCount * 1000) / 1000,
      unbilledTotal: Math.round(total * 100) / 100,
      oldestCreatedAt: sortedOrders[0]?.created_at || "",
    });
  }

  groups.sort((a, b) => {
    if (a.tableNumber !== null && b.tableNumber !== null) {
      return a.tableNumber - b.tableNumber;
    }
    if (a.tableNumber !== null) return -1;
    if (b.tableNumber !== null) return 1;
    return 0;
  });

  return groups;
}

export function buildWhatsAppShareUrl(params: {
  businessName: string;
  billNoText: string;
  total: number;
  publicUrl: string;
}): string {
  const lines = [
    `${params.businessName} - Bill ${params.billNoText}`,
    `Total: ${formatMoney(params.total)}`,
    `View bill: ${params.publicUrl}`,
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}
