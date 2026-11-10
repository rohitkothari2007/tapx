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
    return `Dining at Table ${tableNumber}`;
  }
  return "View menu & order from your table";
}

/**
 * Parse and validate a table number from a query parameter string (e.g. ?table=3).
 * Accepts ONLY a whole number from 1 to 999.
 * If tableCount is configured (> 0), accepts only 1 to tableCount.
 * Returns null for anything else.
 */
export function parseQueryTableNumber(
  rawTable?: string | null,
  tableCount?: number | null
): number | null {
  if (!rawTable) return null;
  const trimmed = rawTable.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = parseInt(trimmed, 10);
  if (isNaN(num) || num < 1 || num > 999) return null;
  if (typeof tableCount === "number" && tableCount > 0 && num > tableCount) return null;
  return num;
}

/**
 * Resolve table number for a device session in order:
 * (a) table number saved on the stand (parseStandTableNumber)
 * (b) query parameter ?table=N (from URL or session storage)
 * (c) null (unknown)
 */
export function resolveSessionTableNumber({
  standLabel,
  standLocation,
  queryTableParam,
  deviceCode,
  tableCount,
}: {
  standLabel?: string | null;
  standLocation?: string | null;
  queryTableParam?: string | null;
  deviceCode?: string | null;
  tableCount?: number | null;
}): number | null {
  // (a) Table number saved on the stand
  const standTable = parseStandTableNumber(standLabel, standLocation);
  if (standTable !== null && standTable > 0) {
    return standTable;
  }

  // (b) ?table=N parameter in the address, with session persistence
  const sessionKey = deviceCode ? `tapx_session_table_${deviceCode}` : "tapx_session_table";

  // Check URL parameter first
  const parsedFromQuery = parseQueryTableNumber(queryTableParam, tableCount);
  if (parsedFromQuery !== null) {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(sessionKey, String(parsedFromQuery));
      }
    } catch {
      // sessionStorage unavailable or restricted
    }
    return parsedFromQuery;
  }

  // Check session storage if not in query or invalid
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      const savedInSession = window.sessionStorage.getItem(sessionKey);
      const parsedFromSession = parseQueryTableNumber(savedInSession, tableCount);
      if (parsedFromSession !== null) {
        return parsedFromSession;
      }
    }
  } catch {
    // sessionStorage unavailable or restricted
  }

  // (c) Unknown
  return null;
}
