"use client";
import type { ReactNode } from "react";

export type Feature = {
  id: string;
  feature_key: string;
  name: string;
  description: string | null;
  category: string;
  is_core: boolean;
  is_paid: boolean;
  is_active: boolean;
  icon: string | null;
  sort_order: number;
};

type Config = Record<string, any>;

type Props = {
  feature: Feature;
  config: Config;
  onChange: (config: Config) => void;
};

type Item = {
  id: string;
  name: string;
  price?: string;
  description?: string;
  duration?: string;
};

type ServiceCategory = {
  id: string;
  name: string;
  description?: string;
};

type ServiceConfigItem = {
  id: string;
  name: string;
  categoryId?: string;
  category?: string;
  price?: string;
  priceType?: "fixed" | "starting_from";
  duration?: string;
  description?: string;
  popular?: boolean;
  available?: boolean;
};

export default function ModuleConfigurator({
  feature,
  config,
  onChange,
}: Props) {
  const key = normalizeKey(
    feature.feature_key,
    feature.name
  );

  switch (key) {
    case "services_catalogue":
      return (
        <Services
          feature={feature}
          config={config}
          onChange={onChange}
        />
      );

    case "product_catalogue":
      return (
        <Products
          feature={feature}
          config={config}
          onChange={onChange}
        />
      );

    case "digital_menu":
      return (
        <Menu
          feature={feature}
          config={config}
          onChange={onChange}
        />
      );

    case "offers_promotions":
      return (
        <Offers
          feature={feature}
          config={config}
          onChange={onChange}
        />
      );

    case "appointment_booking":
      return (
        <Appointments
          feature={feature}
          config={config}
          onChange={onChange}
        />
      );

    case "customer_loyalty":
      return (
        <Loyalty
          feature={feature}
          config={config}
          onChange={onChange}
        />
      );

    case "table_ordering":
      return (
        <TableOrdering
          feature={feature}
          config={config}
          onChange={onChange}
        />
      );

    case "hotel_services":
      return (
        <HotelServices
          feature={feature}
          config={config}
          onChange={onChange}
        />
      );

    case "room_service":
      return (
        <RoomService
          feature={feature}
          config={config}
          onChange={onChange}
        />
      );

    default:
      return (
        <Generic
          feature={feature}
          config={config}
          onChange={onChange}
        />
      );
  }
}

/* =========================================================
   FEATURE KEY NORMALIZATION
========================================================= */

function normalizeKey(
  key: string,
  name: string
) {
  const value = `${key} ${name}`
    .toLowerCase()
    .replace(/&/g, "and");

  if (
    value.includes("service") &&
    value.includes("catalogue")
  ) {
    return "services_catalogue";
  }

  if (
    value.includes("product") &&
    value.includes("catalogue")
  ) {
    return "product_catalogue";
  }

  if (
    value.includes("digital") &&
    value.includes("menu")
  ) {
    return "digital_menu";
  }

  if (
    value.includes("appointment") &&
    value.includes("booking")
  ) {
    return "appointment_booking";
  }

  if (
    value.includes("offer") ||
    value.includes("promotion")
  ) {
    return "offers_promotions";
  }

  if (
    value.includes("loyalty") ||
    value.includes("reward")
  ) {
    return "customer_loyalty";
  }

  if (
    value.includes("table") &&
    value.includes("order")
  ) {
    return "table_ordering";
  }

  if (
    value.includes("hotel") &&
    value.includes("service")
  ) {
    return "hotel_services";
  }

  if (
    value.includes("room") &&
    value.includes("service")
  ) {
    return "room_service";
  }

  return key;
}

/* =========================================================
   SERVICES
========================================================= */

function Services({
  feature,
  config,
  onChange,
}: Props) {
  const storedServices: ServiceConfigItem[] = Array.isArray(
    config.services
  )
    ? config.services
    : [];

  const storedCategories: ServiceCategory[] = Array.isArray(
    config.categories
  )
    ? config.categories
    : [];

  // Backward compatibility for services created before categories existed.
  const categories: ServiceCategory[] =
    storedCategories.length > 0
      ? storedCategories
      : storedServices.length > 0
        ? [
            {
              id: "general-services",
              name: "General Services",
              description: "",
            },
          ]
        : [];

  const services: ServiceConfigItem[] = storedServices.map((service) => {
    const matchingCategory = categories.find(
      (category) =>
        category.id === service.categoryId ||
        category.name.toLowerCase() ===
          String(service.category || "").trim().toLowerCase()
    );

    return {
      ...service,
      categoryId: matchingCategory?.id || categories[0]?.id,
      category:
        matchingCategory?.name ||
        String(service.category || "General Services").trim() ||
        "General Services",
      available: service.available !== false,
      priceType:
        service.priceType === "starting_from"
          ? "starting_from"
          : "fixed",
    };
  });

  const draft = (config.__serviceDraft || {}) as Record<string, any>;

  function updateDraft(field: string, value: string | boolean) {
    onChange({
      ...config,
      __serviceDraft: {
        ...draft,
        [field]: value,
      },
    });
  }

  function clearDraft() {
    const nextConfig = { ...config };
    delete nextConfig.__serviceDraft;
    onChange(nextConfig);
  }

  function addCategory() {
    const name = String(draft.categoryName || "").trim();
    if (!name) return;

    const duplicate = categories.some(
      (category) => category.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (duplicate) return;

    const category: ServiceCategory = {
      id: makeId(),
      name,
      description: String(draft.categoryDescription || "").trim(),
    };

    onChange({
      ...config,
      categories: [...categories, category],
      services,
      __serviceDraft: {
        ...draft,
        categoryName: "",
        categoryDescription: "",
        serviceCategoryId: category.id,
      },
    });
  }

  function removeCategory(categoryId: string) {
    const categoryServices = services.filter(
      (service) => service.categoryId === categoryId
    );

    if (categoryServices.length > 0) {
      return;
    }

    const nextCategories = categories.filter(
      (category) => category.id !== categoryId
    );

    const nextConfig = {
      ...config,
      categories: nextCategories,
      services,
    };

    onChange(nextConfig);
  }

  function addService() {
    const name = String(draft.serviceName || "").trim();
    if (!name) return;

    if (!categories.length) return;

    const categoryId = String(
      draft.serviceCategoryId || categories[0].id
    );

    const category = categories.find(
      (item) => item.id === categoryId
    );

    if (!category) return;

    const service: ServiceConfigItem = {
      id: makeId(),
      name,
      categoryId: category.id,
      category: category.name,
      price: String(draft.servicePrice || "").trim(),
      priceType:
        draft.servicePriceType === "starting_from"
          ? "starting_from"
          : "fixed",
      duration: String(draft.serviceDuration || "").trim(),
      description: String(draft.serviceDescription || "").trim(),
      popular: draft.servicePopular === true,
      available: true,
    };

    onChange({
      ...config,
      categories,
      services: [...services, service],
    });
  }

  function removeService(serviceId: string) {
    onChange({
      ...config,
      categories,
      services: services.filter(
        (service) => service.id !== serviceId
      ),
    });
  }

  function toggleAvailable(serviceId: string) {
    onChange({
      ...config,
      categories,
      services: services.map((service) =>
        service.id === serviceId
          ? {
              ...service,
              available: service.available === false,
            }
          : service
      ),
    });
  }

  function togglePopular(serviceId: string) {
    onChange({
      ...config,
      categories,
      services: services.map((service) =>
        service.id === serviceId
          ? {
              ...service,
              popular: !service.popular,
            }
          : service
      ),
    });
  }

  function moveService(serviceId: string, categoryId: string) {
    const category = categories.find(
      (item) => item.id === categoryId
    );

    if (!category) return;

    onChange({
      ...config,
      categories,
      services: services.map((service) =>
        service.id === serviceId
          ? {
              ...service,
              categoryId: category.id,
              category: category.name,
            }
          : service
      ),
    });
  }

  return (
    <ModuleBox
      icon="💇"
      title="Services Catalogue"
      description="Create your own service categories and organize every service, price and duration this business offers."
    >
      <div className="service-builder">
        <div className="service-intro">
          <div>
            <strong>Build your service catalogue</strong>
            <p>
              Create categories such as Hair, Skin, Nails, Bridal, Spa or any
              categories your business needs. Then add services inside them.
            </p>
          </div>
          <span className="service-builder-badge">Salon-ready</span>
        </div>

        <div className="service-category-form">
          <div className="service-section-title">
            <span>1</span>
            <div>
              <strong>Service Categories</strong>
              <small>Organize your services into any categories you want.</small>
            </div>
          </div>

          <div className="service-form-grid category-grid">
            <Field
              label="Category name"
              placeholder="e.g. Hair"
              value={String(draft.categoryName || "")}
              onChange={(value) => updateDraft("categoryName", value)}
            />

            <Field
              label="Description (optional)"
              placeholder="e.g. Hair cutting and styling"
              value={String(draft.categoryDescription || "")}
              onChange={(value) => updateDraft("categoryDescription", value)}
            />

            <button
              type="button"
              className="service-primary-btn"
              onClick={addCategory}
            >
              + Add Category
            </button>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="service-category-list">
            {categories.map((category) => {
              const categoryServices = services.filter(
                (service) => service.categoryId === category.id
              );

              return (
                <div className="service-category-card" key={category.id}>
                  <div className="service-category-header">
                    <div>
                      <div className="service-category-name">
                        {category.name}
                      </div>
                      {category.description && (
                        <div className="service-category-description">
                          {category.description}
                        </div>
                      )}
                    </div>

                    <div className="service-category-actions">
                      <span className="service-count">
                        {categoryServices.length} service
                        {categoryServices.length === 1 ? "" : "s"}
                      </span>

                      <button
                        type="button"
                        className="service-danger-btn"
                        disabled={categoryServices.length > 0}
                        title={
                          categoryServices.length > 0
                            ? "Remove the services from this category first"
                            : "Delete category"
                        }
                        onClick={() => removeCategory(category.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {categoryServices.length === 0 && (
                    <div className="service-empty-category">
                      No services in this category yet.
                    </div>
                  )}

                  {categoryServices.length > 0 && (
                    <div className="service-list">
                      {categoryServices.map((service) => (
                        <div className="service-row" key={service.id}>
                          <div className="service-row-main">
                            <div className="service-name-line">
                              <strong>{service.name}</strong>

                              {service.popular && (
                                <span className="service-popular-badge">
                                  ★ Popular
                                </span>
                              )}

                              {service.available === false && (
                                <span className="service-hidden-badge">
                                  Hidden
                                </span>
                              )}
                            </div>

                            {service.description && (
                              <div className="service-description">
                                {service.description}
                              </div>
                            )}

                            <div className="service-meta">
                              {service.price ? (
                                <span>
                                  {service.priceType === "starting_from"
                                    ? "From "
                                    : ""}
                                  ₹{service.price}
                                </span>
                              ) : (
                                <span>Price on request</span>
                              )}

                              {service.duration && (
                                <span>• {service.duration}</span>
                              )}
                            </div>
                          </div>

                          <div className="service-row-actions">
                            <select
                              value={service.categoryId || ""}
                              onChange={(event) =>
                                moveService(
                                  service.id,
                                  event.target.value
                                )
                              }
                              title="Move to category"
                            >
                              {categories.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              className="service-action-btn"
                              onClick={() => togglePopular(service.id)}
                            >
                              {service.popular ? "Unfeature" : "Popular"}
                            </button>

                            <button
                              type="button"
                              className="service-action-btn"
                              onClick={() => toggleAvailable(service.id)}
                            >
                              {service.available === false ? "Show" : "Hide"}
                            </button>

                            <button
                              type="button"
                              className="service-danger-btn"
                              onClick={() => removeService(service.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="service-add-form">
          <div className="service-section-title">
            <span>2</span>
            <div>
              <strong>Add Service</strong>
              <small>Add a service and assign it to one of your categories.</small>
            </div>
          </div>

          {categories.length === 0 ? (
            <div className="service-info-box">
              Create at least one service category above before adding services.
            </div>
          ) : (
            <>
              <div className="service-form-grid service-fields-grid">
                <Field
                  label="Service name"
                  placeholder="e.g. Haircut"
                  value={String(draft.serviceName || "")}
                  onChange={(value) => updateDraft("serviceName", value)}
                />

                <label className="field">
                  <span className="field-label">Category</span>
                  <select
                    value={String(
                      draft.serviceCategoryId || categories[0]?.id || ""
                    )}
                    onChange={(event) =>
                      updateDraft("serviceCategoryId", event.target.value)
                    }
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <Field
                  label="Price"
                  placeholder="e.g. 500"
                  value={String(draft.servicePrice || "")}
                  onChange={(value) => updateDraft("servicePrice", value)}
                />

                <label className="field">
                  <span className="field-label">Price type</span>
                  <select
                    value={String(draft.servicePriceType || "fixed")}
                    onChange={(event) =>
                      updateDraft("servicePriceType", event.target.value)
                    }
                  >
                    <option value="fixed">Fixed price</option>
                    <option value="starting_from">Starting from</option>
                  </select>
                </label>

                <Field
                  label="Duration"
                  placeholder="e.g. 30 min"
                  value={String(draft.serviceDuration || "")}
                  onChange={(value) => updateDraft("serviceDuration", value)}
                />

                <Field
                  label="Description"
                  placeholder="e.g. Precision haircut and styling"
                  value={String(draft.serviceDescription || "")}
                  onChange={(value) => updateDraft("serviceDescription", value)}
                />
              </div>

              <div className="service-option-row">
                <label className="check-option">
                  <input
                    type="checkbox"
                    checked={draft.servicePopular === true}
                    onChange={(event) =>
                      updateDraft("servicePopular", event.target.checked)
                    }
                  />
                  Mark as Popular
                </label>

                <button
                  type="button"
                  className="service-secondary-btn"
                  onClick={clearDraft}
                >
                  Clear
                </button>

                <button
                  type="button"
                  className="service-primary-btn service-add-btn"
                  onClick={addService}
                >
                  + Add Service
                </button>
              </div>
            </>
          )}
        </div>

        <div className="service-builder-footer">
          <span>
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}
            &nbsp;•&nbsp; {services.length} service
            {services.length === 1 ? "" : "s"}
          </span>
          <span>Changes are saved with this client's TAPX module.</span>
        </div>
      </div>
    </ModuleBox>
  );
}

/* =========================================================
   PRODUCTS
========================================================= */

function Products({
  feature,
  config,
  onChange,
}: Props) {
  return (
    <ListModule
      feature={feature}
      config={config}
      onChange={onChange}
      arrayKey="products"
      icon="🛍️"
      title="Product Catalogue"
      description="Add products, prices and short descriptions."
      nameLabel="Product name"
      namePlaceholder="e.g. Premium Shirt"
      pricePlaceholder="e.g. 999"
      descriptionPlaceholder="Short product description"
      addLabel="Add Product"
    />
  );
}

/* =========================================================
   DIGITAL MENU
========================================================= */

function Menu({
  feature,
  config,
  onChange,
}: Props) {
  type MenuCategory = {
    id: string;
    name: string;
    description?: string;
  };

  type MenuItem = {
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

  const storedCategories: MenuCategory[] = Array.isArray(
    config.categories
  )
    ? config.categories
    : [];

  const storedItems: MenuItem[] = Array.isArray(
    config.items
  )
    ? config.items
    : [];

  // Backward compatibility: older Digital Menu data used a flat
  // `items` array. Keep those items visible under one default category.
  const categories: MenuCategory[] =
    storedCategories.length > 0
      ? storedCategories
      : storedItems.length > 0
        ? [
            {
              id: "default-menu",
              name: "Menu",
              description: "",
            },
          ]
        : [];

  const items: MenuItem[] =
    storedCategories.length > 0
      ? storedItems.map((item) => ({
          ...item,
          categoryId:
            item.categoryId &&
            storedCategories.some(
              (category) =>
                category.id === item.categoryId
            )
              ? item.categoryId
              : storedCategories[0]?.id || "",
          available:
            item.available !== false,
        }))
      : storedItems.map((item) => ({
          ...item,
          categoryId: "default-menu",
          available: item.available !== false,
        }));

  const draft = config.__menuDraft || {};

  function updateDraft(
    field: string,
    value: string
  ) {
    onChange({
      ...config,
      __menuDraft: {
        ...draft,
        [field]: value,
      },
    });
  }

  function clearDraft() {
    const nextConfig = { ...config };
    delete nextConfig.__menuDraft;
    onChange(nextConfig);
  }

  function addCategory() {
    const name = String(
      draft.categoryName || ""
    ).trim();

    if (!name) return;

    const category: MenuCategory = {
      id: makeId(),
      name,
      description: String(
        draft.categoryDescription || ""
      ).trim(),
    };

    onChange({
      ...config,
      categories: [
        ...categories,
        category,
      ],
      items,
      __menuDraft: {
        ...draft,
        categoryName: "",
        categoryDescription: "",
      },
    });
  }

  function removeCategory(
    categoryId: string
  ) {
    const nextCategories = categories.filter(
      (category) => category.id !== categoryId
    );

    const nextItems = items.filter(
      (item) => item.categoryId !== categoryId
    );

    onChange({
      ...config,
      categories: nextCategories,
      items: nextItems,
    });
  }

  function addMenuItem() {
    const name = String(
      draft.itemName || ""
    ).trim();

    const categoryId = String(
      draft.itemCategoryId ||
        categories[0]?.id ||
        ""
    );

    if (!name || !categoryId) return;

    const item: MenuItem = {
      id: makeId(),
      categoryId,
      name,
      price: String(
        draft.itemPrice || ""
      ).trim(),
      description: String(
        draft.itemDescription || ""
      ).trim(),
      imageUrl: String(
        draft.itemImageUrl || ""
      ).trim(),
      dietary:
        draft.itemDietary === "non_veg"
          ? "non_veg"
          : draft.itemDietary === "egg"
            ? "egg"
            : "veg",
      popular:
        draft.itemPopular === "true",
      available: true,
    };

    onChange({
      ...config,
      categories,
      items: [
        ...items,
        item,
      ],
      __menuDraft: {
        ...draft,
        itemName: "",
        itemPrice: "",
        itemDescription: "",
        itemImageUrl: "",
        itemPopular: "false",
      },
    });
  }

  function removeMenuItem(
    itemId: string
  ) {
    onChange({
      ...config,
      categories,
      items: items.filter(
        (item) => item.id !== itemId
      ),
    });
  }

  function toggleAvailability(
    itemId: string
  ) {
    onChange({
      ...config,
      categories,
      items: items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              available:
                item.available === false,
            }
          : item
      ),
    });
  }

  function togglePopular(
    itemId: string
  ) {
    onChange({
      ...config,
      categories,
      items: items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              popular: !item.popular,
            }
          : item
      ),
    });
  }

  const hasMenu =
    categories.length > 0;

  return (
    <ModuleBox
      icon="🍽️"
      title="Digital Menu"
      description="Create a branded, easy-to-browse menu with your own categories and items."
    >
      <div className="menu-builder">
        <div className="menu-builder-intro">
          <div>
            <strong>Build your menu</strong>
            <p>
              Create categories such as Starters, Main Course,
              Desserts or any names your business uses.
            </p>
          </div>
          <div className="menu-builder-badge">
            Premium customer experience
          </div>
        </div>

        <div className="menu-category-form">
          <div className="menu-section-title">
            <span>1</span>
            <div>
              <strong>Menu Categories</strong>
              <small>
                Organize your menu however you want.
              </small>
            </div>
          </div>

          <div className="menu-form-grid">
            <Field
              label="Category name"
              placeholder="e.g. Starters"
              value={String(
                draft.categoryName || ""
              )}
              onChange={(value) =>
                updateDraft(
                  "categoryName",
                  value
                )
              }
            />

            <Field
              label="Short description (optional)"
              placeholder="e.g. Something delicious to start"
              value={String(
                draft.categoryDescription || ""
              )}
              onChange={(value) =>
                updateDraft(
                  "categoryDescription",
                  value
                )
              }
            />

            <button
              type="button"
              className="menu-primary-btn"
              onClick={addCategory}
            >
              + Add Category
            </button>
          </div>
        </div>

        {hasMenu && (
          <div className="menu-categories-preview">
            {categories.map((category) => {
              const categoryItems = items.filter(
                (item) =>
                  item.categoryId === category.id
              );

              return (
                <div
                  className="menu-category-card"
                  key={category.id}
                >
                  <div className="menu-category-header">
                    <div>
                      <span className="menu-drag-handle">
                        ⋮⋮
                      </span>
                      <div className="menu-category-title-wrap">
                        <strong>
                          {category.name}
                        </strong>
                        {category.description && (
                          <small>
                            {category.description}
                          </small>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="menu-danger-btn"
                      onClick={() =>
                        removeCategory(
                          category.id
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>

                  {categoryItems.length === 0 ? (
                    <div className="menu-empty-category">
                      No items in this category yet.
                    </div>
                  ) : (
                    <div className="menu-item-list">
                      {categoryItems.map(
                        (item) => (
                          <div
                            className="menu-item-card"
                            key={item.id}
                          >
                            <div className="menu-item-details">
                              <div className="menu-item-name-line">
                                <strong>
                                  {item.name}
                                </strong>

                                {item.popular && (
                                  <span className="menu-popular-badge">
                                    ★ Popular
                                  </span>
                                )}

                                {item.dietary ===
                                  "veg" && (
                                  <span className="menu-dietary veg">
                                    Veg
                                  </span>
                                )}

                                {item.dietary ===
                                  "non_veg" && (
                                  <span className="menu-dietary nonveg">
                                    Non-Veg
                                  </span>
                                )}
                              </div>

                              {item.description && (
                                <small>
                                  {item.description}
                                </small>
                              )}

                              <div className="menu-item-meta">
                                <strong>
                                  {item.price
                                    ? `₹${item.price}`
                                    : "Price on request"}
                                </strong>
                                <button
                                  type="button"
                                  className="menu-inline-btn"
                                  onClick={() =>
                                    toggleAvailability(
                                      item.id
                                    )
                                  }
                                >
                                  {item.available ===
                                  false
                                    ? "Unavailable"
                                    : "Available"}
                                </button>
                              </div>
                            </div>

                            <div className="menu-item-actions">
                              <button
                                type="button"
                                className="menu-icon-btn"
                                title="Toggle popular"
                                onClick={() =>
                                  togglePopular(
                                    item.id
                                  )
                                }
                              >
                                {item.popular
                                  ? "★"
                                  : "☆"}
                              </button>
                              <button
                                type="button"
                                className="menu-danger-btn"
                                onClick={() =>
                                  removeMenuItem(
                                    item.id
                                  )
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="menu-item-form">
          <div className="menu-section-title">
            <span>2</span>
            <div>
              <strong>Add Menu Item</strong>
              <small>
                Add food or beverage items to a category.
              </small>
            </div>
          </div>

          {!hasMenu ? (
            <div className="menu-info-box">
              Create at least one category above before adding menu items.
            </div>
          ) : (
            <>
              <div className="menu-form-grid menu-item-grid">
                <Field
                  label="Item name"
                  placeholder="e.g. Paneer Tikka"
                  value={String(
                    draft.itemName || ""
                  )}
                  onChange={(value) =>
                    updateDraft(
                      "itemName",
                      value
                    )
                  }
                />

                <Field
                  label="Price"
                  placeholder="e.g. 280"
                  value={String(
                    draft.itemPrice || ""
                  )}
                  onChange={(value) =>
                    updateDraft(
                      "itemPrice",
                      value
                    )
                  }
                />

                <label className="field">
                  <span className="field-label">
                    Category
                  </span>
                  <select
                    value={String(
                      draft.itemCategoryId ||
                        categories[0]?.id ||
                        ""
                    )}
                    onChange={(event) =>
                      updateDraft(
                        "itemCategoryId",
                        event.target.value
                      )
                    }
                  >
                    {categories.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <Field
                  label="Description"
                  placeholder="Short description of the dish"
                  value={String(
                    draft.itemDescription || ""
                  )}
                  onChange={(value) =>
                    updateDraft(
                      "itemDescription",
                      value
                    )
                  }
                />

                <Field
                  label="Food image URL (optional)"
                  placeholder="https://..."
                  value={String(
                    draft.itemImageUrl || ""
                  )}
                  onChange={(value) =>
                    updateDraft(
                      "itemImageUrl",
                      value
                    )
                  }
                />

                <label className="field">
                  <span className="field-label">
                    Dietary type
                  </span>
                  <select
                    value={String(
                      draft.itemDietary ||
                        "veg"
                    )}
                    onChange={(event) =>
                      updateDraft(
                        "itemDietary",
                        event.target.value
                      )
                    }
                  >
                    <option value="veg">
                      Vegetarian
                    </option>
                    <option value="non_veg">
                      Non-Vegetarian
                    </option>
                    <option value="egg">
                      Contains Egg
                    </option>
                  </select>
                </label>
              </div>

              <div className="menu-item-options">
                <label className="menu-check">
                  <input
                    type="checkbox"
                    checked={
                      draft.itemPopular ===
                      "true"
                    }
                    onChange={(event) =>
                      updateDraft(
                        "itemPopular",
                        event.target.checked
                          ? "true"
                          : "false"
                      )
                    }
                  />
                  <span>
                    Mark as Popular
                  </span>
                </label>

                <button
                  type="button"
                  className="menu-primary-btn"
                  onClick={addMenuItem}
                >
                  + Add Menu Item
                </button>

                <button
                  type="button"
                  className="menu-secondary-btn"
                  onClick={clearDraft}
                >
                  Clear
                </button>
              </div>
            </>
          )}
        </div>

        <div className="menu-builder-footer">
          <span>
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}
            &nbsp;•&nbsp; {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          <span>
            Changes are saved with this client's TAPX module.
          </span>
        </div>
      </div>
    </ModuleBox>
  );
}

/* =========================================================
   GENERIC LIST MODULE
========================================================= */

function ListModule({
  feature,
  config,
  onChange,
  arrayKey,
  icon,
  title,
  description,
  nameLabel,
  namePlaceholder,
  pricePlaceholder,
  durationPlaceholder,
  descriptionPlaceholder,
  addLabel,
}: Props & {
  arrayKey: string;
  icon: string;
  title: string;
  description: string;
  nameLabel: string;
  namePlaceholder: string;
  pricePlaceholder?: string;
  durationPlaceholder?: string;
  descriptionPlaceholder?: string;
  addLabel: string;
}) {
  const items: Item[] = Array.isArray(
    config[arrayKey]
  )
    ? config[arrayKey]
    : [];

  const draft = config.__draft || {};

  function updateDraft(
    field: string,
    value: string
  ) {
    onChange({
      ...config,
      __draft: {
        ...draft,
        [field]: value,
      },
    });
  }

  function addItem() {
    if (
      !String(draft.name || "").trim()
    ) {
      return;
    }

    const item: Item = {
      id: makeId(),
      name: String(draft.name).trim(),

      ...(pricePlaceholder
        ? {
            price: String(
              draft.price || ""
            ).trim(),
          }
        : {}),

      ...(durationPlaceholder
        ? {
            duration: String(
              draft.duration || ""
            ).trim(),
          }
        : {}),

      ...(descriptionPlaceholder
        ? {
            description: String(
              draft.description || ""
            ).trim(),
          }
        : {}),
    };

    const nextConfig = {
      ...config,
      [arrayKey]: [
        ...items,
        item,
      ],
    };

    delete nextConfig.__draft;

    onChange(nextConfig);
  }

  function removeItem(id: string) {
    onChange({
      ...config,
      [arrayKey]: items.filter(
        (item) => item.id !== id
      ),
    });
  }

  return (
    <ModuleBox
      icon={icon}
      title={title}
      description={description}
    >
      <div className="module-grid">
        <Field
          label={nameLabel}
          placeholder={namePlaceholder}
          value={String(
            draft.name || ""
          )}
          onChange={(value) =>
            updateDraft(
              "name",
              value
            )
          }
        />

        {pricePlaceholder && (
          <Field
            label="Price"
            placeholder={
              pricePlaceholder
            }
            value={String(
              draft.price || ""
            )}
            onChange={(value) =>
              updateDraft(
                "price",
                value
              )
            }
          />
        )}

        {durationPlaceholder && (
          <Field
            label="Duration"
            placeholder={
              durationPlaceholder
            }
            value={String(
              draft.duration || ""
            )}
            onChange={(value) =>
              updateDraft(
                "duration",
                value
              )
            }
          />
        )}

        {descriptionPlaceholder && (
          <Field
            label="Description"
            placeholder={
              descriptionPlaceholder
            }
            value={String(
              draft.description ||
                ""
            )}
            onChange={(value) =>
              updateDraft(
                "description",
                value
              )
            }
          />
        )}

        <button
          type="button"
          className="add-btn"
          onClick={addItem}
        >
          + {addLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty-list">
          Nothing added yet.
        </div>
      ) : (
        <div className="items-list">
          {items.map((item) => (
            <div
              className="item-row"
              key={item.id}
            >
              <div className="item-main">
                <strong>
                  {item.name}
                </strong>

                {item.price && (
                  <span className="price">
                    ₹{item.price}
                  </span>
                )}

                {item.duration && (
                  <span className="muted">
                    {item.duration}
                  </span>
                )}

                {item.description && (
                  <div className="description">
                    {item.description}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="remove-btn"
                onClick={() =>
                  removeItem(item.id)
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </ModuleBox>
  );
}

/* =========================================================
   OFFERS
========================================================= */

function Offers({
  feature,
  config,
  onChange,
}: Props) {
  const offers: Item[] =
    Array.isArray(config.offers)
      ? config.offers
      : [];

  const [
    title,
    setTitle,
  ] = useDraftState(
    config,
    "title",
    onChange
  );

  const [
    description,
    setDescription,
  ] = useDraftState(
    config,
    "description",
    onChange
  );

  function add() {
    if (!title.trim()) {
      return;
    }

    onChange({
      ...config,
      offers: [
        ...offers,
        {
          id: makeId(),
          name: title.trim(),
          description:
            description.trim(),
        },
      ],
    });
  }

  return (
    <ModuleBox
      icon="🏷️"
      title="Offers & Promotions"
      description="Create offers and promotions customers can see."
    >
      <div className="module-grid">
        <Field
          label="Offer title"
          placeholder="e.g. 20% Off"
          value={title}
          onChange={setTitle}
        />

        <Field
          label="Description"
          placeholder="e.g. Valid this weekend"
          value={description}
          onChange={
            setDescription
          }
        />

        <button
          type="button"
          className="add-btn"
          onClick={add}
        >
          + Add Offer
        </button>
      </div>

      <SimpleItems
        items={offers}
        onRemove={(id) =>
          onChange({
            ...config,
            offers:
              offers.filter(
                (item) =>
                  item.id !== id
              ),
          })
        }
      />
    </ModuleBox>
  );
}

/* =========================================================
   APPOINTMENTS
========================================================= */

function Appointments({
  feature,
  config,
  onChange,
}: Props) {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const selected: string[] =
    Array.isArray(
      config.working_days
    )
      ? config.working_days
      : days.slice(0, 6);

  function update(
    key: string,
    value: any
  ) {
    onChange({
      ...config,
      [key]: value,
    });
  }

  return (
    <ModuleBox
      icon="📅"
      title="Appointment Booking"
      description="Configure when customers can request appointments."
    >
      <div className="module-grid">
        <Field
          label="Appointment duration"
          placeholder="e.g. 30 minutes"
          value={String(
            config.duration || ""
          )}
          onChange={(value) =>
            update(
              "duration",
              value
            )
          }
        />

        <Field
          label="Opening time"
          placeholder="e.g. 10:00 AM"
          value={String(
            config.opening_time ||
              ""
          )}
          onChange={(value) =>
            update(
              "opening_time",
              value
            )
          }
        />

        <Field
          label="Closing time"
          placeholder="e.g. 8:00 PM"
          value={String(
            config.closing_time ||
              ""
          )}
          onChange={(value) =>
            update(
              "closing_time",
              value
            )
          }
        />
      </div>

      <div className="days-wrap">
        <div className="field-label">
          Working days
        </div>

        <div className="days">
          {days.map((day) => {
            const active =
              selected.includes(
                day
              );

            return (
              <button
                type="button"
                key={day}
                className={
                  active
                    ? "day active"
                    : "day"
                }
                onClick={() =>
                  update(
                    "working_days",
                    active
                      ? selected.filter(
                          (d) =>
                            d !== day
                        )
                      : [
                          ...selected,
                          day,
                        ]
                  )
                }
              >
                {active
                  ? "✓ "
                  : ""}
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>
    </ModuleBox>
  );
}

/* =========================================================
   LOYALTY
========================================================= */

function Loyalty({
  feature,
  config,
  onChange,
}: Props) {
  function update(
    key: string,
    value: string
  ) {
    onChange({
      ...config,
      [key]: value,
    });
  }

  return (
    <ModuleBox
      icon="🎁"
      title="Customer Loyalty"
      description="Set up the loyalty and rewards rules for this client."
    >
      <div className="module-grid">
        <Field
          label="Program name"
          placeholder="e.g. Royal Rewards"
          value={String(
            config.program_name ||
              ""
          )}
          onChange={(value) =>
            update(
              "program_name",
              value
            )
          }
        />

        <Field
          label="Reward"
          placeholder="e.g. Free service after 5 visits"
          value={String(
            config.reward || ""
          )}
          onChange={(value) =>
            update(
              "reward",
              value
            )
          }
        />

        <Field
          label="Visits required"
          placeholder="e.g. 5"
          value={String(
            config.visits_required ||
              ""
          )}
          onChange={(value) =>
            update(
              "visits_required",
              value
            )
          }
        />
      </div>
    </ModuleBox>
  );
}

/* =========================================================
   TABLE ORDERING
========================================================= */

function TableOrdering({
  feature,
  config,
  onChange,
}: Props) {
  return (
    <ModuleBox
      icon="🪑"
      title="Table Ordering"
      description="Configure table-based ordering for restaurants and cafés."
    >
      <Field
        label="Number of tables"
        placeholder="e.g. 20"
        value={String(
          config.table_count || ""
        )}
        onChange={(value) =>
          onChange({
            ...config,
            table_count: value,
          })
        }
      />

      <div className="info">
        TAPX will later generate a
        unique ordering link and QR
        for each table.
      </div>
    </ModuleBox>
  );
}

/* =========================================================
   HOTEL SERVICES
========================================================= */

function HotelServices({
  feature,
  config,
  onChange,
}: Props) {
  type HotelService = {
    id: string;
    name: string;
    categoryId?: string;
    category?: string;
    description?: string;
    availability?: string;
    action?: "info" | "request" | "contact";
    available?: boolean;
  };
  type HotelCategory = { id: string; name: string; description?: string };

  const categories: HotelCategory[] = Array.isArray(config.categories)
    ? config.categories
    : [];
  const services: HotelService[] = Array.isArray(config.services)
    ? config.services
    : [];
  const draft = (config.__hotelServiceDraft || {}) as Record<string, any>;

  const update = (field: string, value: string | boolean) =>
    onChange({
      ...config,
      __hotelServiceDraft: { ...draft, [field]: value },
    });

  const clear = () => {
    const next = { ...config };
    delete next.__hotelServiceDraft;
    onChange(next);
  };

  const addCategory = () => {
    const name = String(draft.categoryName || "").trim();
    if (!name || categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    const category = {
      id: makeId(),
      name,
      description: String(draft.categoryDescription || "").trim(),
    };
    onChange({
      ...config,
      categories: [...categories, category],
      services,
      __hotelServiceDraft: { ...draft, categoryName: "", categoryDescription: "", categoryId: category.id },
    });
  };

  const addService = () => {
    const name = String(draft.serviceName || "").trim();
    if (!name || !categories.length) return;
    const category = categories.find((c) => c.id === String(draft.categoryId || categories[0].id));
    if (!category) return;
    const service: HotelService = {
      id: makeId(),
      name,
      categoryId: category.id,
      category: category.name,
      description: String(draft.description || "").trim(),
      availability: String(draft.availability || "").trim(),
      action: draft.action === "request" || draft.action === "contact" ? draft.action : "info",
      available: true,
    };
    onChange({ ...config, categories, services: [...services, service] });
    clear();
  };

  const removeService = (id: string) =>
    onChange({ ...config, categories, services: services.filter((item) => item.id !== id) });

  const toggleService = (id: string) =>
    onChange({
      ...config,
      categories,
      services: services.map((item) => item.id === id ? { ...item, available: item.available === false } : item),
    });

  const removeCategory = (id: string) => {
    if (services.some((item) => item.categoryId === id)) return;
    onChange({ ...config, categories: categories.filter((item) => item.id !== id), services });
  };

  return (
    <ModuleBox
      icon="🏨"
      title="Hotel Services"
      description="Show guests your hotel's facilities, amenities and services, with optional request or contact actions."
    >
      <div className="hotel-builder">
        <div className="hotel-intro">
          <div>
            <strong>Build your hotel services catalogue</strong>
            <p>Create categories such as Facilities, Wellness, Transport, Housekeeping or anything your hotel offers.</p>
          </div>
          <span className="hotel-badge">HOTEL EXPERIENCE</span>
        </div>

        <div className="hotel-section-title"><span>1</span><div><strong>Service Categories</strong><small>Organize facilities and guest services into clear sections.</small></div></div>
        <div className="hotel-form-grid">
          <Field label="Category name" placeholder="e.g. Facilities" value={String(draft.categoryName || "")} onChange={(v) => update("categoryName", v)} />
          <Field label="Description" placeholder="e.g. Hotel facilities" value={String(draft.categoryDescription || "")} onChange={(v) => update("categoryDescription", v)} />
          <button type="button" className="hotel-primary-btn" onClick={addCategory}>+ Add Category</button>
        </div>

        {categories.length > 0 && (
          <div className="hotel-category-grid">
            {categories.map((category) => {
              const categoryServices = services.filter((item) => item.categoryId === category.id);
              return (
                <div className="hotel-category-card" key={category.id}>
                  <div className="hotel-category-head">
                    <div><strong>{category.name}</strong><small>{category.description || "Guest services"}</small></div>
                    <div className="hotel-category-tools"><span>{categoryServices.length} service{categoryServices.length === 1 ? "" : "s"}</span><button type="button" disabled={categoryServices.length > 0} onClick={() => removeCategory(category.id)}>Delete</button></div>
                  </div>
                  {categoryServices.length === 0 ? <div className="hotel-empty">No services added yet.</div> : (
                    <div className="hotel-service-list">
                      {categoryServices.map((item) => (
                        <div className="hotel-service-row" key={item.id}>
                          <div className="hotel-service-main"><strong>{item.name}</strong><small>{item.description || "No description"}</small><span>{item.availability || "Available to guests"} · {item.action === "request" ? "Request enabled" : item.action === "contact" ? "Contact enabled" : "Information"}</span></div>
                          <div className="hotel-service-actions"><button type="button" onClick={() => toggleService(item.id)}>{item.available === false ? "Show" : "Hide"}</button><button type="button" className="danger" onClick={() => removeService(item.id)}>Remove</button></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="hotel-add-box">
          <div className="hotel-section-title"><span>2</span><div><strong>Add Hotel Service</strong><small>Give guests useful information and a clear next action.</small></div></div>
          {categories.length === 0 ? <div className="hotel-info">Create a category first.</div> : (
            <>
              <div className="hotel-form-grid hotel-service-fields">
                <Field label="Service / Facility" placeholder="e.g. Swimming Pool" value={String(draft.serviceName || "")} onChange={(v) => update("serviceName", v)} />
                <label className="field"><span className="field-label">Category</span><select value={String(draft.categoryId || categories[0].id)} onChange={(e) => update("categoryId", e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <Field label="Availability" placeholder="e.g. 7 AM – 10 PM" value={String(draft.availability || "")} onChange={(v) => update("availability", v)} />
                <Field label="Description" placeholder="Short guest-friendly description" value={String(draft.description || "")} onChange={(v) => update("description", v)} />
                <label className="field"><span className="field-label">Guest action</span><select value={String(draft.action || "info")} onChange={(e) => update("action", e.target.value)}><option value="info">View information</option><option value="request">Request service</option><option value="contact">Contact hotel</option></select></label>
              </div>
              <div className="hotel-option-row"><button type="button" className="hotel-secondary-btn" onClick={clear}>Clear</button><button type="button" className="hotel-primary-btn" onClick={addService}>+ Add Hotel Service</button></div>
            </>
          )}
        </div>
        <div className="hotel-footer">{categories.length} categor{categories.length === 1 ? "y" : "ies"} · {services.length} service{services.length === 1 ? "" : "s"}</div>
      </div>
    </ModuleBox>
  );
}

function RoomService({
  feature,
  config,
  onChange,
}: Props) {
  type RoomItem = {
    id: string;
    name: string;
    categoryId?: string;
    category?: string;
    price?: string;
    priceType?: "fixed" | "starting_from";
    description?: string;
    available?: boolean;
    deliveryTime?: string;
  };
  type RoomCategory = { id: string; name: string; description?: string };

  const categories: RoomCategory[] = Array.isArray(config.categories) ? config.categories : [];
  const items: RoomItem[] = Array.isArray(config.items) ? config.items : [];
  const draft = (config.__roomServiceDraft || {}) as Record<string, any>;

  const update = (field: string, value: string | boolean) => onChange({ ...config, __roomServiceDraft: { ...draft, [field]: value } });
  const clear = () => { const next = { ...config }; delete next.__roomServiceDraft; onChange(next); };

  const addCategory = () => {
    const name = String(draft.categoryName || "").trim();
    if (!name || categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    const category = { id: makeId(), name, description: String(draft.categoryDescription || "").trim() };
    onChange({ ...config, categories: [...categories, category], items, __roomServiceDraft: { ...draft, categoryName: "", categoryDescription: "", categoryId: category.id } });
  };

  const addItem = () => {
    const name = String(draft.itemName || "").trim();
    if (!name || !categories.length) return;
    const category = categories.find((c) => c.id === String(draft.categoryId || categories[0].id));
    if (!category) return;
    const item: RoomItem = {
      id: makeId(), name, categoryId: category.id, category: category.name,
      price: String(draft.price || "").trim(),
      priceType: draft.priceType === "starting_from" ? "starting_from" : "fixed",
      description: String(draft.description || "").trim(),
      deliveryTime: String(draft.deliveryTime || "").trim(), available: true,
    };
    onChange({ ...config, categories, items: [...items, item] });
    clear();
  };

  const removeItem = (id: string) => onChange({ ...config, categories, items: items.filter((item) => item.id !== id) });
  const toggleItem = (id: string) => onChange({ ...config, categories, items: items.map((item) => item.id === id ? { ...item, available: item.available === false } : item) });
  const removeCategory = (id: string) => { if (items.some((item) => item.categoryId === id)) return; onChange({ ...config, categories: categories.filter((item) => item.id !== id), items }); };

  return (
    <ModuleBox icon="🛎️" title="Room Service" description="Create a room-service catalogue guests can browse and request from their room.">
      <div className="hotel-builder">
        <div className="hotel-intro">
          <div><strong>Build your room-service menu</strong><p>Add food, drinks, amenities or guest essentials and organize them by category.</p></div>
          <span className="hotel-badge">IN-ROOM DINING</span>
        </div>
        <div className="hotel-section-title"><span>1</span><div><strong>Room Service Categories</strong><small>Examples: Breakfast, All Day Dining, Drinks, Amenities.</small></div></div>
        <div className="hotel-form-grid">
          <Field label="Category name" placeholder="e.g. Breakfast" value={String(draft.categoryName || "")} onChange={(v) => update("categoryName", v)} />
          <Field label="Description" placeholder="e.g. Morning favourites" value={String(draft.categoryDescription || "")} onChange={(v) => update("categoryDescription", v)} />
          <button type="button" className="hotel-primary-btn" onClick={addCategory}>+ Add Category</button>
        </div>
        {categories.length > 0 && <div className="hotel-category-grid">{categories.map((category) => { const categoryItems = items.filter((item) => item.categoryId === category.id); return <div className="hotel-category-card" key={category.id}><div className="hotel-category-head"><div><strong>{category.name}</strong><small>{category.description || "Room service items"}</small></div><div className="hotel-category-tools"><span>{categoryItems.length} item{categoryItems.length === 1 ? "" : "s"}</span><button type="button" disabled={categoryItems.length > 0} onClick={() => removeCategory(category.id)}>Delete</button></div></div>{categoryItems.length === 0 ? <div className="hotel-empty">No items added yet.</div> : <div className="hotel-service-list">{categoryItems.map((item) => <div className="hotel-service-row" key={item.id}><div className="hotel-service-main"><strong>{item.name}</strong><small>{item.description || "No description"}</small><span>{item.price ? `${item.priceType === "starting_from" ? "From " : ""}₹${item.price}` : "Price on request"}{item.deliveryTime ? ` · ${item.deliveryTime}` : ""}</span></div><div className="hotel-service-actions"><button type="button" onClick={() => toggleItem(item.id)}>{item.available === false ? "Show" : "Hide"}</button><button type="button" className="danger" onClick={() => removeItem(item.id)}>Remove</button></div></div>)}</div>}</div>; })}</div>}
        <div className="hotel-add-box">
          <div className="hotel-section-title"><span>2</span><div><strong>Add Room Service Item</strong><small>Set the item, price and expected delivery time.</small></div></div>
          {categories.length === 0 ? <div className="hotel-info">Create a category first.</div> : <>
            <div className="hotel-form-grid hotel-service-fields">
              <Field label="Item name" placeholder="e.g. Club Sandwich" value={String(draft.itemName || "")} onChange={(v) => update("itemName", v)} />
              <label className="field"><span className="field-label">Category</span><select value={String(draft.categoryId || categories[0].id)} onChange={(e) => update("categoryId", e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <Field label="Price" placeholder="e.g. 450" value={String(draft.price || "")} onChange={(v) => update("price", v)} />
              <label className="field"><span className="field-label">Price type</span><select value={String(draft.priceType || "fixed")} onChange={(e) => update("priceType", e.target.value)}><option value="fixed">Fixed price</option><option value="starting_from">Starting from</option></select></label>
              <Field label="Delivery time" placeholder="e.g. 25–30 min" value={String(draft.deliveryTime || "")} onChange={(v) => update("deliveryTime", v)} />
              <Field label="Description" placeholder="Short guest-friendly description" value={String(draft.description || "")} onChange={(v) => update("description", v)} />
            </div>
            <div className="hotel-option-row"><button type="button" className="hotel-secondary-btn" onClick={clear}>Clear</button><button type="button" className="hotel-primary-btn" onClick={addItem}>+ Add Room Service Item</button></div>
          </>}
        </div>
        <div className="hotel-footer">{categories.length} categor{categories.length === 1 ? "y" : "ies"} · {items.length} item{items.length === 1 ? "" : "s"}</div>
      </div>
    </ModuleBox>
  );
}

/* =========================================================
   GENERIC MODULE
========================================================= */

function Generic({
  feature,
  config,
  onChange,
}: Props) {
  return (
    <ModuleBox
      icon={feature.icon || "⚡"}
      title={`Configure ${feature.name}`}
      description={
        feature.description ||
        "Configure this TAPX module."
      }
    >
      <div className="info">
        This module is selected.
        Advanced configuration for
        this module can be added here
        without changing the client
        onboarding flow.
      </div>

      <button
        type="button"
        className="add-btn"
        onClick={() =>
          onChange({
            ...config,
            configured: true,
          })
        }
      >
        ✓ Mark Configured
      </button>
    </ModuleBox>
  );
}

/* =========================================================
   SHARED UI
========================================================= */

function ModuleBox({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="module-box">
      <div className="module-head">
        <div className="module-icon">
          {icon}
        </div>

        <div>
          <h3>{title}</h3>

          <p>
            {description}
          </p>
        </div>
      </div>

      {children}

      <style>{styles}</style>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
      </span>

      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />
    </label>
  );
}

function SimpleItems({
  items,
  onRemove,
}: {
  items: Item[];
  onRemove: (
    id: string
  ) => void;
}) {
  if (!items.length) {
    return (
      <div className="empty-list">
        Nothing added yet.
      </div>
    );
  }

  return (
    <div className="items-list">
      {items.map((item) => (
        <div
          className="item-row"
          key={item.id}
        >
          <div className="item-main">
            <strong>
              {item.name}
            </strong>

            {item.description && (
              <div className="description">
                {item.description}
              </div>
            )}
          </div>

          <button
            type="button"
            className="remove-btn"
            onClick={() =>
              onRemove(item.id)
            }
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   DRAFT HELPER
========================================================= */

function useDraftState(
  config: Config,
  key: string,
  onChange: (
    config: Config
  ) => void
): [
  string,
  (value: string) => void
] {
  const value = String(
    config.__draft?.[key] || ""
  );

  const setValue = (
    next: string
  ) => {
    onChange({
      ...config,
      __draft: {
        ...(config.__draft || {}),
        [key]: next,
      },
    });
  };

  return [
    value,
    setValue,
  ];
}

/* =========================================================
   ID
========================================================= */

function makeId() {
  if (
    typeof crypto !==
      "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/* =========================================================
   STYLES
========================================================= */

const styles = `
  .module-box {
    padding: 20px;
    border: 1px solid #dbe3ec;
    border-radius: 13px;
    background: #f8fafc;
  }

  .module-head {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 18px;
  }

  .module-icon {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }

  h3 {
    margin: 0;
    font-size: 15px;
    color: #111827;
  }

  .module-head p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #64748b;
  }

  .module-grid {
    display: grid;
    grid-template-columns:
      repeat(3, minmax(0, 1fr));
    gap: 12px;
    align-items: end;
  }

  .field {
    display: block;
    min-width: 0;
  }

  .field-label {
    display: block;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #475569;
  }

  input,
  select {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 11px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #111827;
    font-size: 13px;
    outline: none;
  }

  .add-btn {
    border: 0;
    border-radius: 8px;
    padding: 10px 14px;
    background: #111827;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .empty-list {
    margin-top: 18px;
    padding: 13px;
    border: 1px dashed #cbd5e1;
    border-radius: 9px;
    background: #ffffff;
    color: #64748b;
    font-size: 12px;
    text-align: center;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 18px;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 9px;
    background: #ffffff;
  }

  .item-main {
    flex: 1;
    min-width: 0;
    color: #111827;
    font-size: 13px;
  }

  .price {
    margin-left: 10px;
    font-weight: 700;
  }

  .muted {
    margin-left: 10px;
    color: #64748b;
    font-size: 12px;
  }

  .description {
    margin-top: 3px;
    color: #64748b;
    font-size: 11px;
  }

  .remove-btn {
    border: 0;
    border-radius: 7px;
    padding: 7px 9px;
    background: #fee2e2;
    color: #991b1b;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }

  .days-wrap {
    margin-top: 18px;
  }

  .days {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }

  .day {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 11px;
    background: #ffffff;
    color: #475569;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .day.active {
    background: #111827;
    color: #ffffff;
  }

  .info {
    margin: 12px 0 14px;
    padding: 12px;
    border-radius: 9px;
    background: #ffffff;
    color: #64748b;
    font-size: 12px;
    line-height: 1.5;
  }


  .service-builder {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .service-intro {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  }

  .service-intro strong {
    display: block;
    color: #111827;
    font-size: 15px;
  }

  .service-intro p {
    margin: 5px 0 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.5;
  }

  .service-builder-badge {
    flex: 0 0 auto;
    padding: 7px 10px;
    border: 1px solid #fde68a;
    border-radius: 999px;
    background: #fffbeb;
    color: #92400e;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  .service-category-form,
  .service-add-form {
    padding: 18px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #f8fafc;
  }

  .service-section-title {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 15px;
  }

  .service-section-title > span {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 9px;
    background: #111827;
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
  }

  .service-section-title strong,
  .service-section-title small {
    display: block;
  }

  .service-section-title strong {
    color: #111827;
    font-size: 13px;
  }

  .service-section-title small {
    margin-top: 2px;
    color: #64748b;
    font-size: 11px;
  }

  .service-form-grid {
    display: grid;
    gap: 12px;
    align-items: end;
  }

  .category-grid {
    grid-template-columns: 1fr 1.3fr auto;
  }

  .service-fields-grid {
    grid-template-columns: 1.25fr .9fr .7fr .9fr .8fr 1.4fr;
  }

  .service-form-grid select,
  .service-row-actions select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px 11px;
    background: #ffffff;
    color: #111827;
    font-size: 12px;
    outline: none;
  }

  .service-primary-btn,
  .service-secondary-btn,
  .service-danger-btn,
  .service-action-btn {
    border: 0;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }

  .service-primary-btn {
    min-height: 38px;
    padding: 10px 14px;
    border-radius: 9px;
    background: #111827;
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
  }

  .service-primary-btn:hover {
    background: #1f2937;
  }

  .service-secondary-btn {
    min-height: 38px;
    padding: 9px 13px;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    background: #ffffff;
    color: #475569;
    font-size: 12px;
    font-weight: 700;
  }

  .service-add-btn {
    margin-left: auto;
  }

  .service-category-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .service-category-card {
    overflow: hidden;
    border: 1px solid #dbe3ee;
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(15, 23, 42, .04);
  }

  .service-category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 15px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
  }

  .service-category-name {
    color: #111827;
    font-size: 14px;
    font-weight: 800;
  }

  .service-category-description {
    margin-top: 2px;
    color: #64748b;
    font-size: 10px;
  }

  .service-category-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .service-count {
    padding: 5px 8px;
    border-radius: 999px;
    background: #eef2ff;
    color: #475569;
    font-size: 9px;
    font-weight: 800;
  }

  .service-danger-btn {
    padding: 7px 9px;
    border-radius: 7px;
    background: #fee2e2;
    color: #991b1b;
    font-size: 10px;
    font-weight: 800;
  }

  .service-danger-btn:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .service-empty-category {
    padding: 15px;
    color: #94a3b8;
    font-size: 11px;
    text-align: center;
  }

  .service-list {
    padding: 8px;
  }

  .service-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px;
    border-bottom: 1px solid #eef2f7;
  }

  .service-row:last-child {
    border-bottom: 0;
  }

  .service-row-main {
    min-width: 0;
    flex: 1;
  }

  .service-name-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .service-name-line strong {
    color: #111827;
    font-size: 13px;
  }

  .service-description {
    margin-top: 4px;
    color: #64748b;
    font-size: 11px;
    line-height: 1.4;
  }

  .service-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 7px;
    color: #111827;
    font-size: 11px;
    font-weight: 700;
  }

  .service-popular-badge,
  .service-hidden-badge {
    display: inline-flex;
    padding: 3px 6px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 800;
  }

  .service-popular-badge {
    background: #fff7ed;
    color: #c2410c;
  }

  .service-hidden-badge {
    background: #f1f5f9;
    color: #64748b;
  }

  .service-row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 6px;
    flex-shrink: 0;
  }

  .service-row-actions select {
    width: auto;
    min-width: 110px;
    padding: 7px 8px;
    font-size: 10px;
  }

  .service-action-btn {
    padding: 7px 9px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    background: #ffffff;
    color: #475569;
    font-size: 10px;
    font-weight: 700;
  }

  .service-option-row {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: 14px;
  }

  .check-option {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-right: auto;
    color: #475569;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .check-option input {
    width: 15px;
    height: 15px;
    accent-color: #111827;
  }

  .service-info-box {
    padding: 12px;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    background: #ffffff;
    color: #64748b;
    font-size: 11px;
    line-height: 1.5;
  }

  .service-builder-footer {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 11px 2px 0;
    color: #64748b;
    font-size: 10px;
  }

  .menu-builder {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .menu-builder-intro {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  }

  .menu-builder-intro strong {
    display: block;
    color: #111827;
    font-size: 15px;
  }

  .menu-builder-intro p {
    margin: 5px 0 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.5;
  }

  .menu-builder-badge {
    flex: 0 0 auto;
    padding: 7px 10px;
    border: 1px solid #fde68a;
    border-radius: 999px;
    background: #fffbeb;
    color: #92400e;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  .menu-category-form,
  .menu-item-form {
    padding: 18px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #f8fafc;
  }

  .menu-section-title {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 15px;
  }

  .menu-section-title > span {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 9px;
    background: #111827;
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
  }

  .menu-section-title strong,
  .menu-section-title small {
    display: block;
  }

  .menu-section-title strong {
    color: #111827;
    font-size: 13px;
  }

  .menu-section-title small {
    margin-top: 2px;
    color: #64748b;
    font-size: 11px;
  }

  .menu-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 12px;
    align-items: end;
  }

  .menu-item-grid {
    grid-template-columns: 1fr 0.65fr 0.9fr;
  }

  .menu-item-grid .field:nth-child(4) {
    grid-column: span 2;
  }

  .menu-primary-btn,
  .menu-secondary-btn,
  .menu-danger-btn,
  .menu-inline-btn,
  .menu-icon-btn {
    border: 0;
    cursor: pointer;
    font-family: inherit;
  }

  .menu-primary-btn {
    min-height: 38px;
    padding: 10px 14px;
    border-radius: 9px;
    background: #111827;
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .menu-primary-btn:hover {
    background: #1f2937;
  }

  .menu-secondary-btn {
    min-height: 38px;
    padding: 9px 13px;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    background: #ffffff;
    color: #475569;
    font-size: 12px;
    font-weight: 700;
  }

  .menu-categories-preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .menu-category-card {
    overflow: hidden;
    border: 1px solid #dbe3ee;
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(15, 23, 42, .04);
  }

  .menu-category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 15px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
  }

  .menu-category-header > div:first-child {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 10px;
  }

  .menu-drag-handle {
    color: #94a3b8;
    font-size: 16px;
    letter-spacing: -4px;
  }

  .menu-category-title-wrap strong,
  .menu-category-title-wrap small {
    display: block;
  }

  .menu-category-title-wrap strong {
    color: #111827;
    font-size: 14px;
  }

  .menu-category-title-wrap small {
    margin-top: 2px;
    color: #64748b;
    font-size: 10px;
  }

  .menu-danger-btn {
    padding: 7px 9px;
    border-radius: 7px;
    background: #fee2e2;
    color: #991b1b;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  .menu-empty-category {
    padding: 15px;
    color: #94a3b8;
    font-size: 11px;
    text-align: center;
  }

  .menu-item-list {
    padding: 8px;
  }

  .menu-item-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px;
    border-bottom: 1px solid #eef2f7;
  }

  .menu-item-card:last-child {
    border-bottom: 0;
  }

  .menu-item-details {
    min-width: 0;
    flex: 1;
  }

  .menu-item-name-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .menu-item-name-line strong {
    color: #111827;
    font-size: 13px;
  }

  .menu-item-details > small {
    display: block;
    margin-top: 4px;
    color: #64748b;
    font-size: 11px;
    line-height: 1.4;
  }

  .menu-item-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 7px;
  }

  .menu-item-meta > strong {
    color: #111827;
    font-size: 12px;
  }

  .menu-inline-btn {
    padding: 3px 7px;
    border-radius: 999px;
    background: #dcfce7;
    color: #166534;
    font-size: 9px;
    font-weight: 800;
  }

  .menu-item-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .menu-icon-btn {
    width: 30px;
    height: 30px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    color: #d97706;
    font-size: 16px;
  }

  .menu-popular-badge,
  .menu-dietary {
    display: inline-flex;
    align-items: center;
    padding: 3px 6px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 800;
  }

  .menu-popular-badge {
    background: #fff7ed;
    color: #c2410c;
  }

  .menu-dietary.veg {
    background: #dcfce7;
    color: #166534;
  }

  .menu-dietary.nonveg {
    background: #fee2e2;
    color: #991b1b;
  }

  .menu-item-options {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: 14px;
  }

  .menu-check {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-right: auto;
    color: #475569;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .menu-check input {
    width: 15px;
    height: 15px;
  }

  .menu-info-box {
    padding: 12px;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    background: #ffffff;
    color: #64748b;
    font-size: 11px;
    line-height: 1.5;
  }

  .menu-builder-footer {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 11px 2px 0;
    color: #64748b;
    font-size: 10px;
  }

  .hotel-builder { margin-top: 4px; }
  .hotel-intro { display:flex; justify-content:space-between; gap:16px; padding:16px; margin-bottom:18px; border:1px solid #e5e7eb; border-radius:14px; background:#f8fafc; }
  .hotel-intro strong { display:block; color:#111827; font-size:14px; }
  .hotel-intro p { margin:5px 0 0; color:#64748b; font-size:11px; line-height:1.5; max-width:650px; }
  .hotel-badge { align-self:flex-start; padding:5px 8px; border-radius:999px; background:#e8eef5; color:#334155; font-size:9px; font-weight:800; letter-spacing:.08em; white-space:nowrap; }
  .hotel-section-title { display:flex; gap:10px; align-items:center; margin:18px 0 12px; }
  .hotel-section-title > span { width:26px; height:26px; border-radius:8px; background:#111827; color:white; display:grid; place-items:center; font-size:11px; font-weight:800; flex:0 0 26px; }
  .hotel-section-title strong,.hotel-section-title small { display:block; }
  .hotel-section-title strong { color:#111827; font-size:13px; }
  .hotel-section-title small { margin-top:2px; color:#64748b; font-size:10px; }
  .hotel-form-grid { display:grid; grid-template-columns:1fr 1fr auto; gap:12px; align-items:end; }
  .hotel-service-fields { grid-template-columns:1.1fr .9fr .7fr .8fr 1fr; }
  .hotel-primary-btn,.hotel-secondary-btn,.hotel-category-tools button,.hotel-service-actions button { border:0; cursor:pointer; font-family:inherit; }
  .hotel-primary-btn { min-height:38px; padding:10px 15px; border-radius:9px; background:#111827; color:#fff; font-size:11px; font-weight:800; white-space:nowrap; }
  .hotel-primary-btn:hover { background:#1f2937; }
  .hotel-secondary-btn { min-height:38px; padding:9px 13px; border:1px solid #cbd5e1; border-radius:9px; background:#fff; color:#475569; font-size:11px; font-weight:700; }
  .hotel-category-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }
  .hotel-category-card { overflow:hidden; border:1px solid #dbe3ee; border-radius:14px; background:#fff; box-shadow:0 2px 8px rgba(15,23,42,.04); }
  .hotel-category-head { display:flex; justify-content:space-between; gap:10px; padding:14px 15px; background:#f8fafc; border-bottom:1px solid #e5e7eb; }
  .hotel-category-head strong,.hotel-category-head small { display:block; }
  .hotel-category-head strong { color:#111827; font-size:13px; }
  .hotel-category-head small { margin-top:3px; color:#64748b; font-size:10px; }
  .hotel-category-tools { display:flex; align-items:center; gap:8px; }
  .hotel-category-tools span { color:#64748b; font-size:9px; font-weight:700; white-space:nowrap; }
  .hotel-category-tools button { padding:6px 8px; border-radius:7px; background:#fee2e2; color:#991b1b; font-size:9px; font-weight:800; }
  .hotel-category-tools button:disabled { opacity:.45; cursor:not-allowed; }
  .hotel-empty { padding:15px; color:#94a3b8; font-size:10px; text-align:center; }
  .hotel-service-list { padding:7px; }
  .hotel-service-row { display:flex; justify-content:space-between; gap:12px; padding:12px; border-bottom:1px solid #eef2f7; }
  .hotel-service-row:last-child { border-bottom:0; }
  .hotel-service-main { min-width:0; flex:1; }
  .hotel-service-main strong,.hotel-service-main small,.hotel-service-main span { display:block; }
  .hotel-service-main strong { color:#111827; font-size:12px; }
  .hotel-service-main small { margin-top:3px; color:#64748b; font-size:10px; line-height:1.4; }
  .hotel-service-main span { margin-top:6px; color:#475569; font-size:9px; font-weight:700; }
  .hotel-service-actions { display:flex; gap:6px; align-items:center; }
  .hotel-service-actions button { padding:6px 8px; border:1px solid #e2e8f0; border-radius:7px; background:#fff; color:#475569; font-size:9px; font-weight:700; white-space:nowrap; }
  .hotel-service-actions .danger { background:#fff1f2; border-color:#fecdd3; color:#be123c; }
  .hotel-add-box { margin-top:18px; padding:15px; border:1px solid #dbe3ee; border-radius:14px; background:#f8fafc; }
  .hotel-info { padding:12px; border:1px dashed #cbd5e1; border-radius:9px; color:#64748b; font-size:10px; background:#fff; }
  .hotel-option-row { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
  .hotel-footer { display:flex; justify-content:space-between; padding:13px 2px 0; color:#64748b; font-size:9px; }

  @media (max-width: 750px) {
    .module-grid {
      grid-template-columns: 1fr;
    }

    .item-row {
      align-items: flex-start;
    }
  }
`;