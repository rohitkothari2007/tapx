import type { jsPDF } from "jspdf";
import QRCode from "qrcode";
import {
  BillingBusinessProfile,
  BillingPaperSize,
  BillingSettings,
  BillPaymentStatus,
  BillStatus,
  PaymentMethod,
  buildUpiPayUri,
  formatBillDateTime,
  formatBillPaymentLabel,
  formatMoney,
  formatQuantity,
  normalizeWhatsAppPhone,
} from "./billing";

export type BillPdfData = {
  id?: string;
  bill_no_text: string;
  status: BillStatus;
  created_at: string;
  bill_day: string;
  table_number: number | null;
  customer_name: string | null;
  customer_phone?: string | null;
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
  void_reason?: string | null;
  voided_at?: string | null;
  notes?: string | null;
  share_token?: string;
  items: Array<{
    item_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }>;
  business: BillingBusinessProfile;
  settings: {
    paper: BillingPaperSize;
    footer: string;
    show_upi_qr: boolean;
    show_logo: boolean;
  };
};

export type GenerateBillPdfOptions = {
  mode?: "dashboard" | "public";
  fontRegularBase64?: string;
  fontBoldBase64?: string;
};

let cachedRegularB64: string | null = null;
let cachedBoldB64: string | null = null;
let fontLoadAttempted = false;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
}

export async function preloadBillPdfFonts(): Promise<{
  regular: string | null;
  bold: string | null;
}> {
  if (cachedRegularB64 && cachedBoldB64) {
    return { regular: cachedRegularB64, bold: cachedBoldB64 };
  }
  if (fontLoadAttempted && (!cachedRegularB64 || !cachedBoldB64)) {
    return { regular: cachedRegularB64, bold: cachedBoldB64 };
  }
  fontLoadAttempted = true;

  try {
    const [regRes, boldRes] = await Promise.all([
      fetch("/fonts/NotoSans-Regular.ttf"),
      fetch("/fonts/NotoSans-Bold.ttf"),
    ]);
    if (regRes.ok && boldRes.ok) {
      const [regBuf, boldBuf] = await Promise.all([
        regRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ]);
      cachedRegularB64 = arrayBufferToBase64(regBuf);
      cachedBoldB64 = arrayBufferToBase64(boldBuf);
    }
  } catch (err) {
    // Fonts failed to load; will fall back to standard fonts
    console.warn("Could not load Noto Sans fonts for PDF. Falling back to standard fonts.", err);
  }

  return { regular: cachedRegularB64, bold: cachedBoldB64 };
}

export function getBillPdfFileName(billNoText?: string | null): string {
  const clean = (billNoText || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean ? `${clean}.pdf` : "bill.pdf";
}

export function stripLinkFromBillMessage(message: string): string {
  return message
    .split("\n")
    .filter((line) => {
      const l = line.trim().toLowerCase();
      return !l.startsWith("view your bill:") && !l.startsWith("view bill:");
    })
    .join("\n")
    .trim();
}

async function tryLoadImageAsDataUrl(url?: string | null): Promise<string | null> {
  if (!url || typeof window === "undefined") return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateBillPdfBlob(
  data: BillPdfData,
  options?: GenerateBillPdfOptions
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const mode = options?.mode || "dashboard";
  let regB64 = options?.fontRegularBase64 || cachedRegularB64;
  let boldB64 = options?.fontBoldBase64 || cachedBoldB64;

  if (!regB64 || !boldB64) {
    const loaded = await preloadBillPdfFonts();
    regB64 = loaded.regular;
    boldB64 = loaded.bold;
  }

  const hasCustomFont = Boolean(regB64 && boldB64);
  const fontName = hasCustomFont ? "NotoSans" : "helvetica";

  const formatPdfMoney = (val: number | string | null | undefined): string => {
    const formatted = formatMoney(val);
    if (!hasCustomFont) {
      return formatted.replace(/₹\s?/g, "Rs. ");
    }
    return formatted;
  };

  const paper: BillingPaperSize =
    data.settings?.paper === "58mm" || data.settings?.paper === "a4"
      ? data.settings.paper
      : "80mm";

  // Preload logo & QR code in parallel
  const cleanUpiId = (data.business?.upi_id || "").trim();
  const shouldIncludeUpiQr =
    data.payment_status === "unpaid" &&
    data.settings.show_upi_qr &&
    Boolean(cleanUpiId) &&
    data.status === "issued";

  const [logoDataUrl, qrDataUrl] = await Promise.all([
    data.settings.show_logo && data.business?.logo_url
      ? tryLoadImageAsDataUrl(data.business.logo_url)
      : Promise.resolve(null),
    shouldIncludeUpiQr
      ? (async () => {
          try {
            const upiUri = buildUpiPayUri({
              upiId: cleanUpiId,
              businessName: data.business?.name || "Business",
              total: data.total,
              billNoText: data.bill_no_text,
            });
            return await QRCode.toDataURL(upiUri, { width: 256, margin: 1 });
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null),
  ]);

  // Dimension settings (in mm)
  let pageWidth = 80;
  let pageHeight = 200; // Will be computed for thermal receipts
  let marginX = 4;
  let contentWidth = 72;
  const isA4 = paper === "a4";

  if (paper === "58mm") {
    pageWidth = 58;
    marginX = 3;
    contentWidth = 52;
  } else if (isA4) {
    pageWidth = 210;
    pageHeight = 297;
    contentWidth = 110;
    marginX = (pageWidth - contentWidth) / 2; // centered 110mm column
  }

  // Measure content height for thermal continuous receipts
  // Base text sizing
  const fontSizeTitle = isA4 ? 14 : paper === "58mm" ? 11 : 12;
  const fontSizeSub = isA4 ? 9.5 : paper === "58mm" ? 7.5 : 8.5;
  const fontSizeBody = isA4 ? 9.5 : paper === "58mm" ? 8 : 8.5;
  const fontSizeTotal = isA4 ? 13 : paper === "58mm" ? 10.5 : 11.5;

  // Let's create a scratch doc to measure wrapped text heights accurately
  const measureDoc = new jsPDF({ unit: "mm", format: isA4 ? "a4" : [pageWidth, 500] });
  if (hasCustomFont && regB64 && boldB64) {
    measureDoc.addFileToVFS("NotoSans-Regular.ttf", regB64);
    measureDoc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    measureDoc.addFileToVFS("NotoSans-Bold.ttf", boldB64);
    measureDoc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  }

  // Pre-calculate items layout and height
  const colQtyRateWidth = paper === "58mm" ? 22 : 26;
  const colAmtWidth = paper === "58mm" ? 15 : 18;
  const colNameWidth = contentWidth - colQtyRateWidth - colAmtWidth;

  const itemLines = data.items.map((item) => {
    measureDoc.setFont(fontName, "normal");
    measureDoc.setFontSize(fontSizeBody);
    const wrappedName = measureDoc.splitTextToSize(item.item_name, colNameWidth) as string[];
    const qtyRate = `${formatQuantity(item.quantity)} × ${formatPdfMoney(item.unit_price)}`;
    const lineAmt = formatPdfMoney(item.line_total);
    const lineCount = Math.max(1, wrappedName.length);
    const itemHeight = lineCount * (paper === "58mm" ? 3.4 : 3.8);
    return { item, wrappedName, qtyRate, lineAmt, itemHeight };
  });

  const footerText = (data.settings?.footer || "").trim();
  let wrappedFooterLines: string[] = [];
  if (footerText) {
    measureDoc.setFont(fontName, "normal");
    measureDoc.setFontSize(fontSizeSub);
    wrappedFooterLines = measureDoc.splitTextToSize(footerText, contentWidth) as string[];
  }

  const isVoid = data.status === "void";
  const voidReasonText =
    mode === "dashboard" && isVoid && data.void_reason ? `Reason: ${data.void_reason}` : "";
  let wrappedVoidReason: string[] = [];
  if (voidReasonText) {
    measureDoc.setFont(fontName, "normal");
    measureDoc.setFontSize(fontSizeSub);
    wrappedVoidReason = measureDoc.splitTextToSize(voidReasonText, contentWidth - 4) as string[];
  }

  if (!isA4) {
    // Continuous thermal height calculation
    let h = 8; // top margin
    if (logoDataUrl) h += 16;
    h += 6; // business name
    if (data.business?.address || data.business?.city || data.business?.state) h += 8;
    if (data.business?.phone) h += 4;
    h += 4; // dashed line

    if (isVoid) {
      h += 8;
      if (wrappedVoidReason.length > 0) h += wrappedVoidReason.length * 3.5 + 2;
    }

    // Bill metadata
    h += 4; // Bill No
    h += 4; // Date
    if (data.table_number != null) h += 4;
    if (data.customer_name) h += 4;
    h += 4; // dashed line

    // Table header + items
    h += 5; // table header
    for (const line of itemLines) {
      h += line.itemHeight + 1.2;
    }
    h += 3; // dashed line

    // Financial totals
    h += 4; // subtotal
    if (data.discount_amount > 0) h += 4;
    if (data.service_charge > 0) h += 4;
    if (data.round_off !== 0) h += 4;
    h += 6; // TOTAL
    h += 4; // dashed line

    // Payment line
    h += 4.5;

    // UPI QR
    if (qrDataUrl) {
      const qrSize = paper === "58mm" ? 26 : 32;
      h += qrSize + 7;
    }

    // Footer note
    if (wrappedFooterLines.length > 0) {
      h += 3 + wrappedFooterLines.length * 3.5;
    }

    h += 10; // bottom margin
    pageHeight = Math.max(70, Math.ceil(h));
  }

  // Create actual output document
  const doc = new jsPDF({
    unit: "mm",
    format: isA4 ? "a4" : [pageWidth, pageHeight],
  });

  if (hasCustomFont && regB64 && boldB64) {
    doc.addFileToVFS("NotoSans-Regular.ttf", regB64);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.addFileToVFS("NotoSans-Bold.ttf", boldB64);
    doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  }

  let y = isA4 ? 14 : 7;
  const leftX = marginX;
  const rightX = marginX + contentWidth;
  const centerX = marginX + contentWidth / 2;

  function checkPageBreak(neededHeight: number) {
    if (!isA4) return;
    if (y + neededHeight > 282) {
      doc.addPage();
      y = 15;
    }
  }

  function drawDashedLine() {
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(leftX, y, rightX, y);
    doc.setLineDashPattern([], 0); // reset
    y += 3.5;
  }

  // 1. Logo
  if (logoDataUrl) {
    try {
      const logoSize = isA4 ? 15 : paper === "58mm" ? 11 : 13;
      doc.addImage(logoDataUrl, "PNG", centerX - logoSize / 2, y, logoSize, logoSize);
      y += logoSize + 2.5;
    } catch {
      // Ignore logo error silently
    }
  }

  // 2. Business Header
  doc.setFont(fontName, "bold");
  doc.setFontSize(fontSizeTitle);
  doc.setTextColor(15, 23, 42);
  const bizName = (data.business?.name || "Business").toUpperCase();
  const wrappedBizName = doc.splitTextToSize(bizName, contentWidth) as string[];
  for (const line of wrappedBizName) {
    doc.text(line, centerX, y, { align: "center" });
    y += fontSizeTitle * 0.35 + 1;
  }

  const addressParts = [
    data.business?.address?.trim(),
    data.business?.city?.trim(),
    data.business?.state?.trim(),
  ].filter(Boolean);

  if (addressParts.length > 0) {
    doc.setFont(fontName, "normal");
    doc.setFontSize(fontSizeSub);
    doc.setTextColor(71, 85, 105);
    const addrStr = addressParts.join(", ");
    const wrappedAddr = doc.splitTextToSize(addrStr, contentWidth) as string[];
    for (const line of wrappedAddr) {
      doc.text(line, centerX, y, { align: "center" });
      y += fontSizeSub * 0.35 + 0.8;
    }
  }

  if (data.business?.phone) {
    doc.setFont(fontName, "normal");
    doc.setFontSize(fontSizeSub);
    doc.setTextColor(71, 85, 105);
    doc.text(`Tel: ${data.business.phone}`, centerX, y, { align: "center" });
    y += fontSizeSub * 0.35 + 1.2;
  }

  y += 1.5;
  drawDashedLine();

  // 3. VOID Banner / Watermark
  if (isVoid) {
    checkPageBreak(14);
    doc.setDrawColor(220, 38, 38);
    doc.setFillColor(254, 242, 242);
    const bannerH = wrappedVoidReason.length > 0 ? 8 + wrappedVoidReason.length * 3.5 : 7;
    doc.roundedRect(leftX, y, contentWidth, bannerH, 1.5, 1.5, "FD");

    doc.setFont(fontName, "bold");
    doc.setFontSize(fontSizeBody + 2);
    doc.setTextColor(185, 28, 28);
    doc.text("VOID", centerX, y + 5, { align: "center" });

    if (wrappedVoidReason.length > 0) {
      doc.setFont(fontName, "normal");
      doc.setFontSize(fontSizeSub);
      doc.setTextColor(127, 29, 29);
      let rY = y + 8.5;
      for (const line of wrappedVoidReason) {
        doc.text(line, centerX, rY, { align: "center" });
        rY += 3.2;
      }
    }
    y += bannerH + 3;
  }

  // 4. Bill Meta
  doc.setFontSize(fontSizeBody);
  const drawMetaRow = (label: string, value: string, boldValue = false) => {
    checkPageBreak(4);
    doc.setFont(fontName, "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(label, leftX, y);
    doc.setFont(fontName, boldValue ? "bold" : "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(value, rightX, y, { align: "right" });
    y += 3.8;
  };

  drawMetaRow("Bill No:", data.bill_no_text, true);
  const dateTimeStr = formatBillDateTime(data.created_at) || data.bill_day;
  drawMetaRow("Date:", dateTimeStr);
  if (data.table_number != null) {
    drawMetaRow("Table:", `Table ${data.table_number}`, true);
  }
  if (data.customer_name) {
    drawMetaRow("Customer:", data.customer_name);
  }

  y += 1;
  drawDashedLine();

  // 5. Items Header
  checkPageBreak(8);
  doc.setFont(fontName, "bold");
  doc.setFontSize(fontSizeSub);
  doc.setTextColor(100, 116, 139);
  doc.text("ITEM", leftX, y);
  doc.text("QTY × RATE", leftX + colNameWidth + colQtyRateWidth - 1, y, { align: "right" });
  doc.text("AMOUNT", rightX, y, { align: "right" });
  y += 3.2;

  // 6. Items Lines
  for (const itemLine of itemLines) {
    checkPageBreak(itemLine.itemHeight + 2);
    const startY = y;
    doc.setFont(fontName, "normal");
    doc.setFontSize(fontSizeBody);
    doc.setTextColor(15, 23, 42);

    // Left: item name wrapped
    let nameY = startY;
    for (const nl of itemLine.wrappedName) {
      doc.text(nl, leftX, nameY);
      nameY += paper === "58mm" ? 3.3 : 3.6;
    }

    // Mid: Qty × Rate
    doc.setFontSize(fontSizeSub);
    doc.setTextColor(71, 85, 105);
    doc.text(itemLine.qtyRate, leftX + colNameWidth + colQtyRateWidth - 1, startY, {
      align: "right",
    });

    // Right: Amount
    doc.setFont(fontName, "bold");
    doc.setFontSize(fontSizeBody);
    doc.setTextColor(15, 23, 42);
    doc.text(itemLine.lineAmt, rightX, startY, { align: "right" });

    y = Math.max(nameY, startY + (paper === "58mm" ? 3.3 : 3.6)) + 0.8;
  }

  y += 1;
  drawDashedLine();

  // 7. Totals & Breakdown
  const drawSummaryRow = (label: string, value: string, bold = false, size = fontSizeBody) => {
    checkPageBreak(4.5);
    doc.setFont(fontName, bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(bold ? 15 : 71, bold ? 23 : 85, bold ? 42 : 105);
    doc.text(label, leftX, y);
    doc.text(value, rightX, y, { align: "right" });
    y += bold ? 5.2 : 3.8;
  };

  drawSummaryRow("Subtotal", formatPdfMoney(data.subtotal));

  if (data.discount_amount > 0) {
    const discLabel = data.discount_note
      ? `Discount (${data.discount_note})`
      : "Discount";
    drawSummaryRow(discLabel, `-${formatPdfMoney(data.discount_amount)}`);
  }

  if (data.service_charge > 0) {
    const scLabel =
      data.service_charge_pct > 0
        ? `Service Charge (${data.service_charge_pct}%)`
        : "Service Charge";
    drawSummaryRow(scLabel, formatPdfMoney(data.service_charge));
  }

  if (data.round_off !== 0) {
    const roLabel = "Round Off";
    const roVal =
      data.round_off > 0
        ? `+${formatPdfMoney(data.round_off)}`
        : `-${formatPdfMoney(Math.abs(data.round_off))}`;
    drawSummaryRow(roLabel, roVal);
  }

  y += 1;
  doc.setDrawColor(200, 200, 200);
  doc.line(leftX, y, rightX, y);
  y += 3.8;

  // Big TOTAL
  drawSummaryRow("TOTAL", formatPdfMoney(data.total), true, fontSizeTotal);

  drawDashedLine();

  // 8. Payment Status Line
  checkPageBreak(6);
  const isPaid = data.payment_status === "paid";
  doc.setFont(fontName, "bold");
  doc.setFontSize(fontSizeBody);
  doc.setTextColor(isPaid ? 22 : 180, isPaid ? 101 : 83, isPaid ? 52 : 9); // green or amber
  const paymentText = formatBillPaymentLabel(data.payment_status, data.payment_method, data.paid_at);
  doc.text(paymentText, centerX, y, { align: "center" });
  y += 4.5;

  // 9. UPI QR Code (if unpaid and business has UPI ID)
  if (qrDataUrl) {
    const qrSize = paper === "58mm" ? 24 : isA4 ? 28 : 28;
    checkPageBreak(qrSize + 7);
    try {
      doc.addImage(qrDataUrl, "PNG", centerX - qrSize / 2, y, qrSize, qrSize);
      y += qrSize + 3;
      doc.setFont(fontName, "bold");
      doc.setFontSize(fontSizeSub);
      doc.setTextColor(15, 23, 42);
      doc.text(`Scan to pay ${formatPdfMoney(data.total)}`, centerX, y, { align: "center" });
      y += 4;
    } catch {
      // Ignore QR error silently
    }
  }

  // 10. Owner Footer Text
  if (wrappedFooterLines.length > 0) {
    checkPageBreak(wrappedFooterLines.length * 3.5 + 4);
    y += 1.5;
    doc.setFont(fontName, "normal");
    doc.setFontSize(fontSizeSub);
    doc.setTextColor(100, 116, 139);
    for (const fl of wrappedFooterLines) {
      doc.text(fl, centerX, y, { align: "center" });
      y += 3.2;
    }
  }

  const arrayBuffer = doc.output("arraybuffer");
  return new Blob([arrayBuffer], { type: "application/pdf" });
}

export function downloadPdfBlob(blob: Blob, fileName: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function sharePdfOnWhatsApp(params: {
  blob: Blob;
  fileName: string;
  messageText: string;
  customerPhone?: string | null;
  onInstructionNeeded?: (fileName: string) => void;
}): Promise<void> {
  const { blob, fileName, messageText, customerPhone, onInstructionNeeded } = params;
  const cleanMessage = stripLinkFromBillMessage(messageText);

  // Check Web Share API with files support (common on mobile browsers)
  if (typeof navigator !== "undefined" && typeof (navigator as any).canShare === "function") {
    try {
      const file = new File([blob], fileName, { type: "application/pdf" });
      if ((navigator as any).canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: cleanMessage,
        });
        return;
      }
    } catch (err: any) {
      // User cancelling share sheet is a normal abort, not an error
      if (err?.name === "AbortError") {
        return;
      }
      // If Web Share throws unexpected error, fall through to desktop download + wa.me flow
    }
  }

  // Desktop or fallback flow: trigger download + open wa.me chat in new tab
  downloadPdfBlob(blob, fileName);

  const normalizedPhone = normalizeWhatsAppPhone(customerPhone);
  const waUrl = normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(cleanMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(cleanMessage)}`;

  if (typeof window !== "undefined") {
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  if (onInstructionNeeded) {
    onInstructionNeeded(fileName);
  }
}
