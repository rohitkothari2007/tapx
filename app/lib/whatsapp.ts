export const DEFAULT_COUNTRY_CODE = "91";

/**
 * Normalizes a phone number for WhatsApp wa.me links.
 *
 * Rules:
 * - strip spaces, dashes, brackets, dots and a leading +;
 * - 10 digits starting 6-9 -> prefix with the default country code;
 * - 11 digits starting 0 -> drop the 0, then prefix;
 * - 12 digits starting with the default country code -> keep;
 * - 11-15 other digits -> keep (international);
 * - anything else (empty, letters, too short or too long) -> null.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  let cleaned = input.trim();
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // Strip spaces, dashes, brackets ()[]{}, dots
  cleaned = cleaned.replace(/[\s\-\(\)\[\]\{\}\.]/g, "");

  // If any non-digit character remains, it is invalid
  if (!/^\d+$/.test(cleaned)) {
    return null;
  }

  // 10 digits starting 6-9 -> prefix with default country code
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `${DEFAULT_COUNTRY_CODE}${cleaned}`;
  }

  // 11 digits starting 0 -> drop the 0, then prefix
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    const withoutZero = cleaned.slice(1);
    return `${DEFAULT_COUNTRY_CODE}${withoutZero}`;
  }

  // 12 digits starting with the default country code -> keep
  if (cleaned.length === 12 && cleaned.startsWith(DEFAULT_COUNTRY_CODE)) {
    return cleaned;
  }

  // 11-15 other digits -> keep (international)
  if (cleaned.length >= 11 && cleaned.length <= 15) {
    return cleaned;
  }

  // Anything else (too short, too long, 10-digit not starting with 6-9) -> null
  return null;
}

/**
 * Builds the official wa.me link with encoded text message.
 */
export function formatWhatsAppUrl(phoneDigits: string, text: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}
