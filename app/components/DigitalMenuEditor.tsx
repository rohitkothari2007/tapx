"use client";

import { useMemo, useState, type CSSProperties } from "react";

export type MenuCategory = {
  id: string;
  name: string;
  description?: string;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  price?: string;
  description?: string;
  imageUrl?: string;
  dietary?: "veg" | "non_veg" | "egg" | "none";
  popular?: boolean;
  available?: boolean;
};

export type DigitalMenuConfig = {
  categories?: MenuCategory[];
  items?: MenuItem[];
  quick_requests?: string[];
  [key: string]: unknown;
};

export const DEFAULT_QUICK_REQUESTS = [
  "Less spicy",
  "Extra spicy",
  "No onion",
  "No garlic",
  "Less sugar",
  "Jain",
];

const MAX_CATEGORIES = 20;
const MAX_ITEMS = 300;
const MAX_PAYLOAD_BYTES = 300 * 1024; // 300 KB

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type DigitalMenuEditorProps = {
  config: DigitalMenuConfig;
  onChange: (nextConfig: DigitalMenuConfig) => void;
  isOwnerMode?: boolean;
  onPreviewCustomerMenu?: () => void;
};

export default function DigitalMenuEditor({
  config,
  onChange,
  isOwnerMode = false,
  onPreviewCustomerMenu,
}: DigitalMenuEditorProps) {
  const storedCategories: MenuCategory[] = Array.isArray(config.categories)
    ? config.categories
    : [];
  const storedItems: MenuItem[] = Array.isArray(config.items)
    ? config.items
    : [];

  // Backward compatibility: default category fallback if flat items
  const categories: MenuCategory[] = useMemo(() => {
    if (storedCategories.length > 0) return storedCategories;
    if (storedItems.length > 0) {
      return [{ id: "default-menu", name: "Menu", description: "" }];
    }
    return [];
  }, [storedCategories, storedItems]);

  const items: MenuItem[] = useMemo(() => {
    if (storedCategories.length > 0) {
      return storedItems.map((item) => ({
        ...item,
        categoryId:
          item.categoryId &&
          storedCategories.some((c) => c.id === item.categoryId)
            ? item.categoryId
            : storedCategories[0]?.id || "",
        available: item.available !== false,
      }));
    }
    return storedItems.map((item) => ({
      ...item,
      categoryId: "default-menu",
      available: item.available !== false,
    }));
  }, [storedCategories, storedItems]);

  const quickRequests: string[] = useMemo(() => {
    if (Array.isArray(config.quick_requests) && config.quick_requests.length > 0) {
      return config.quick_requests;
    }
    return DEFAULT_QUICK_REQUESTS;
  }, [config.quick_requests]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");

  // Editing Category state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryDesc, setEditCategoryDesc] = useState("");

  // Editing Item state (Modal / inline)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemPrice, setEditItemPrice] = useState("");
  const [editItemDesc, setEditItemDesc] = useState("");
  const [editItemCategory, setEditItemCategory] = useState("");
  const [editItemDietary, setEditItemDietary] = useState<"veg" | "non_veg" | "egg" | "none">("veg");
  const [editItemImageUrl, setEditItemImageUrl] = useState("");
  const [editItemPopular, setEditItemPopular] = useState(false);
  const [editItemError, setEditItemError] = useState("");

  // New Category draft
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [categoryError, setCategoryError] = useState("");

  // New Item draft
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemImageUrl, setNewItemImageUrl] = useState("");
  const [newItemDietary, setNewItemDietary] = useState<"veg" | "non_veg" | "egg" | "none">("veg");
  const [newItemPopular, setNewItemPopular] = useState(false);
  const [itemError, setItemError] = useState("");

  // Quick Request management draft
  const [newQuickRequestText, setNewQuickRequestText] = useState("");

  // Live preview active item (defaults to first item or currently edited item)
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  // Payload size calculation
  const payloadSize = useMemo(() => {
    try {
      return new TextEncoder().encode(JSON.stringify(config)).length;
    } catch {
      return 0;
    }
  }, [config]);

  const payloadSizeKb = (payloadSize / 1024).toFixed(1);
  const isNearPayloadLimit = payloadSize > MAX_PAYLOAD_BYTES * 0.9;
  const isOverPayloadLimit = payloadSize > MAX_PAYLOAD_BYTES;

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        activeCategoryTab === "all" || item.categoryId === activeCategoryTab;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    });
  }, [items, activeCategoryTab, searchQuery]);

  // Preview item resolution
  const previewItem = useMemo(() => {
    if (previewItemId) {
      const found = items.find((i) => i.id === previewItemId);
      if (found) return found;
    }
    if (editingItemId) {
      const found = items.find((i) => i.id === editingItemId);
      if (found) return found;
    }
    if (filteredItems.length > 0) return filteredItems[0];
    if (items.length > 0) return items[0];
    return null;
  }, [previewItemId, editingItemId, items, filteredItems]);

  /* =========================================================
     CATEGORY ACTIONS
  ========================================================= */

  const handleAddCategory = () => {
    setCategoryError("");
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryError("Please enter a category name.");
      return;
    }
    if (trimmed.length > 80) {
      setCategoryError("Category name must be 80 characters or fewer.");
      return;
    }
    if (categories.length >= MAX_CATEGORIES) {
      setCategoryError(`Limit reached: maximum ${MAX_CATEGORIES} categories allowed.`);
      return;
    }

    const newCategory: MenuCategory = {
      id: makeId(),
      name: trimmed,
      description: newCategoryDesc.trim() || undefined,
    };

    const nextCategories = [...categories, newCategory];
    onChange({
      ...config,
      categories: nextCategories,
      items,
      quick_requests: quickRequests,
    });

    setNewCategoryName("");
    setNewCategoryDesc("");
  };

  const handleStartEditCategory = (cat: MenuCategory) => {
    setEditingCategoryId(cat.id);
    setEditCategoryName(cat.name);
    setEditCategoryDesc(cat.description || "");
  };

  const handleSaveEditCategory = () => {
    if (!editingCategoryId) return;
    const trimmed = editCategoryName.trim();
    if (!trimmed) return;
    if (trimmed.length > 80) return;

    const nextCategories = categories.map((c) =>
      c.id === editingCategoryId
        ? { ...c, name: trimmed, description: editCategoryDesc.trim() || undefined }
        : c
    );

    onChange({
      ...config,
      categories: nextCategories,
      items,
      quick_requests: quickRequests,
    });

    setEditingCategoryId(null);
  };

  const handleDeleteCategory = (cat: MenuCategory) => {
    const attachedItems = items.filter((i) => i.categoryId === cat.id);
    const msg =
      attachedItems.length > 0
        ? `Delete category "${cat.name}"? This will also remove ${attachedItems.length} menu item(s) in this category.`
        : `Delete category "${cat.name}"?`;

    if (!confirm(msg)) return;

    const nextCategories = categories.filter((c) => c.id !== cat.id);
    const nextItems = items.filter((i) => i.categoryId !== cat.id);

    onChange({
      ...config,
      categories: nextCategories,
      items: nextItems,
      quick_requests: quickRequests,
    });
  };

  const handleMoveCategory = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const next = [...categories];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;

    onChange({
      ...config,
      categories: next,
      items,
      quick_requests: quickRequests,
    });
  };

  /* =========================================================
     ITEM ACTIONS
  ========================================================= */

  const handleAddItem = () => {
    setItemError("");
    const trimmedName = newItemName.trim();
    if (!trimmedName) {
      setItemError("Item name is required.");
      return;
    }
    if (trimmedName.length > 80) {
      setItemError("Item name must be 80 characters or fewer.");
      return;
    }
    if (items.length >= MAX_ITEMS) {
      setItemError(`Limit reached: maximum ${MAX_ITEMS} items allowed.`);
      return;
    }

    const assignedCategoryId =
      newItemCategory || categories[0]?.id || "default-menu";

    // Validate price
    const priceStr = newItemPrice.trim();
    if (priceStr && !/^\d+(\.\d{1,2})?$/.test(priceStr)) {
      setItemError("Price must be a valid positive number with at most 2 decimal places.");
      return;
    }

    // Validate description
    const descStr = newItemDesc.trim();
    if (descStr.length > 300) {
      setItemError("Description must be 300 characters or fewer.");
      return;
    }

    const newItem: MenuItem = {
      id: makeId(),
      categoryId: assignedCategoryId,
      name: trimmedName,
      price: priceStr || undefined,
      description: descStr || undefined,
      imageUrl: newItemImageUrl.trim() || undefined,
      dietary: newItemDietary,
      popular: newItemPopular,
      available: true,
    };

    const nextItems = [...items, newItem];

    onChange({
      ...config,
      categories,
      items: nextItems,
      quick_requests: quickRequests,
    });

    setNewItemName("");
    setNewItemPrice("");
    setNewItemDesc("");
    setNewItemImageUrl("");
    setNewItemPopular(false);
    setPreviewItemId(newItem.id);
  };

  const handleToggleAvailability = (itemId: string) => {
    const nextItems = items.map((i) =>
      i.id === itemId ? { ...i, available: i.available === false } : i
    );
    onChange({
      ...config,
      categories,
      items: nextItems,
      quick_requests: quickRequests,
    });
  };

  const handleTogglePopular = (itemId: string) => {
    const nextItems = items.map((i) =>
      i.id === itemId ? { ...i, popular: !i.popular } : i
    );
    onChange({
      ...config,
      categories,
      items: nextItems,
      quick_requests: quickRequests,
    });
  };

  const handleStartEditItem = (item: MenuItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemPrice(item.price || "");
    setEditItemDesc(item.description || "");
    setEditItemCategory(item.categoryId);
    setEditItemDietary(item.dietary || "veg");
    setEditItemImageUrl(item.imageUrl || "");
    setEditItemPopular(Boolean(item.popular));
    setEditItemError("");
    setPreviewItemId(item.id);
  };

  const handleSaveEditItem = () => {
    if (!editingItemId) return;
    setEditItemError("");

    const trimmedName = editItemName.trim();
    if (!trimmedName) {
      setEditItemError("Item name is required.");
      return;
    }
    if (trimmedName.length > 80) {
      setEditItemError("Item name must be 80 characters or fewer.");
      return;
    }

    const priceStr = editItemPrice.trim();
    if (priceStr && !/^\d+(\.\d{1,2})?$/.test(priceStr)) {
      setEditItemError("Price must be a valid number with at most 2 decimal places.");
      return;
    }

    const descStr = editItemDesc.trim();
    if (descStr.length > 300) {
      setEditItemError("Description must be 300 characters or fewer.");
      return;
    }

    const nextItems = items.map((i) =>
      i.id === editingItemId
        ? {
            ...i,
            name: trimmedName,
            price: priceStr || undefined,
            description: descStr || undefined,
            categoryId: editItemCategory || i.categoryId,
            dietary: editItemDietary,
            imageUrl: editItemImageUrl.trim() || undefined,
            popular: editItemPopular,
          }
        : i
    );

    onChange({
      ...config,
      categories,
      items: nextItems,
      quick_requests: quickRequests,
    });

    setEditingItemId(null);
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete "${itemName}"?`)) return;
    const nextItems = items.filter((i) => i.id !== itemId);
    onChange({
      ...config,
      categories,
      items: nextItems,
      quick_requests: quickRequests,
    });
    if (previewItemId === itemId) {
      setPreviewItemId(null);
    }
  };

  /* =========================================================
     QUICK REQUESTS ACTIONS
  ========================================================= */

  const handleAddQuickRequest = () => {
    const trimmed = newQuickRequestText.trim();
    if (!trimmed) return;
    if (trimmed.length > 30) return;
    if (quickRequests.length >= 12) return;
    if (quickRequests.includes(trimmed)) return;

    const next = [...quickRequests, trimmed];
    onChange({
      ...config,
      categories,
      items,
      quick_requests: next,
    });
    setNewQuickRequestText("");
  };

  const handleRemoveQuickRequest = (index: number) => {
    const next = quickRequests.filter((_, i) => i !== index);
    onChange({
      ...config,
      categories,
      items,
      quick_requests: next,
    });
  };

  const handleMoveQuickRequest = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= quickRequests.length) return;

    const next = [...quickRequests];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;

    onChange({
      ...config,
      categories,
      items,
      quick_requests: next,
    });
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div style={styles.container}>
      {/* HEADER BAR */}
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.mainTitle}>Digital Menu Manager</h2>
          <p style={styles.mainSubtitle}>
            Configure your customer-facing menu, categories, item availability, and custom order requests.
          </p>
        </div>

        {onPreviewCustomerMenu && (
          <button
            type="button"
            onClick={onPreviewCustomerMenu}
            style={styles.previewMenuButton}
          >
            <span>↗</span>
            <span>View customer menu</span>
          </button>
        )}
      </div>

      {/* METRICS & LIMITS BAR */}
      <div style={styles.limitsBar}>
        <div style={styles.limitPill}>
          <span style={styles.limitLabel}>Categories:</span>
          <strong>
            {categories.length} / {MAX_CATEGORIES}
          </strong>
        </div>

        <div style={styles.limitPill}>
          <span style={styles.limitLabel}>Menu Items:</span>
          <strong>
            {items.length} / {MAX_ITEMS}
          </strong>
        </div>

        <div
          style={{
            ...styles.limitPill,
            borderColor: isOverPayloadLimit
              ? "#f87171"
              : isNearPayloadLimit
              ? "#fbbf24"
              : "#e2e8f0",
            background: isOverPayloadLimit
              ? "#fef2f2"
              : isNearPayloadLimit
              ? "#fffbeb"
              : "#ffffff",
          }}
        >
          <span style={styles.limitLabel}>Saved size:</span>
          <strong>{payloadSizeKb} KB / 300 KB</strong>
        </div>
      </div>

      {isOverPayloadLimit && (
        <div style={styles.alertError}>
          Warning: Menu data exceeds the 300 KB limit. Please reduce image URL lengths or item descriptions.
        </div>
      )}

      {/* SECTION 1: CATEGORIES */}
      <section style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div style={styles.stepBadge}>1</div>
          <div>
            <h3 style={styles.sectionTitle}>Categories</h3>
            <p style={styles.sectionSubtitle}>
              Organize your menu into sections (e.g. Starters, Main Course, Beverages, Desserts).
            </p>
          </div>
        </div>

        {/* Add Category Form */}
        <div style={styles.formRow}>
          <div style={{ flex: 1 }}>
            <label style={styles.inputLabel}>
              Category Name <span style={{ color: "#ef4444" }}>*</span> (max 80 chars)
            </label>
            <input
              type="text"
              placeholder="e.g. Appetizers, Main Course"
              maxLength={80}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              disabled={categories.length >= MAX_CATEGORIES}
              style={styles.input}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={styles.inputLabel}>Description (optional)</label>
            <input
              type="text"
              placeholder="e.g. Freshly prepared tandoor specials"
              maxLength={150}
              value={newCategoryDesc}
              onChange={(e) => setNewCategoryDesc(e.target.value)}
              disabled={categories.length >= MAX_CATEGORIES}
              style={styles.input}
            />
          </div>

          <button
            type="button"
            onClick={handleAddCategory}
            disabled={categories.length >= MAX_CATEGORIES || !newCategoryName.trim()}
            style={styles.primaryButton}
          >
            + Add Category
          </button>
        </div>

        {categoryError && <div style={styles.fieldError}>{categoryError}</div>}

        {/* Categories List */}
        <div style={styles.categoryList}>
          {categories.length === 0 ? (
            <div style={styles.emptyNotice}>No categories added yet. Add your first category above.</div>
          ) : (
            categories.map((cat, idx) => {
              const count = items.filter((i) => i.categoryId === cat.id).length;
              const isEditing = editingCategoryId === cat.id;

              return (
                <div key={cat.id} style={styles.categoryItem}>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: "8px", flex: 1, alignItems: "center" }}>
                      <input
                        type="text"
                        maxLength={80}
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        style={styles.input}
                      />
                      <input
                        type="text"
                        maxLength={150}
                        value={editCategoryDesc}
                        onChange={(e) => setEditCategoryDesc(e.target.value)}
                        placeholder="Description"
                        style={styles.input}
                      />
                      <button
                        type="button"
                        onClick={handleSaveEditCategory}
                        style={styles.smallPrimaryButton}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategoryId(null)}
                        style={styles.smallSecondaryButton}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={styles.categoryNameText}>{cat.name}</span>
                          <span style={styles.itemCountChip}>{count} items</span>
                        </div>
                        {cat.description && (
                          <div style={styles.categoryDescText}>{cat.description}</div>
                        )}
                      </div>

                      <div style={styles.itemActionGroup}>
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(idx, "up")}
                          disabled={idx === 0}
                          title="Move Up"
                          style={styles.iconButton}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(idx, "down")}
                          disabled={idx === categories.length - 1}
                          title="Move Down"
                          style={styles.iconButton}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(cat)}
                          style={styles.smallSecondaryButton}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          style={styles.deleteButton}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* SECTION 2: MENU ITEMS */}
      <section style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div style={styles.stepBadge}>2</div>
          <div>
            <h3 style={styles.sectionTitle}>Menu Items</h3>
            <p style={styles.sectionSubtitle}>
              Add, edit, and instantly toggle items between Available and Sold out.
            </p>
          </div>
        </div>

        {/* Add Item Form */}
        <div style={styles.itemFormContainer}>
          <h4 style={styles.subsectionTitle}>+ Add New Dish / Drink</h4>

          {categories.length === 0 ? (
            <div style={styles.emptyNotice}>
              Please create at least one category above before adding menu items.
            </div>
          ) : (
            <>
              <div style={styles.formGrid}>
                <div>
                  <label style={styles.inputLabel}>
                    Item Name <span style={{ color: "#ef4444" }}>*</span> (1-80 chars)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Butter Chicken, Cold Brew"
                    maxLength={80}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div>
                  <label style={styles.inputLabel}>
                    Price (₹) <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 350 or 120.50"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div>
                  <label style={styles.inputLabel}>Category</label>
                  <select
                    value={newItemCategory || categories[0]?.id || ""}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    style={styles.select}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.inputLabel}>Dietary Type</label>
                  <select
                    value={newItemDietary}
                    onChange={(e) =>
                      setNewItemDietary(
                        e.target.value as "veg" | "non_veg" | "egg" | "none"
                      )
                    }
                    style={styles.select}
                  >
                    <option value="veg">🟢 Vegetarian (Veg)</option>
                    <option value="non_veg">🔴 Non-Vegetarian</option>
                    <option value="egg">🟡 Contains Egg</option>
                    <option value="none">⚪ Not Specified</option>
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.inputLabel}>
                    Description (max 300 chars, {300 - newItemDesc.length} left)
                  </label>
                  <textarea
                    placeholder="e.g. Tender boneless chicken in rich tomato, butter and cream gravy."
                    maxLength={300}
                    rows={2}
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    style={styles.textarea}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.inputLabel}>Image URL (optional)</label>
                  <input
                    type="url"
                    placeholder="https://images.example.com/dish.jpg"
                    value={newItemImageUrl}
                    onChange={(e) => setNewItemImageUrl(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.checkboxRow}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={newItemPopular}
                    onChange={(e) => setNewItemPopular(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span>Mark as Bestseller / Popular dish</span>
                </label>

                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={items.length >= MAX_ITEMS || !newItemName.trim()}
                  style={styles.primaryButton}
                >
                  + Add Item to Menu
                </button>
              </div>

              {itemError && <div style={styles.fieldError}>{itemError}</div>}
            </>
          )}
        </div>

        {/* Search & Category Filter for items */}
        <div style={styles.filterBar}>
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search items by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={styles.clearSearchBtn}
              >
                ✕
              </button>
            )}
          </div>

          <div style={styles.categoryFilterRow}>
            <button
              type="button"
              onClick={() => setActiveCategoryTab("all")}
              style={{
                ...styles.categoryFilterChip,
                ...(activeCategoryTab === "all" ? styles.categoryFilterChipActive : {}),
              }}
            >
              All ({items.length})
            </button>
            {categories.map((c) => {
              const count = items.filter((i) => i.categoryId === c.id).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategoryTab(c.id)}
                  style={{
                    ...styles.categoryFilterChip,
                    ...(activeCategoryTab === c.id
                      ? styles.categoryFilterChipActive
                      : {}),
                  }}
                >
                  {c.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Items Grid & Live Preview Split */}
        <div style={styles.itemsAndPreviewWrap}>
          {/* Item List */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {filteredItems.length === 0 ? (
              <div style={styles.emptyNotice}>
                {searchQuery
                  ? "No menu items match your search."
                  : "No items in this category. Add an item above."}
              </div>
            ) : (
              <div style={styles.itemsListContainer}>
                {filteredItems.map((item) => {
                  const cat = categories.find((c) => c.id === item.categoryId);
                  const isAvailable = item.available !== false;
                  const isEditing = editingItemId === item.id;

                  if (isEditing) {
                    return (
                      <div key={item.id} style={styles.editItemCard}>
                        <div style={styles.editItemHeader}>
                          <strong>Editing "{item.name}"</strong>
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            style={styles.smallSecondaryButton}
                          >
                            Cancel
                          </button>
                        </div>

                        <div style={styles.formGrid}>
                          <div>
                            <label style={styles.inputLabel}>Name (1-80 chars)</label>
                            <input
                              type="text"
                              maxLength={80}
                              value={editItemName}
                              onChange={(e) => setEditItemName(e.target.value)}
                              style={styles.input}
                            />
                          </div>

                          <div>
                            <label style={styles.inputLabel}>Price (₹)</label>
                            <input
                              type="text"
                              value={editItemPrice}
                              onChange={(e) => setEditItemPrice(e.target.value)}
                              style={styles.input}
                            />
                          </div>

                          <div>
                            <label style={styles.inputLabel}>Category</label>
                            <select
                              value={editItemCategory}
                              onChange={(e) => setEditItemCategory(e.target.value)}
                              style={styles.select}
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={styles.inputLabel}>Dietary</label>
                            <select
                              value={editItemDietary}
                              onChange={(e) =>
                                setEditItemDietary(
                                  e.target.value as "veg" | "non_veg" | "egg" | "none"
                                )
                              }
                              style={styles.select}
                            >
                              <option value="veg">🟢 Vegetarian</option>
                              <option value="non_veg">🔴 Non-Vegetarian</option>
                              <option value="egg">🟡 Contains Egg</option>
                              <option value="none">⚪ Not Specified</option>
                            </select>
                          </div>

                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={styles.inputLabel}>
                              Description (max 300 chars, {300 - editItemDesc.length} left)
                            </label>
                            <textarea
                              maxLength={300}
                              rows={2}
                              value={editItemDesc}
                              onChange={(e) => setEditItemDesc(e.target.value)}
                              style={styles.textarea}
                            />
                          </div>

                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={styles.inputLabel}>Image URL</label>
                            <input
                              type="url"
                              value={editItemImageUrl}
                              onChange={(e) => setEditItemImageUrl(e.target.value)}
                              style={styles.input}
                            />
                          </div>
                        </div>

                        <div style={styles.checkboxRow}>
                          <label style={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={editItemPopular}
                              onChange={(e) => setEditItemPopular(e.target.checked)}
                              style={styles.checkbox}
                            />
                            <span>Bestseller / Popular</span>
                          </label>

                          <button
                            type="button"
                            onClick={handleSaveEditItem}
                            style={styles.primaryButton}
                          >
                            Save Changes
                          </button>
                        </div>

                        {editItemError && (
                          <div style={styles.fieldError}>{editItemError}</div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      onClick={() => setPreviewItemId(item.id)}
                      style={{
                        ...styles.itemRowCard,
                        ...(previewItemId === item.id ? styles.itemRowCardSelected : {}),
                        opacity: isAvailable ? 1 : 0.65,
                      }}
                    >
                      {/* Thumbnail or Initial */}
                      <div style={styles.thumbnailBox}>
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            loading="lazy"
                            style={styles.thumbnailImg}
                          />
                        ) : (
                          <div style={styles.thumbnailPlaceholder}>
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {item.dietary === "veg" && (
                            <span style={styles.vegIndicator} title="Vegetarian">
                              <span style={styles.vegDot} />
                            </span>
                          )}
                          {item.dietary === "non_veg" && (
                            <span style={styles.nonVegIndicator} title="Non-Vegetarian">
                              <span style={styles.nonVegDot} />
                            </span>
                          )}
                          {item.dietary === "egg" && (
                            <span style={styles.eggIndicator} title="Contains Egg">
                              <span style={styles.eggDot} />
                            </span>
                          )}

                          <span style={styles.itemNameText}>{item.name}</span>

                          {item.popular && (
                            <span style={styles.bestsellerBadge}>Bestseller</span>
                          )}
                        </div>

                        <div style={styles.itemMetaLine}>
                          <strong style={styles.itemPriceText}>
                            {item.price ? `₹${item.price}` : "Price upon request"}
                          </strong>
                          {cat && <span style={styles.itemCatLabel}>• {cat.name}</span>}
                        </div>

                        {item.description && (
                          <p style={styles.itemDescClamped}>{item.description}</p>
                        )}
                      </div>

                      {/* Quick Available/Sold-Out Switch + Tools */}
                      <div style={styles.itemActionsRight}>
                        {/* 1-TAP SOLD OUT SWITCH */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAvailability(item.id);
                          }}
                          style={{
                            ...styles.soldOutToggle,
                            background: isAvailable ? "#ecfdf5" : "#fef2f2",
                            borderColor: isAvailable ? "#a7f3d0" : "#fecaca",
                            color: isAvailable ? "#065f46" : "#991b1b",
                          }}
                          title={isAvailable ? "Click to mark Sold out" : "Click to mark Available"}
                        >
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: isAvailable ? "#10b981" : "#ef4444",
                              display: "inline-block",
                            }}
                          />
                          <span>{isAvailable ? "Available" : "Sold out"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditItem(item);
                          }}
                          style={styles.smallSecondaryButton}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id, item.name);
                          }}
                          style={styles.deleteButton}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Customer Card Preview */}
          <div style={styles.livePreviewColumn}>
            <div style={styles.previewStickyBox}>
              <div style={styles.previewHeader}>
                <span style={styles.previewTitle}>Live Customer Preview</span>
                <span style={styles.previewSubtitle}>Customer tap view</span>
              </div>

              {previewItem ? (
                <div style={styles.customerCardPreview}>
                  <div style={styles.previewImageContainer}>
                    {previewItem.imageUrl ? (
                      <img
                        src={previewItem.imageUrl}
                        alt={previewItem.name}
                        loading="lazy"
                        decoding="async"
                        style={styles.previewImg}
                      />
                    ) : (
                      <div style={styles.previewImagePlaceholder}>
                        <span>{previewItem.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}

                    {previewItem.popular && (
                      <span style={styles.previewBadgeBestseller}>Bestseller</span>
                    )}

                    {previewItem.available === false && (
                      <div style={styles.previewSoldOutOverlay}>
                        <span>Sold out</span>
                      </div>
                    )}
                  </div>

                  <div style={styles.previewContentBox}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {previewItem.dietary === "veg" && (
                        <span style={styles.vegIndicator}>
                          <span style={styles.vegDot} />
                        </span>
                      )}
                      {previewItem.dietary === "non_veg" && (
                        <span style={styles.nonVegIndicator}>
                          <span style={styles.nonVegDot} />
                        </span>
                      )}
                      {previewItem.dietary === "egg" && (
                        <span style={styles.eggIndicator}>
                          <span style={styles.eggDot} />
                        </span>
                      )}
                      <h4 style={styles.previewItemName}>{previewItem.name}</h4>
                    </div>

                    <div style={styles.previewItemPrice}>
                      {previewItem.price ? `₹${previewItem.price}` : "₹—"}
                    </div>

                    <p style={styles.previewItemDesc}>
                      {previewItem.description || "No description provided."}
                    </p>

                    <div style={styles.previewItemBottom}>
                      {previewItem.available === false ? (
                        <button type="button" disabled style={styles.previewDisabledAddBtn}>
                          Sold out
                        </button>
                      ) : (
                        <button type="button" disabled style={styles.previewAddBtn}>
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={styles.previewEmptyNotice}>
                  Select or add an item to see its live appearance.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: QUICK REQUEST CHIPS (Part C) */}
      <section style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div style={styles.stepBadge}>3</div>
          <div>
            <h3 style={styles.sectionTitle}>Quick-Request Chips</h3>
            <p style={styles.sectionSubtitle}>
              Chips appear on customer order items so guests can customize with 1 tap (e.g. "Less spicy", "No onion").
            </p>
          </div>
        </div>

        <div style={styles.quickRequestControls}>
          <div style={{ display: "flex", gap: "8px", flex: 1 }}>
            <input
              type="text"
              placeholder="e.g. Jain, Extra crispy, No garlic"
              maxLength={30}
              value={newQuickRequestText}
              onChange={(e) => setNewQuickRequestText(e.target.value)}
              disabled={quickRequests.length >= 12}
              style={styles.input}
            />
            <button
              type="button"
              onClick={handleAddQuickRequest}
              disabled={quickRequests.length >= 12 || !newQuickRequestText.trim()}
              style={styles.primaryButton}
            >
              + Add Chip ({quickRequests.length}/12)
            </button>
          </div>
        </div>

        <div style={styles.chipsRow}>
          {quickRequests.map((req, idx) => (
            <div key={req} style={styles.chipTag}>
              <span style={styles.chipText}>{req}</span>
              <div style={{ display: "flex", gap: "2px" }}>
                <button
                  type="button"
                  onClick={() => handleMoveQuickRequest(idx, "left")}
                  disabled={idx === 0}
                  title="Move left"
                  style={styles.chipMoveBtn}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveQuickRequest(idx, "right")}
                  disabled={idx === quickRequests.length - 1}
                  title="Move right"
                  style={styles.chipMoveBtn}
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveQuickRequest(idx)}
                  title="Remove chip"
                  style={styles.chipRemoveBtn}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    fontFamily: "inherit",
    color: "#0f172a",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    paddingBottom: "12px",
    borderBottom: "1px solid #e2e8f0",
  },
  mainTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "#0f172a",
  },
  mainSubtitle: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "#64748b",
    lineHeight: 1.5,
  },
  previewMenuButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    minHeight: "44px",
  },
  limitsBar: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  limitPill: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    borderRadius: "8px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    fontSize: "12px",
    color: "#334155",
  },
  limitLabel: {
    color: "#64748b",
  },
  alertError: {
    padding: "10px 14px",
    borderRadius: "8px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: "12px",
    fontWeight: 600,
  },
  sectionCard: {
    padding: "20px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "16px",
  },
  stepBadge: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    background: "#0f172a",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: "13px",
    fontWeight: 800,
    flexShrink: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 800,
    color: "#0f172a",
  },
  sectionSubtitle: {
    margin: "3px 0 0",
    fontSize: "12px",
    color: "#64748b",
  },
  formRow: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-end",
    flexWrap: "wrap",
    marginBottom: "12px",
  },
  inputLabel: {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    color: "#475569",
    marginBottom: "5px",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  input: {
    width: "100%",
    height: "44px",
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "#ffffff",
    fontSize: "13px",
    color: "#0f172a",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    height: "44px",
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "#ffffff",
    fontSize: "13px",
    color: "#0f172a",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "#ffffff",
    fontSize: "13px",
    color: "#0f172a",
    fontFamily: "inherit",
    boxSizing: "border-box",
    resize: "vertical",
  },
  primaryButton: {
    height: "44px",
    padding: "0 18px",
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  smallPrimaryButton: {
    height: "36px",
    padding: "0 12px",
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  smallSecondaryButton: {
    height: "36px",
    padding: "0 12px",
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  deleteButton: {
    height: "36px",
    padding: "0 12px",
    background: "#fff1f2",
    color: "#be123c",
    border: "1px solid #fecdd3",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  iconButton: {
    width: "36px",
    height: "36px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    display: "grid",
    placeItems: "center",
    fontSize: "14px",
    fontWeight: 700,
    color: "#334155",
    cursor: "pointer",
  },
  fieldError: {
    color: "#dc2626",
    fontSize: "12px",
    marginTop: "6px",
    fontWeight: 600,
  },
  categoryList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "14px",
  },
  categoryItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 14px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
  },
  categoryNameText: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#0f172a",
  },
  itemCountChip: {
    padding: "2px 8px",
    borderRadius: "999px",
    background: "#e2e8f0",
    color: "#475569",
    fontSize: "11px",
    fontWeight: 700,
  },
  categoryDescText: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "2px",
  },
  itemActionGroup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  emptyNotice: {
    padding: "20px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
    background: "#f8fafc",
    borderRadius: "10px",
    border: "1px dashed #cbd5e1",
  },
  itemFormContainer: {
    padding: "16px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    marginBottom: "20px",
  },
  subsectionTitle: {
    margin: "0 0 12px",
    fontSize: "14px",
    fontWeight: 800,
    color: "#0f172a",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },
  checkboxRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "14px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
    cursor: "pointer",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    accentColor: "#0f172a",
    cursor: "pointer",
  },
  filterBar: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "16px",
  },
  searchBox: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: "14px",
    fontSize: "14px",
    pointerEvents: "none",
    color: "#94a3b8",
  },
  searchInput: {
    width: "100%",
    height: "44px",
    padding: "0 38px 0 38px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "13px",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  clearSearchBtn: {
    position: "absolute",
    right: "12px",
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: "14px",
    cursor: "pointer",
  },
  categoryFilterRow: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: "4px",
  },
  categoryFilterChip: {
    padding: "6px 14px",
    borderRadius: "999px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#475569",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  categoryFilterChipActive: {
    background: "#0f172a",
    borderColor: "#0f172a",
    color: "#ffffff",
  },
  itemsAndPreviewWrap: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  itemsListContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  itemRowCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "12px 14px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
    cursor: "pointer",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  itemRowCardSelected: {
    borderColor: "#0f172a",
    boxShadow: "0 0 0 1px #0f172a",
  },
  thumbnailBox: {
    width: "56px",
    height: "56px",
    borderRadius: "10px",
    overflow: "hidden",
    background: "#f1f5f9",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
  },
  thumbnailImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  thumbnailPlaceholder: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#64748b",
  },
  vegIndicator: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    border: "1px solid #16a34a",
    borderRadius: "3px",
    background: "#ffffff",
    flexShrink: 0,
  },
  vegDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#16a34a",
  },
  nonVegIndicator: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    border: "1px solid #dc2626",
    borderRadius: "3px",
    background: "#ffffff",
    flexShrink: 0,
  },
  nonVegDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#dc2626",
  },
  eggIndicator: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    border: "1px solid #d97706",
    borderRadius: "3px",
    background: "#ffffff",
    flexShrink: 0,
  },
  eggDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#d97706",
  },
  itemNameText: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#0f172a",
  },
  bestsellerBadge: {
    padding: "2px 6px",
    borderRadius: "4px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: "10px",
    fontWeight: 800,
    textTransform: "uppercase",
  },
  itemMetaLine: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "2px",
  },
  itemPriceText: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#0f172a",
  },
  itemCatLabel: {
    fontSize: "12px",
    color: "#64748b",
  },
  itemDescClamped: {
    margin: "4px 0 0",
    fontSize: "12px",
    color: "#64748b",
    lineHeight: 1.4,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  itemActionsRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  soldOutToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
    minHeight: "36px",
    fontFamily: "inherit",
  },
  editItemCard: {
    padding: "16px",
    background: "#f8fafc",
    border: "1px solid #94a3b8",
    borderRadius: "12px",
  },
  editItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  livePreviewColumn: {
    width: "280px",
    flexShrink: 0,
  },
  previewStickyBox: {
    position: "sticky",
    top: "16px",
    padding: "16px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
  },
  previewHeader: {
    marginBottom: "12px",
  },
  previewTitle: {
    display: "block",
    fontSize: "13px",
    fontWeight: 800,
    color: "#0f172a",
  },
  previewSubtitle: {
    fontSize: "11px",
    color: "#64748b",
  },
  customerCardPreview: {
    background: "#ffffff",
    borderRadius: "14px",
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
  },
  previewImageContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    background: "#f1f5f9",
    overflow: "hidden",
  },
  previewImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  previewImagePlaceholder: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    fontSize: "36px",
    fontWeight: 900,
    color: "#94a3b8",
    background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
  },
  previewBadgeBestseller: {
    position: "absolute",
    top: "8px",
    left: "8px",
    padding: "3px 8px",
    borderRadius: "6px",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: 800,
    textTransform: "uppercase",
  },
  previewSoldOutOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(15, 23, 42, 0.65)",
    backdropFilter: "blur(2px)",
    display: "grid",
    placeItems: "center",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  previewContentBox: {
    padding: "12px",
  },
  previewItemName: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 800,
    color: "#0f172a",
  },
  previewItemPrice: {
    marginTop: "4px",
    fontSize: "14px",
    fontWeight: 800,
    color: "#0f172a",
  },
  previewItemDesc: {
    margin: "6px 0 10px",
    fontSize: "11px",
    color: "#64748b",
    lineHeight: 1.4,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  previewItemBottom: {
    display: "flex",
    justifyContent: "flex-end",
  },
  previewAddBtn: {
    padding: "6px 14px",
    borderRadius: "8px",
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "default",
  },
  previewDisabledAddBtn: {
    padding: "6px 14px",
    borderRadius: "8px",
    background: "#e2e8f0",
    color: "#94a3b8",
    border: "none",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "not-allowed",
  },
  previewEmptyNotice: {
    padding: "30px 10px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "12px",
  },
  quickRequestControls: {
    display: "flex",
    gap: "12px",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  chipsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  chipTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
    color: "#1e293b",
    fontWeight: 600,
  },
  chipText: {
    userSelect: "none",
  },
  chipMoveBtn: {
    background: "transparent",
    border: "none",
    padding: "0 2px",
    fontSize: "14px",
    color: "#64748b",
    cursor: "pointer",
  },
  chipRemoveBtn: {
    background: "transparent",
    border: "none",
    padding: "0 4px",
    fontSize: "12px",
    color: "#94a3b8",
    cursor: "pointer",
    fontWeight: 700,
  },
};
