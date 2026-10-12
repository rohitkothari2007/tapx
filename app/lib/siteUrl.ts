export const PRODUCTION_SITE_URL = "https://tapx-roan.vercel.app";

/**
 * Returns the public-facing URL of the application.
 * If running on localhost or in an environment without a public domain,
 * it returns the production URL (https://tapx-roan.vercel.app)
 * so that links copied, shared, or sent to clients (WhatsApp, email, QR codes)
 * will ALWAYS work on the client's own phone or computer!
 */
export function getPublicSiteUrl(customOrigin?: string | null): string {
  // 1. If customOrigin was provided and is not localhost
  if (customOrigin && !customOrigin.includes("localhost") && !customOrigin.includes("127.0.0.1")) {
    try {
      const parsed = new URL(customOrigin);
      return parsed.origin;
    } catch {}
  }

  // 2. Check browser window origin
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return origin;
    }
  }

  // 3. Check NEXT_PUBLIC_SITE_URL env variable
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL.trim();
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl.replace(/\/+$/, "");
    }
  }

  // 4. Default to live production URL
  return PRODUCTION_SITE_URL;
}
