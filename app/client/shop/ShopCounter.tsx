"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  BillingSettings,
  PaymentMethod,
  formatMoney,
  hasAtMostDecimals,
} from "../../lib/billing";
import {
  CatalogCategory,
  CatalogItem,
  CatalogSizeSet,
  CatalogUnit,
  composeCatalogLineName,
  formatPrice,
  friendlyCatalogError,
} from "../../lib/shopCatalog";

type Props = {
  businessId: string;
  billingSettings: BillingSettings;
  upiQrEnabled?: boolean;
  onCancel: () => void;
  onIssued: (billId: string, opts?: { collectUpi?: boolean }) => Promise<void> | void;
};

interface CartLine {
  key: string;
  itemId: string;
  categoryName: string;
  typeName: string;
  size: string | null;
  unit: CatalogUnit;
  composedName: string;
  priceInput: string;
  qtyInput: string;
}

type DiscountMode = "none" | "quick" | "custom" | "final_price";

interface QuickDiscountOption {
  type: "amount" | "percent";
  value: number;
  label: string;
}

const QUICK_DISCOUNT_OPTIONS: QuickDiscountOption[] = [
  { type: "amount", value: 50, label: "₹50" },
  { type: "amount", value: 100, label: "₹100" },
  { type: "percent", value: 5, label: "5%" },
  { type: "percent", value: 10, label: "10%" },
];

export default function ShopCounter({
  businessId,
  billingSettings,
  upiQrEnabled = false,
  onCancel,
  onIssued,
}: Props) {
  // Catalog state
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [sizeSets, setSizeSets] = useState<CatalogSizeSet[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  // Navigation & Search
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [openSizePickerItemId, setOpenSizePickerItemId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"picker" | "bill">("picker");

  // Cart / Bill State
  const [lines, setLines] = useState<CartLine[]>([]);
  const [recentLineKey, setRecentLineKey] = useState<string | null>(null);

  // Discount State
  const [discountMode, setDiscountMode] = useState<DiscountMode>("none");
  const [quickDiscount, setQuickDiscount] = useState<QuickDiscountOption | null>(null);
  const [customDiscountType, setCustomDiscountType] = useState<"amount" | "percent">("amount");
  const [customDiscountValue, setCustomDiscountValue] = useState("");
  const [finalPriceInput, setFinalPriceInput] = useState("");
  const [discountNote, setDiscountNote] = useState("");

  // Customer State
  const [showCustomer, setShowCustomer] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Submission State
  const [issuing, setIssuing] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittingRef = useRef(false);

  // Refs for focusing inputs
  const priceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);

  // Load catalog data
  const loadCatalog = useCallback(async () => {
    if (!businessId) return;
    const reqId = ++requestIdRef.current;
    setLoadingCatalog(true);
    setCatalogError("");

    try {
      const [catRes, itemRes, sizeRes] = await Promise.all([
        supabase
          .from("tapx_catalog_categories")
          .select("*")
          .eq("business_id", businessId)
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("tapx_catalog_items")
          .select("*")
          .eq("business_id", businessId)
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("tapx_catalog_size_sets")
          .select("*")
          .eq("business_id", businessId)
          .order("name", { ascending: true }),
      ]);

      if (reqId !== requestIdRef.current) return;

      if (catRes.error) throw catRes.error;
      if (itemRes.error) throw itemRes.error;
      if (sizeRes.error) throw sizeRes.error;

      const loadedCategories: CatalogCategory[] = catRes.data || [];
      const loadedItems: CatalogItem[] = itemRes.data || [];
      const loadedSizeSets: CatalogSizeSet[] = sizeRes.data || [];

      // Filter categories to only those having at least one active item
      const visibleCats = loadedCategories.filter((c) =>
        loadedItems.some((it) => it.category_id === c.id)
      );

      setCategories(visibleCats);
      setItems(loadedItems);
      setSizeSets(loadedSizeSets);

      if (visibleCats.length > 0) {
        setSelectedCategoryId(visibleCats[0].id);
      }
    } catch (err: any) {
      if (reqId !== requestIdRef.current) return;
      setCatalogError(friendlyCatalogError(err));
    } finally {
      if (reqId === requestIdRef.current) {
        setLoadingCatalog(false);
      }
    }
  }, [businessId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Autofocus search on fine pointer (mouse/trackpad) only
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
      searchInputRef.current?.focus();
    }
  }, []);

  // Quick lookup maps
  const categoryMap = useMemo(() => {
    const map = new Map<string, CatalogCategory>();
    for (const c of categories) {
      map.set(c.id, c);
    }
    return map;
  }, [categories]);

  const sizeSetMap = useMemo(() => {
    const map = new Map<string, CatalogSizeSet>();
    for (const s of sizeSets) {
      map.set(s.id, s);
    }
    return map;
  }, [sizeSets]);

  // Filtered items based on category or search
  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return items.filter((it) => {
        const itemName = it.name.toLowerCase();
        const catName = (categoryMap.get(it.category_id)?.name || "").toLowerCase();
        return itemName.includes(q) || catName.includes(q);
      });
    }
    if (!selectedCategoryId) return [];
    return items.filter((it) => it.category_id === selectedCategoryId);
  }, [items, searchQuery, selectedCategoryId, categoryMap]);

  // Handle back with confirmation
  const handleBack = () => {
    if (lines.length > 0) {
      const confirmDiscard = window.confirm("Discard this bill?");
      if (!confirmDiscard) return;
    }
    onCancel();
  };

  // Add line to cart
  const handleAddItem = (item: CatalogItem, size: string | null) => {
    setSubmitError("");
    const cat = categoryMap.get(item.category_id);
    const categoryName = cat ? cat.name : "";
    const composed = composeCatalogLineName(categoryName, item.name, size);
    const lineKey = `${item.id}-${size || "nosize"}`;

    setLines((prevLines) => {
      const existingIdx = prevLines.findIndex((l) => l.key === lineKey);
      if (existingIdx >= 0) {
        // Increment quantity on existing line
        const existing = prevLines[existingIdx];
        const isDecimal =
          existing.unit === "kg" || existing.unit === "g" || existing.unit === "litre";
        let nextQty = "1";
        if (isDecimal) {
          const currentVal = parseFloat(existing.qtyInput) || 0;
          nextQty = String(Number((currentVal + 1).toFixed(3)));
        } else {
          const currentVal = parseInt(existing.qtyInput, 10) || 0;
          nextQty = String(currentVal + 1);
        }

        const nextLines = [...prevLines];
        nextLines[existingIdx] = {
          ...existing,
          qtyInput: nextQty,
        };
        return nextLines;
      }

      // Add new line
      if (prevLines.length >= 100) {
        setSubmitError("Maximum 100 items are allowed per bill.");
        return prevLines;
      }

      const newLine: CartLine = {
        key: lineKey,
        itemId: item.id,
        categoryName,
        typeName: item.name,
        size,
        unit: item.unit,
        composedName: composed,
        priceInput: item.default_price !== null ? String(item.default_price) : "",
        qtyInput: "1",
      };

      // If price is missing, auto focus price input
      if (item.default_price === null) {
        setTimeout(() => {
          priceInputRefs.current[lineKey]?.focus();
        }, 60);
      }

      return [...prevLines, newLine];
    });

    // Provide visual feedback
    setRecentLineKey(lineKey);
    setTimeout(() => {
      setRecentLineKey((k) => (k === lineKey ? null : k));
    }, 800);
  };

  // Update line details
  const updateLinePrice = (key: string, value: string) => {
    setSubmitError("");
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, priceInput: value } : l))
    );
  };

  const updateLineQty = (key: string, value: string) => {
    setSubmitError("");
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qtyInput: value } : l))
    );
  };

  const adjustQtyStep = (key: string, delta: number) => {
    setSubmitError("");
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const isDecimal = l.unit === "kg" || l.unit === "g" || l.unit === "litre";
        if (isDecimal) {
          const currentVal = parseFloat(l.qtyInput) || 0;
          const nextVal = Math.max(0.001, Number((currentVal + delta).toFixed(3)));
          return { ...l, qtyInput: String(nextVal) };
        } else {
          const currentVal = parseInt(l.qtyInput, 10) || 0;
          const nextVal = Math.max(1, currentVal + delta);
          return { ...l, qtyInput: String(nextVal) };
        }
      })
    );
  };

  const removeLine = (key: string) => {
    setSubmitError("");
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  // Calculate live preview totals
  const preview = useMemo(() => {
    let subtotal = 0;
    for (const l of lines) {
      const p = parseFloat(l.priceInput);
      const q = parseFloat(l.qtyInput);
      if (!isNaN(p) && p >= 0 && !isNaN(q) && q > 0) {
        subtotal += p * q;
      }
    }
    subtotal = Math.round(subtotal * 100) / 100;

    let discountAmount = 0;
    let discountHint = "";

    if (discountMode === "quick" && quickDiscount) {
      if (quickDiscount.type === "amount") {
        discountAmount = Math.min(subtotal, quickDiscount.value);
      } else {
        discountAmount =
          Math.round(((subtotal * quickDiscount.value) / 100) * 100) / 100;
      }
    } else if (discountMode === "custom") {
      const val = parseFloat(customDiscountValue);
      if (!isNaN(val) && val > 0) {
        if (customDiscountType === "amount") {
          discountAmount = Math.min(subtotal, Math.round(val * 100) / 100);
        } else {
          const pct = Math.min(100, val);
          discountAmount = Math.round(((subtotal * pct) / 100) * 100) / 100;
        }
      }
    } else if (discountMode === "final_price") {
      const finalVal = parseFloat(finalPriceInput);
      if (!isNaN(finalVal)) {
        if (finalVal < 0) {
          discountHint = "Final price cannot be negative";
        } else if (finalVal >= subtotal) {
          discountHint = "Final price is not lower than the bill total";
        } else {
          discountAmount = Math.round((subtotal - finalVal) * 100) / 100;
          discountHint = `Discount ${formatMoney(discountAmount)} given`;
        }
      }
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const rawTotal = afterDiscount;
    const roundedTotal = billingSettings.round_off
      ? Math.round(rawTotal)
      : Math.round(rawTotal * 100) / 100;
    const roundOffDelta = Math.round((roundedTotal - rawTotal) * 100) / 100;

    return {
      subtotal,
      discountAmount,
      discountHint,
      roundOffDelta,
      estimatedTotal: roundedTotal,
    };
  }, [
    lines,
    discountMode,
    quickDiscount,
    customDiscountType,
    customDiscountValue,
    finalPriceInput,
    billingSettings.round_off,
  ]);

  // Validation logic
  const validateCart = (): { error?: string; args?: Record<string, any> } => {
    if (lines.length === 0) {
      return { error: "Add at least one item to create a bill." };
    }
    if (lines.length > 100) {
      return { error: "Maximum 100 items allowed per bill." };
    }

    const manualItems: Array<{
      name: string;
      unit_price: number;
      quantity: number;
    }> = [];

    let subtotalCheck = 0;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const trimmedName = l.composedName.trim();
      if (!trimmedName) {
        return { error: `Line ${i + 1}: Item name is required.` };
      }

      if (l.priceInput.trim() === "") {
        return { error: `Line ${i + 1} (${trimmedName}): Please enter a price.` };
      }

      const p = parseFloat(l.priceInput);
      if (isNaN(p) || p < 0 || !hasAtMostDecimals(p, 2)) {
        return {
          error: `Line ${i + 1} (${trimmedName}): Price must be 0 or more with at most 2 decimals.`,
        };
      }

      const q = parseFloat(l.qtyInput);
      if (isNaN(q) || q <= 0 || !hasAtMostDecimals(q, 3)) {
        return {
          error: `Line ${i + 1} (${trimmedName}): Quantity must be greater than 0 with at most 3 decimals.`,
        };
      }

      const isDecimalUnit =
        l.unit === "kg" || l.unit === "g" || l.unit === "litre";
      if (!isDecimalUnit && (!Number.isInteger(q) || q < 1)) {
        return {
          error: `Line ${i + 1} (${trimmedName}): Quantity must be a whole number of at least 1.`,
        };
      }

      const roundedPrice = Math.round(p * 100) / 100;
      const roundedQty = Number(q.toFixed(3));
      subtotalCheck += roundedPrice * roundedQty;

      manualItems.push({
        name: trimmedName.slice(0, 120),
        unit_price: roundedPrice,
        quantity: roundedQty,
      });
    }

    subtotalCheck = Math.round(subtotalCheck * 100) / 100;

    const args: Record<string, any> = {
      p_business_id: businessId,
      p_manual_items: manualItems,
    };

    if (customerName.trim()) {
      args.p_customer_name = customerName.trim();
    }

    if (customerPhone.trim()) {
      const digitsOnly = customerPhone.replace(/\D/g, "");
      if (digitsOnly.length > 15) {
        return { error: "Customer phone number cannot exceed 15 digits." };
      }
      args.p_customer_phone = customerPhone.trim();
    }

    // Apply active discount
    if (discountMode === "quick" && quickDiscount) {
      if (quickDiscount.type === "amount") {
        if (quickDiscount.value > subtotalCheck) {
          return { error: "Discount amount cannot exceed the bill total." };
        }
        args.p_discount_type = "amount";
        args.p_discount_value = quickDiscount.value;
      } else {
        args.p_discount_type = "percent";
        args.p_discount_value = quickDiscount.value;
      }
    } else if (discountMode === "custom") {
      const val = parseFloat(customDiscountValue);
      if (isNaN(val) || val <= 0) {
        return { error: "Please enter a valid discount greater than 0." };
      }
      if (customDiscountType === "amount") {
        if (!hasAtMostDecimals(val, 2)) {
          return { error: "Discount amount can have at most 2 decimals." };
        }
        if (val > subtotalCheck) {
          return { error: "Discount amount cannot exceed the bill total." };
        }
        args.p_discount_type = "amount";
        args.p_discount_value = Math.round(val * 100) / 100;
      } else {
        if (val > 100) {
          return { error: "Discount percent cannot exceed 100%." };
        }
        args.p_discount_type = "percent";
        args.p_discount_value = val;
      }
    } else if (discountMode === "final_price") {
      const finalVal = parseFloat(finalPriceInput);
      if (isNaN(finalVal) || finalVal < 0) {
        return { error: "Please enter a valid final price." };
      }
      if (finalVal >= subtotalCheck) {
        return { error: "Final price must be lower than the bill total to give a discount." };
      }
      const discAmt = Math.round((subtotalCheck - finalVal) * 100) / 100;
      args.p_discount_type = "amount";
      args.p_discount_value = discAmt;
    }

    if (discountMode !== "none" && discountNote.trim()) {
      args.p_discount_note = discountNote.trim().slice(0, 120);
    }

    return { args };
  };

  // Submit bill
  const handleIssueBill = async (paymentMethod?: PaymentMethod) => {
    if (submittingRef.current || issuing) return;
    setSubmitError("");

    const validation = validateCart();
    if (validation.error) {
      setSubmitError(validation.error);
      return;
    }

    const isUpiCollect = paymentMethod === "upi" && Boolean(upiQrEnabled);

    const payload = { ...validation.args };
    if (paymentMethod && !isUpiCollect) {
      payload.p_payment_method = paymentMethod;
    }

    submittingRef.current = true;
    setIssuing(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "create_tapx_bill",
        payload
      );

      if (rpcError) {
        setSubmitError(rpcError.message || "Failed to create bill. Please check inputs.");
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const billId = row?.id ? String(row.id) : "";
      if (!billId) {
        setSubmitError("Bill was created without an ID. Please check Bills list.");
        return;
      }

      await onIssued(billId, isUpiCollect ? { collectUpi: true } : undefined);
    } catch (err: any) {
      setSubmitError(err?.message || "An unexpected error occurred while creating the bill.");
    } finally {
      submittingRef.current = false;
      setIssuing(false);
    }
  };

  // Render loading skeleton
  if (loadingCatalog) {
    return (
      <div style={containerStyle}>
        <div style={loadingCardStyle}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🛍️</div>
          <strong style={{ fontSize: "16px", color: "#0f172a" }}>
            Loading counter catalog...
          </strong>
        </div>
      </div>
    );
  }

  // Render catalog error
  if (catalogError && categories.length === 0 && items.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "32px 20px" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚠️</div>
          <h2 style={{ fontSize: "18px", color: "#0f172a", margin: "0 0 8px" }}>
            Could not load catalog
          </h2>
          <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 18px" }}>
            {catalogError}
          </p>
          <button type="button" onClick={loadCatalog} style={btnPrimaryStyle}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty catalog state
  if (items.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px 20px", maxWidth: "500px", margin: "40px auto" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🛍️</div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>
            No products yet.
          </h2>
          <p style={{ color: "#64748b", fontSize: "14.5px", margin: "0 0 24px", lineHeight: 1.5 }}>
            Go to Products in the left menu and add what you sell.
          </p>
          <button type="button" onClick={onCancel} style={btnSecondaryStyle}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* TOP BAR */}
      <div style={topBarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={handleBack}
            style={backBtnStyle}
            title="Discard and go back"
          >
            ← Back
          </button>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            New bill
          </h1>
        </div>

        <div style={{ flex: "1 1 260px", maxWidth: "420px" }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search items by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={topSearchInputStyle}
          />
        </div>
      </div>

      {/* MOBILE TOGGLE HEADER (Phone only) */}
      <div className="counter-mobile-toggle" style={mobileToggleBarStyle}>
        <button
          type="button"
          onClick={() => setMobileView("picker")}
          style={{
            ...mobileToggleBtnStyle,
            background: mobileView === "picker" ? "#0f172a" : "#f1f5f9",
            color: mobileView === "picker" ? "#ffffff" : "#475569",
          }}
        >
          Items Catalog
        </button>
        <button
          type="button"
          onClick={() => setMobileView("bill")}
          style={{
            ...mobileToggleBtnStyle,
            background: mobileView === "bill" ? "#0f172a" : "#f1f5f9",
            color: mobileView === "bill" ? "#ffffff" : "#475569",
          }}
        >
          Bill ({lines.length}) • {formatMoney(preview.estimatedTotal)}
        </button>
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div style={mainLayoutGridStyle}>
        {/* LEFT COLUMN: ITEM PICKER */}
        <div
          className={`counter-picker-column ${
            mobileView === "picker" ? "mobile-show" : "mobile-hide"
          }`}
          style={{ flex: "1 1 58%", minWidth: 0 }}
        >
          {/* Category Chips (hidden while searching) */}
          {!searchQuery.trim() && (
            <div style={categoryChipsRowStyle}>
              {categories.map((c) => {
                const isSelected = selectedCategoryId === c.id;
                const count = items.filter((it) => it.category_id === c.id).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(c.id);
                      setOpenSizePickerItemId(null);
                    }}
                    style={{
                      ...categoryChipStyle,
                      background: isSelected ? "#0f172a" : "#ffffff",
                      color: isSelected ? "#ffffff" : "#0f172a",
                      borderColor: isSelected ? "#0f172a" : "#cbd5e1",
                    }}
                  >
                    <span>{c.name}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 6px",
                        borderRadius: "99px",
                        background: isSelected ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                        color: isSelected ? "#ffffff" : "#64748b",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Search Results Notification Banner */}
          {searchQuery.trim() && (
            <div style={searchBannerStyle}>
              <span>
                Found <strong>{displayedItems.length}</strong> matching "
                {searchQuery}"
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={clearSearchBtnStyle}
              >
                Clear
              </button>
            </div>
          )}

          {/* Types Cards Grid */}
          {displayedItems.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: "40px 16px", color: "#64748b" }}>
              No items found. Try another search.
            </div>
          ) : (
            <div style={itemsGridStyle}>
              {displayedItems.map((item) => {
                const sizeSet = item.size_set_id ? sizeSetMap.get(item.size_set_id) : null;
                const hasSizes = sizeSet && Array.isArray(sizeSet.sizes) && sizeSet.sizes.length > 0;
                const isSizePickerOpen = openSizePickerItemId === item.id;
                const catName = categoryMap.get(item.category_id)?.name || "";

                // Size preview label
                let sizePreviewText = "No sizes";
                if (hasSizes) {
                  const s = sizeSet!.sizes;
                  if (s.length === 1) {
                    sizePreviewText = `Size: ${s[0]}`;
                  } else {
                    sizePreviewText = `${s[0]} to ${s[s.length - 1]}`;
                  }
                }

                return (
                  <div key={item.id} style={itemCardWrapperStyle}>
                    <button
                      type="button"
                      onClick={() => {
                        if (hasSizes) {
                          setOpenSizePickerItemId((prev) => (prev === item.id ? null : item.id));
                        } else {
                          handleAddItem(item, null);
                        }
                      }}
                      style={itemCardBtnStyle}
                    >
                      {searchQuery.trim() && catName && (
                        <span style={itemCategoryBadgeStyle}>{catName}</span>
                      )}
                      <strong style={itemTitleStyle}>{item.name}</strong>

                      <div style={itemPriceLineStyle}>
                        {item.default_price !== null ? (
                          <span style={itemPriceTextStyle}>
                            {formatPrice(item.default_price)}
                          </span>
                        ) : (
                          <span style={itemUnpricedBadgeStyle}>
                            Set price at counter
                          </span>
                        )}
                      </div>

                      <div style={itemSizePreviewStyle}>
                        <span>{sizePreviewText}</span>
                        {item.unit && item.unit !== "piece" && (
                          <span>• per {item.unit}</span>
                        )}
                      </div>
                    </button>

                    {/* Inline Size Picker Sheet */}
                    {isSizePickerOpen && hasSizes && (
                      <div style={sizePickerContainerStyle}>
                        <div style={sizePickerHeaderStyle}>
                          <span>Select size for {item.name}:</span>
                          <button
                            type="button"
                            onClick={() => setOpenSizePickerItemId(null)}
                            style={sizePickerCloseBtnStyle}
                          >
                            ✕ Cancel
                          </button>
                        </div>
                        <div style={sizeButtonsWrapStyle}>
                          {sizeSet!.sizes.map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => {
                                handleAddItem(item, sz);
                                setOpenSizePickerItemId(null);
                              }}
                              style={sizeOptionBtnStyle}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: THE BILL */}
        <div
          className={`counter-bill-column ${
            mobileView === "bill" ? "mobile-show" : "mobile-hide"
          }`}
          style={{ flex: "1 1 42%", minWidth: 0 }}
        >
          <div style={billPanelCardStyle}>
            <div style={billHeaderStyle}>
              <div>
                <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                  Current Bill
                </strong>
                <span style={{ fontSize: "12.5px", color: "#64748b", marginLeft: "8px" }}>
                  ({lines.length} {lines.length === 1 ? "item" : "items"})
                </span>
              </div>
              {lines.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear all items from this bill?")) {
                      setLines([]);
                      setSubmitError("");
                    }
                  }}
                  style={clearBillBtnStyle}
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Error Message */}
            {submitError && <div style={errorBannerStyle}>{submitError}</div>}

            {/* Lines List */}
            {lines.length === 0 ? (
              <div style={emptyBillStateStyle}>
                <div style={{ fontSize: "28px", marginBottom: "6px" }}>🧾</div>
                <strong>Tap an item to start the bill.</strong>
              </div>
            ) : (
              <div style={billLinesScrollContainerStyle}>
                {lines.map((l) => {
                  const isRecent = recentLineKey === l.key;
                  const isMissingPrice = l.priceInput.trim() === "";
                  const pNum = parseFloat(l.priceInput) || 0;
                  const qNum = parseFloat(l.qtyInput) || 0;
                  const lineTotal = Math.round(pNum * qNum * 100) / 100;

                  return (
                    <div
                      key={l.key}
                      style={{
                        ...billLineRowStyle,
                        background: isRecent ? "#f0fdf4" : isMissingPrice ? "#fffbeb" : "#ffffff",
                        borderColor: isMissingPrice ? "#f59e0b" : "#e2e8f0",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "120px" }}>
                        <div style={billLineNameStyle}>{l.composedName}</div>
                        {isMissingPrice && (
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#b45309" }}>
                            ⚠️ Enter price
                          </div>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div style={qtyControlsWrapStyle}>
                        <button
                          type="button"
                          onClick={() => adjustQtyStep(l.key, -1)}
                          style={qtyStepBtnStyle}
                          title="Decrease quantity"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          step={l.unit === "kg" || l.unit === "g" || l.unit === "litre" ? "0.001" : "1"}
                          min={l.unit === "kg" || l.unit === "g" || l.unit === "litre" ? "0.001" : "1"}
                          value={l.qtyInput}
                          onChange={(e) => updateLineQty(l.key, e.target.value)}
                          style={qtyInputStyle}
                          title="Quantity"
                        />
                        <button
                          type="button"
                          onClick={() => adjustQtyStep(l.key, 1)}
                          style={qtyStepBtnStyle}
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      {/* Price Input */}
                      <div style={priceInputWrapStyle}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748b" }}>
                          ₹
                        </span>
                        <input
                          ref={(el) => {
                            priceInputRefs.current[l.key] = el;
                          }}
                          type="number"
                          step="0.01"
                          min="0"
                          max="10000000"
                          placeholder="0.00"
                          value={l.priceInput}
                          onChange={(e) => updateLinePrice(l.key, e.target.value)}
                          style={{
                            ...linePriceFieldStyle,
                            borderColor: isMissingPrice ? "#f59e0b" : "#cbd5e1",
                            background: isMissingPrice ? "#fffbeb" : "#ffffff",
                          }}
                          title="Unit price (editable)"
                        />
                      </div>

                      {/* Line Total */}
                      <div style={lineTotalTextStyle}>
                        {formatMoney(lineTotal)}
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        style={removeLineBtnStyle}
                        title="Remove line"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* DISCOUNT SECTION */}
            <div style={discountSectionStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>
                  Discount
                </strong>
                {discountMode !== "none" && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountMode("none");
                      setQuickDiscount(null);
                      setCustomDiscountValue("");
                      setFinalPriceInput("");
                    }}
                    style={removeDiscountBtnStyle}
                  >
                    Remove discount
                  </button>
                )}
              </div>

              {/* Quick Discount Buttons */}
              <div style={quickDiscountRowStyle}>
                {QUICK_DISCOUNT_OPTIONS.map((opt) => {
                  const isActive =
                    discountMode === "quick" &&
                    quickDiscount?.type === opt.type &&
                    quickDiscount?.value === opt.value;

                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setDiscountMode("none");
                          setQuickDiscount(null);
                        } else {
                          setDiscountMode("quick");
                          setQuickDiscount(opt);
                          setCustomDiscountValue("");
                          setFinalPriceInput("");
                        }
                      }}
                      style={{
                        ...quickDiscountBtnStyle,
                        background: isActive ? "#0f172a" : "#f1f5f9",
                        color: isActive ? "#ffffff" : "#1e293b",
                        borderColor: isActive ? "#0f172a" : "#cbd5e1",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Discount & Final Price Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                {/* Custom Discount */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
                      Custom
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomDiscountType((prev) => (prev === "amount" ? "percent" : "amount"))
                      }
                      style={discountTypeToggleBtnStyle}
                      title="Toggle between rupees and percent"
                    >
                      {customDiscountType === "amount" ? "₹ (Rupees)" : "% (Percent)"}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={customDiscountType === "amount" ? "Amount (₹)" : "Percent (%)"}
                    value={customDiscountValue}
                    onChange={(e) => {
                      setCustomDiscountValue(e.target.value);
                      if (e.target.value.trim()) {
                        setDiscountMode("custom");
                        setQuickDiscount(null);
                        setFinalPriceInput("");
                      } else {
                        setDiscountMode("none");
                      }
                    }}
                    style={discountInputFieldStyle}
                  />
                </div>

                {/* Final Price / Customer Pays */}
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
                    Customer pays (final)
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Agreed total (₹)"
                    value={finalPriceInput}
                    onChange={(e) => {
                      setFinalPriceInput(e.target.value);
                      if (e.target.value.trim()) {
                        setDiscountMode("final_price");
                        setQuickDiscount(null);
                        setCustomDiscountValue("");
                      } else {
                        setDiscountMode("none");
                      }
                    }}
                    style={discountInputFieldStyle}
                  />
                </div>
              </div>

              {/* Discount Hint / Message */}
              {preview.discountHint && (
                <div style={discountHintStyle}>{preview.discountHint}</div>
              )}

              {/* Optional Reason */}
              {discountMode !== "none" && (
                <div style={{ marginTop: "8px" }}>
                  <input
                    type="text"
                    maxLength={120}
                    placeholder="Reason (optional)"
                    value={discountNote}
                    onChange={(e) => setDiscountNote(e.target.value)}
                    style={discountNoteInputStyle}
                  />
                </div>
              )}
            </div>

            {/* CUSTOMER SECTION (Optional, Collapsed) */}
            <div style={customerSectionStyle}>
              <button
                type="button"
                onClick={() => setShowCustomer((prev) => !prev)}
                style={customerToggleBtnStyle}
              >
                <span>{showCustomer ? "▼ Customer details" : "+ Add customer (optional)"}</span>
                {customerName.trim() && (
                  <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 700 }}>
                    ✓ {customerName.trim()}
                  </span>
                )}
              </button>

              {showCustomer && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                  <div>
                    <label style={customerLabelStyle}>Customer Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      style={customerInputFieldStyle}
                    />
                  </div>

                  <div>
                    <label style={customerLabelStyle}>Mobile Number</label>
                    <input
                      type="tel"
                      maxLength={15}
                      placeholder="e.g. 9876543210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      style={customerInputFieldStyle}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* TOTALS PREVIEW */}
            <div style={totalsBoxStyle}>
              <div style={totalRowStyle}>
                <span style={{ color: "#64748b" }}>Subtotal</span>
                <strong>{formatMoney(preview.subtotal)}</strong>
              </div>

              {preview.discountAmount > 0 && (
                <div style={{ ...totalRowStyle, color: "#16a34a" }}>
                  <span>Discount</span>
                  <strong>- {formatMoney(preview.discountAmount)}</strong>
                </div>
              )}

              {billingSettings.round_off && preview.roundOffDelta !== 0 && (
                <div style={totalRowStyle}>
                  <span style={{ color: "#64748b" }}>Round off</span>
                  <span>
                    {preview.roundOffDelta > 0 ? "+" : ""}
                    {formatMoney(preview.roundOffDelta)}
                  </span>
                </div>
              )}

              <div style={grandTotalRowStyle}>
                <span>Total Amount</span>
                <span style={grandTotalValueStyle}>
                  {formatMoney(preview.estimatedTotal)}
                </span>
              </div>
            </div>

            {/* PAYMENT BUTTONS */}
            <div style={paymentActionBoxStyle}>
              <div style={paymentMethodsGridStyle}>
                <button
                  type="button"
                  disabled={lines.length === 0 || issuing}
                  onClick={() => handleIssueBill("cash")}
                  style={{
                    ...payMethodBtnStyle,
                    background: "#16a34a",
                    color: "#ffffff",
                    opacity: lines.length === 0 || issuing ? 0.5 : 1,
                  }}
                >
                  💵 Cash
                </button>

                <button
                  type="button"
                  disabled={lines.length === 0 || issuing}
                  onClick={() => handleIssueBill("upi")}
                  style={{
                    ...payMethodBtnStyle,
                    background: "#2563eb",
                    color: "#ffffff",
                    opacity: lines.length === 0 || issuing ? 0.5 : 1,
                  }}
                >
                  <span>📱 UPI</span>
                  {upiQrEnabled && (
                    <span style={{ fontSize: "10.5px", fontWeight: 500, opacity: 0.9 }}>
                      Shows a QR to scan
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={lines.length === 0 || issuing}
                  onClick={() => handleIssueBill("card")}
                  style={{
                    ...payMethodBtnStyle,
                    background: "#4f46e5",
                    color: "#ffffff",
                    opacity: lines.length === 0 || issuing ? 0.5 : 1,
                  }}
                >
                  💳 Card
                </button>
              </div>

              <button
                type="button"
                disabled={lines.length === 0 || issuing}
                onClick={() => handleIssueBill()}
                style={{
                  ...unpaidBtnStyle,
                  opacity: lines.length === 0 || issuing ? 0.5 : 1,
                }}
              >
                Save as unpaid
              </button>

              {issuing && (
                <div style={{ textAlign: "center", fontSize: "13px", color: "#64748b", fontWeight: 700 }}>
                  Creating bill...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM BAR (Phone only) */}
      <div className="counter-mobile-sticky-bar" style={mobileStickyBarStyle}>
        <div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            {lines.length} {lines.length === 1 ? "item" : "items"}
          </div>
          <strong style={{ fontSize: "17px", color: "#0f172a" }}>
            {formatMoney(preview.estimatedTotal)}
          </strong>
        </div>

        <button
          type="button"
          onClick={() =>
            setMobileView((prev) => (prev === "picker" ? "bill" : "picker"))
          }
          style={mobileReviewPayBtnStyle}
        >
          {mobileView === "picker"
            ? `Review & Pay (${lines.length}) →`
            : "← Back to items"}
        </button>
      </div>

      {/* RESPONSIVE STYLES */}
      <style>{`
        @media (max-width: 899px) {
          .counter-mobile-toggle {
            display: flex !important;
          }
          .counter-mobile-sticky-bar {
            display: flex !important;
          }
          .mobile-hide {
            display: none !important;
          }
          .mobile-show {
            display: block !important;
          }
        }
        @media (min-width: 900px) {
          .counter-mobile-toggle {
            display: none !important;
          }
          .counter-mobile-sticky-bar {
            display: none !important;
          }
          .mobile-hide {
            display: block !important;
          }
          .mobile-show {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   INLINE STYLES
========================================================= */

const containerStyle: React.CSSProperties = {
  padding: "16px",
  maxWidth: "1300px",
  margin: "0 auto",
  fontFamily: "inherit",
  overflowX: "hidden",
  paddingBottom: "80px",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "16px",
};

const loadingCardStyle: React.CSSProperties = {
  ...cardStyle,
  textAlign: "center",
  padding: "48px 20px",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "16px",
};

const backBtnStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#1e293b",
  borderRadius: "10px",
  padding: "8px 14px",
  fontSize: "13.5px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "44px",
};

const topSearchInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  fontSize: "14px",
  color: "#0f172a",
  outline: "none",
  minHeight: "44px",
};

const mobileToggleBarStyle: React.CSSProperties = {
  display: "none",
  gap: "8px",
  marginBottom: "12px",
};

const mobileToggleBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "44px",
};

const mainLayoutGridStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  alignItems: "flex-start",
};

const categoryChipsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  paddingBottom: "8px",
  marginBottom: "14px",
  flexWrap: "wrap",
};

const categoryChipStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "99px",
  padding: "8px 14px",
  fontSize: "13.5px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "44px",
  flexShrink: 0,
};

const searchBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  borderRadius: "10px",
  background: "#f1f5f9",
  color: "#334155",
  fontSize: "13px",
  marginBottom: "12px",
};

const clearSearchBtnStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#2563eb",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const itemsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: "12px",
};

const itemCardWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const itemCardBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  textAlign: "left",
  gap: "6px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  minHeight: "100px",
  transition: "border-color 0.15s ease",
};

const itemCategoryBadgeStyle: React.CSSProperties = {
  fontSize: "11px",
  padding: "2px 6px",
  borderRadius: "4px",
  background: "#f1f5f9",
  color: "#64748b",
  fontWeight: 600,
};

const itemTitleStyle: React.CSSProperties = {
  fontSize: "14.5px",
  color: "#0f172a",
  lineHeight: 1.3,
};

const itemPriceLineStyle: React.CSSProperties = {
  marginTop: "auto",
};

const itemPriceTextStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 800,
  color: "#0f172a",
};

const itemUnpricedBadgeStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: "6px",
  background: "#fffbeb",
  color: "#b45309",
  border: "1px solid #fde68a",
};

const itemSizePreviewStyle: React.CSSProperties = {
  fontSize: "11.5px",
  color: "#64748b",
  display: "flex",
  gap: "4px",
};

const sizePickerContainerStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "10px",
  background: "#f8fafc",
  border: "1px solid #cbd5e1",
};

const sizePickerHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "11.5px",
  fontWeight: 700,
  color: "#475569",
  marginBottom: "8px",
};

const sizePickerCloseBtnStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 700,
  cursor: "pointer",
};

const sizeButtonsWrapStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
};

const sizeOptionBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "8px",
  border: "1px solid #0f172a",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: "13px",
  cursor: "pointer",
  minHeight: "44px",
  minWidth: "48px",
};

const billPanelCardStyle: React.CSSProperties = {
  ...cardStyle,
  padding: "16px",
  position: "sticky",
  top: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const billHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingBottom: "10px",
  borderBottom: "1px solid #f1f5f9",
};

const clearBillBtnStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#dc2626",
  fontSize: "12.5px",
  fontWeight: 700,
  cursor: "pointer",
};

const emptyBillStateStyle: React.CSSProperties = {
  padding: "36px 16px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "13.5px",
};

const billLinesScrollContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  maxHeight: "320px",
  overflowY: "auto",
};

const billLineRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 10px",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  fontSize: "13px",
  transition: "background 0.3s ease",
};

const billLineNameStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#0f172a",
  lineHeight: 1.25,
};

const qtyControlsWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#ffffff",
  overflow: "hidden",
};

const qtyStepBtnStyle: React.CSSProperties = {
  border: 0,
  background: "#f1f5f9",
  color: "#0f172a",
  width: "28px",
  height: "36px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const qtyInputStyle: React.CSSProperties = {
  border: 0,
  width: "38px",
  textAlign: "center",
  fontSize: "13px",
  fontWeight: 700,
  color: "#0f172a",
  outline: "none",
};

const priceInputWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "2px",
};

const linePriceFieldStyle: React.CSSProperties = {
  width: "70px",
  padding: "6px 6px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "13px",
  fontWeight: 700,
  color: "#0f172a",
  outline: "none",
  textAlign: "right",
};

const lineTotalTextStyle: React.CSSProperties = {
  fontSize: "13.5px",
  fontWeight: 800,
  color: "#0f172a",
  minWidth: "64px",
  textAlign: "right",
};

const removeLineBtnStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#94a3b8",
  fontSize: "14px",
  cursor: "pointer",
  padding: "4px 6px",
};

const discountSectionStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: "10px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const removeDiscountBtnStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#dc2626",
  fontSize: "11.5px",
  fontWeight: 700,
  cursor: "pointer",
};

const quickDiscountRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "6px",
};

const quickDiscountBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 6px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "12.5px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "44px",
};

const discountTypeToggleBtnStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "4px",
  background: "#ffffff",
  fontSize: "10px",
  fontWeight: 700,
  padding: "2px 6px",
  cursor: "pointer",
};

const discountInputFieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "13px",
  color: "#0f172a",
  outline: "none",
  minHeight: "44px",
};

const discountHintStyle: React.CSSProperties = {
  fontSize: "11.5px",
  fontWeight: 700,
  color: "#166534",
  marginTop: "6px",
};

const discountNoteInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 10px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "12px",
  color: "#0f172a",
  outline: "none",
};

const customerSectionStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
};

const customerToggleBtnStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: 0,
  background: "transparent",
  fontSize: "13px",
  fontWeight: 700,
  color: "#334155",
  cursor: "pointer",
  padding: "4px 0",
};

const customerLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  color: "#64748b",
  marginBottom: "4px",
};

const customerInputFieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "13px",
  color: "#0f172a",
  outline: "none",
  minHeight: "44px",
};

const totalsBoxStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "10px 12px",
  borderRadius: "10px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  fontSize: "13.5px",
};

const totalRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const grandTotalRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderTop: "1px solid #e2e8f0",
  paddingTop: "8px",
  marginTop: "4px",
  fontSize: "15px",
  fontWeight: 800,
  color: "#0f172a",
};

const grandTotalValueStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 900,
  color: "#0f172a",
};

const paymentActionBoxStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const paymentMethodsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "8px",
};

const payMethodBtnStyle: React.CSSProperties = {
  border: 0,
  borderRadius: "10px",
  padding: "12px 6px",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
  minHeight: "48px",
  display: "grid",
  placeItems: "center",
};

const unpaidBtnStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  background: "transparent",
  color: "#64748b",
  borderRadius: "8px",
  padding: "10px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "44px",
};

const mobileStickyBarStyle: React.CSSProperties = {
  display: "none",
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  padding: "12px 16px",
  background: "#ffffff",
  borderTop: "1px solid #cbd5e1",
  boxShadow: "0 -4px 12px rgba(0,0,0,0.08)",
  alignItems: "center",
  justifyContent: "space-between",
  zIndex: 100,
};

const mobileReviewPayBtnStyle: React.CSSProperties = {
  border: 0,
  background: "#0f172a",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "10px 18px",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
  minHeight: "44px",
};

const btnPrimaryStyle: React.CSSProperties = {
  border: 0,
  background: "#0f172a",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "10px 16px",
  fontSize: "13.5px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "44px",
};

const btnSecondaryStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#1e293b",
  borderRadius: "10px",
  padding: "9px 14px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "44px",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: "8px",
  fontSize: "12.5px",
  fontWeight: 600,
};
