/**
 * Shared helper for order number display.
 * Generic and independent of business category.
 *
 * Rule: Displays order_number if present, otherwise the first 6 characters
 * of the order id in uppercase.
 */

export function formatOrderNumber(order?: {
  id?: string;
  order_number?: number | string | null;
} | null): string {
  if (!order) return "";
  if (
    order.order_number !== undefined &&
    order.order_number !== null &&
    String(order.order_number).trim() !== ""
  ) {
    return String(order.order_number);
  }
  if (order.id) {
    return order.id.slice(0, 6).toUpperCase();
  }
  return "";
}

export function formatOrderNumberWithHash(order?: {
  id?: string;
  order_number?: number | string | null;
} | null): string {
  const num = formatOrderNumber(order);
  return num ? `#${num}` : "";
}
