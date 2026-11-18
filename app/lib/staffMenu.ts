/**
 * Parses digital_menu module configuration into structured categories and items
 * for staff and owner order entry.
 */

export type StaffMenuCategory = {
  id: string;
  name: string;
  description?: string;
};

export type StaffMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  price?: string | number;
  description?: string;
  imageUrl?: string;
  dietary?: "veg" | "non_veg" | "egg" | "none" | "vegan";
  popular?: boolean;
  available?: boolean;
};

function normalizeModuleKey(key?: string | null): string {
  if (!key) return "";
  return key.toLowerCase().replace(/[\s\-_]+/g, "_").trim();
}

export function parseStaffMenu(moduleConfigs: Array<{ module_key: string; config: unknown }> | null | undefined): {
  categories: StaffMenuCategory[];
  items: StaffMenuItem[];
} {
  if (!Array.isArray(moduleConfigs) || moduleConfigs.length === 0) {
    return { categories: [], items: [] };
  }

  const digitalMenuConfig = moduleConfigs.find((m) => {
    const k = normalizeModuleKey(m?.module_key);
    return k === "digital_menu" || k === "digitalmenu";
  });

  const rawConfig = (digitalMenuConfig?.config && typeof digitalMenuConfig.config === "object"
    ? digitalMenuConfig.config
    : {}) as Record<string, unknown>;

  const rawCategories = Array.isArray(rawConfig.categories) ? rawConfig.categories : [];
  const rawItems = Array.isArray(rawConfig.items) ? rawConfig.items : [];

  const validCategories: StaffMenuCategory[] = rawCategories
    .filter((cat): cat is Record<string, unknown> => Boolean(cat && typeof cat === "object" && cat.id && cat.name))
    .map((cat) => ({
      id: String(cat.id),
      name: String(cat.name).trim(),
      description: typeof cat.description === "string" ? cat.description.trim() : undefined,
    }));

  const validItems: StaffMenuItem[] = rawItems
    .filter((it): it is Record<string, unknown> => Boolean(it && typeof it === "object" && it.id && it.name))
    .map((it) => ({
      id: String(it.id),
      categoryId: String(it.categoryId || it.category_id || ""),
      name: String(it.name).trim(),
      price: it.price !== undefined ? (it.price as string | number) : undefined,
      description: typeof it.description === "string" ? it.description.trim() : undefined,
      imageUrl: typeof it.imageUrl === "string" ? it.imageUrl : typeof it.image_url === "string" ? it.image_url : undefined,
      dietary: (["veg", "non_veg", "egg", "none", "vegan"].includes(String(it.dietary))
        ? it.dietary
        : undefined) as StaffMenuItem["dietary"],
      popular: Boolean(it.popular),
      available: it.available !== false,
    }));

  return { categories: validCategories, items: validItems };
}
