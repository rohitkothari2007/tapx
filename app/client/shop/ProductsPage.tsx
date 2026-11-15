"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  ApplyTemplateResult,
  CATALOG_UNITS,
  CatalogCategory,
  CatalogItem,
  CatalogSizeSet,
  CatalogTemplate,
  CatalogUnit,
  composeCatalogLineName,
  formatPrice,
  friendlyCatalogError,
} from "../../lib/shopCatalog";

type Props = {
  businessId: string;
};

export default function ProductsPage({ businessId }: Props) {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [sizeSets, setSizeSets] = useState<CatalogSizeSet[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [templates, setTemplates] = useState<CatalogTemplate[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [noticeMsg, setNoticeMsg] = useState("");

  const [startEmptyChosen, setStartEmptyChosen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [shopReadyExpanded, setShopReadyExpanded] = useState(false);
  const selectedCatChipRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (selectedCatChipRef.current) {
      selectedCatChipRef.current.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [selectedCategoryId]);

  // Modals state
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<CatalogItem | null>(null);

  const [showSizesModal, setShowSizesModal] = useState(false);
  const [editingSizeSet, setEditingSizeSet] = useState<CatalogSizeSet | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CatalogCategory | null>(null);

  // Busy/saving flags
  const [actionBusy, setActionBusy] = useState(false);

  // Inline price editing state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");
  const [priceStatus, setPriceStatus] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [priceError, setPriceError] = useState<Record<string, string>>({});
  const priceInputRef = useRef<HTMLInputElement | null>(null);
  const isMovingToNextRef = useRef(false);

  // Request race condition guard
  const requestIdRef = useRef(0);

  const loadCatalog = useCallback(async () => {
    if (!businessId) return;
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setErrorMsg("");

    try {
      const [catRes, sizeRes, itemRes, tplRes] = await Promise.all([
        supabase
          .from("tapx_catalog_categories")
          .select("*")
          .eq("business_id", businessId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("tapx_catalog_size_sets")
          .select("*")
          .eq("business_id", businessId)
          .order("name", { ascending: true }),
        supabase
          .from("tapx_catalog_items")
          .select("*")
          .eq("business_id", businessId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("tapx_catalog_templates")
          .select("key, name, description, data")
          .order("name", { ascending: true }),
      ]);

      if (reqId !== requestIdRef.current) return;

      if (catRes.error) throw catRes.error;
      if (sizeRes.error) throw sizeRes.error;
      if (itemRes.error) throw itemRes.error;
      // tplRes may fail if table doesn't have templates or user not admin, but handle gracefully
      const fetchedTemplates: CatalogTemplate[] = tplRes.data || [];

      const fetchedCategories: CatalogCategory[] = catRes.data || [];
      const fetchedSizeSets: CatalogSizeSet[] = sizeRes.data || [];
      const fetchedItems: CatalogItem[] = itemRes.data || [];

      setCategories(fetchedCategories);
      setSizeSets(fetchedSizeSets);
      setItems(fetchedItems);
      setTemplates(fetchedTemplates);

      // Select first category if none selected or selected was removed
      setSelectedCategoryId((prev) => {
        if (prev && fetchedCategories.some((c) => c.id === prev)) {
          return prev;
        }
        return fetchedCategories[0]?.id || null;
      });
    } catch (err: any) {
      if (reqId !== requestIdRef.current) return;
      console.error("Error loading catalog:", err);
      setErrorMsg(friendlyCatalogError(err));
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [businessId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Notice auto-dismiss
  useEffect(() => {
    if (!noticeMsg) return;
    const t = setTimeout(() => setNoticeMsg(""), 6000);
    return () => clearTimeout(t);
  }, [noticeMsg]);

  // Template application
  const handleApplyTemplate = async (templateKey: string) => {
    if (actionBusy) return;
    setActionBusy(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase.rpc("tapx_catalog_apply_template", {
        p_business_id: businessId,
        p_template_key: templateKey,
      });

      if (error) throw error;

      const result = (data as ApplyTemplateResult) || {};
      const catCount = result.categories ?? 0;
      const itemCount = result.items ?? 0;

      setNoticeMsg(
        `Added ${catCount} categories and ${itemCount} types. Now set the prices.`
      );
      await loadCatalog();
    } catch (err: any) {
      console.error("Apply template error:", err);
      setErrorMsg(friendlyCatalogError(err));
    } finally {
      setActionBusy(false);
    }
  };

  // Check if catalog is completely empty
  const isCatalogEmpty =
    !loading &&
    categories.length === 0 &&
    items.length === 0 &&
    sizeSets.length === 0;

  // Selected category and items
  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || categories[0] || null;
  }, [categories, selectedCategoryId]);

  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return items.filter((it) => it.name.toLowerCase().includes(q));
    }
    if (!selectedCategory) return [];
    return items.filter((it) => it.category_id === selectedCategory.id);
  }, [items, searchQuery, selectedCategory]);

  const unpricedInCurrentCategory = useMemo(() => {
    if (searchQuery.trim()) {
      return displayedItems.filter((it) => it.default_price === null);
    }
    if (!selectedCategory) return [];
    return items.filter(
      (it) => it.category_id === selectedCategory.id && it.default_price === null
    );
  }, [displayedItems, items, searchQuery, selectedCategory]);

  // Progress metrics
  const totalTypesCount = items.length;
  const pricedTypesCount = items.filter((it) => it.default_price !== null).length;
  const step1Done = totalTypesCount > 0;
  const step2Done = totalTypesCount > 0 && pricedTypesCount === totalTypesCount;
  const showProgressCard = !(step1Done && step2Done);

  // Category counts map
  const categoryItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) {
      counts[it.category_id] = (counts[it.category_id] || 0) + 1;
    }
    return counts;
  }, [items]);

  // Size set map
  const sizeSetMap = useMemo(() => {
    const map = new Map<string, CatalogSizeSet>();
    for (const s of sizeSets) {
      map.set(s.id, s);
    }
    return map;
  }, [sizeSets]);

  // Category map
  const categoryMap = useMemo(() => {
    const map = new Map<string, CatalogCategory>();
    for (const c of categories) {
      map.set(c.id, c);
    }
    return map;
  }, [categories]);

  // Price inline editing
  const startEditingPrice = (item: CatalogItem) => {
    isMovingToNextRef.current = false;
    setEditingPriceId(item.id);
    setEditingPriceValue(item.default_price !== null ? String(item.default_price) : "");
    // focus input on next frame
    setTimeout(() => {
      if (priceInputRef.current) {
        priceInputRef.current.focus();
        priceInputRef.current.select();
      }
    }, 20);
  };

  const cancelEditingPrice = () => {
    isMovingToNextRef.current = false;
    setEditingPriceId(null);
    setEditingPriceValue("");
  };

  const savePrice = async (item: CatalogItem, rawVal: string): Promise<boolean> => {
    const trimmed = rawVal.trim();
    let numVal: number | null = null;

    if (trimmed !== "") {
      const parsed = parseFloat(trimmed);
      if (isNaN(parsed) || parsed < 0 || parsed > 10000000) {
        setPriceError((prev) => ({
          ...prev,
          [item.id]: "Price must be between 0 and 10,000,000.",
        }));
        return false;
      }
      numVal = Math.round(parsed * 100) / 100;
    }

    // Only update if changed
    if (numVal === item.default_price) {
      return true;
    }

    setPriceStatus((prev) => ({ ...prev, [item.id]: "saving" }));
    setPriceError((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });

    try {
      const { error } = await supabase
        .from("tapx_catalog_items")
        .update({ default_price: numVal })
        .eq("id", item.id);

      if (error) throw error;

      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, default_price: numVal } : it))
      );
      setPriceStatus((prev) => ({ ...prev, [item.id]: "saved" }));
      setTimeout(() => {
        setPriceStatus((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }, 2000);
      return true;
    } catch (err: any) {
      console.error("Error saving price:", err);
      setPriceStatus((prev) => ({ ...prev, [item.id]: "error" }));
      setPriceError((prev) => ({ ...prev, [item.id]: friendlyCatalogError(err) }));
      return false;
    }
  };

  const savePriceOnBlur = async (item: CatalogItem) => {
    if (isMovingToNextRef.current) return;
    const ok = await savePrice(item, editingPriceValue);
    if (ok) {
      setEditingPriceId(null);
    }
  };

  const savePriceAndNext = async (item: CatalogItem, currentIndex: number) => {
    isMovingToNextRef.current = true;
    const ok = await savePrice(item, editingPriceValue);

    if (ok) {
      const nextItem = displayedItems[currentIndex + 1];
      if (nextItem) {
        setEditingPriceId(nextItem.id);
        setEditingPriceValue(
          nextItem.default_price !== null ? String(nextItem.default_price) : ""
        );
        setTimeout(() => {
          if (priceInputRef.current) {
            priceInputRef.current.focus();
            priceInputRef.current.select();
          }
          isMovingToNextRef.current = false;
        }, 30);
      } else {
        setEditingPriceId(null);
        isMovingToNextRef.current = false;
      }
    } else {
      isMovingToNextRef.current = false;
    }
  };

  // Helper to focus first empty price field
  const handleFocusFirstEmptyPrice = () => {
    if (unpricedInCurrentCategory.length === 0) return;
    startEditingPrice(unpricedInCurrentCategory[0]);
  };

  // Toggle type active
  const handleToggleTypeActive = async (item: CatalogItem) => {
    const nextActive = !item.active;
    try {
      const { error } = await supabase
        .from("tapx_catalog_items")
        .update({ active: nextActive })
        .eq("id", item.id);

      if (error) throw error;

      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, active: nextActive } : it))
      );
    } catch (err: any) {
      console.error("Toggle active error:", err);
      setErrorMsg(friendlyCatalogError(err));
    }
  };

  // Duplicate type
  const handleDuplicateType = async (item: CatalogItem) => {
    if (actionBusy) return;
    setActionBusy(true);
    setErrorMsg("");

    try {
      const catItems = items.filter((it) => it.category_id === item.category_id);
      const existingNames = new Set(
        catItems.map((it) => it.name.trim().toLowerCase())
      );

      const baseName = item.name.trim();
      let newName = `${baseName} (copy)`.slice(0, 120);

      if (existingNames.has(newName.toLowerCase())) {
        let counter = 2;
        while (true) {
          const candidate = `${baseName} (copy ${counter})`.slice(0, 120);
          if (!existingNames.has(candidate.toLowerCase())) {
            newName = candidate;
            break;
          }
          counter++;
        }
      }

      const nextOrder =
        catItems.reduce((max, it) => Math.max(max, it.sort_order), 0) + 1;

      const { data, error } = await supabase
        .from("tapx_catalog_items")
        .insert({
          business_id: businessId,
          category_id: item.category_id,
          name: newName,
          default_price: item.default_price,
          mrp: item.mrp,
          cost_price: item.cost_price,
          unit: item.unit,
          size_set_id: item.size_set_id,
          track_stock: false,
          image_url: null,
          sort_order: nextOrder,
          active: item.active,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setItems((prev) => [...prev, data as CatalogItem]);
        setNoticeMsg(`Duplicated "${item.name}" as "${newName}".`);
      }
    } catch (err: any) {
      console.error("Duplicate error:", err);
      setErrorMsg(friendlyCatalogError(err));
    } finally {
      setActionBusy(false);
    }
  };

  // Delete type
  const handleDeleteType = async (item: CatalogItem) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    if (actionBusy) return;
    setActionBusy(true);
    setErrorMsg("");

    try {
      const { error } = await supabase
        .from("tapx_catalog_items")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      setItems((prev) => prev.filter((it) => it.id !== item.id));
      setNoticeMsg(`Deleted "${item.name}".`);
    } catch (err: any) {
      console.error("Delete type error:", err);
      setErrorMsg(friendlyCatalogError(err));
    } finally {
      setActionBusy(false);
    }
  };

  // Category Actions
  const handleToggleCategoryActive = async (category: CatalogCategory) => {
    const nextActive = !category.active;
    try {
      const { error } = await supabase
        .from("tapx_catalog_categories")
        .update({ active: nextActive })
        .eq("id", category.id);

      if (error) throw error;

      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, active: nextActive } : c))
      );
    } catch (err: any) {
      console.error("Toggle category active error:", err);
      setErrorMsg(friendlyCatalogError(err));
    }
  };

  const handleMoveCategory = async (
    category: CatalogCategory,
    direction: "up" | "down"
  ) => {
    const sorted = [...categories].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );
    const index = sorted.findIndex((c) => c.id === category.id);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const neighbor = sorted[targetIndex];
    let newCurrentOrder = neighbor.sort_order;
    let newNeighborOrder = category.sort_order;

    if (newCurrentOrder === newNeighborOrder) {
      newCurrentOrder = direction === "up" ? newNeighborOrder - 1 : newNeighborOrder + 1;
    }

    try {
      const [res1, res2] = await Promise.all([
        supabase
          .from("tapx_catalog_categories")
          .update({ sort_order: newCurrentOrder })
          .eq("id", category.id),
        supabase
          .from("tapx_catalog_categories")
          .update({ sort_order: newNeighborOrder })
          .eq("id", neighbor.id),
      ]);

      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;

      setCategories((prev) =>
        prev.map((c) => {
          if (c.id === category.id) return { ...c, sort_order: newCurrentOrder };
          if (c.id === neighbor.id) return { ...c, sort_order: newNeighborOrder };
          return c;
        })
      );
    } catch (err: any) {
      console.error("Move category error:", err);
      setErrorMsg(friendlyCatalogError(err));
    }
  };

  const handleDeleteCategory = async (category: CatalogCategory) => {
    const count = categoryItemCounts[category.id] || 0;
    if (count > 0) {
      setErrorMsg("This category still has types. Hide it instead.");
      return;
    }

    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    if (actionBusy) return;
    setActionBusy(true);
    setErrorMsg("");

    try {
      const { error } = await supabase
        .from("tapx_catalog_categories")
        .delete()
        .eq("id", category.id);

      if (error) throw error;

      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      setSelectedCategoryId((prev) => {
        if (prev === category.id) {
          const remaining = categories.filter((c) => c.id !== category.id);
          return remaining[0]?.id || null;
        }
        return prev;
      });
      setNoticeMsg(`Deleted category "${category.name}".`);
    } catch (err: any) {
      console.error("Delete category error:", err);
      setErrorMsg(friendlyCatalogError(err));
    } finally {
      setActionBusy(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={loadingCardStyle}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🛍️</div>
          <strong style={{ fontSize: "16px", color: "#0f172a" }}>
            Loading shop catalog...
          </strong>
        </div>
      </div>
    );
  }

  // Render initial error state with retry
  if (errorMsg && categories.length === 0 && items.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "32px 20px" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚠️</div>
          <h2 style={{ fontSize: "18px", color: "#0f172a", margin: "0 0 8px" }}>
            Could not load products
          </h2>
          <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 18px" }}>
            {errorMsg}
          </p>
          <button
            type="button"
            onClick={loadCatalog}
            style={btnPrimaryStyle}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render empty catalog screen
  if (isCatalogEmpty && !startEmptyChosen) {
    return (
      <div style={containerStyle}>
        <div style={{ maxWidth: "680px", margin: "0 auto", padding: "20px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <span style={{ fontSize: "36px" }}>🛍️</span>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "#0f172a",
                margin: "12px 0 6px",
              }}
            >
              Set up what you sell
            </h1>
            <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
              Choose a starter template or start from scratch. You can change everything anytime.
            </p>
          </div>

          {errorMsg && (
            <div style={errorBannerStyle}>{errorMsg}</div>
          )}

          <div style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
            {templates.map((tpl) => (
              <div
                key={tpl.key}
                style={{
                  ...cardStyle,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "16px",
                  padding: "20px",
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: "17px",
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: "0 0 6px",
                    }}
                  >
                    {tpl.name}
                  </h3>
                  <p
                    style={{
                      fontSize: "13.5px",
                      color: "#475569",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {tpl.description}
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleApplyTemplate(tpl.key)}
                    style={{
                      ...btnPrimaryStyle,
                      width: "100%",
                      opacity: actionBusy ? 0.6 : 1,
                    }}
                  >
                    {actionBusy ? "Setting up..." : "Use this to start"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", paddingTop: "8px" }}>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setStartEmptyChosen(true)}
              style={{
                ...btnSecondaryStyle,
                background: "transparent",
                borderColor: "#cbd5e1",
                padding: "10px 20px",
              }}
            >
              Start empty
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isShopReady = step1Done && step2Done;

  // Normal screen
  return (
    <div className="products-page-root" style={containerStyle}>
      <style>{`
        @media (max-width: 899px) {
          .products-page-root input,
          .products-page-root select,
          .products-page-root textarea {
            font-size: 16px !important;
          }
          .products-page-root .catalog-desktop-sidebar {
            display: none !important;
          }
          .products-page-root .catalog-mobile-chips {
            display: flex !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            padding-bottom: 8px !important;
            margin-bottom: 12px !important;
          }
          .products-page-root .catalog-mobile-chips::-webkit-scrollbar {
            display: none !important;
          }
          .products-page-root .catalog-layout-grid {
            display: block !important;
          }
          .products-page-root .catalog-top-toolbar {
            width: 100% !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          .products-page-root .catalog-add-type-btn {
            width: 100% !important;
            order: -1 !important;
            min-height: 44px !important;
          }
          .products-page-root .catalog-category-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .products-page-root .catalog-category-actions {
            width: 100% !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          .products-page-root .catalog-category-actions button {
            min-height: 40px !important;
            padding: 8px 12px !important;
          }
          .products-page-root .catalog-type-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .products-page-root .catalog-type-line1 {
            width: 100% !important;
            flex: 0 0 auto !important;
            min-width: 0 !important;
            height: auto !important;
          }
          .products-page-root .catalog-type-line2 {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .products-page-root .catalog-type-price-wrap {
            min-width: 0 !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
          }
          .products-page-root .catalog-price-badge {
            min-height: 44px !important;
            display: inline-flex !important;
            align-items: center !important;
          }
          .products-page-root .catalog-type-actions-wrap {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-wrap: wrap !important;
          }
          .products-page-root .catalog-type-actions-wrap button:not(.catalog-active-switch) {
            min-height: 40px !important;
          }
          .products-page-root .catalog-active-switch {
            min-height: 0 !important;
            height: 22px !important;
            width: 40px !important;
            flex-shrink: 0 !important;
            position: relative !important;
          }
          .products-page-root .catalog-active-switch::after {
            content: "" !important;
            position: absolute !important;
            top: -9px !important;
            bottom: -9px !important;
            left: -4px !important;
            right: -4px !important;
          }
          .products-page-root .products-progress-card {
            padding: 12px !important;
          }
        }

        @media (min-width: 900px) {
          .products-page-root .catalog-mobile-chips {
            display: none !important;
          }
          .products-page-root .catalog-desktop-sidebar {
            display: block !important;
          }
          .products-page-root .catalog-type-row {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 12px !important;
          }
          .products-page-root .catalog-type-line1 {
            flex: 1 1 200px !important;
            min-width: 160px !important;
          }
          .products-page-root .catalog-type-line2 {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            flex-shrink: 0 !important;
          }
        }
      `}</style>

      {/* Notifications */}
      {noticeMsg && <div style={noticeBannerStyle}>{noticeMsg}</div>}
      {errorMsg && <div style={errorBannerStyle}>{errorMsg}</div>}

      {/* Progress Card */}
      {isShopReady && !shopReadyExpanded ? (
        <div
          className="products-shop-ready-pill"
          onClick={() => setShopReadyExpanded(true)}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: "13px",
            fontWeight: 700,
            marginBottom: "16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>✓ Shop is ready</span>
          <span style={{ fontSize: "12px", color: "#15803d", fontWeight: 600 }}>Show details ▾</span>
        </div>
      ) : (
        <div className="products-progress-card" style={progressCardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>🚀</span>
              <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                Get your shop ready
              </strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>
                {step1Done && step2Done
                  ? "2 of 2 ready"
                  : step1Done
                  ? "1 of 2 ready"
                  : "0 of 2 ready"}
              </span>
              {isShopReady && (
                <button
                  type="button"
                  onClick={() => setShopReadyExpanded(false)}
                  style={{
                    border: 0,
                    background: "transparent",
                    fontSize: "12px",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: "2px 4px",
                  }}
                  title="Collapse"
                >
                  ▲
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
            }}
          >
            <div
              style={{
                ...progressStepStyle,
                background: step1Done ? "#f0fdf4" : "#ffffff",
                borderColor: step1Done ? "#bbf7d0" : "#e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "14px" }}>{step1Done ? "✓" : "1"}</span>
                <strong
                  style={{
                    fontSize: "13.5px",
                    color: step1Done ? "#166534" : "#0f172a",
                  }}
                >
                  Add what you sell
                </strong>
              </div>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                {step1Done
                  ? `${totalTypesCount} items in catalog`
                  : "Add at least one item"}
              </span>
            </div>

            <div
              style={{
                ...progressStepStyle,
                background: step2Done ? "#f0fdf4" : "#ffffff",
                borderColor: step2Done ? "#bbf7d0" : "#e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "14px" }}>{step2Done ? "✓" : "2"}</span>
                <strong
                  style={{
                    fontSize: "13.5px",
                    color: step2Done ? "#166534" : "#0f172a",
                  }}
                >
                  Set prices
                </strong>
              </div>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                {step2Done
                  ? "All prices set"
                  : `${pricedTypesCount} of ${totalTypesCount} done`}
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: "10px",
              fontSize: "12.5px",
              color: "#64748b",
              paddingTop: "8px",
              borderTop: "1px dashed #e2e8f0",
            }}
          >
            Next: make a test bill from the Bills page.
          </div>
        </div>
      )}

      {/* Top Bar with Search & Action Buttons */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: "220px" }}>
          <input
            type="text"
            placeholder="Search products across all categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        <div className="catalog-top-toolbar" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowSizesModal(true)}
            style={btnSecondaryStyle}
            title="Manage size sets"
          >
            📏 Sizes ({sizeSets.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingCategory(null);
              setShowCategoryModal(true);
            }}
            style={btnSecondaryStyle}
            title="Add a new category"
          >
            + Add category
          </button>

          <button
            type="button"
            className="catalog-add-type-btn"
            onClick={() => {
              if (categories.length === 0) {
                setEditingCategory(null);
                setShowCategoryModal(true);
                return;
              }
              setEditingType(null);
              setShowTypeModal(true);
            }}
            style={btnPrimaryStyle}
            title="Add a new type"
          >
            + Add type
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      {categories.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px 20px" }}>
          <span style={{ fontSize: "32px" }}>📂</span>
          <h3 style={{ fontSize: "17px", color: "#0f172a", margin: "12px 0 6px" }}>
            No categories yet
          </h3>
          <p style={{ color: "#64748b", fontSize: "13.5px", margin: "0 0 16px" }}>
            Start by creating a category for your products (e.g. Shirts, Bread, Beverages).
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingCategory(null);
              setShowCategoryModal(true);
            }}
            style={btnPrimaryStyle}
          >
            + Add category
          </button>
        </div>
      ) : (
        <div>
          {/* Mobile Category Chip Row */}
          {!searchQuery && (
            <div className="catalog-mobile-chips" style={mobileChipRowStyle}>
              {categories.map((cat) => {
                const count = categoryItemCounts[cat.id] || 0;
                const isSelected = selectedCategory?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    ref={isSelected ? selectedCatChipRef : null}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    style={{
                      ...categoryChipStyle,
                      background: isSelected ? "#0f172a" : cat.active ? "#ffffff" : "#f1f5f9",
                      color: isSelected ? "#ffffff" : cat.active ? "#0f172a" : "#94a3b8",
                      borderColor: isSelected ? "#0f172a" : "#e2e8f0",
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    <span>{cat.name}</span>
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
                    {!cat.active && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: isSelected ? "#cbd5e1" : "#94a3b8",
                        }}
                      >
                        (Hidden)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Desktop Two-Column Layout */}
          <div className="catalog-layout-grid" style={layoutGridStyle}>
            {/* Left Column: Categories (Desktop) */}
            {!searchQuery && (
              <div className="catalog-desktop-sidebar" style={categorySidebarStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderBottom: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    borderTopLeftRadius: "12px",
                    borderTopRightRadius: "12px",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "#475569", textTransform: "uppercase" }}>
                    Categories ({categories.length})
                  </strong>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      setShowCategoryModal(true);
                    }}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#2563eb",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    + New
                  </button>
                </div>

                <div style={{ padding: "8px" }}>
                  {categories.map((cat, idx) => {
                    const count = categoryItemCounts[cat.id] || 0;
                    const isSelected = selectedCategory?.id === cat.id;

                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        style={{
                          ...categoryItemStyle,
                          background: isSelected ? "#0f172a" : "transparent",
                          color: isSelected ? "#ffffff" : cat.active ? "#0f172a" : "#94a3b8",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, overflow: "hidden" }}>
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: isSelected ? 700 : 500,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {cat.name}
                          </span>
                          {!cat.active && (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "1px 5px",
                                borderRadius: "4px",
                                background: isSelected ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                                color: isSelected ? "#ffffff" : "#64748b",
                              }}
                            >
                              Hidden
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "99px",
                            background: isSelected ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                            color: isSelected ? "#ffffff" : "#64748b",
                          }}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Right Column: Types / Products List */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Category Header with Actions (when not in search mode) */}
              {!searchQuery && selectedCategory && (
                <div className="catalog-category-header" style={categoryHeaderCardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      {selectedCategory.name}
                    </h2>
                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                      ({displayedItems.length} {displayedItems.length === 1 ? "type" : "types"})
                    </span>
                    {!selectedCategory.active && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "99px",
                          background: "#f1f5f9",
                          color: "#64748b",
                        }}
                      >
                        Hidden from catalog
                      </span>
                    )}
                  </div>

                  {/* Category Action Buttons */}
                  <div className="catalog-category-actions" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(selectedCategory);
                        setShowCategoryModal(true);
                      }}
                      style={iconBtnStyle}
                      title="Rename category"
                    >
                      ✏️ Rename
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMoveCategory(selectedCategory, "up")}
                      disabled={categories[0]?.id === selectedCategory.id}
                      style={{
                        ...iconBtnStyle,
                        opacity: categories[0]?.id === selectedCategory.id ? 0.3 : 1,
                      }}
                      title="Move category up"
                    >
                      ↑ Move up
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMoveCategory(selectedCategory, "down")}
                      disabled={categories[categories.length - 1]?.id === selectedCategory.id}
                      style={{
                        ...iconBtnStyle,
                        opacity:
                          categories[categories.length - 1]?.id === selectedCategory.id
                            ? 0.3
                            : 1,
                      }}
                      title="Move category down"
                    >
                      ↓ Move down
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleCategoryActive(selectedCategory)}
                      style={iconBtnStyle}
                      title={selectedCategory.active ? "Hide category" : "Show category"}
                    >
                      {selectedCategory.active ? "👁️ Hide" : "👁️ Show"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(selectedCategory)}
                      style={{ ...iconBtnStyle, color: "#dc2626" }}
                      title="Delete category"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Search Result Banner */}
              {searchQuery.trim() && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ fontSize: "14px", color: "#334155" }}>
                    Found <strong>{displayedItems.length}</strong> matching "
                    {searchQuery}" across all categories
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#2563eb",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Clear search
                  </button>
                </div>
              )}

              {/* Set Prices Helper Banner */}
              {unpricedInCurrentCategory.length > 0 && (
                <div
                  onClick={handleFocusFirstEmptyPrice}
                  style={setPriceBannerStyle}
                  title="Click to focus first unpriced item"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>⚠️</span>
                    <strong style={{ fontSize: "13.5px", color: "#92400e" }}>
                      {unpricedInCurrentCategory.length}{" "}
                      {unpricedInCurrentCategory.length === 1
                        ? "type needs a price"
                        : "types need a price"}
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#b45309",
                      textDecoration: "underline",
                    }}
                  >
                    Tap to set price →
                  </span>
                </div>
              )}

              {/* Types Rows */}
              {displayedItems.length === 0 ? (
                <div
                  style={{
                    ...cardStyle,
                    textAlign: "center",
                    padding: "36px 16px",
                    color: "#64748b",
                  }}
                >
                  {searchQuery ? (
                    <div>No products found matching "{searchQuery}".</div>
                  ) : (
                    <div>
                      <div style={{ fontSize: "24px", marginBottom: "8px" }}>🏷️</div>
                      <div style={{ fontSize: "14px", marginBottom: "14px" }}>
                        No items in this category yet.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingType(null);
                          setShowTypeModal(true);
                        }}
                        style={btnPrimaryStyle}
                      >
                        + Add first type
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {displayedItems.map((item, index) => {
                    const isEditingThisPrice = editingPriceId === item.id;
                    const thisStatus = priceStatus[item.id];
                    const thisError = priceError[item.id];
                    const sizeSet = item.size_set_id ? sizeSetMap.get(item.size_set_id) : null;
                    const catName = categoryMap.get(item.category_id)?.name || "";

                    return (
                      <div
                        key={item.id}
                        className="catalog-type-row"
                        style={{
                          ...typeRowStyle,
                          opacity: item.active ? 1 : 0.65,
                          background: item.active ? "#ffffff" : "#f8fafc",
                        }}
                      >
                        {/* Name and Meta (Line 1 on phone) */}
                        <div className="catalog-type-line1" style={{ flex: "1 1 200px", minWidth: "160px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong style={{ fontSize: "14.5px", color: "#0f172a", wordBreak: "break-word" }}>
                              {item.name}
                            </strong>
                            {!item.active && (
                              <span
                                style={{
                                  fontSize: "10.5px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#e2e8f0",
                                  color: "#475569",
                                }}
                              >
                                Hidden
                              </span>
                            )}
                            {searchQuery && catName && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  padding: "2px 7px",
                                  borderRadius: "6px",
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  fontWeight: 600,
                                }}
                              >
                                {catName}
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginTop: "4px",
                              fontSize: "12px",
                              color: "#64748b",
                              flexWrap: "wrap",
                            }}
                          >
                            <span>
                              {sizeSet ? `📏 ${sizeSet.name}` : "No sizes"}
                            </span>
                            {item.unit && item.unit !== "piece" && (
                              <span>• per {item.unit}</span>
                            )}
                            {item.mrp !== null && item.mrp > 0 && (
                              <span>• MRP ₹{item.mrp}</span>
                            )}
                          </div>
                        </div>

                        {/* Price & Actions (Line 2 on phone) */}
                        <div className="catalog-type-line2">
                          {/* Inline Price Editor / Display */}
                          <div
                            className="catalog-type-price-wrap"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              minWidth: "140px",
                            }}
                          >
                            {isEditingThisPrice ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ fontSize: "14px", fontWeight: 700, color: "#64748b" }}>
                                  ₹
                                </span>
                                <input
                                  ref={priceInputRef}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="10000000"
                                  value={editingPriceValue}
                                  onChange={(e) => setEditingPriceValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      savePriceAndNext(item, index);
                                    } else if (e.key === "Escape") {
                                      cancelEditingPrice();
                                    }
                                  }}
                                  onBlur={() => savePriceOnBlur(item)}
                                  style={priceInlineInputStyle}
                                  placeholder="0.00"
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditingPrice(item)}
                                className="catalog-price-badge"
                                style={
                                  item.default_price !== null
                                    ? priceBadgeStyle
                                    : unpricedBadgeStyle
                                }
                                title="Tap to change price"
                              >
                                {item.default_price !== null
                                  ? formatPrice(item.default_price)
                                  : "⚠️ Set price"}
                              </button>
                            )}

                            {thisStatus === "saving" && (
                              <span style={{ fontSize: "11px", color: "#64748b" }}>
                                Saving...
                              </span>
                            )}
                            {thisStatus === "saved" && (
                              <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>
                                ✓ Saved
                              </span>
                            )}
                            {thisError && (
                              <span style={{ fontSize: "11px", color: "#dc2626" }}>
                                {thisError}
                              </span>
                            )}
                          </div>

                          {/* Active Switch & Actions */}
                          <div
                            className="catalog-type-actions-wrap"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            {/* Active Toggle Switch */}
                            <button
                              type="button"
                              className="catalog-active-switch"
                              onClick={() => handleToggleTypeActive(item)}
                              style={{
                                ...activeSwitchStyle,
                                background: item.active ? "#16a34a" : "#cbd5e1",
                              }}
                              title={item.active ? "Active (click to hide)" : "Hidden (click to show)"}
                            >
                              <span
                                style={{
                                  ...activeSwitchKnobStyle,
                                  transform: item.active ? "translateX(18px)" : "translateX(2px)",
                                }}
                              />
                            </button>

                            {/* Row Actions Menu */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingType(item);
                                setShowTypeModal(true);
                              }}
                              style={iconBtnStyle}
                              title="Edit item"
                            >
                              ✏️ Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicateType(item)}
                              disabled={actionBusy}
                              style={iconBtnStyle}
                              title="Duplicate item"
                            >
                              📋 Copy
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteType(item)}
                              disabled={actionBusy}
                              style={{ ...iconBtnStyle, color: "#dc2626" }}
                              title="Delete item"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Type */}
      {showTypeModal && (
        <TypeModal
          businessId={businessId}
          initialData={editingType}
          categories={categories}
          sizeSets={sizeSets}
          defaultCategoryId={selectedCategory?.id || categories[0]?.id || ""}
          onClose={() => {
            setShowTypeModal(false);
            setEditingType(null);
          }}
          onSaved={(savedItem, isNew) => {
            setItems((prev) => {
              if (isNew) {
                return [...prev, savedItem];
              }
              return prev.map((it) => (it.id === savedItem.id ? savedItem : it));
            });
            setShowTypeModal(false);
            setEditingType(null);
            setNoticeMsg(isNew ? `Added "${savedItem.name}".` : `Updated "${savedItem.name}".`);
          }}
        />
      )}

      {/* MODAL: Size Sets Manager */}
      {showSizesModal && (
        <SizeSetsModal
          businessId={businessId}
          sizeSets={sizeSets}
          items={items}
          editingSizeSet={editingSizeSet}
          setEditingSizeSet={setEditingSizeSet}
          onClose={() => {
            setShowSizesModal(false);
            setEditingSizeSet(null);
          }}
          onSizeSetsChanged={(updatedList) => {
            setSizeSets(updatedList);
          }}
        />
      )}

      {/* MODAL: Add / Rename Category */}
      {showCategoryModal && (
        <CategoryModal
          businessId={businessId}
          initialCategory={editingCategory}
          existingCategories={categories}
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
          }}
          onSaved={(savedCat, isNew) => {
            setCategories((prev) => {
              if (isNew) {
                return [...prev, savedCat];
              }
              return prev.map((c) => (c.id === savedCat.id ? savedCat : c));
            });
            if (isNew) {
              setSelectedCategoryId(savedCat.id);
            }
            setShowCategoryModal(false);
            setEditingCategory(null);
            setNoticeMsg(isNew ? `Added category "${savedCat.name}".` : `Updated category "${savedCat.name}".`);
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   TYPE (ITEM) MODAL
========================================================= */

function TypeModal({
  businessId,
  initialData,
  categories,
  sizeSets,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  businessId: string;
  initialData: CatalogItem | null;
  categories: CatalogCategory[];
  sizeSets: CatalogSizeSet[];
  defaultCategoryId: string;
  onClose: () => void;
  onSaved: (item: CatalogItem, isNew: boolean) => void;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [categoryId, setCategoryId] = useState(
    initialData?.category_id || defaultCategoryId || categories[0]?.id || ""
  );
  const [price, setPrice] = useState(
    initialData?.default_price !== null && initialData?.default_price !== undefined
      ? String(initialData.default_price)
      : ""
  );
  const [mrp, setMrp] = useState(
    initialData?.mrp !== null && initialData?.mrp !== undefined
      ? String(initialData.mrp)
      : ""
  );
  const [costPrice, setCostPrice] = useState(
    initialData?.cost_price !== null && initialData?.cost_price !== undefined
      ? String(initialData.cost_price)
      : ""
  );
  const [unit, setUnit] = useState<CatalogUnit>(initialData?.unit || "piece");
  const [sizeSetId, setSizeSetId] = useState<string>(
    initialData?.size_set_id || ""
  );
  const [active, setActive] = useState(initialData ? initialData.active : true);

  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorText("Please enter a name for this product.");
      return;
    }
    if (trimmedName.length > 120) {
      setErrorText("Name must be 120 characters or less.");
      return;
    }

    let parsedPrice: number | null = null;
    if (price.trim() !== "") {
      const p = parseFloat(price.trim());
      if (isNaN(p) || p < 0 || p > 10000000) {
        setErrorText("Price must be between 0 and 10,000,000.");
        return;
      }
      parsedPrice = Math.round(p * 100) / 100;
    }

    let parsedMrp: number | null = null;
    if (mrp.trim() !== "") {
      const m = parseFloat(mrp.trim());
      if (isNaN(m) || m < 0) {
        setErrorText("MRP must be 0 or more.");
        return;
      }
      parsedMrp = Math.round(m * 100) / 100;
    }

    let parsedCost: number | null = null;
    if (costPrice.trim() !== "") {
      const c = parseFloat(costPrice.trim());
      if (isNaN(c) || c < 0) {
        setErrorText("Cost price must be 0 or more.");
        return;
      }
      parsedCost = Math.round(c * 100) / 100;
    }

    setSaving(true);
    setErrorText("");

    try {
      if (initialData) {
        // Update existing item
        const { data, error } = await supabase
          .from("tapx_catalog_items")
          .update({
            category_id: categoryId,
            name: trimmedName,
            default_price: parsedPrice,
            mrp: parsedMrp,
            cost_price: parsedCost,
            unit,
            size_set_id: sizeSetId || null,
            active,
          })
          .eq("id", initialData.id)
          .select()
          .single();

        if (error) throw error;
        onSaved(data as CatalogItem, false);
      } else {
        // Insert new item
        const { data, error } = await supabase
          .from("tapx_catalog_items")
          .insert({
            business_id: businessId,
            category_id: categoryId,
            name: trimmedName,
            default_price: parsedPrice,
            mrp: parsedMrp,
            cost_price: parsedCost,
            unit,
            size_set_id: sizeSetId || null,
            track_stock: false,
            image_url: null,
            sort_order: 100,
            active,
          })
          .select()
          .single();

        if (error) throw error;
        onSaved(data as CatalogItem, true);
      }
    } catch (err: any) {
      console.error("Save type error:", err);
      setErrorText(friendlyCatalogError(err));
      setSaving(false);
    }
  };

  return (
    <div style={modalBackdropStyle}>
      <div style={modalContentStyle}>
        <div style={modalHeaderStyle}>
          <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            {initialData ? "Edit Type" : "Add Type"}
          </h3>
          <button type="button" onClick={onClose} style={modalCloseBtnStyle}>
            ✕
          </button>
        </div>

        {errorText && <div style={errorBannerStyle}>{errorText}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Name */}
          <label style={formLabelStyle}>
            <span>Item Name *</span>
            <input
              type="text"
              required
              maxLength={120}
              placeholder="e.g. Regular Fit Linen Shirt"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={formInputStyle}
              autoFocus
            />
          </label>

          {/* Category */}
          <label style={formLabelStyle}>
            <span>Category *</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={formInputStyle}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Price & MRP Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={formLabelStyle}>
              <span>Selling Price (₹)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10000000"
                placeholder="Leave blank if not set"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={formInputStyle}
              />
            </label>

            <label style={formLabelStyle}>
              <span>MRP (Optional)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Optional"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                style={formInputStyle}
              />
            </label>
          </div>

          {/* Cost Price */}
          <label style={formLabelStyle}>
            <span>Cost price (optional, only you see this)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Only visible to owner"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              style={formInputStyle}
            />
          </label>

          {/* Unit & Size Set Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={formLabelStyle}>
              <span>Unit</span>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as CatalogUnit)}
                style={formInputStyle}
              >
                {CATALOG_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={formLabelStyle}>
              <span>Sizes</span>
              <select
                value={sizeSetId}
                onChange={(e) => setSizeSetId(e.target.value)}
                style={formInputStyle}
              >
                <option value="">No sizes</option>
                {sizeSets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.sizes.join(", ")})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Active switch */}
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginTop: "4px" }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ width: "18px", height: "18px" }}
            />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
              Active (Visible in catalog)
            </span>
          </label>

          {/* Form Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
            <button type="button" onClick={onClose} disabled={saving} style={btnSecondaryStyle}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={btnPrimaryStyle}>
              {saving ? "Saving..." : initialData ? "Save changes" : "Add type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   CATEGORY MODAL (ADD / RENAME)
========================================================= */

function CategoryModal({
  businessId,
  initialCategory,
  existingCategories,
  onClose,
  onSaved,
}: {
  businessId: string;
  initialCategory: CatalogCategory | null;
  existingCategories: CatalogCategory[];
  onClose: () => void;
  onSaved: (category: CatalogCategory, isNew: boolean) => void;
}) {
  const [name, setName] = useState(initialCategory?.name || "");
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorText("Please enter a category name.");
      return;
    }
    if (trimmed.length > 60) {
      setErrorText("Category name must be 60 characters or less.");
      return;
    }

    setSaving(true);
    setErrorText("");

    try {
      if (initialCategory) {
        // Rename category
        const { data, error } = await supabase
          .from("tapx_catalog_categories")
          .update({ name: trimmed })
          .eq("id", initialCategory.id)
          .select()
          .single();

        if (error) throw error;
        onSaved(data as CatalogCategory, false);
      } else {
        // Add new category
        const nextOrder =
          existingCategories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1;

        const { data, error } = await supabase
          .from("tapx_catalog_categories")
          .insert({
            business_id: businessId,
            name: trimmed,
            sort_order: nextOrder,
            active: true,
          })
          .select()
          .single();

        if (error) throw error;
        onSaved(data as CatalogCategory, true);
      }
    } catch (err: any) {
      console.error("Save category error:", err);
      setErrorText(friendlyCatalogError(err));
      setSaving(false);
    }
  };

  return (
    <div style={modalBackdropStyle}>
      <div style={{ ...modalContentStyle, maxWidth: "420px" }}>
        <div style={modalHeaderStyle}>
          <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            {initialCategory ? "Rename Category" : "Add Category"}
          </h3>
          <button type="button" onClick={onClose} style={modalCloseBtnStyle}>
            ✕
          </button>
        </div>

        {errorText && <div style={errorBannerStyle}>{errorText}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label style={formLabelStyle}>
            <span>Category Name *</span>
            <input
              type="text"
              required
              maxLength={60}
              placeholder="e.g. Shirts, Bread, Dairy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={formInputStyle}
              autoFocus
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={onClose} disabled={saving} style={btnSecondaryStyle}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={btnPrimaryStyle}>
              {saving ? "Saving..." : initialCategory ? "Save changes" : "Add category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   SIZE SETS MANAGER MODAL
========================================================= */

function SizeSetsModal({
  businessId,
  sizeSets,
  items,
  editingSizeSet,
  setEditingSizeSet,
  onClose,
  onSizeSetsChanged,
}: {
  businessId: string;
  sizeSets: CatalogSizeSet[];
  items: CatalogItem[];
  editingSizeSet: CatalogSizeSet | null;
  setEditingSizeSet: (s: CatalogSizeSet | null) => void;
  onClose: () => void;
  onSizeSetsChanged: (list: CatalogSizeSet[]) => void;
}) {
  const [isEditing, setIsEditing] = useState(Boolean(editingSizeSet));
  const [name, setName] = useState(editingSizeSet?.name || "");
  const [sizesList, setSizesList] = useState<string[]>(editingSizeSet?.sizes || []);
  const [chipInput, setChipInput] = useState("");
  const [errorText, setErrorText] = useState("");
  const [saving, setSaving] = useState(false);

  // Switch to edit form
  const startEdit = (s: CatalogSizeSet | null) => {
    setEditingSizeSet(s);
    setName(s ? s.name : "");
    setSizesList(s ? [...s.sizes] : []);
    setChipInput("");
    setErrorText("");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingSizeSet(null);
    setErrorText("");
  };

  // Add chip
  const handleAddChip = () => {
    const trimmed = chipInput.trim();
    if (!trimmed) return;

    if (trimmed.length > 12) {
      setErrorText("Each size must be 12 characters or less.");
      return;
    }

    if (sizesList.length >= 30) {
      setErrorText("Maximum 30 sizes allowed in a set.");
      return;
    }

    const duplicate = sizesList.some(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setErrorText(`"${trimmed}" is already in this size set.`);
      return;
    }

    setSizesList([...sizesList, trimmed]);
    setChipInput("");
    setErrorText("");
  };

  const handleRemoveChip = (indexToRemove: number) => {
    setSizesList(sizesList.filter((_, idx) => idx !== indexToRemove));
  };

  const handleChipKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddChip();
    }
  };

  const handleSaveSizeSet = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorText("Please enter a name for this size set.");
      return;
    }
    if (trimmedName.length > 60) {
      setErrorText("Size set name must be 60 characters or less.");
      return;
    }
    if (sizesList.length === 0) {
      setErrorText("Please add at least one size.");
      return;
    }

    setSaving(true);
    setErrorText("");

    try {
      if (editingSizeSet) {
        // Update size set
        const { data, error } = await supabase
          .from("tapx_catalog_size_sets")
          .update({
            name: trimmedName,
            sizes: sizesList,
          })
          .eq("id", editingSizeSet.id)
          .select()
          .single();

        if (error) throw error;

        const updated = sizeSets.map((s) =>
          s.id === editingSizeSet.id ? (data as CatalogSizeSet) : s
        );
        onSizeSetsChanged(updated);
        cancelEdit();
      } else {
        // Insert new size set
        const { data, error } = await supabase
          .from("tapx_catalog_size_sets")
          .insert({
            business_id: businessId,
            name: trimmedName,
            sizes: sizesList,
          })
          .select()
          .single();

        if (error) throw error;

        onSizeSetsChanged([...sizeSets, data as CatalogSizeSet]);
        cancelEdit();
      }
    } catch (err: any) {
      console.error("Save size set error:", err);
      setErrorText(friendlyCatalogError(err));
      setSaving(false);
    }
  };

  const handleDeleteSizeSet = async (s: CatalogSizeSet) => {
    const inUse = items.some((it) => it.size_set_id === s.id);
    if (inUse) {
      setErrorText("Some types use this size set. Change them first.");
      return;
    }

    if (!window.confirm(`Delete size set "${s.name}"?`)) return;
    setSaving(true);
    setErrorText("");

    try {
      const { error } = await supabase
        .from("tapx_catalog_size_sets")
        .delete()
        .eq("id", s.id);

      if (error) throw error;

      onSizeSetsChanged(sizeSets.filter((item) => item.id !== s.id));
    } catch (err: any) {
      console.error("Delete size set error:", err);
      setErrorText(friendlyCatalogError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalBackdropStyle}>
      <div style={{ ...modalContentStyle, maxWidth: "560px" }}>
        <div style={modalHeaderStyle}>
          <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            {isEditing
              ? editingSizeSet
                ? "Edit Size Set"
                : "Add Size Set"
              : "Manage Size Sets"}
          </h3>
          <button type="button" onClick={onClose} style={modalCloseBtnStyle}>
            ✕
          </button>
        </div>

        {errorText && <div style={errorBannerStyle}>{errorText}</div>}

        {!isEditing ? (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontSize: "13.5px", color: "#64748b" }}>
                Reuse size sets (e.g. S, M, L, XL or 28, 30, 32) across items.
              </span>
              <button
                type="button"
                onClick={() => startEdit(null)}
                style={btnPrimaryStyle}
              >
                + Add size set
              </button>
            </div>

            {sizeSets.length === 0 ? (
              <div
                style={{
                  padding: "30px 16px",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: "10px",
                  border: "1px dashed #cbd5e1",
                  color: "#64748b",
                  fontSize: "13.5px",
                }}
              >
                No size sets yet. Add one to assign sizes to your items.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {sizeSets.map((s) => {
                  const usedCount = items.filter((it) => it.size_set_id === s.id).length;

                  return (
                    <div
                      key={s.id}
                      style={{
                        padding: "14px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        background: "#ffffff",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                            {s.name}
                          </strong>
                          <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>
                            ({usedCount} {usedCount === 1 ? "type" : "types"} using this)
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            style={iconBtnStyle}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSizeSet(s)}
                            style={{ ...iconBtnStyle, color: "#dc2626" }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Sizes Chips */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {s.sizes.map((size, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: "#f1f5f9",
                              color: "#334155",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {size}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "18px" }}>
              <button type="button" onClick={onClose} style={btnSecondaryStyle}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveSizeSet} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <label style={formLabelStyle}>
              <span>Size Set Name *</span>
              <input
                type="text"
                required
                maxLength={60}
                placeholder="e.g. Standard Clothing Sizes"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={formInputStyle}
                autoFocus
              />
            </label>

            <div>
              <span style={{ ...formLabelStyle, display: "block", marginBottom: "6px" }}>
                Sizes (press Enter or comma to add, max 30) *
              </span>

              {/* Current Chips */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  padding: "8px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  background: "#ffffff",
                  minHeight: "44px",
                  alignItems: "center",
                }}
              >
                {sizesList.map((sz, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 8px",
                      background: "#0f172a",
                      color: "#ffffff",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {sz}
                    <button
                      type="button"
                      onClick={() => handleRemoveChip(idx)}
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "#94a3b8",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: "13px",
                      }}
                      title="Remove size"
                    >
                      ✕
                    </button>
                  </span>
                ))}

                <input
                  type="text"
                  placeholder={sizesList.length === 0 ? "Type a size (e.g. M, 32) and press Enter" : "Add another size..."}
                  value={chipInput}
                  onChange={(e) => setChipInput(e.target.value)}
                  onKeyDown={handleChipKeyDown}
                  style={{
                    border: 0,
                    outline: "none",
                    flex: 1,
                    minWidth: "140px",
                    fontSize: "13px",
                    padding: "4px",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                  {sizesList.length} of 30 sizes added
                </span>
                {chipInput.trim() && (
                  <button
                    type="button"
                    onClick={handleAddChip}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#2563eb",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Add "{chipInput.trim()}"
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
              <button type="button" onClick={cancelEdit} disabled={saving} style={btnSecondaryStyle}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={btnPrimaryStyle}>
                {saving ? "Saving..." : editingSizeSet ? "Save changes" : "Create size set"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   INLINE STYLES MATCHING DASHBOARD / BILLS PAGE
========================================================= */

const containerStyle: React.CSSProperties = {
  padding: "16px",
  maxWidth: "1200px",
  margin: "0 auto",
  fontFamily: "inherit",
  overflowX: "hidden",
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

const progressCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "16px",
  marginBottom: "16px",
};

const progressStepStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  fontSize: "14px",
  color: "#0f172a",
  outline: "none",
  minHeight: "40px",
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
  minHeight: "40px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
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
  minHeight: "40px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
};

const iconBtnStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#475569",
  borderRadius: "8px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  minHeight: "34px",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
};

const mobileChipRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  paddingBottom: "10px",
  marginBottom: "12px",
};

const categoryChipStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "99px",
  padding: "8px 14px",
  fontSize: "13px",
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "38px",
  flexShrink: 0,
};

const layoutGridStyle: React.CSSProperties = {
  display: "flex",
  gap: "18px",
  alignItems: "flex-start",
};

const categorySidebarStyle: React.CSSProperties = {
  width: "250px",
  flexShrink: 0,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  overflow: "hidden",
};

const categoryItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "9px 12px",
  borderRadius: "8px",
  cursor: "pointer",
  marginBottom: "2px",
  transition: "background 0.15s ease",
};

const categoryHeaderCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "12px",
  padding: "12px 16px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  marginBottom: "12px",
};

const setPriceBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  borderRadius: "10px",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  marginBottom: "12px",
  cursor: "pointer",
};

const typeRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "12px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
};

const priceBadgeStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  borderRadius: "8px",
  padding: "6px 12px",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "36px",
};

const unpricedBadgeStyle: React.CSSProperties = {
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#b45309",
  borderRadius: "8px",
  padding: "6px 12px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "36px",
};

const priceInlineInputStyle: React.CSSProperties = {
  width: "90px",
  padding: "6px 8px",
  fontSize: "14px",
  fontWeight: 700,
  border: "2px solid #2563eb",
  borderRadius: "8px",
  outline: "none",
  color: "#0f172a",
};

const activeSwitchStyle: React.CSSProperties = {
  width: "40px",
  height: "22px",
  borderRadius: "99px",
  border: 0,
  padding: 0,
  cursor: "pointer",
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  transition: "background 0.2s ease",
};

const activeSwitchKnobStyle: React.CSSProperties = {
  width: "18px",
  height: "18px",
  borderRadius: "50%",
  background: "#ffffff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  transition: "transform 0.2s ease",
  display: "block",
};

const noticeBannerStyle: React.CSSProperties = {
  padding: "12px 16px",
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  borderRadius: "10px",
  fontSize: "13.5px",
  fontWeight: 600,
  marginBottom: "14px",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "12px 16px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: "10px",
  fontSize: "13.5px",
  marginBottom: "14px",
};

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(15, 23, 42, 0.6)",
  backdropFilter: "blur(2px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "16px",
  overflowY: "auto",
};

const modalContentStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "14px",
  padding: "20px",
  width: "100%",
  maxWidth: "480px",
  boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
  maxHeight: "90vh",
  overflowY: "auto",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "16px",
};

const modalCloseBtnStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  fontSize: "16px",
  color: "#64748b",
  cursor: "pointer",
  padding: "4px 8px",
};

const formLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#334155",
};

const formInputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
  color: "#0f172a",
  outline: "none",
  minHeight: "40px",
  boxSizing: "border-box",
  width: "100%",
};
