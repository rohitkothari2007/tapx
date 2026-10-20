/**
 * TAPX Online Ordering Module Helper & Validator
 *
 * Strict validation and sanitization for "Order online" links.
 * Used uniformly across Admin (Add & Manage), Client Portal (Settings),
 * and the Customer Tap Page.
 */

export type OnlineOrderingLink = {
  label: string;
  url: string;
};

export type OnlineOrderingConfig = {
  links: OnlineOrderingLink[];
};

export const MAX_ONLINE_ORDERING_LINKS = 5;
export const MAX_LABEL_LENGTH = 40;
export const MAX_URL_LENGTH = 500;

export const QUICK_FILL_SUGGESTIONS = [
  "Zomato",
  "Swiggy",
  "Website",
  "WhatsApp",
] as const;

/**
 * Validates a single URL string strictly:
 * - Must be trimmed
 * - Must not exceed 500 characters
 * - Must parse as a valid URL
 * - Must strictly use the https: protocol
 * - Rejects http:, javascript:, data:, vbscript:, file:, etc.
 */
export function isValidHttpsUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return false;

  // Must explicitly start with https:// (case-insensitive)
  if (!/^https:\/\//i.test(trimmed)) return false;

  // Reject malicious schemes if somehow embedded
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("javascript:") ||
    lower.includes("data:") ||
    lower.includes("vbscript:")
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Validates a single OnlineOrderingLink:
 * - Label: non-empty, trimmed, <= 40 chars
 * - URL: valid https:// URL, <= 500 chars
 */
export function validateOnlineOrderingLink(link: unknown): {
  valid: boolean;
  error?: string;
  cleanLink?: OnlineOrderingLink;
} {
  if (!link || typeof link !== "object") {
    return { valid: false, error: "Link must be an object." };
  }

  const { label, url } = link as Record<string, unknown>;

  const cleanLabel = typeof label === "string" ? label.trim() : "";
  const cleanUrl = typeof url === "string" ? url.trim() : "";

  if (!cleanLabel) {
    return { valid: false, error: "Label is required." };
  }

  if (cleanLabel.length > MAX_LABEL_LENGTH) {
    return {
      valid: false,
      error: `Label must be ${MAX_LABEL_LENGTH} characters or less (currently ${cleanLabel.length}).`,
    };
  }

  if (!cleanUrl) {
    return { valid: false, error: "URL is required." };
  }

  if (cleanUrl.length > MAX_URL_LENGTH) {
    return {
      valid: false,
      error: `URL must be ${MAX_URL_LENGTH} characters or less.`,
    };
  }

  if (!isValidHttpsUrl(cleanUrl)) {
    return {
      valid: false,
      error: "URL must be a valid link starting with https://",
    };
  }

  return {
    valid: true,
    cleanLink: {
      label: cleanLabel,
      url: cleanUrl,
    },
  };
}

/**
 * Validates an entire online ordering config (used on save).
 * Returns validity, list of error messages, and sanitized links.
 */
export function validateOnlineOrderingConfig(config: unknown): {
  valid: boolean;
  errors: string[];
  cleanLinks: OnlineOrderingLink[];
} {
  const errors: string[] = [];
  const cleanLinks: OnlineOrderingLink[] = [];

  let rawLinks: unknown[] = [];
  if (Array.isArray(config)) {
    rawLinks = config;
  } else if (config && typeof config === "object" && "links" in config) {
    const objLinks = (config as Record<string, unknown>).links;
    if (Array.isArray(objLinks)) {
      rawLinks = objLinks;
    }
  }

  if (rawLinks.length > MAX_ONLINE_ORDERING_LINKS) {
    errors.push(`Maximum ${MAX_ONLINE_ORDERING_LINKS} ordering links allowed.`);
  }

  const slice = rawLinks.slice(0, MAX_ONLINE_ORDERING_LINKS);
  slice.forEach((item, idx) => {
    const res = validateOnlineOrderingLink(item);
    if (!res.valid) {
      errors.push(`Link #${idx + 1}: ${res.error}`);
    } else if (res.cleanLink) {
      cleanLinks.push(res.cleanLink);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    cleanLinks,
  };
}

/**
 * Sanitizes online ordering links for render time (e.g. tap page).
 * Silently ignores any invalid or malformed links so the tap page never crashes.
 * Enforces maximum of 5 valid links.
 */
export function sanitizeOnlineOrderingLinks(rawConfig: unknown): OnlineOrderingLink[] {
  if (!rawConfig) return [];

  let rawLinks: unknown[] = [];
  if (Array.isArray(rawConfig)) {
    rawLinks = rawConfig;
  } else if (typeof rawConfig === "object" && rawConfig !== null && "links" in rawConfig) {
    const obj = rawConfig as Record<string, unknown>;
    if (Array.isArray(obj.links)) {
      rawLinks = obj.links;
    }
  }

  const result: OnlineOrderingLink[] = [];
  for (const item of rawLinks) {
    if (result.length >= MAX_ONLINE_ORDERING_LINKS) break;
    const res = validateOnlineOrderingLink(item);
    if (res.valid && res.cleanLink) {
      result.push(res.cleanLink);
    }
  }

  return result;
}
