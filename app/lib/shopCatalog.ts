import { formatMoney } from "./billing";

export type CatalogUnit =
  | "piece"
  | "pair"
  | "kg"
  | "g"
  | "litre"
  | "dozen"
  | "packet";

export const CATALOG_UNITS: Array<{ value: CatalogUnit; label: string }> = [
  { value: "piece", label: "Piece" },
  { value: "pair", label: "Pair" },
  { value: "kg", label: "Kilogram" },
  { value: "g", label: "Gram" },
  { value: "litre", label: "Litre" },
  { value: "dozen", label: "Dozen" },
  { value: "packet", label: "Packet" },
];

export interface CatalogSizeSet {
  id: string;
  business_id: string;
  name: string; // 1-60 chars
  sizes: string[]; // text[] (1-30 entries, each 1-12 chars, no duplicates ignoring case)
  created_at?: string;
  updated_at?: string;
}

export interface CatalogCategory {
  id: string;
  business_id: string;
  name: string; // 1-60 chars
  sort_order: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CatalogItem {
  id: string;
  business_id: string;
  category_id: string;
  name: string; // 1-120 chars
  default_price: number | null; // numeric(12,2) NULLABLE (null = price not set yet)
  mrp: number | null; // numeric NULLABLE
  cost_price: number | null; // numeric NULLABLE
  unit: CatalogUnit;
  size_set_id: string | null; // uuid NULLABLE (null = no sizes)
  track_stock: boolean; // leave false; stock comes later
  image_url: string | null; // text NULLABLE
  sort_order: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CatalogTemplate {
  key: string;
  name: string;
  description: string;
  data?: any;
}

export interface ApplyTemplateResult {
  size_sets?: number;
  categories?: number;
  items?: number;
}

export function friendlyCatalogError(err: any): string {
  if (!err) return "An unexpected error occurred. Please try again.";
  const code = typeof err === "object" && err !== null ? String(err.code || "") : "";
  const msg = typeof err === "object" && err !== null ? String(err.message || "") : String(err);

  if (msg.toLowerCase().startsWith("limit reached")) {
    return msg;
  }
  if (code === "23505" || msg.includes("23505")) {
    return "That name already exists here.";
  }
  if (code === "23503" || msg.includes("23503")) {
    return "This is still used, so it cannot be removed. Hide it instead.";
  }
  if (code === "23514" || msg.includes("23514")) {
    return "Please check the values you entered.";
  }
  if (
    msg &&
    !msg.toLowerCase().includes("failed") &&
    !msg.toLowerCase().includes("syntax") &&
    !msg.toLowerCase().includes("stack")
  ) {
    return msg;
  }
  return "An unexpected error occurred. Please try again.";
}

export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined || price === "") return "";
  return formatMoney(price);
}

export function composeCatalogLineName(
  categoryName: string,
  typeName: string,
  size?: string | null
): string {
  const cat = (categoryName || "").trim();
  const typ = (typeName || "").trim();
  const sz = (size || "").trim();

  let base = "";
  if (cat && typ) {
    base = `${cat} - ${typ}`;
  } else {
    base = typ || cat;
  }

  if (!sz) {
    return base.slice(0, 120);
  }

  const suffix = ` (${sz})`;
  if (base.length + suffix.length <= 120) {
    return `${base}${suffix}`;
  }

  const maxBaseLen = Math.max(0, 120 - suffix.length);
  const truncatedBase = base.slice(0, maxBaseLen).trimEnd();
  return `${truncatedBase}${suffix}`;
}
