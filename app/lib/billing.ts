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
