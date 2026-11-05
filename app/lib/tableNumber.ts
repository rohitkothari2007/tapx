/**
 * Utility helpers for table numbers on stands/devices.
 * Generic and independent of business category.
 */

export function parseStandTableNumber(
  label?: string | null,
  location?: string | null
): number | null {
  // Check location first, then fallback to label
  const candidates = [location, label].filter(
    (val): val is string => typeof val === "string" && val.trim().length > 0
  );

  for (const text of candidates) {
    const trimmed = text.trim();
    // 1. Explicit "Table 5" or "Table #5" or "T5" or "T-5"
    const tableMatch = trimmed.match(/(?:table|t)[-.\s#]*(\d+)/i);
    if (tableMatch && tableMatch[1]) {
      const num = parseInt(tableMatch[1], 10);
      if (!isNaN(num) && num > 0 && num <= 999) return num;
    }

    // 2. Pure digits "5"
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num > 0 && num <= 999) return num;
    }
  }

  return null;
}

export function formatStandTableLabel(tableNumber: number | null): string {
  if (tableNumber !== null && tableNumber > 0) {
    return `Table ${tableNumber}`;
  }
  return "";
}

export function getDiningCardSubtitle(
  tableOrderingEnabled: boolean,
  tableNumber: number | null
): string {
  if (!tableOrderingEnabled) {
    return "Browse our menu";
  }
  if (tableNumber !== null && tableNumber > 0) {
    return `Order from Table ${tableNumber}`;
  }
  return "Order from your table";
}
