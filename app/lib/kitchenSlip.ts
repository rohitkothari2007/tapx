/**
 * Kitchen slip: a small printout for the kitchen with only what is needed to cook.
 * It deliberately has NO customer name, phone, prices or bill details: the input types below
 * do not even accept them.
 */

export type KitchenSlipItemInput = {
  item_name: string;
  quantity: number;
  special_request?: string | null;
  notes?: string | null;
};

export type KitchenSlipItem = {
  qty: string;
  name: string;
  note: string;
};

export type KitchenSlip = {
  /** "TABLE 5", or "NO TABLE". */
  tableLabel: string;
  /** "ADD-ON · 2nd order" for follow-up orders, otherwise "". */
  addOnText: string;
  /** Order reference, for example "#14". */
  orderLabel: string;
  /** Time the order was placed, for example "8:42 pm". */
  timeText: string;
  items: KitchenSlipItem[];
  /** Order-level note from the guest (for example an allergy), or "". */
  orderNote: string;
};

const MAX_NAME = 120;
const MAX_NOTE = 200;

function clean(text: string | null | undefined, max: number): string {
  const t = String(text ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function formatQty(q: number): string {
  if (!Number.isFinite(q)) return "1";
  if (Number.isInteger(q)) return String(q);
  return String(Number(q.toFixed(2)));
}

/** "8:42 pm" in the device's local time. Returns "" for an invalid date. */
export function formatSlipTime(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const h24 = d.getHours();
  const m = d.getMinutes();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 >= 12 ? "pm" : "am"}`;
}

export function buildKitchenSlip(params: {
  tableNumber: number | null | undefined;
  orderType?: string | null;
  addOnText?: string | null;
  orderLabel?: string | null;
  createdAt: string;
  items: KitchenSlipItemInput[];
  orderNote?: string | null;
}): KitchenSlip {
  const tbl =
    typeof params.tableNumber === "number" && Number.isFinite(params.tableNumber)
      ? params.tableNumber
      : null;
  const rawOrderLabel = clean(params.orderLabel, 40);
  const isTakeaway = params.orderType === "takeaway" || tbl === null;

  let tableLabel = tbl !== null ? `TABLE ${tbl}` : "NO TABLE";
  let finalOrderLabel = rawOrderLabel;

  if (isTakeaway && tbl === null) {
    tableLabel = rawOrderLabel ? `TAKEAWAY · ${rawOrderLabel}` : "TAKEAWAY";
    finalOrderLabel = ""; // avoid duplicate '#14' in meta line
  }

  const items: KitchenSlipItem[] = [];
  for (const it of params.items || []) {
    const name = clean(it?.item_name, MAX_NAME);
    const q = Number(it?.quantity);
    if (!name || !(q > 0)) continue;
    items.push({
      qty: formatQty(q),
      name,
      note: clean(it.special_request || it.notes, MAX_NOTE),
    });
  }
  return {
    tableLabel,
    addOnText: clean(params.addOnText, 40),
    orderLabel: finalOrderLabel,
    timeText: formatSlipTime(params.createdAt),
    items,
    orderNote: clean(params.orderNote, MAX_NOTE),
  };
}

export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSlip(s: KitchenSlip, printedAt: string): string {
  const meta = [s.orderLabel, s.timeText].filter(Boolean).map(escapeHtml).join(" · ");
  const itemsHtml = s.items
    .map(
      (it) =>
        `<div class="item"><span class="qty">${escapeHtml(it.qty)}x</span><span class="name">${escapeHtml(it.name)}</span></div>` +
        (it.note ? `<div class="note">Note: ${escapeHtml(it.note)}</div>` : "")
    )
    .join("");
  return (
    `<div class="slip">` +
    `<div class="center head">KITCHEN SLIP</div>` +
    `<div class="center table">${escapeHtml(s.tableLabel)}</div>` +
    (s.addOnText ? `<div class="center"><span class="badge">${escapeHtml(s.addOnText)}</span></div>` : "") +
    (meta ? `<div class="center meta">${meta}</div>` : "") +
    `<div class="rule"></div>` +
    (itemsHtml || `<div class="center meta">No items</div>`) +
    (s.orderNote ? `<div class="ordernote">Order note: ${escapeHtml(s.orderNote)}</div>` : "") +
    `<div class="rule"></div>` +
    (printedAt ? `<div class="foot">Printed ${escapeHtml(printedAt)}</div>` : "") +
    `</div>`
  );
}

/**
 * A complete HTML document with one slip per page. The slip is at most 74 mm wide, so it fits an
 * 80 mm receipt roll (3 mm margins) and prints as a narrow slip on a normal A4 printer.
 */
export function renderKitchenSlipsHtml(slips: KitchenSlip[], printedAt: string): string {
  const css =
    `@page{margin:3mm}` +
    `*{box-sizing:border-box}` +
    `html,body{margin:0;padding:0;background:#fff;color:#000}` +
    `body{font-family:"Courier New",Courier,monospace;font-size:13px;line-height:1.35}` +
    `.slip{width:100%;max-width:74mm;padding:2mm 0}` +
    `.slip+.slip{break-before:page;page-break-before:always}` +
    `.center{text-align:center}` +
    `.head{font-size:12px;letter-spacing:.08em}` +
    `.table{font-size:26px;font-weight:bold;line-height:1.15}` +
    `.badge{display:inline-block;border:2px solid #000;padding:1px 8px;font-weight:bold;margin:4px 0}` +
    `.meta{font-size:13px}` +
    `.rule{border-top:1px dashed #000;margin:8px 0}` +
    `.item{display:flex;gap:6px;font-size:15px;font-weight:bold;margin:4px 0 0}` +
    `.qty{min-width:34px;flex-shrink:0}` +
    `.name{overflow-wrap:anywhere}` +
    `.note{font-size:12px;padding-left:40px;overflow-wrap:anywhere}` +
    `.ordernote{margin-top:6px;font-size:13px;border:1px solid #000;padding:3px 6px;overflow-wrap:anywhere}` +
    `.foot{font-size:11px;text-align:center;margin-top:6px}`;
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>Kitchen slip</title><style>${css}</style></head><body>` +
    (slips || []).map((s) => renderSlip(s, printedAt)).join("") +
    `</body></html>`
  );
}

/**
 * Opens the browser's print window for the given HTML using a hidden frame (no popup window,
 * so popup blockers do not interfere). Returns false when printing could not be started.
 */
export function printHtmlInHiddenFrame(html: string): boolean {
  if (typeof document === "undefined" || !document.body) return false;
  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("tabindex", "-1");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      iframe.remove();
    };
    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) {
          remove();
          return;
        }
        win.addEventListener("afterprint", remove);
        win.focus();
        win.print();
      } catch {
        remove();
        return;
      }
      // Some browsers never fire afterprint: clean up anyway.
      setTimeout(remove, 120000);
    };
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    return true;
  } catch {
    return false;
  }
}
