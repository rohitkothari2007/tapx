"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  BILL_ITEM_SELECT_COLUMNS,
  BILL_SELECT_COLUMNS,
} from "./BillsPage";
import {
  BillableOrderItemLike,
  BillableOrderLike,
  BillingBusinessProfile,
  BillingSettings,
  LiveOrderBillLinkMap,
  PaymentMethod,
  SavedMenuItem,
  TapxBill,
  TapxBillItem,
  buildCustomerBillMessage,
  formatBillTimeShort,
  formatMoney,
  formatQuantity,
  hasAtMostDecimals,
  isAutoTableName,
  isOrderBillable,
  normalizeWhatsAppPhone,
  parseBillingSettings,
  parseSavedItemsFromConfig,
} from "../../lib/billing";
import {
  formatOrderLabel,
  formatPaymentMethodLabel,
} from "../../lib/orderNumber";
import BillDocument, {
  toBillDocumentDataFromDashboard,
} from "../../components/billing/BillDocument";

type ExtraLine = {
  key: string;
  name: string;
  priceInput: string;
  qtyInput: string;
  menu_item_id?: string;
};

type Props = {
  business: BillingBusinessProfile & { id: string };
  tableNumber: number | null;
  preselectOrderIds?: string[];
  orders: BillableOrderLike[];
  orderItems: BillableOrderItemLike[];
  liveBillLinks: LiveOrderBillLinkMap;
  billingSettings: BillingSettings;
  moduleConfigs?: Array<{ module_key: string; config: Record<string, any> | null }>;
  returnLabel: string;
  onCancel: () => void;
  onDoneBack: () => Promise<void> | void;
  onViewInBills: (billId: string) => Promise<void> | void;
  onBillMutated?: () => Promise<void> | void;
};

function createBlankExtraLine(): ExtraLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    priceInput: "",
    qtyInput: "1",
  };
}

function getOrderStatusChip(status: string): {
  label: string;
  bg: string;
  color: string;
  border: string;
} {
  switch (status) {
    case "pending":
      return {
        label: "Not accepted yet",
        bg: "#fef3c7",
        color: "#92400e",
        border: "#fde68a",
      };
    case "accepted":
      return {
        label: "Accepted",
        bg: "#dbeafe",
        color: "#1e40af",
        border: "#bfdbfe",
      };
    case "preparing":
      return {
        label: "Preparing",
        bg: "#ffedd5",
        color: "#9a3412",
        border: "#fed7aa",
      };
    case "ready":
      return {
        label: "Ready",
        bg: "#e0e7ff",
        color: "#3730a3",
        border: "#c7d2fe",
      };
    case "served":
      return {
        label: "Served",
        bg: "#ccfbf1",
        color: "#115e59",
        border: "#99f6e4",
      };
    case "completed":
      return {
        label: "Completed",
        bg: "#dcfce7",
        color: "#166534",
        border: "#bbf7d0",
      };
    default:
      return {
        label: status || "Order",
        bg: "#f1f5f9",
        color: "#475569",
        border: "#e2e8f0",
      };
  }
}

export default function BillFromOrders({
  business,
  tableNumber,
  preselectOrderIds,
  orders,
  orderItems,
  liveBillLinks,
  billingSettings,
  moduleConfigs,
  returnLabel,
  onCancel,
  onDoneBack,
  onViewInBills,
  onBillMutated,
}: Props) {
  // Step state: "review" (step 1) -> "done" (step 2)
  const [step, setStep] = useState<"review" | "done">("review");
  const [activeSettings, setActiveSettings] = useState<BillingSettings>(billingSettings);

  // Eligible unbilled, non-cancelled, non-archived orders for this table
  const eligibleOrders = useMemo(() => {
    const filtered = (orders || []).filter((o) => {
      if (!isOrderBillable(o, liveBillLinks)) return false;
      if (tableNumber !== null) {
        return o.table_number === tableNumber;
      }
      if (preselectOrderIds && preselectOrderIds.length > 0) {
        return o.table_number == null && preselectOrderIds.includes(o.id);
      }
      return o.table_number == null;
    });
    return filtered.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [orders, liveBillLinks, tableNumber, preselectOrderIds]);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(() => {
    if (preselectOrderIds && preselectOrderIds.length > 0) {
      const matched = eligibleOrders
        .filter((o) => preselectOrderIds.includes(o.id))
        .map((o) => o.id);
      if (matched.length > 0) return matched;
    }
    return eligibleOrders.map((o) => o.id);
  });

  // Map of excluded order_item_ids (true = left off bill)
  const [excludedItemIds, setExcludedItemIds] = useState<Record<string, boolean>>({});

  // Saved digital menu items for extra lines
  const initialMenuItems = useMemo(() => {
    const row = (moduleConfigs || []).find((m) => {
      const k = String(m.module_key || "").trim().toLowerCase();
      return k === "digital_menu" || k === "digital-menu";
    });
    return parseSavedItemsFromConfig(row?.config);
  }, [moduleConfigs]);
  const [savedItems, setSavedItems] = useState<SavedMenuItem[]>(initialMenuItems);
  const [itemSearch, setItemSearch] = useState("");
  const [showSavedPicker, setShowSavedPicker] = useState(false);

  // Extra manual lines
  const [extraLines, setExtraLines] = useState<ExtraLine[]>([]);

  // Customer info prefilled from first selected order (ignoring auto "Table N" placeholder names)
  const selectedOrders = useMemo(() => {
    const set = new Set(selectedOrderIds);
    return eligibleOrders.filter((o) => set.has(o.id));
  }, [eligibleOrders, selectedOrderIds]);

  const firstSelectedOrder = selectedOrders[0] || eligibleOrders[0] || null;
  const [customerName, setCustomerName] = useState(() => {
    const raw = (firstSelectedOrder?.customer_name || "").trim();
    return raw && !isAutoTableName(raw) ? raw : "";
  });
  const [customerPhone, setCustomerPhone] = useState(() =>
    (firstSelectedOrder?.customer_phone || "").trim()
  );
  const customerTouchedRef = useRef(false);

  // Discount & Service charge %
  const [discountType, setDiscountType] = useState<"none" | "amount" | "percent">("none");
  const [discountValueInput, setDiscountValueInput] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [serviceChargeInput, setServiceChargeInput] = useState(() =>
    billingSettings.service_charge_pct !== null
      ? String(billingSettings.service_charge_pct)
      : ""
  );
  const serviceChargeTouchedRef = useRef(false);

  // Payment chooser / submit lock
  const [showPaidChooser, setShowPaidChooser] = useState(false);
  const [selectedPaidMethod, setSelectedPaidMethod] = useState<PaymentMethod | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const submittingRef = useRef(false);

  // Step 2 (Done screen) state
  const [issuedBillId, setIssuedBillId] = useState<string | null>(null);
  const [issuedBill, setIssuedBill] = useState<TapxBill | null>(null);
  const [issuedItems, setIssuedItems] = useState<TapxBillItem[]>([]);
  const [loadingDone, setLoadingDone] = useState(false);
  const [doneError, setDoneError] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [copiedMessage, setCopiedMessage] = useState(false);
  const messageEditedRef = useRef(false);

  // Fetch fresh billing settings (service_charge_pct, etc.) and digital_menu items on mount
  useEffect(() => {
    let active = true;
    async function loadFreshConfigs() {
      if (!business?.id) return;
      try {
        const [billingRes, menuRes] = await Promise.all([
          supabase
            .from("business_module_configs")
            .select("config")
            .eq("business_id", business.id)
            .eq("module_key", "billing")
            .maybeSingle(),
          supabase
            .from("business_module_configs")
            .select("id, config, module_key")
            .eq("business_id", business.id)
            .or("module_key.eq.digital_menu,module_key.eq.digital-menu")
            .maybeSingle(),
        ]);
        if (!active) return;
        if (!billingRes.error && billingRes.data?.config) {
          const parsed = parseBillingSettings(
            billingRes.data.config as Record<string, any>
          );
          setActiveSettings(parsed);
          if (!serviceChargeTouchedRef.current) {
            setServiceChargeInput(
              parsed.service_charge_pct !== null ? String(parsed.service_charge_pct) : ""
            );
          }
        }
        if (!menuRes.error && menuRes.data?.config) {
          setSavedItems(
            parseSavedItemsFromConfig(menuRes.data.config as Record<string, any>)
          );
        }
      } catch {
        // Fallback silently to props
      }
    }
    void loadFreshConfigs();
    return () => {
      active = false;
    };
  }, [business?.id]);

  // Keep customer fields synced with first selected order until manually edited
  useEffect(() => {
    if (customerTouchedRef.current) return;
    const ord = selectedOrders[0];
    if (!ord) return;
    const raw = (ord.customer_name || "").trim();
    setCustomerName(raw && !isAutoTableName(raw) ? raw : "");
    setCustomerPhone((ord.customer_phone || "").trim());
  }, [selectedOrders]);

  // Detect if every selected order already has payment_status === 'paid'
  const { allOrdersMarkedPaid, preselectedOrderPayMethod } = useMemo(() => {
    if (selectedOrders.length === 0) {
      return { allOrdersMarkedPaid: false, preselectedOrderPayMethod: null as PaymentMethod | null };
    }
    const allPaid = selectedOrders.every((o) => o.payment_status === "paid");
    if (!allPaid) {
      return { allOrdersMarkedPaid: false, preselectedOrderPayMethod: null as PaymentMethod | null };
    }
    const firstMethod = selectedOrders.find(
      (o) =>
        o.payment_method === "cash" ||
        o.payment_method === "upi" ||
        o.payment_method === "card"
    )?.payment_method as PaymentMethod | undefined;
    return {
      allOrdersMarkedPaid: true,
      preselectedOrderPayMethod: firstMethod || null,
    };
  }, [selectedOrders]);

  useEffect(() => {
    if (allOrdersMarkedPaid && preselectedOrderPayMethod) {
      setSelectedPaidMethod(preselectedOrderPayMethod);
    } else if (!allOrdersMarkedPaid) {
      setSelectedPaidMethod(null);
    }
  }, [allOrdersMarkedPaid, preselectedOrderPayMethod]);

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, BillableOrderItemLike[]>();
    for (const item of orderItems || []) {
      if (!item?.order_id) continue;
      const list = map.get(item.order_id) || [];
      list.push(item);
      map.set(item.order_id, list);
    }
    return map;
  }, [orderItems]);

  const toggleOrderSelection = (orderId: string) => {
    setErrorMsg("");
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleExcludeOrderItem = (orderId: string, itemId: string) => {
    setErrorMsg("");
    const isOrderChecked = selectedOrderIds.includes(orderId);
    const items = itemsByOrder.get(orderId) || [];
    const currentlyExcluded = Boolean(excludedItemIds[itemId]);

    // Turning OFF an item on a checked order: block if no other items would remain
    if (!currentlyExcluded && isOrderChecked) {
      const remainingIncluded = items.filter(
        (it) => it.id !== itemId && !excludedItemIds[it.id]
      );
      if (remainingIncluded.length === 0) {
        setErrorMsg("Uncheck the whole order instead");
        return;
      }
    }

    setExcludedItemIds((prev) => ({
      ...prev,
      [itemId]: !currentlyExcluded,
    }));
  };

  const filteredSavedItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return savedItems;
    return savedItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [savedItems, itemSearch]);

  const handleAddBlankExtraLine = () => {
    setErrorMsg("");
    setExtraLines((prev) => [...prev, createBlankExtraLine()]);
  };

  const handlePickSavedItem = (item: SavedMenuItem) => {
    setErrorMsg("");
    setExtraLines((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: item.name.slice(0, 120),
        priceInput: String(item.price),
        qtyInput: "1",
        menu_item_id: item.id,
      },
    ]);
  };

  const updateExtraLine = (key: string, patch: Partial<ExtraLine>) => {
    setExtraLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const removeExtraLine = (key: string) => {
    setExtraLines((prev) => prev.filter((line) => line.key !== key));
  };

  // LIVE Estimated preview only (server computes authoritative amounts on Issue)
  const preview = useMemo(() => {
    let ordersSubtotal = 0;
    let includedOrderItemCount = 0;

    for (const ord of selectedOrders) {
      const items = itemsByOrder.get(ord.id) || [];
      if (items.length === 0) {
        ordersSubtotal += Number(ord.subtotal ?? ord.total ?? 0);
        continue;
      }
      for (const item of items) {
        if (excludedItemIds[item.id]) continue;
        const lineAmt = Number(
          item.line_total ?? Number(item.unit_price || 0) * Number(item.quantity || 0)
        );
        if (Number.isFinite(lineAmt)) {
          ordersSubtotal += lineAmt;
        }
        includedOrderItemCount += 1;
      }
    }

    let extraSubtotal = 0;
    for (const line of extraLines) {
      const p = Number(line.priceInput);
      const q = Number(line.qtyInput);
      if (Number.isFinite(p) && p >= 0 && Number.isFinite(q) && q > 0) {
        extraSubtotal += p * q;
      }
    }

    const subtotal = Math.round((ordersSubtotal + extraSubtotal) * 100) / 100;

    let discountAmount = 0;
    const discRaw = Number(discountValueInput);
    if (discountType === "amount" && Number.isFinite(discRaw) && discRaw > 0) {
      discountAmount = Math.min(subtotal, Math.round(discRaw * 100) / 100);
    } else if (discountType === "percent" && Number.isFinite(discRaw) && discRaw > 0) {
      const pct = Math.min(100, discRaw);
      discountAmount = Math.round(((subtotal * pct) / 100) * 100) / 100;
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const scTrim = serviceChargeInput.trim();
    const scPct = scTrim === "" ? 0 : Number(scTrim);
    const serviceCharge =
      Number.isFinite(scPct) && scPct >= 0 && scPct <= 30
        ? Math.round(((afterDiscount * scPct) / 100) * 100) / 100
        : 0;

    const rawTotal = afterDiscount + serviceCharge;
    const finalTotal = activeSettings.round_off
      ? Math.round(rawTotal)
      : Math.round(rawTotal * 100) / 100;
    const roundOff = Math.round((finalTotal - rawTotal) * 100) / 100;

    return {
      subtotal,
      includedOrderItemCount,
      discountAmount,
      serviceCharge,
      roundOff,
      total: finalTotal,
    };
  }, [
    selectedOrders,
    itemsByOrder,
    excludedItemIds,
    extraLines,
    discountType,
    discountValueInput,
    serviceChargeInput,
    activeSettings.round_off,
  ]);

  const validateAndBuildArgs = (paymentMethod?: PaymentMethod) => {
    if (selectedOrderIds.length === 0 && extraLines.length === 0) {
      return { error: "Select at least one order or add an extra item." };
    }

    // Ensure every checked order keeps at least one item
    const excludedForSelected: string[] = [];
    let totalLinesCount = 0;
    for (const orderId of selectedOrderIds) {
      const items = itemsByOrder.get(orderId) || [];
      let includedInOrder = 0;
      for (const item of items) {
        if (excludedItemIds[item.id]) {
          excludedForSelected.push(item.id);
        } else {
          includedInOrder += 1;
          totalLinesCount += 1;
        }
      }
      if (items.length > 0 && includedInOrder === 0) {
        return { error: "Uncheck the whole order instead" };
      }
    }

    const manualItems: Array<{
      name: string;
      unit_price: number;
      quantity: number;
      menu_item_id?: string;
    }> = [];

    for (let i = 0; i < extraLines.length; i += 1) {
      const line = extraLines[i];
      const name = line.name.trim();
      if (!name) {
        return { error: `Extra item ${i + 1}: Please enter an item name.` };
      }
      if (name.length > 120) {
        return { error: `Extra item ${i + 1}: Name cannot exceed 120 characters.` };
      }
      const price = Number(line.priceInput);
      if (
        line.priceInput.trim() === "" ||
        !Number.isFinite(price) ||
        price < 0 ||
        !hasAtMostDecimals(price, 2)
      ) {
        return {
          error: `Extra item ${i + 1} (${name}): Price must be 0 or more with at most 2 decimals.`,
        };
      }
      const qty = Number(line.qtyInput);
      if (!Number.isFinite(qty) || qty <= 0 || !hasAtMostDecimals(qty, 3)) {
        return {
          error: `Extra item ${i + 1} (${name}): Quantity must be greater than 0 with at most 3 decimals.`,
        };
      }
      manualItems.push({
        name,
        unit_price: Math.round(price * 100) / 100,
        quantity: Number(qty.toFixed(3)),
        ...(line.menu_item_id ? { menu_item_id: line.menu_item_id } : {}),
      });
    }

    totalLinesCount += manualItems.length;
    if (totalLinesCount === 0) {
      return { error: "Select at least one order or add an item." };
    }
    if (totalLinesCount > 100) {
      return { error: "Maximum 100 bill lines are allowed per bill." };
    }

    const args: Record<string, any> = {
      p_business_id: business.id,
    };

    if (selectedOrderIds.length > 0) {
      args.p_order_ids = selectedOrderIds;
    }
    if (excludedForSelected.length > 0) {
      args.p_exclude_order_item_ids = excludedForSelected;
    }
    if (manualItems.length > 0) {
      args.p_manual_items = manualItems;
    }

    const cleanName = customerName.trim();
    if (cleanName) args.p_customer_name = cleanName;
    const cleanPhone = customerPhone.trim();
    if (cleanPhone) args.p_customer_phone = cleanPhone;

    if (discountType !== "none") {
      const discVal = Number(discountValueInput);
      if (!discountValueInput.trim() || !Number.isFinite(discVal) || discVal <= 0) {
        return {
          error: "Enter a discount value greater than 0, or set discount to None.",
        };
      }
      if (discountType === "amount") {
        if (!hasAtMostDecimals(discVal, 2)) {
          return { error: "Discount amount can have at most 2 decimals." };
        }
        if (discVal > preview.subtotal) {
          return { error: "Discount amount cannot exceed the subtotal." };
        }
      } else if (discountType === "percent") {
        if (discVal > 100) {
          return { error: "Discount percent cannot exceed 100%." };
        }
      }
      args.p_discount_type = discountType;
      args.p_discount_value = discVal;
      const cleanNote = discountNote.trim();
      if (cleanNote) args.p_discount_note = cleanNote;
    }

    const scTrim = serviceChargeInput.trim();
    if (scTrim !== "") {
      const sc = Number(scTrim);
      if (!Number.isFinite(sc) || sc < 0 || sc > 30) {
        return { error: "Service charge % must be between 0 and 30." };
      }
      args.p_service_charge_pct = Math.round(sc * 100) / 100;
    }

    if (paymentMethod) {
      args.p_payment_method = paymentMethod;
    }

    return { args };
  };

  const loadIssuedBillDetails = useCallback(
    async (billId: string) => {
      setLoadingDone(true);
      setDoneError("");
      try {
        const [billRes, itemsRes] = await Promise.all([
          supabase
            .from("tapx_bills")
            .select(BILL_SELECT_COLUMNS)
            .eq("id", billId)
            .eq("business_id", business.id)
            .maybeSingle(),
          supabase
            .from("tapx_bill_items")
            .select(BILL_ITEM_SELECT_COLUMNS)
            .eq("bill_id", billId)
            .order("line_no", { ascending: true }),
        ]);

        if (billRes.error) {
          setDoneError(billRes.error.message || "Failed to load issued bill.");
          return;
        }
        if (itemsRes.error) {
          setDoneError(itemsRes.error.message || "Failed to load bill items.");
        }
        const loaded = (billRes.data || null) as TapxBill | null;
        setIssuedBill(loaded);
        setIssuedItems((itemsRes.data || []) as TapxBillItem[]);

        if (loaded && !messageEditedRef.current) {
          const origin =
            typeof window !== "undefined" ? window.location.origin : "";
          const publicUrl = loaded.share_token
            ? `${origin}/bill/${loaded.share_token}`
            : origin;
          setWhatsappMessage(
            buildCustomerBillMessage({
              customerName: loaded.customer_name,
              businessName: business.name,
              billNoText: loaded.bill_no_text,
              total: loaded.total,
              publicUrl,
            })
          );
        }
      } catch (err: any) {
        setDoneError(err?.message || "Failed to load issued bill.");
      } finally {
        setLoadingDone(false);
      }
    },
    [business.id, business.name]
  );

  const handleIssue = async (paymentMethod?: PaymentMethod) => {
    if (submittingRef.current || issuing) return;
    setErrorMsg("");

    const check = validateAndBuildArgs(paymentMethod);
    if ("error" in check) {
      setErrorMsg(check.error || "Please check your entries.");
      return;
    }

    submittingRef.current = true;
    setIssuing(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc(
        "create_tapx_bill",
        check.args
      );
      if (rpcErr) {
        setErrorMsg(rpcErr.message || "Failed to issue bill.");
        return;
      }

      const returnedId =
        data && typeof data === "object" && "id" in data
          ? String((data as any).id)
          : "";
      if (!returnedId) {
        setErrorMsg("Bill was issued, but the server did not return a bill ID.");
        return;
      }

      setIssuedBillId(returnedId);
      setStep("done");
      await Promise.all([
        loadIssuedBillDetails(returnedId),
        onBillMutated ? onBillMutated() : Promise.resolve(),
      ]);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to issue bill.");
    } finally {
      setIssuing(false);
      submittingRef.current = false;
    }
  };

  const handleDoneMarkPaid = async (method: PaymentMethod) => {
    if (!issuedBill) return;
    const { error: rpcErr } = await supabase.rpc("set_tapx_bill_payment", {
      p_bill_id: issuedBill.id,
      p_payment_status: "paid",
      p_method: method,
    });
    if (rpcErr) throw new Error(rpcErr.message || "Could not update payment status.");
    await Promise.all([
      loadIssuedBillDetails(issuedBill.id),
      onBillMutated ? onBillMutated() : Promise.resolve(),
    ]);
  };

  const handleDoneMarkUnpaid = async () => {
    if (!issuedBill) return;
    const { error: rpcErr } = await supabase.rpc("set_tapx_bill_payment", {
      p_bill_id: issuedBill.id,
      p_payment_status: "unpaid",
      p_method: null,
    });
    if (rpcErr) throw new Error(rpcErr.message || "Could not mark bill unpaid.");
    await Promise.all([
      loadIssuedBillDetails(issuedBill.id),
      onBillMutated ? onBillMutated() : Promise.resolve(),
    ]);
  };

  const handleDoneVoid = async (reason: string) => {
    if (!issuedBill) return;
    const { error: rpcErr } = await supabase.rpc("void_tapx_bill", {
      p_bill_id: issuedBill.id,
      p_reason: reason,
    });
    if (rpcErr) throw new Error(rpcErr.message || "Could not void bill.");
    await Promise.all([
      loadIssuedBillDetails(issuedBill.id),
      onBillMutated ? onBillMutated() : Promise.resolve(),
    ]);
  };

  // ======================== STEP 2: DONE SCREEN ========================
  if (step === "done") {
    const normalizedPhone = normalizeWhatsAppPhone(
      issuedBill?.customer_phone ?? customerPhone
    );
    const waHref = normalizedPhone
      ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(whatsappMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

    const handleCopyMessage = async () => {
      if (typeof navigator === "undefined" || !navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(whatsappMessage);
        setCopiedMessage(true);
        setTimeout(() => setCopiedMessage(false), 2200);
      } catch {
        // Ignore clipboard errors silently
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "40px" }}>
        {/* TOP NAVIGATION BAR */}
        <div
          className="tapx-bill-no-print"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "14px 18px",
          }}
        >
          <div>
            <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "#15803d" }}>
              BILL ISSUED
            </div>
            <h2 style={{ margin: "2px 0 0", fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
              {issuedBill?.bill_no_text || "Loading bill..."}
            </h2>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button
              type="button"
              onClick={() => void onDoneBack()}
              style={btnSecondaryStyle}
            >
              ← {returnLabel}
            </button>
            {issuedBillId && (
              <button
                type="button"
                onClick={() => void onViewInBills(issuedBillId)}
                style={btnPrimaryStyle}
              >
                View in Bills →
              </button>
            )}
          </div>
        </div>

        {doneError && (
          <div className="tapx-bill-no-print" style={errorBannerStyle}>
            ⚠️ {doneError}
          </div>
        )}

        {/* SEND TO CUSTOMER ON WHATSAPP PANEL */}
        {issuedBill && (
          <div
            className="tapx-bill-no-print"
            style={{
              background: "#ffffff",
              border: "1px solid #bbf7d0",
              borderRadius: "14px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                  Send to customer on WhatsApp
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  {normalizedPhone
                    ? `Sending directly to +${normalizedPhone}`
                    : "No usable customer phone — WhatsApp will let you choose a chat"}
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => void handleCopyMessage()}
                  style={btnSecondaryStyle}
                >
                  {copiedMessage ? "✓ Copied message" : "Copy message"}
                </button>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...btnWhatsAppStyle,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  Send on WhatsApp
                </a>
              </div>
            </div>

            <textarea
              rows={4}
              value={whatsappMessage}
              onChange={(e) => {
                messageEditedRef.current = true;
                setWhatsappMessage(e.target.value);
              }}
              aria-label="Customer WhatsApp message"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                lineHeight: 1.45,
                color: "#0f172a",
                background: "#f8fafc",
                boxSizing: "border-box",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>
        )}

        {/* BILL DOCUMENT PREVIEW & PRINT / PAY / VOID */}
        {loadingDone && !issuedBill ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "32px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "13.5px",
            }}
          >
            Loading bill document...
          </div>
        ) : issuedBill ? (
          <BillDocument
            mode="dashboard"
            data={toBillDocumentDataFromDashboard(
              issuedBill,
              issuedItems,
              business,
              activeSettings
            )}
            onMarkPaid={handleDoneMarkPaid}
            onMarkUnpaid={handleDoneMarkUnpaid}
            onVoid={handleDoneVoid}
          />
        ) : null}
      </div>
    );
  }

  // ======================== STEP 1: REVIEW SCREEN ========================
  const headerTitle =
    tableNumber !== null ? `Bill — Table ${tableNumber}` : "Bill — Order";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "110px" }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", color: "#64748b" }}>
            REVIEW ORDER BILL
          </div>
          <h2 style={{ margin: "2px 0 0", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
            {headerTitle}
          </h2>
        </div>

        <button
          type="button"
          disabled={issuing}
          onClick={onCancel}
          style={btnSecondaryStyle}
        >
          ← {returnLabel}
        </button>
      </div>

      {errorMsg && (
        <div role="alert" style={errorBannerStyle}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* ORDERS LIST */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <div>
            <h3 style={sectionTitleStyle}>
              Unbilled orders ({selectedOrderIds.length} of {eligibleOrders.length} selected)
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
              Select the orders to include. You can leave individual items off the bill if needed.
            </p>
          </div>
          {eligibleOrders.length > 1 && (
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setSelectedOrderIds(eligibleOrders.map((o) => o.id))}
                style={btnMiniStyle}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrderIds([])}
                style={btnMiniStyle}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {eligibleOrders.length === 0 ? (
          <div
            style={{
              padding: "18px",
              borderRadius: "10px",
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              textAlign: "center",
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            No unbilled orders left on{" "}
            {tableNumber !== null ? `Table ${tableNumber}` : "this table"}. You can still add items below or go back.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {eligibleOrders.map((order) => {
              const checked = selectedOrderIds.includes(order.id);
              const items = itemsByOrder.get(order.id) || [];
              const chip = getOrderStatusChip(order.status);
              const label = formatOrderLabel(order, { showDayIfNotToday: true });
              const timeStr = formatBillTimeShort(order.created_at);
              const displayCustomer = (order.customer_name || "").trim();

              return (
                <div
                  key={order.id}
                  style={{
                    borderRadius: "12px",
                    border: checked ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                    background: checked ? "#ffffff" : "#f8fafc",
                    padding: "12px 14px",
                    opacity: checked ? 1 : 0.78,
                  }}
                >
                  {/* ORDER HEADER ROW */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        flex: "1 1 200px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOrderSelection(order.id)}
                        style={{ width: "18px", height: "18px", accentColor: "#2563eb", cursor: "pointer" }}
                      />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "14px", color: "#0f172a" }}>{label}</strong>
                          {timeStr && (
                            <span style={{ fontSize: "12px", color: "#64748b" }}>{timeStr}</span>
                          )}
                          {displayCustomer && (
                            <span style={{ fontSize: "12.5px", color: "#334155", fontWeight: 600 }}>
                              · {displayCustomer}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: "99px",
                          background: chip.bg,
                          color: chip.color,
                          border: `1px solid ${chip.border}`,
                        }}
                      >
                        {chip.label}
                      </span>
                      {order.payment_status === "paid" && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 9px",
                            borderRadius: "99px",
                            background: "#dcfce7",
                            color: "#166534",
                            border: "1px solid #bbf7d0",
                          }}
                        >
                          Paid
                          {formatPaymentMethodLabel(order.payment_method)
                            ? ` · ${formatPaymentMethodLabel(order.payment_method)}`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ORDER ITEMS */}
                  <div
                    style={{
                      marginTop: "10px",
                      borderTop: "1px solid #f1f5f9",
                      paddingTop: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {items.length === 0 ? (
                      <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                        Order total: {formatMoney(order.total ?? order.subtotal ?? 0)}
                      </div>
                    ) : (
                      items.map((item) => {
                        const isLeftOff = Boolean(excludedItemIds[item.id]);
                        const lineAmt = Number(
                          item.line_total ??
                            Number(item.unit_price || 0) * Number(item.quantity || 0)
                        );
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                              padding: "6px 8px",
                              borderRadius: "8px",
                              background: isLeftOff ? "#fef2f2" : "#f8fafc",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: isLeftOff ? "#94a3b8" : "#0f172a",
                                  textDecoration: isLeftOff ? "line-through" : "none",
                                }}
                              >
                                {item.item_name}
                              </div>
                              <div
                                style={{
                                  fontSize: "11.5px",
                                  color: isLeftOff ? "#94a3b8" : "#64748b",
                                  textDecoration: isLeftOff ? "line-through" : "none",
                                }}
                              >
                                {formatQuantity(item.quantity)} × {formatMoney(item.unit_price)}
                              </div>
                              {item.special_request && (
                                <div style={{ fontSize: "11px", color: "#b45309", marginTop: "2px" }}>
                                  Note: {item.special_request}
                                </div>
                              )}
                            </div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flexShrink: 0,
                              }}
                            >
                              <strong
                                style={{
                                  fontSize: "13px",
                                  color: isLeftOff ? "#94a3b8" : "#0f172a",
                                  textDecoration: isLeftOff ? "line-through" : "none",
                                }}
                              >
                                {formatMoney(lineAmt)}
                              </strong>
                              {checked && (
                                <button
                                  type="button"
                                  onClick={() => toggleExcludeOrderItem(order.id, item.id)}
                                  style={{
                                    padding: "4px 9px",
                                    borderRadius: "6px",
                                    border: isLeftOff
                                      ? "1px solid #cbd5e1"
                                      : "1px solid #fecaca",
                                    background: isLeftOff ? "#ffffff" : "#fff1f2",
                                    color: isLeftOff ? "#334155" : "#b91c1c",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {isLeftOff ? "Include" : "Leave off bill"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EXTRA ITEMS (OPTIONAL MANUAL OR MENU LINES) */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
            marginBottom: extraLines.length > 0 || showSavedPicker ? "12px" : 0,
          }}
        >
          <div>
            <h3 style={sectionTitleStyle}>Extra items (optional)</h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
              Add counter extras to this table&apos;s bill if needed.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {savedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSavedPicker((v) => !v)}
                style={btnSecondaryStyle}
              >
                {showSavedPicker ? "Hide menu" : "Pick from menu"}
              </button>
            )}
            <button
              type="button"
              onClick={handleAddBlankExtraLine}
              style={btnSecondaryStyle}
            >
              + Add item
            </button>
          </div>
        </div>

        {showSavedPicker && savedItems.length > 0 && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              borderRadius: "10px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <input
              type="text"
              placeholder="Search saved items..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: "8px" }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "150px", overflowY: "auto" }}>
              {filteredSavedItems.length === 0 ? (
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  No saved items match &ldquo;{itemSearch}&rdquo;.
                </span>
              ) : (
                filteredSavedItems.slice(0, 40).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePickSavedItem(item)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "99px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#0f172a",
                      cursor: "pointer",
                    }}
                  >
                    + {item.name} · {formatMoney(item.price)}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {extraLines.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {extraLines.map((line) => (
              <div
                key={line.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(140px, 2fr) minmax(80px, 1fr) minmax(70px, 0.8fr) auto",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  placeholder="Item name"
                  maxLength={120}
                  value={line.name}
                  onChange={(e) => updateExtraLine(line.key, { name: e.target.value })}
                  style={inputStyle}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price"
                  value={line.priceInput}
                  onChange={(e) => updateExtraLine(line.key, { priceInput: e.target.value })}
                  style={inputStyle}
                />
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="Qty"
                  value={line.qtyInput}
                  onChange={(e) => updateExtraLine(line.key, { qtyInput: e.target.value })}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => removeExtraLine(line.key)}
                  aria-label="Remove extra item"
                  style={{
                    border: "1px solid #fecaca",
                    background: "#fff1f2",
                    color: "#dc2626",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CUSTOMER + DISCOUNT + SERVICE CHARGE */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "14px",
        }}
      >
        {/* CUSTOMER */}
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitleStyle, marginBottom: "10px" }}>
            Customer details (optional)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input
              type="text"
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => {
                customerTouchedRef.current = true;
                setCustomerName(e.target.value);
              }}
              style={inputStyle}
            />
            <input
              type="tel"
              placeholder="Customer phone (for WhatsApp)"
              value={customerPhone}
              onChange={(e) => {
                customerTouchedRef.current = true;
                setCustomerPhone(e.target.value);
              }}
              style={inputStyle}
            />
          </div>
        </div>

        {/* DISCOUNT & SERVICE CHARGE */}
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitleStyle, marginBottom: "10px" }}>
            Discount &amp; Service Charge
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              {(
                [
                  { id: "none", label: "No discount" },
                  { id: "amount", label: "Amount" },
                  { id: "percent", label: "Percent %" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDiscountType(opt.id)}
                  style={{
                    flex: 1,
                    padding: "7px 8px",
                    borderRadius: "8px",
                    border:
                      discountType === opt.id
                        ? "1.5px solid #2563eb"
                        : "1px solid #cbd5e1",
                    background: discountType === opt.id ? "#eff6ff" : "#ffffff",
                    color: discountType === opt.id ? "#1d4ed8" : "#475569",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {discountType !== "none" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "8px" }}>
                <input
                  type="number"
                  step={discountType === "amount" ? "0.01" : "0.1"}
                  min="0"
                  placeholder={discountType === "amount" ? "Amount" : "%"}
                  value={discountValueInput}
                  onChange={(e) => setDiscountValueInput(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  maxLength={100}
                  value={discountNote}
                  onChange={(e) => setDiscountNote(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginTop: "4px" }}>
              Service charge % (0–30, optional)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="30"
              placeholder="None"
              value={serviceChargeInput}
              onChange={(e) => {
                serviceChargeTouchedRef.current = true;
                setServiceChargeInput(e.target.value);
              }}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* LIVE ESTIMATED PREVIEW + PAID STATUS HINT */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 800, color: "#64748b", letterSpacing: "0.08em" }}>
            ESTIMATED BREAKDOWN
          </span>
          {allOrdersMarkedPaid && (
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: "99px",
                background: "#dcfce7",
                color: "#166534",
                border: "1px solid #bbf7d0",
              }}
            >
              Marked paid on the order
              {preselectedOrderPayMethod
                ? ` (${formatPaymentMethodLabel(preselectedOrderPayMethod)})`
                : ""}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", color: "#334155" }}>
          <div style={summaryRowStyle}>
            <span>Subtotal</span>
            <span>{formatMoney(preview.subtotal)}</span>
          </div>
          {preview.discountAmount > 0 && (
            <div style={summaryRowStyle}>
              <span>Discount</span>
              <span>-{formatMoney(preview.discountAmount)}</span>
            </div>
          )}
          {preview.serviceCharge > 0 && (
            <div style={summaryRowStyle}>
              <span>Service charge</span>
              <span>{formatMoney(preview.serviceCharge)}</span>
            </div>
          )}
          {preview.roundOff !== 0 && (
            <div style={summaryRowStyle}>
              <span>Round off</span>
              <span>
                {preview.roundOff > 0 ? "+" : "-"}
                {formatMoney(Math.abs(preview.roundOff))}
              </span>
            </div>
          )}
          <div
            style={{
              ...summaryRowStyle,
              marginTop: "6px",
              paddingTop: "8px",
              borderTop: "1px solid #e2e8f0",
              fontSize: "15px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            <span>Estimated Total</span>
            <span>{formatMoney(preview.total)}</span>
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM BAR */}
      <div
        style={{
          position: "sticky",
          bottom: "10px",
          zIndex: 20,
          background: "#0f172a",
          color: "#ffffff",
          borderRadius: "14px",
          padding: "12px 16px",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.25)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
            Estimated total
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800 }}>
            {formatMoney(preview.total)}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            disabled={issuing}
            onClick={() => void handleIssue()}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#ffffff",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: issuing ? "not-allowed" : "pointer",
            }}
          >
            {issuing ? "Issuing..." : "Issue bill"}
          </button>

          {!showPaidChooser ? (
            <button
              type="button"
              disabled={issuing}
              onClick={() => setShowPaidChooser(true)}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
                background: "#16a34a",
                color: "#ffffff",
                fontSize: "13.5px",
                fontWeight: 800,
                cursor: issuing ? "not-allowed" : "pointer",
              }}
            >
              {allOrdersMarkedPaid && selectedPaidMethod
                ? `Issue & mark paid (${formatPaymentMethodLabel(selectedPaidMethod)})`
                : "Issue & mark paid"}
            </button>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
              {(
                [
                  { key: "cash", label: "Cash" },
                  { key: "upi", label: "UPI" },
                  { key: "card", label: "Card" },
                ] as const
              ).map((m) => {
                const isPreselected = selectedPaidMethod === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={issuing}
                    onClick={() => void handleIssue(m.key)}
                    style={{
                      padding: "9px 13px",
                      borderRadius: "8px",
                      border: isPreselected ? "2px solid #bbf7d0" : "none",
                      background: isPreselected ? "#15803d" : "#22c55e",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 800,
                      cursor: issuing ? "not-allowed" : "pointer",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={issuing}
                onClick={() => setShowPaidChooser(false)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  background: "transparent",
                  color: "#cbd5e1",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 800,
  color: "#0f172a",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "13px",
  color: "#0f172a",
  background: "#ffffff",
  boxSizing: "border-box",
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: "12px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
  fontSize: "13px",
  fontWeight: 700,
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnMiniStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: "7px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontSize: "11.5px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnWhatsAppStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#16a34a",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};
