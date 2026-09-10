"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Device = {
  id: string;
  device_code: string;
  business_id: string;
  device_type: string | null;
  location: string | null;
  status: string | null;
};

type Business = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  logo_url: string | null;
  google_review_url: string | null;
  instagram_url: string | null;
  payment_url: string | null;
  whatsapp_number: string | null;
  upi_id: string | null;
  upi_qr_url: string | null;
  payment_enabled: boolean | null;
};

type ProductItem = {
  id: string;
  name: string;
  price?: string;
  description?: string;
};

const CATEGORY_ACCENTS: Record<
  string,
  { main: string; bgLight: string; borderLight: string; textOnAccent: string }
> = {
  restaurant: {
    main: "#a31d1d",
    bgLight: "rgba(163, 29, 29, 0.08)",
    borderLight: "rgba(163, 29, 29, 0.2)",
    textOnAccent: "#ffffff",
  },
  salon: {
    main: "#c94e0c",
    bgLight: "rgba(201, 78, 12, 0.08)",
    borderLight: "rgba(201, 78, 12, 0.2)",
    textOnAccent: "#ffffff",
  },
  hotel: {
    main: "#1e3866",
    bgLight: "rgba(30, 56, 102, 0.08)",
    borderLight: "rgba(30, 56, 102, 0.2)",
    textOnAccent: "#ffffff",
  },
  cafe: {
    main: "#9c490a",
    bgLight: "rgba(156, 73, 10, 0.08)",
    borderLight: "rgba(156, 73, 10, 0.2)",
    textOnAccent: "#ffffff",
  },
  retail: {
    main: "#056e50",
    bgLight: "rgba(5, 110, 80, 0.08)",
    borderLight: "rgba(5, 110, 80, 0.2)",
    textOnAccent: "#ffffff",
  },
  healthcare: {
    main: "#04875f",
    bgLight: "rgba(4, 135, 95, 0.08)",
    borderLight: "rgba(4, 135, 95, 0.2)",
    textOnAccent: "#ffffff",
  },
  real_estate: {
    main: "#b53c0d",
    bgLight: "rgba(181, 60, 13, 0.08)",
    borderLight: "rgba(181, 60, 13, 0.2)",
    textOnAccent: "#ffffff",
  },
  custom: {
    main: "#4d5566",
    bgLight: "rgba(77, 85, 102, 0.08)",
    borderLight: "rgba(77, 85, 102, 0.2)",
    textOnAccent: "#ffffff",
  },
};

function getCategoryAccent(category?: string | null) {
  if (!category) return CATEGORY_ACCENTS.custom;
  const normalized = category.toLowerCase().trim().replace(/[\s-]/g, "_");
  return CATEGORY_ACCENTS[normalized] || CATEGORY_ACCENTS.custom;
}

type OfferItem = {
  id: string;
  name: string;
  description?: string;
};

type ServiceItem = {
  id: string;
  name: string;
  category?: string;
  price?: string;
  priceType?: "fixed" | "starting_from";
  duration?: string;
  description?: string;
  popular?: boolean;
  available?: boolean;
};

type RoomServiceCategory = {
  id: string;
  name: string;
  description?: string;
};

type RoomServiceItem = {
  id: string;
  name: string;
  categoryId?: string;
  category?: string;
  price?: string;
  priceType?: "fixed" | "starting_from";
  description?: string;
  deliveryTime?: string;
  available?: boolean;
};

type HotelServiceCategory = {
  id: string;
  name: string;
  description?: string;
};

type HotelServiceItem = {
  id: string;
  name: string;
  categoryId?: string;
  category?: string;
  description?: string;
  availability?: string;
  action?: "info" | "request" | "contact";
  available?: boolean;
};

type DigitalMenuCategory = {
  id: string;
  name: string;
  description?: string;
};

type DigitalMenuItem = {
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

type BusinessFeature = {
  feature_id: string;
  enabled: boolean;
  status: string | null;
};

type ModuleConfig = {
  feature_id: string;
  module_key: string;
  config: Record<string, unknown> | null;
  status: string | null;
};

type LoyaltyConfig = {
  program_name?: string;
  reward?: string;
  visits_required?: string | number;
};

type TableOrderingConfig = {
  table_count?: string | number;
};

type AppointmentConfig = {
  duration?: string | number;
  opening_time?: string;
  closing_time?: string;
  working_days?: string[];
};

type ActiveModule =
  | "digital-menu"
  | "product-catalogue"
  | "offers"
  | "services"
  | "loyalty"
  | "table-ordering"
  | "feedback"
  | "appointment-booking"
  | "room-service"
  | "hotel-services"
  | null;

export default function TapPage() {
  const params = useParams();

  const deviceCode = Array.isArray(params.deviceCode)
    ? params.deviceCode[0]
    : params.deviceCode;

  const [device, setDevice] = useState<Device | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [productItems, setProductItems] =
    useState<ProductItem[]>([]);

  const [offerItems, setOfferItems] =
    useState<OfferItem[]>([]);

  const [serviceItems, setServiceItems] =
    useState<ServiceItem[]>([]);

  const [digitalMenuCategories, setDigitalMenuCategories] =
    useState<DigitalMenuCategory[]>([]);

  const [digitalMenuItems, setDigitalMenuItems] =
    useState<DigitalMenuItem[]>([]);

  const [enabledModuleKeys, setEnabledModuleKeys] =
    useState<string[]>([]);

  const [activeModule, setActiveModule] =
    useState<ActiveModule>(null);

  const [loyaltyConfig, setLoyaltyConfig] =
    useState<LoyaltyConfig>({});

  const [tableOrderingConfig, setTableOrderingConfig] =
    useState<TableOrderingConfig>({});

  const [appointmentConfig, setAppointmentConfig] =
    useState<AppointmentConfig>({});

  const [roomServiceCategories, setRoomServiceCategories] =
    useState<RoomServiceCategory[]>([]);

  const [roomServiceItems, setRoomServiceItems] =
    useState<RoomServiceItem[]>([]);

  const [hotelServiceCategories, setHotelServiceCategories] =
    useState<HotelServiceCategory[]>([]);

  const [hotelServiceItems, setHotelServiceItems] =
    useState<HotelServiceItem[]>([]);

  useEffect(() => {
    if (deviceCode) {
      void loadTapExperience();
    } else {
      setError("TAPX device code was not detected.");
      setLoading(false);
    }
  }, [deviceCode]);

  async function loadTapExperience() {
    setLoading(true);
    setError("");

    try {
      const tapRpcRequest = supabase.rpc("resolve_tap_device", {
        p_device_code: deviceCode,
      });

      const rpcTimeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "TAPX experience request timed out. Please check your connection."
              )
            ),
          10000
        )
      );

      const { data: tapData, error: tapError } = await Promise.race([
        tapRpcRequest,
        rpcTimeout,
      ]);

      if (tapError) throw tapError;

      if (!tapData || !tapData.device || !tapData.business) {
        setError(`TAPX device "${deviceCode}" was not found or is inactive.`);
        setLoading(false);
        return;
      }

      const deviceData = tapData.device;
      const businessData = tapData.business;

      setDevice(deviceData);
      setBusiness(businessData);

      const enabledFeatureIds = new Set(
        (tapData.enabled_features || [])
          .filter(
            (item: any) =>
              item.enabled && item.status !== "inactive"
          )
          .map((item: any) => item.feature_id)
      );

      const normalizeModuleKey = (
        value: unknown
      ) => {
        const key = String(value || "")
          .toLowerCase()
          .replace(/[- ]/g, "_");

        if (
          key === "service_catalogue" ||
          key === "service_catalog" ||
          key === "services"
        ) {
          return "services_catalogue";
        }

        if (
          key === "product_catalog" ||
          key === "products"
        ) {
          return "product_catalogue";
        }

        if (
          key === "offers" ||
          key === "offer_promotions"
        ) {
          return "offers_promotions";
        }

        if (
          key === "loyalty" ||
          key === "rewards"
        ) {
          return "customer_loyalty";
        }

        if (
          key === "appointment" ||
          key === "appointments" ||
          key === "appointment_booking" ||
          key === "booking"
        ) {
          return "appointment_booking";
        }

        if (
          key === "feedback" ||
          key === "customer_feedback" ||
          key === "customer_feedbacks"
        ) {
          return "customer_feedback";
        }

        if (
          key === "room_service" ||
          key === "room-service" ||
          key === "roomservice" ||
          key === "in_room_dining"
        ) {
          return "room_service";
        }

        if (
          key === "hotel_services" ||
          key === "hotel-services" ||
          key === "hotelservices" ||
          key === "hotel_facilities"
        ) {
          return "hotel_services";
        }

        return key;
      };

      const enabledConfigs =
        (tapData.module_configs || []).filter(
          (item: any) =>
            enabledFeatureIds.has(
              item.feature_id
            ) &&
            item.status !== "inactive"
        );

      const activeModuleKeys =
        enabledConfigs
          .map((item: ModuleConfig) =>
            normalizeModuleKey(
              item.module_key
            )
          )
          .filter(Boolean);

      setEnabledModuleKeys(
        activeModuleKeys
      );

      // ====================================================
      // DIGITAL MENU
      // ====================================================

      const digitalMenuConfig =
        enabledConfigs.find(
          (item: ModuleConfig) =>
            normalizeModuleKey(
              item.module_key
            ) === "digital_menu"
        );

      const menuConfig =
        digitalMenuConfig?.config || {};

      const configuredCategories: unknown[] =
        Array.isArray(
          menuConfig.categories
        )
          ? menuConfig.categories
          : [];

      const configuredMenuItems: unknown[] =
        Array.isArray(menuConfig.items)
          ? menuConfig.items
          : [];

      const validCategories =
        configuredCategories.filter(
          (item): item is DigitalMenuCategory =>
            Boolean(
              item &&
                typeof item ===
                  "object" &&
                "id" in item &&
                "name" in item &&
                String(
                  (
                    item as {
                      name?: unknown;
                    }
                  ).name || ""
                ).trim()
            )
        );

      const validMenuItems =
        configuredMenuItems
          .filter(
            (item): item is DigitalMenuItem =>
              Boolean(
                item &&
                  typeof item ===
                    "object" &&
                  "id" in item &&
                  "name" in item
              )
          )
          .map((item) => ({
            ...item,
            available:
              item.available !== false,
            categoryId:
              String(
                item.categoryId || ""
              ),
          }));

      setDigitalMenuCategories(
        validCategories
      );

      setDigitalMenuItems(
        validMenuItems
      );

      // ====================================================
      // PRODUCT CATALOGUE
      // ====================================================

      const productConfig =
        enabledConfigs.find(
          (item: ModuleConfig) => {
            const key =
              normalizeModuleKey(
                item.module_key
              );

            return (
              key ===
                "product_catalogue" ||
              key ===
                "product_catalog" ||
              key === "products"
            );
          }
        );

      const configuredProducts: unknown[] =
        productConfig?.config &&
        Array.isArray(
          productConfig.config.products
        )
          ? productConfig.config.products
          : [];

      const validProducts =
        configuredProducts.filter(
          (item): item is ProductItem =>
            Boolean(
              item &&
                typeof item ===
                  "object" &&
                "name" in item
            )
        );

      setProductItems(
        validProducts
      );

      // ====================================================
      // OFFERS
      // ====================================================

      const offersConfig =
        enabledConfigs.find(
          (item: ModuleConfig) =>
            normalizeModuleKey(
              item.module_key
            ) ===
            "offers_promotions"
        );

      const configuredOffers: unknown[] =
        offersConfig?.config &&
        Array.isArray(
          offersConfig.config.offers
        )
          ? offersConfig.config.offers
          : [];

      const now = new Date();
      const todayYMD = now.toISOString().slice(0, 10);
      const daysMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const currentDay = daysMap[now.getDay()];
      const currentHHMM = now.toTimeString().slice(0, 5);

      const validOffers = configuredOffers.filter((item: any): item is OfferItem => {
        if (!item || typeof item !== "object") return false;
        const name = String(item.name || item.title || "").trim();
        if (!name) return false;

        if (item.start_date && String(item.start_date).trim()) {
          if (todayYMD < String(item.start_date).trim()) return false;
        }

        if (item.end_date && String(item.end_date).trim()) {
          if (todayYMD > String(item.end_date).trim()) return false;
        }

        if (Array.isArray(item.active_days) && item.active_days.length > 0) {
          const normalizedDays = item.active_days.map((d: any) => String(d).toLowerCase().trim().slice(0, 3));
          if (!normalizedDays.includes(currentDay)) return false;
        }

        if (item.active_time_start && String(item.active_time_start).trim()) {
          if (currentHHMM < String(item.active_time_start).trim()) return false;
        }

        if (item.active_time_end && String(item.active_time_end).trim()) {
          if (currentHHMM > String(item.active_time_end).trim()) return false;
        }

        return true;
      });

      setOfferItems(validOffers);

      // ====================================================
      // SERVICES CATALOGUE
      // ====================================================

      const servicesConfig =
        enabledConfigs.find(
          (item: ModuleConfig) =>
            normalizeModuleKey(
              item.module_key
            ) ===
            "services_catalogue"
        );

      const configuredServices: unknown[] =
        servicesConfig?.config &&
        Array.isArray(
          servicesConfig.config.services
        )
          ? servicesConfig.config.services
          : [];

      const validServices: ServiceItem[] = configuredServices
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(
              item &&
                typeof item === "object" &&
                "id" in item &&
                "name" in item &&
                String((item as { name?: unknown }).name || "").trim()
            )
        )
        .map((item) => {
          const rawPriceType = String(item.priceType || "").toLowerCase().trim();
          const priceType: "fixed" | "starting_from" =
            rawPriceType === "starting_from" || rawPriceType === "starting"
              ? "starting_from"
              : "fixed";

          return {
            id: String(item.id),
            name: String(item.name).trim(),
            category:
              item.category !== undefined &&
              item.category !== null &&
              String(item.category).trim()
                ? String(item.category).trim()
                : "Services",
            price:
              item.price !== undefined && item.price !== null
                ? String(item.price)
                : undefined,
            priceType,
            duration:
              item.duration !== undefined && item.duration !== null
                ? String(item.duration)
                : undefined,
            description:
              item.description !== undefined && item.description !== null
                ? String(item.description)
                : undefined,
            popular: item.popular === true,
            available: item.available !== false,
          };
        });

      setServiceItems(validServices);

      // ====================================================
      // CUSTOMER LOYALTY
      // ====================================================

      const loyaltyModuleConfig =
        enabledConfigs.find(
          (item: ModuleConfig) =>
            normalizeModuleKey(
              item.module_key
            ) ===
            "customer_loyalty"
        );

      const rawLoyaltyConfig =
        loyaltyModuleConfig?.config ||
        {};

      setLoyaltyConfig({
        program_name:
          typeof
            rawLoyaltyConfig.program_name ===
          "string"
            ? rawLoyaltyConfig.program_name
            : "",

        reward:
          typeof
            rawLoyaltyConfig.reward ===
          "string"
            ? rawLoyaltyConfig.reward
            : "",

        visits_required:
          rawLoyaltyConfig.visits_required !==
            undefined &&
          rawLoyaltyConfig.visits_required !==
            null
            ? String(
                rawLoyaltyConfig.visits_required
              )
            : "",
      });

      // ====================================================
      // TABLE ORDERING
      // ====================================================

      const tableOrderingModuleConfig =
        enabledConfigs.find(
          (item: ModuleConfig) =>
            normalizeModuleKey(
              item.module_key
            ) ===
            "table_ordering"
        );

      const rawTableOrderingConfig =
        tableOrderingModuleConfig?.config ||
        {};

      setTableOrderingConfig({
        table_count:
          rawTableOrderingConfig.table_count !==
            undefined &&
          rawTableOrderingConfig.table_count !==
            null
            ? String(
                rawTableOrderingConfig.table_count
              )
            : "",
      });

      // ====================================================
      // APPOINTMENT BOOKING
      // ====================================================

      const appointmentModuleConfig =
        enabledConfigs.find(
          (item: ModuleConfig) =>
            normalizeModuleKey(
              item.module_key
            ) === "appointment_booking"
        );

      const rawAppointmentConfig =
        appointmentModuleConfig?.config || {};

      setAppointmentConfig({
        duration:
          rawAppointmentConfig.duration !==
            undefined &&
          rawAppointmentConfig.duration !== null
            ? String(
                rawAppointmentConfig.duration
              )
            : "30",
        opening_time:
          typeof rawAppointmentConfig.opening_time ===
          "string"
            ? rawAppointmentConfig.opening_time
            : "10:00",
        closing_time:
          typeof rawAppointmentConfig.closing_time ===
          "string"
            ? rawAppointmentConfig.closing_time
            : "20:00",
        working_days:
          Array.isArray(
            rawAppointmentConfig.working_days
          )
            ? rawAppointmentConfig.working_days.map(
                (day) => String(day)
              )
            : [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ],
      });

      // ====================================================
      // ROOM SERVICE
      // ====================================================

      const roomServiceConfig = enabledConfigs.find(
        (item: ModuleConfig) =>
          normalizeModuleKey(item.module_key) === "room_service"
      );

      const rawRoomConfig = roomServiceConfig?.config || {};
      const roomCats: unknown[] = Array.isArray(rawRoomConfig.categories)
        ? rawRoomConfig.categories
        : [];
      const roomItems: unknown[] = Array.isArray(rawRoomConfig.items)
        ? rawRoomConfig.items
        : [];

      setRoomServiceCategories(
        roomCats.filter(
          (c): c is RoomServiceCategory =>
            Boolean(c && typeof c === "object" && "id" in c && "name" in c)
        )
      );

      const validRoomItems: RoomServiceItem[] = roomItems
        .filter(
          (i): i is Record<string, unknown> =>
            Boolean(i && typeof i === "object" && "id" in i && "name" in i)
        )
        .map((i) => {
          const rawPriceType = String(i.priceType || "").toLowerCase().trim();
          const priceType: "fixed" | "starting_from" =
            rawPriceType === "starting_from" || rawPriceType === "starting"
              ? "starting_from"
              : "fixed";

          return {
            id: String(i.id),
            name: String(i.name).trim(),
            categoryId: i.categoryId !== undefined && i.categoryId !== null ? String(i.categoryId) : undefined,
            category: i.category !== undefined && i.category !== null ? String(i.category) : undefined,
            price: i.price !== undefined && i.price !== null ? String(i.price) : undefined,
            priceType,
            description: i.description !== undefined && i.description !== null ? String(i.description) : undefined,
            deliveryTime: i.deliveryTime !== undefined && i.deliveryTime !== null ? String(i.deliveryTime) : undefined,
            available: i.available !== false,
          };
        });

      setRoomServiceItems(validRoomItems);

      // ====================================================
      // HOTEL SERVICES
      // ====================================================

      const hotelServicesConfig = enabledConfigs.find(
        (item: ModuleConfig) =>
          normalizeModuleKey(item.module_key) === "hotel_services"
      );

      const rawHotelConfig = hotelServicesConfig?.config || {};
      const hotelCats: unknown[] = Array.isArray(rawHotelConfig.categories)
        ? rawHotelConfig.categories
        : [];
      const hotelServicesList: unknown[] = Array.isArray(rawHotelConfig.services)
        ? rawHotelConfig.services
        : [];

      setHotelServiceCategories(
        hotelCats.filter(
          (c): c is HotelServiceCategory =>
            Boolean(c && typeof c === "object" && "id" in c && "name" in c)
        )
      );

      const validHotelServices: HotelServiceItem[] = hotelServicesList
        .filter(
          (s): s is Record<string, unknown> =>
            Boolean(s && typeof s === "object" && "id" in s && "name" in s)
        )
        .map((s) => {
          const rawAction = String(s.action || "").toLowerCase().trim();
          const action: "info" | "request" | "contact" =
            rawAction === "request"
              ? "request"
              : rawAction === "contact"
              ? "contact"
              : "info";

          return {
            id: String(s.id),
            name: String(s.name).trim(),
            categoryId: s.categoryId !== undefined && s.categoryId !== null ? String(s.categoryId) : undefined,
            category: s.category !== undefined && s.category !== null ? String(s.category) : undefined,
            description: s.description !== undefined && s.description !== null ? String(s.description) : undefined,
            availability: s.availability !== undefined && s.availability !== null ? String(s.availability) : undefined,
            action,
            available: s.available !== false,
          };
        });

      setHotelServiceItems(validHotelServices);

      // ====================================================
      // TAP ANALYTICS
      // ====================================================

      void supabase
        .from("interactions")
        .insert({
          device_id:
            deviceData.id,
          device_code:
            deviceData.device_code,
          business_id:
            deviceData.business_id,
          interaction_type:
            "nfc_tap",
        })
        .then(
          ({
            error:
              interactionError,
          }) => {
            if (
              interactionError
            ) {
              console.error(
                "Unable to record interaction:",
                interactionError
              );
            }
          }
        );
    } catch (err) {
      console.error(
        "TAPX customer experience error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "This TAPX experience is currently unavailable."
      );
    } finally {
      setLoading(false);
    }
  }

  function openModule(
    module: Exclude<
      ActiveModule,
      null
    >
  ) {
    setActiveModule(module);

    window.setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 0);
  }

  function closeModule() {
    setActiveModule(null);

    window.setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 0);
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingLogo}>
            TAPX
          </div>

          <div style={styles.spinner} />

          <p style={styles.loadingText}>
            Loading your experience...
          </p>

          <p style={styles.loadingSubText}>
            Connecting securely
          </p>
        </div>
      </main>
    );
  }

  if (
    error ||
    !business ||
    !device
  ) {
    return (
      <main style={styles.page}>
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>
            !
          </div>

          <h1 style={styles.errorTitle}>
            TAPX unavailable
          </h1>

          <p style={styles.errorText}>
            {error ||
              "We couldn't load this TAPX experience."}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            style={styles.retryButton}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  const whatsappNumber =
    business.whatsapp_number
      ? business.whatsapp_number.replace(
          /\D/g,
          ""
        )
      : "";

  const whatsappLink =
    whatsappNumber
      ? `https://wa.me/${whatsappNumber}`
      : null;

  const locationText = [
    business.city,
    business.state,
  ]
    .filter(Boolean)
    .join(", ");

  const locationQuery = [
    business.address,
    business.city,
    business.state,
  ]
    .filter(Boolean)
    .join(", ");

  const locationLink =
    locationQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          locationQuery
        )}`
      : null;

  const upiPaymentLink =
    business.payment_enabled ===
      true &&
    business.upi_id
      ? `upi://pay?pa=${encodeURIComponent(
          business.upi_id
        )}&pn=${encodeURIComponent(
          business.name
        )}&cu=INR`
      : null;

  const paymentLink =
    business.payment_url ||
    upiPaymentLink;

  const paymentSubtitle =
    business.payment_url
      ? "Secure payment"
      : upiPaymentLink
        ? "Pay via UPI"
        : "Payment not configured";

  const digitalMenuEnabled =
    enabledModuleKeys.includes(
      "digital_menu"
    ) &&
    digitalMenuCategories.length >
      0 &&
    digitalMenuItems.length > 0;

  const productModuleEnabled =
    enabledModuleKeys.some(
      (key) =>
        key ===
          "product_catalogue" ||
        key ===
          "product_catalog" ||
        key === "products"
    ) &&
    productItems.length > 0;

  const offersEnabled =
    enabledModuleKeys.includes(
      "offers_promotions"
    ) &&
    offerItems.length > 0;

  const servicesEnabled =
    enabledModuleKeys.includes(
      "services_catalogue"
    ) &&
    serviceItems.length > 0;

  const loyaltyEnabled =
    enabledModuleKeys.includes(
      "customer_loyalty"
    );

  const tableOrderingEnabled =
    enabledModuleKeys.includes(
      "table_ordering"
    ) &&
    Math.max(
      0,
      Number(
        tableOrderingConfig.table_count
      ) || 0
    ) > 0 &&
    digitalMenuItems.some(
      (item) =>
        item.available !== false
    );

  const feedbackEnabled =
    enabledModuleKeys.includes(
      "customer_feedback"
    );

  const appointmentBookingEnabled =
    enabledModuleKeys.includes(
      "appointment_booking"
    ) &&
    servicesEnabled;

  const roomServiceEnabled =
    enabledModuleKeys.some(
      (key) =>
        key === "room_service" ||
        key === "room-service" ||
        key === "roomservice" ||
        key === "in_room_dining"
    );

  const hotelServicesEnabled =
    enabledModuleKeys.some(
      (key) =>
        key === "hotel_services" ||
        key === "hotel-services" ||
        key === "hotelservices" ||
        key === "hotel_facilities"
    );

  const categoryAccent = useMemo(
    () => getCategoryAccent(business?.category),
    [business?.category]
  );

  return (
    <main style={styles.page}>
      <div style={styles.mobileContainer}>
        <header style={styles.header}>
          <div style={styles.businessIdentity}>
            <div
              style={{
                ...styles.businessLogo,
                background: categoryAccent.main,
              }}
            >
              {business.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={business.name}
                  style={styles.businessLogoImage}
                />
              ) : (
                getInitials(business.name)
              )}
            </div>

            <div>
              <div style={styles.businessName}>{business.name}</div>

              {business.category && (
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "3px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: categoryAccent.bgLight,
                    color: categoryAccent.main,
                    border: `1px solid ${categoryAccent.borderLight}`,
                    fontFamily: "var(--font-satoshi), sans-serif",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "none",
                  }}
                >
                  {business.category}
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              fontFamily: "var(--font-cabinet), sans-serif",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing: "1px",
              color: categoryAccent.main,
              padding: "4px 10px",
              borderRadius: "8px",
              background: categoryAccent.bgLight,
              border: `1px solid ${categoryAccent.borderLight}`,
            }}
          >
            TAPX
          </div>
        </header>

        {activeModule === null ? (
          <>
            <section style={styles.hero}>
              <div
                style={{
                  width: "36px",
                  height: "4px",
                  borderRadius: "999px",
                  background: categoryAccent.main,
                  margin: "0 auto 12px",
                }}
              />
              <h1 style={styles.heroTitle}>
                Welcome to {business.name}
              </h1>

              <p
                style={
                  styles.heroDescription
                }
              >
                Discover more, connect
                with us and enjoy your
                TAPX experience.
              </p>

              {locationText && (
                <div
                  style={
                    styles.locationBadge
                  }
                >
                  <span>
                    {String.fromCodePoint(
                      0x1f4cd
                    )}
                  </span>

                  <span>
                    {locationText}
                  </span>
                </div>
              )}
            </section>

            <section>
              <h2
                style={
                  styles.sectionTitle
                }
              >
                What would you like
                to do?
              </h2>

              <div
                style={
                  styles.actionGrid
                }
              >
                {/* CORE */}

                <ActionCard
                  icon={String.fromCodePoint(
                    0x2b50
                  )}
                  title="Review us"
                  subtitle="Google"
                  href={
                    business.google_review_url
                  }
                />

                <ActionCard
                  icon={String.fromCodePoint(
                    0x1f4f8
                  )}
                  title="Instagram"
                  subtitle="Follow us"
                  href={
                    business.instagram_url
                  }
                />

                <ActionCard
                  icon={String.fromCodePoint(
                    0x1f4ac
                  )}
                  title="WhatsApp"
                  subtitle="Chat with us"
                  href={
                    whatsappLink
                  }
                />

                <ActionCard
                  icon={String.fromCodePoint(
                    0x1f4b3
                  )}
                  title="Pay Now"
                  subtitle={
                    paymentSubtitle
                  }
                  href={
                    paymentLink
                  }
                />

                <ActionCard
                  icon={String.fromCodePoint(
                    0x1f4de
                  )}
                  title="Call"
                  subtitle={
                    business.phone
                      ? "Call us"
                      : "Phone not configured"
                  }
                  href={
                    business.phone
                      ? `tel:${business.phone}`
                      : null
                  }
                />

                <ActionCard
                  icon={String.fromCodePoint(
                    0x1f4cd
                  )}
                  title="Location"
                  subtitle={
                    locationLink
                      ? "Open in Maps"
                      : "Location not configured"
                  }
                  href={
                    locationLink
                  }
                />

                {/* PAID MODULES */}

                {digitalMenuEnabled && (
                  <ModuleActionCard
                    icon={String.fromCodePoint(
                      0x1f37d,
                      0xfe0f
                    )}
                    title="Digital Menu"
                    subtitle="View menu"
                    accentColor={categoryAccent.main}
                    onClick={() =>
                      openModule(
                        "digital-menu"
                      )
                    }
                  />
                )}

                {offersEnabled && (
                  <ModuleActionCard
                    icon={String.fromCodePoint(
                      0x1f3ab
                    )}
                    title="Offers"
                    subtitle="View latest deals"
                    accentColor={categoryAccent.main}
                    onClick={() =>
                      openModule(
                        "offers"
                      )
                    }
                  />
                )}

                {productModuleEnabled && (
                  <ModuleActionCard
                    icon={String.fromCodePoint(
                      0x1f6cd,
                      0xfe0f
                    )}
                    title="Products"
                    subtitle="Browse catalogue"
                    accentColor={categoryAccent.main}
                    onClick={() =>
                      openModule(
                        "product-catalogue"
                      )
                    }
                  />
                )}

                {servicesEnabled && (
                  <ModuleActionCard
                    icon={String.fromCodePoint(
                      0x1f485
                    )}
                    title="Services"
                    subtitle="View services"
                    accentColor={categoryAccent.main}
                    onClick={() =>
                      openModule(
                        "services"
                      )
                    }
                  />
                )}

                {appointmentBookingEnabled && (
                  <ModuleActionCard
                    icon={String.fromCodePoint(
                      0x1f4c5
                    )}
                    title="Book Appointment"
                    subtitle="Choose your service & time"
                    accentColor={categoryAccent.main}
                    onClick={() =>
                      openModule(
                        "appointment-booking"
                      )
                    }
                  />
                )}

                {loyaltyEnabled && (
                  <ModuleActionCard
                    icon={String.fromCodePoint(
                      0x1f381
                    )}
                    title="Loyalty"
                    subtitle={
                      loyaltyConfig.program_name ||
                      "Join rewards program"
                    }
                    accentColor={categoryAccent.main}
                    onClick={() =>
                      openModule(
                        "loyalty"
                      )
                    }
                  />
                )}

                {tableOrderingEnabled && (
                  <ModuleActionCard
                    icon={String.fromCodePoint(
                      0x1f6d2
                    )}
                    title="Order at Table"
                    subtitle="Browse menu & place order"
                    accentColor={categoryAccent.main}
                    onClick={() =>
                      openModule(
                        "table-ordering"
                      )
                    }
                  />
                )}

                {feedbackEnabled && (
                  <ModuleActionCard
                    icon={String.fromCodePoint(
                      0x1f4ac
                    )}
                    title="Feedback"
                    subtitle="Share your experience"
                    accentColor={categoryAccent.main}
                    onClick={() =>
                      openModule(
                        "feedback"
                      )
                    }
                  />
                )}

                {roomServiceEnabled && (
                  <ModuleActionCard
                    icon={String.fromCodePoint(
                      0x1f6ce,
                      0xfe0f
                    )}
                    title="Room Service"
                    subtitle="In-room food, drinks & requests"
                    accentColor={categoryAccent.main}
                    onClick={() =>
                      openModule(
                        "room-service"
                      )
                    }
                  />
                )}

                {hotelServicesEnabled && (
                  <ModuleActionCard
                    icon={String.fromCodePoint(
                      0x1f3e8
                    )}
                    title="Hotel Services"
                    subtitle="Amenities, spa & guest requests"
                    accentColor={categoryAccent.main}
                    onClick={() =>
                      openModule(
                        "hotel-services"
                      )
                    }
                  />
                )}
              </div>
            </section>

            <section
              style={
                styles.aboutSection
              }
            >
              <h2
                style={
                  styles.sectionTitle
                }
              >
                About{" "}
                {business.name}
              </h2>

              <div
                style={
                  styles.aboutCard
                }
              >
                <div
                  style={
                    styles.aboutRow
                  }
                >
                  <span
                    style={
                      styles.aboutLabel
                    }
                  >
                    Business
                  </span>

                  <span
                    style={
                      styles.aboutValue
                    }
                  >
                    {business.name}
                  </span>
                </div>

                {business.category && (
                  <div
                    style={
                      styles.aboutRow
                    }
                  >
                    <span
                      style={
                        styles.aboutLabel
                      }
                    >
                      Category
                    </span>

                    <span
                      style={
                        styles.aboutValue
                      }
                    >
                      {
                        business.category
                      }
                    </span>
                  </div>
                )}

                {locationText && (
                  <div
                    style={
                      styles.aboutRow
                    }
                  >
                    <span
                      style={
                        styles.aboutLabel
                      }
                    >
                      Location
                    </span>

                    <span
                      style={
                        styles.aboutValue
                      }
                    >
                      {locationText}
                    </span>
                  </div>
                )}

                {business.phone && (
                  <div
                    style={
                      styles.aboutRow
                    }
                  >
                    <span
                      style={
                        styles.aboutLabel
                      }
                    >
                      Phone
                    </span>

                    <a
                      href={`tel:${business.phone}`}
                      style={
                        styles.aboutLink
                      }
                    >
                      {business.phone}
                    </a>
                  </div>
                )}

                {business.email && (
                  <div
                    style={
                      styles.aboutRow
                    }
                  >
                    <span
                      style={
                        styles.aboutLabel
                      }
                    >
                      Email
                    </span>

                    <a
                      href={`mailto:${business.email}`}
                      style={
                        styles.aboutLink
                      }
                    >
                      {business.email}
                    </a>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <section
            style={
              styles.moduleView
            }
          >
            <button
              type="button"
              onClick={
                closeModule
              }
              style={
                styles.moduleBackButton
              }
              aria-label="Back to main TAPX page"
            >
              <span>
                {String.fromCodePoint(
                  0x2190
                )}
              </span>

              <span>
                Back
              </span>
            </button>

            {activeModule ===
              "digital-menu" &&
              digitalMenuEnabled && (
                <DigitalMenu
                  categories={
                    digitalMenuCategories
                  }
                  items={
                    digitalMenuItems
                  }
                />
              )}

            {activeModule ===
              "product-catalogue" &&
              productModuleEnabled && (
                <ProductCatalogue
                  products={
                    productItems
                  }
                />
              )}

            {activeModule ===
              "offers" &&
              offersEnabled && (
                <OffersSection
                  offers={
                    offerItems
                  }
                />
              )}

            {activeModule ===
              "services" &&
              servicesEnabled && (
                <ServicesCatalogue
                  services={
                    serviceItems
                  }
                />
              )}

            {activeModule ===
              "appointment-booking" &&
              appointmentBookingEnabled && (
                <AppointmentBookingSection
                  businessId={
                    business.id
                  }
                  businessName={
                    business.name
                  }
                  deviceCode={
                    device.device_code
                  }
                  services={
                    serviceItems
                  }
                  config={
                    appointmentConfig
                  }
                />
              )}

            {activeModule ===
              "loyalty" &&
              loyaltyEnabled && (
                <LoyaltySection
                  businessId={
                    business.id
                  }
                  businessName={
                    business.name
                  }
                  config={
                    loyaltyConfig
                  }
                />
              )}

            {activeModule ===
              "table-ordering" &&
              tableOrderingEnabled && (
                <TableOrderingSection
                  businessId={
                    business.id
                  }
                  businessName={
                    business.name
                  }
                  deviceCode={
                    device.device_code
                  }
                  tableCount={Math.max(
                    0,
                    Number(
                      tableOrderingConfig.table_count
                    ) || 0
                  )}
                  categories={
                    digitalMenuCategories
                  }
                  items={
                    digitalMenuItems
                  }
                />
              )}

            {activeModule ===
              "feedback" &&
              feedbackEnabled && (
                <CustomerFeedbackSection
                  businessId={
                    business.id
                  }
                  businessName={
                    business.name
                  }
                  deviceCode={
                    device.device_code
                  }
                />
              )}

            {activeModule ===
              "room-service" &&
              roomServiceEnabled && (
                <RoomServiceSection
                  businessId={
                    business.id
                  }
                  businessName={
                    business.name
                  }
                  deviceCode={
                    device.device_code
                  }
                  location={
                    device.location
                  }
                  categories={
                    roomServiceCategories
                  }
                  items={
                    roomServiceItems
                  }
                />
              )}

            {activeModule ===
              "hotel-services" &&
              hotelServicesEnabled && (
                <HotelServicesSection
                  businessId={
                    business.id
                  }
                  businessName={
                    business.name
                  }
                  deviceCode={
                    device.device_code
                  }
                  location={
                    device.location
                  }
                  whatsappLink={
                    whatsappLink
                  }
                  phone={
                    business.phone
                  }
                  categories={
                    hotelServiceCategories
                  }
                  services={
                    hotelServiceItems
                  }
                />
              )}
          </section>
        )}

        <footer
          style={styles.footer}
        >
          <div
            style={
              styles.footerBrand
            }
          >
            TAPX
          </div>

          <div
            style={
              styles.footerText
            }
          >
            Powered by TAPX
          </div>

          <div
            style={
              styles.deviceInfo
            }
          >
            {
              device.device_code
            }
          </div>
        </footer>
      </div>
    </main>
  );
}

/* =========================================================
   CUSTOMER FEEDBACK
   ========================================================= */

function CustomerFeedbackSection({
  businessId,
  businessName,
  deviceCode,
}: {
  businessId: string;
  businessName: string;
  deviceCode: string;
}) {
  const [rating, setRating] =
    useState(0);

  const [comment, setComment] =
    useState("");

  const [customerName, setCustomerName] =
    useState("");

  const [customerPhone, setCustomerPhone] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [error, setError] =
    useState("");

  async function submitFeedback() {
    setError("");

    if (
      rating < 1 ||
      rating > 5
    ) {
      setError(
        "Please select a rating from 1 to 5."
      );
      return;
    }

    const cleanPhone =
      customerPhone.replace(
        /\D/g,
        ""
      );

    if (
      cleanPhone &&
      cleanPhone.length < 10
    ) {
      setError(
        "Please enter a valid mobile number."
      );
      return;
    }

    if (
      comment.trim().length >
      1000
    ) {
      setError(
        "Please keep your comment within 1000 characters."
      );
      return;
    }

    setSubmitting(true);

    try {
      const {
        error: insertError,
      } = await supabase
        .from(
          "customer_feedback"
        )
        .insert({
          business_id:
            businessId,

          rating,

          comment:
            comment.trim() ||
            null,

          customer_name:
            customerName.trim() ||
            null,

          customer_phone:
            cleanPhone ||
            null,

          source_device_code:
            deviceCode ||
            null,
        });

      if (insertError) {
        throw insertError;
      }

      setSubmitted(true);
    } catch (err) {
      console.error(
        "TAPX customer feedback error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit your feedback. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetFeedback() {
    setSubmitted(false);
    setRating(0);
    setComment("");
    setCustomerName("");
    setCustomerPhone("");
    setError("");
  }

  if (submitted) {
    return (
      <section
        style={
          styles.feedbackSection
        }
      >
        <div
          style={
            styles.feedbackSuccessCard
          }
        >
          <div
            style={
              styles.feedbackSuccessIcon
            }
          >
            ✓
          </div>

          <div
            style={
              styles.feedbackEyebrow
            }
          >
            THANK YOU
          </div>

          <h2
            style={
              styles.feedbackSuccessTitle
            }
          >
            Feedback received.
          </h2>

          <p
            style={
              styles.feedbackSuccessText
            }
          >
            Thank you for sharing
            your experience with{" "}
            {businessName}.
          </p>

          <button
            type="button"
            onClick={
              resetFeedback
            }
            style={
              styles.feedbackSecondaryButton
            }
          >
            Send another response
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      style={
        styles.feedbackSection
      }
    >
      <div
        style={
          styles.feedbackHeader
        }
      >
        <div>
          <div
            style={
              styles.feedbackEyebrow
            }
          >
            YOUR EXPERIENCE
          </div>

          <h2
            style={
              styles.feedbackTitle
            }
          >
            How was your experience?
          </h2>

          <p
            style={
              styles.feedbackSubtitle
            }
          >
            Your feedback helps{" "}
            {businessName} improve
            its service.
          </p>
        </div>

        <div
          style={
            styles.feedbackMark
          }
        >
          ♡
        </div>
      </div>

      <div
        style={
          styles.feedbackCard
        }
      >
        <div
          style={
            styles.feedbackQuestion
          }
        >
          Rate your experience
        </div>

        <div
          style={
            styles.feedbackStars
          }
          role="radiogroup"
          aria-label="Rate your experience from one to five stars"
        >
          {[1, 2, 3, 4, 5].map(
            (value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} out of 5 stars`}
                aria-pressed={
                  rating === value
                }
                onClick={() =>
                  setRating(
                    value
                  )
                }
                style={{
                  ...styles.feedbackStarButton,

                  ...(value <=
                  rating
                    ? styles.feedbackStarActive
                    : {}),
                }}
              >
                ★
              </button>
            )
          )}
        </div>

        <div
          style={
            styles.feedbackRatingHint
          }
        >
          {rating === 0
            ? "Tap a star to rate"
            : rating === 5
              ? "Excellent"
              : rating === 4
                ? "Very good"
                : rating === 3
                  ? "Good"
                  : rating === 2
                    ? "Could be better"
                    : "Needs improvement"}
        </div>

        <label
          style={
            styles.feedbackLabel
          }
        >
          Comment{" "}
          <span
            style={
              styles.feedbackOptional
            }
          >
            (optional)
          </span>
        </label>

        <textarea
          value={comment}
          onChange={(event) =>
            setComment(
              event.target.value
            )
          }
          placeholder="Tell us what you liked or what we can improve..."
          maxLength={1000}
          rows={5}
          style={
            styles.feedbackTextarea
          }
        />

        <div
          style={
            styles.feedbackTwoColumn
          }
        >
          <div>
            <label
              style={
                styles.feedbackLabel
              }
            >
              Name{" "}
              <span
                style={
                  styles.feedbackOptional
                }
              >
                (optional)
              </span>
            </label>

            <input
              type="text"
              value={
                customerName
              }
              onChange={(event) =>
                setCustomerName(
                  event.target.value
                )
              }
              placeholder="Your name"
              autoComplete="name"
              maxLength={100}
              style={
                styles.feedbackInput
              }
            />
          </div>

          <div>
            <label
              style={
                styles.feedbackLabel
              }
            >
              Mobile{" "}
              <span
                style={
                  styles.feedbackOptional
                }
              >
                (optional)
              </span>
            </label>

            <input
              type="tel"
              value={
                customerPhone
              }
              onChange={(event) =>
                setCustomerPhone(
                  event.target.value
                )
              }
              placeholder="10-digit mobile number"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={15}
              style={
                styles.feedbackInput
              }
            />
          </div>
        </div>

        {error && (
          <div
            style={
              styles.feedbackError
            }
          >
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={
            submitting
          }
          onClick={() =>
            void submitFeedback()
          }
          style={{
            ...styles.feedbackPrimaryButton,
            opacity:
              submitting
                ? 0.65
                : 1,
          }}
        >
          {submitting
            ? "Submitting..."
            : "Submit feedback"}
        </button>

        <div
          style={
            styles.feedbackPrivacy
          }
        >
          Your feedback is shared
          with the business to
          improve its customer
          experience.
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   TABLE ORDERING
   ========================================================= */

function TableOrderingSection({
  businessId,
  businessName,
  deviceCode,
  tableCount,
  categories,
  items,
}: {
  businessId: string;
  businessName: string;
  deviceCode: string;
  tableCount: number;
  categories: DigitalMenuCategory[];
  items: DigitalMenuItem[];
}) {
  type ActiveOrder = {
    id: string;
    table_number: number;
    customer_name: string;
    customer_phone: string | null;
    status: string;
    subtotal: number;
    total: number;
    created_at: string;
  };

  type ActiveOrderItem = {
    id: string;
    item_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  };

  const storageKey = `tapx_active_order_${businessId}_${deviceCode}`;

  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [currentOrder, setCurrentOrder] = useState<ActiveOrder | null>(null);
  const [currentOrderItems, setCurrentOrderItems] = useState<ActiveOrderItem[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [showOrder, setShowOrder] = useState(false);

  const activeStatuses = [
    "pending",
    "accepted",
    "preparing",
    "ready",
    "served",
  ];

  const availableItems = items.filter(
    (item) => item.available !== false
  );

  const validCategories = categories.length
    ? categories
    : [{ id: "default", name: "Menu" }];

  const isActiveOrder = (status?: string | null) =>
    Boolean(status && activeStatuses.includes(status));

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Order received",
      accepted: "Order accepted",
      preparing: "Being prepared",
      ready: "Ready",
      served: "Served",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return labels[status] || status.replace(/_/g, " ");
  };

  const statusStep = (status: string) => {
    const steps = ["pending", "accepted", "preparing", "ready", "served"];
    const index = steps.indexOf(status);
    if (index >= 0) return index;
    return status === "completed" ? steps.length : 0;
  };

  async function loadCurrentOrder(orderIdOverride?: string) {
    setLoadingOrder(true);

    try {
      const savedOrderId =
        orderIdOverride ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem(storageKey)
          : null);

      if (!savedOrderId) {
        setCurrentOrder(null);
        setCurrentOrderItems([]);
        return;
      }

      const { data: order, error: orderError } = await supabase
        .from("tapx_orders")
        .select(
          "id, table_number, customer_name, customer_phone, status, subtotal, total, created_at"
        )
        .eq("id", savedOrderId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (orderError || !order) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(storageKey);
        }
        setCurrentOrder(null);
        setCurrentOrderItems([]);
        return;
      }

      const typedOrder = order as ActiveOrder;
      setCurrentOrder(typedOrder);
      setTableNumber(String(typedOrder.table_number));
      setCustomerName(typedOrder.customer_name || "");
      setCustomerPhone(typedOrder.customer_phone || "");

      if (!isActiveOrder(typedOrder.status)) {
        setCurrentOrderItems([]);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(storageKey);
        }
        return;
      }

      const { data: orderItems, error: itemsError } = await supabase
        .from("tapx_order_items")
        .select("id, item_name, unit_price, quantity, line_total")
        .eq("order_id", typedOrder.id)
        .order("created_at", { ascending: true });

      if (itemsError) {
        console.error("Unable to load order items:", itemsError);
        setCurrentOrderItems([]);
      } else {
        setCurrentOrderItems((orderItems || []) as ActiveOrderItem[]);
      }
    } catch (err) {
      console.error("TAPX current order restore error:", err);
    } finally {
      setLoadingOrder(false);
    }
  }

  useEffect(() => {
    void loadCurrentOrder();

    const timer = window.setInterval(() => {
      void loadCurrentOrder();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [businessId, deviceCode]);

  function addToCart(id: string) {
    setCart((current) => ({
      ...current,
      [id]: (current[id] || 0) + 1,
    }));
  }

  function removeFromCart(id: string) {
    setCart((current) => {
      const next = { ...current };
      if (!next[id]) return next;
      if (next[id] <= 1) delete next[id];
      else next[id] -= 1;
      return next;
    });
  }

  const cartItems = availableItems
    .filter((item) => (cart[item.id] || 0) > 0)
    .map((item) => ({
      ...item,
      quantity: cart[item.id],
      numericPrice:
        Number(String(item.price || "").replace(/[^0-9.]/g, "")) || 0,
    }));

  const total = cartItems.reduce(
    (sum, item) => sum + item.numericPrice * item.quantity,
    0
  );

  const cartQuantity = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  async function placeOrder() {
    setError("");

    if (!tableNumber) {
      setError("Please select your table number.");
      return;
    }

    if (!customerName.trim()) {
      setError("Please enter your name.");
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, "");

    if (cleanPhone && cleanPhone.length < 10) {
      setError("Please enter a valid mobile number.");
      return;
    }

    if (!cartItems.length) {
      setError("Please add at least one item to your order.");
      return;
    }

    setPlacing(true);

    try {
      const { data, error: orderError } = await supabase.rpc(
        "create_tapx_table_order",
        {
          p_business_id: businessId,
          p_table_number: Number(tableNumber),
          p_customer_name: customerName.trim(),
          p_customer_phone: cleanPhone || null,
          p_source_device_code: deviceCode,
          p_items: cartItems.map((item) => ({
            item_id: item.id,
            quantity: item.quantity,
          })),
        }
      );

      if (orderError) throw orderError;

      const newOrderId = String(data || "");
      if (!newOrderId) {
        throw new Error("The order was created without an order ID.");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, newOrderId);
      }

      setCart({});
      await loadCurrentOrder(newOrderId);
      setShowOrder(true);
    } catch (err) {
      console.error("TAPX table order error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to place your order."
      );
    } finally {
      setPlacing(false);
    }
  }

  async function addMoreToCurrentOrder() {
    setError("");

    if (!currentOrder) {
      await placeOrder();
      return;
    }

    if (!isActiveOrder(currentOrder.status)) {
      setError("This order is no longer active. Please start a new order.");
      return;
    }

    if (!cartItems.length) {
      setError("Please add at least one item.");
      return;
    }

    setPlacing(true);

    try {
      const { error: addError } = await supabase.rpc(
        "add_tapx_table_order_items",
        {
          p_order_id: currentOrder.id,
          p_items: cartItems.map((item) => ({
            item_id: item.id,
            quantity: item.quantity,
          })),
        }
      );

      if (addError) throw addError;

      setCart({});
      await loadCurrentOrder(currentOrder.id);
      setShowOrder(true);
    } catch (err) {
      console.error("TAPX add items error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add items to your current order."
      );
    } finally {
      setPlacing(false);
    }
  }

  function startNewOrder() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }

    setCurrentOrder(null);
    setCurrentOrderItems([]);
    setCart({});
    setTableNumber("");
    setCustomerName("");
    setCustomerPhone("");
    setShowOrder(false);
    setError("");
  }

  if (loadingOrder) {
    return (
      <section style={styles.orderSection}>
        <div style={styles.orderFormCard}>
          <div style={styles.orderEyebrow}>TABLE ORDERING</div>
          <h2 style={styles.orderTitle}>Checking your current order...</h2>
          <p style={styles.orderText}>
            Restoring your order so you can continue where you left off.
          </p>
        </div>
      </section>
    );
  }

  const hasActiveOrder =
    currentOrder && isActiveOrder(currentOrder.status);

  return (
    <section style={styles.orderSection}>
      <div style={styles.orderHeader}>
        <div>
          <div style={styles.orderEyebrow}>TABLE ORDERING</div>
          <h2 style={styles.orderTitle}>Order at your table</h2>
          <p style={styles.orderText}>
            Browse the menu, place your order and keep it while you explore TAPX.
          </p>
        </div>
        <div style={styles.orderMark}>🛒</div>
      </div>

      {hasActiveOrder && currentOrder && (
        <div
          style={{
            ...styles.orderFormCard,
            marginBottom: 18,
            background: "#ffffff",
            border: "1px solid #e4e4df",
            boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 14,
            }}
          >
            <div>
              <div style={styles.orderEyebrow}>YOUR CURRENT ORDER</div>
              <strong
                style={{
                  display: "block",
                  marginTop: 5,
                  fontSize: 18,
                  color: "#171717",
                }}
              >
                #{currentOrder.id.slice(0, 8).toUpperCase()}
              </strong>
              <div
                style={{
                  marginTop: 5,
                  fontSize: 12,
                  color: "#777",
                }}
              >
                Table {currentOrder.table_number} · {currentOrder.customer_name}
              </div>
            </div>

            <strong
              style={{
                fontSize: 18,
                color: "#171717",
              }}
            >
              ₹{Number(currentOrder.total || 0).toFixed(2)}
            </strong>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 4,
            }}
          >
            {["pending", "accepted", "preparing", "ready", "served"].map(
              (step, index) => {
                const active = index <= statusStep(currentOrder.status);
                return (
                  <div key={step} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 25,
                        height: 25,
                        margin: "0 auto",
                        borderRadius: "50%",
                        background: active ? "#171717" : "#eeeeec",
                        color: active ? "#ffffff" : "#999999",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {active ? "✓" : ""}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 9,
                        fontWeight: active ? 800 : 600,
                        color: active ? "#171717" : "#999999",
                      }}
                    >
                      {step === "pending"
                        ? "Received"
                        : step === "accepted"
                          ? "Accepted"
                          : step === "preparing"
                            ? "Preparing"
                            : step === "ready"
                              ? "Ready"
                              : "Served"}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "9px 11px",
              borderRadius: 10,
              background: "#f5f5f2",
              color: "#333",
              fontSize: 12,
              fontWeight: 750,
            }}
          >
            ● {statusLabel(currentOrder.status)}
          </div>

          <button
            type="button"
            onClick={() => setShowOrder((value) => !value)}
            style={{
              ...styles.orderPrimaryButton,
              width: "100%",
              marginTop: 12,
            }}
          >
            {showOrder ? "Hide current order" : "View current order"}
          </button>

          {showOrder && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px solid #eeeeec",
              }}
            >
              {currentOrderItems.length === 0 && (
                <p style={styles.orderText}>No items found in this order.</p>
              )}

              {currentOrderItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "9px 0",
                    borderBottom: "1px solid #f0f0ed",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "#222",
                      }}
                    >
                      {item.item_name}
                    </strong>
                    <span
                      style={{
                        display: "block",
                        marginTop: 3,
                        fontSize: 10,
                        color: "#888",
                      }}
                    >
                      {item.quantity} × ₹{Number(item.unit_price || 0).toFixed(2)}
                    </span>
                  </div>
                  <strong style={{ fontSize: 12 }}>
                    ₹{Number(item.line_total || 0).toFixed(2)}
                  </strong>
                </div>
              ))}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 12,
                  fontSize: 13,
                }}
              >
                <strong>Total</strong>
                <strong>₹{Number(currentOrder.total || 0).toFixed(2)}</strong>
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 10,
            }}
          >
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("tapx-table-menu")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              style={{
                ...styles.orderPrimaryButton,
                background: "#171717",
                color: "#ffffff",
              }}
            >
              Add more items
            </button>

            <button
              type="button"
              onClick={startNewOrder}
              style={{
                ...styles.orderPrimaryButton,
                background: "#eeeeec",
                color: "#333333",
              }}
            >
              Start new
            </button>
          </div>
        </div>
      )}

      <div style={styles.orderFormCard}>
        <label style={styles.orderLabel}>Table number</label>
        <select
          value={tableNumber}
          onChange={(event) => setTableNumber(event.target.value)}
          disabled={Boolean(hasActiveOrder)}
          style={styles.orderInput}
        >
          <option value="">Select your table</option>
          {Array.from({ length: tableCount }, (_, index) => index + 1).map(
            (number) => (
              <option key={number} value={number}>
                Table {number}
              </option>
            )
          )}
        </select>

        <label style={styles.orderLabel}>Your name</label>
        <input
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          disabled={Boolean(hasActiveOrder)}
          placeholder="Your name"
          style={styles.orderInput}
        />

        <label style={styles.orderLabel}>
          Mobile number <span style={styles.orderOptional}>(optional)</span>
        </label>
        <input
          value={customerPhone}
          onChange={(event) => setCustomerPhone(event.target.value)}
          disabled={Boolean(hasActiveOrder)}
          placeholder="10-digit mobile number"
          inputMode="tel"
          style={styles.orderInput}
        />
      </div>

      <div id="tapx-table-menu">
        {validCategories.map((category) => {
          const categoryItems = availableItems.filter((item) =>
            categories.length ? item.categoryId === category.id : true
          );

          if (!categoryItems.length) return null;

          return (
            <div key={category.id} style={styles.orderCategoryBlock}>
              <h3 style={styles.orderCategoryTitle}>{category.name}</h3>
              {category.description && (
                <p style={styles.orderCategoryDescription}>
                  {category.description}
                </p>
              )}

              <div style={styles.orderItemList}>
                {categoryItems.map((item) => {
                  const quantity = cart[item.id] || 0;

                  return (
                    <div key={item.id} style={styles.orderItemCard}>
                      <div style={styles.orderItemMain}>
                        <div style={styles.orderItemName}>{item.name}</div>
                        {item.description && (
                          <div style={styles.orderItemDescription}>
                            {item.description}
                          </div>
                        )}
                        <div style={styles.orderItemPrice}>
                          {item.price
                            ? `₹${item.price}`
                            : "Price on request"}
                        </div>
                      </div>

                      <div style={styles.orderQuantityControls}>
                        {quantity > 0 && (
                          <button
                            type="button"
                            style={styles.orderQtyButton}
                            onClick={() => removeFromCart(item.id)}
                          >
                            −
                          </button>
                        )}

                        {quantity > 0 && (
                          <span style={styles.orderQty}>{quantity}</span>
                        )}

                        <button
                          type="button"
                          style={styles.orderQtyButton}
                          onClick={() => addToCart(item.id)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error && <div style={styles.orderError}>{error}</div>}

      <div style={styles.orderSummaryCard}>
        <div>
          <span style={styles.orderSummaryLabel}>
            {cartQuantity} {cartQuantity === 1 ? "item" : "items"}
          </span>
          <strong style={styles.orderSummaryTotal}>
            ₹{total.toFixed(2)}
          </strong>
        </div>

        <button
          type="button"
          disabled={placing || !cartItems.length}
          onClick={() =>
            hasActiveOrder
              ? void addMoreToCurrentOrder()
              : void placeOrder()
          }
          style={{
            ...styles.orderPrimaryButton,
            opacity: placing || !cartItems.length ? 0.55 : 1,
          }}
        >
          {placing
            ? "Updating..."
            : hasActiveOrder
              ? "Add to current order"
              : "Place Order"}
        </button>
      </div>
    </section>
  );
}


/* =========================================================
   LOYALTY
   ========================================================= */

/* =========================================================
   APPOINTMENT BOOKING
   ========================================================= */

function AppointmentBookingSection({
  businessId,
  businessName,
  deviceCode,
  services,
  config,
}: {
  businessId: string;
  businessName: string;
  deviceCode: string;
  services: ServiceItem[];
  config: AppointmentConfig;
}) {
  const [selectedService, setSelectedService] =
    useState<ServiceItem | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const [error, setError] = useState("");
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);

  const visibleServices = services.filter(
    (service) => service.available !== false
  );

  const durationMinutes = Math.max(
    15,
    Number(
      String(config.duration ?? "30").replace(/[^0-9]/g, "")
    ) || 30
  );

  const workingDays = Array.isArray(config.working_days)
    ? config.working_days
    : [];

  const timeToMinutes = (value: string) => {
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const formatTime = (minutes: number) => {
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  };

  const availableTimes = (() => {
    const opening = timeToMinutes(config.opening_time || "10:00");
    const closing = timeToMinutes(config.closing_time || "20:00");
    const slots: string[] = [];

    for (
      let minutes = opening;
      minutes + durationMinutes <= closing;
      minutes += 30
    ) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      slots.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      );
    }

    return slots;
  })();

  type BookedInterval = {
    startMin: number;
    endMin: number;
    timeStr: string;
  };

  const [bookedIntervals, setBookedIntervals] = useState<BookedInterval[]>([]);

  async function loadBookedTimes(selectedDate: string) {
    if (!selectedDate) {
      setBookedTimes([]);
      setBookedIntervals([]);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("tapx_appointments")
      .select("appointment_time, duration_minutes")
      .eq("business_id", businessId)
      .eq("appointment_date", selectedDate)
      .in("status", ["pending", "confirmed"]);

    if (queryError) {
      console.error("Unable to load booked appointment slots:", queryError);
      return;
    }

    const intervals: BookedInterval[] = (data || []).map((row: any) => {
      const timeStr = String(row.appointment_time).slice(0, 5);
      const [h, m] = timeStr.split(":").map(Number);
      const startMin = (h || 0) * 60 + (m || 0);
      const duration = Number(row.duration_minutes || 30);
      return { startMin, endMin: startMin + duration, timeStr };
    });

    setBookedIntervals(intervals);
    setBookedTimes(intervals.map((i) => i.timeStr));
  }

  function isSlotOverlapping(slotTimeStr: string, durationMinutes: number = 30) {
    const [sh, sm] = slotTimeStr.split(":").map(Number);
    const slotStart = sh * 60 + sm;
    const slotEnd = slotStart + durationMinutes;

    return bookedIntervals.some(
      (existing) => slotStart < existing.endMin && slotEnd > existing.startMin
    );
  }

  useEffect(() => {
    void loadBookedTimes(date);
  }, [date, businessId]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);

  const toDateInput = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

  const todayString = toDateInput(today);
  const maxDateString = toDateInput(maxDate);

  const selectedDateObject = date
    ? new Date(`${date}T00:00:00`)
    : null;

  const selectedDayName = selectedDateObject
    ? selectedDateObject.toLocaleDateString("en-US", {
        weekday: "long",
      })
    : "";

  const dayAllowed =
    !date ||
    workingDays.length === 0 ||
    workingDays.some(
      (day) =>
        day.toLowerCase() === selectedDayName.toLowerCase()
    );

  const cleanPhone = phone.replace(/\D/g, "");

  async function submitAppointment() {
    setError("");

    if (!selectedService) {
      setError("Please select a service.");
      return;
    }

    if (!date) {
      setError("Please select a date.");
      return;
    }

    if (!dayAllowed) {
      setError(`${selectedDayName} is not available for appointments.`);
      return;
    }

    if (!time) {
      setError("Please select a time.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (cleanPhone.length < 10) {
      setError("Please enter a valid mobile number.");
      return;
    }

    const serviceDuration = selectedService?.duration ? parseInt(selectedService.duration) || 30 : 30;
    if (isSlotOverlapping(time, serviceDuration)) {
      setError("That time slot overlaps with an existing booking. Please select another time.");
      await loadBookedTimes(date);
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "create_tapx_appointment",
        {
          p_business_id: businessId,
          p_customer_name: name.trim(),
          p_customer_phone: cleanPhone,
          p_service_id: selectedService.id,
          p_service_name: selectedService.name,
          p_appointment_date: date,
          p_appointment_time: time,
          p_duration_minutes: durationMinutes,
          p_notes: notes.trim() || null,
          p_source_device_code: deviceCode,
        }
      );

      if (rpcError) throw rpcError;

      const appointmentId = String(data || "");

      if (!appointmentId) {
        throw new Error(
          "Appointment was created without a confirmation ID."
        );
      }

      setSubmittedId(appointmentId);
    } catch (err) {
      console.error("TAPX appointment booking error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to book the appointment. Please try again."
      );
      await loadBookedTimes(date);
    } finally {
      setSubmitting(false);
    }
  }

  function resetBooking() {
    setSelectedService(null);
    setDate("");
    setTime("");
    setName("");
    setPhone("");
    setNotes("");
    setSubmittedId("");
    setError("");
    setBookedTimes([]);
  }

  if (submittedId) {
    return (
      <section style={{ padding: "8px 0 24px" }}>
        <div
          style={{
            background: "linear-gradient(145deg, #171411 0%, #30271f 100%)",
            borderRadius: 28,
            padding: 28,
            color: "#fff",
            boxShadow: "0 18px 45px rgba(30,24,18,0.16)",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,0.12)",
              fontSize: 25,
              marginBottom: 20,
            }}
          >
            ✓
          </div>

          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              fontWeight: 700,
              opacity: 0.7,
            }}
          >
            APPOINTMENT REQUESTED
          </div>

          <h2
            style={{
              fontSize: 30,
              lineHeight: 1.08,
              margin: "10px 0",
              fontWeight: 700,
              letterSpacing: "-0.03em",
            }}
          >
            You're booked.
          </h2>

          <p
            style={{
              margin: 0,
              color: "rgba(255,255,255,0.72)",
              lineHeight: 1.6,
            }}
          >
            {businessName} has received your appointment request.
          </p>

          <div
            style={{
              marginTop: 24,
              padding: 18,
              borderRadius: 18,
              background: "rgba(255,255,255,0.08)",
            }}
          >
            <strong style={{ display: "block", fontSize: 18 }}>
              {selectedService?.name}
            </strong>

            <div style={{ marginTop: 7, color: "rgba(255,255,255,0.72)" }}>
              {date} · {formatTime(timeToMinutes(time))}
            </div>

            <div style={{ marginTop: 7, color: "rgba(255,255,255,0.72)" }}>
              Booking #{submittedId.slice(0, 8).toUpperCase()}
            </div>
          </div>

          <button
            type="button"
            onClick={resetBooking}
            style={{
              marginTop: 18,
              width: "100%",
              border: 0,
              borderRadius: 15,
              padding: "14px 18px",
              background: "#fff",
              color: "#171411",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Book another appointment
          </button>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: "8px 0 24px" }}>
      <div style={{ padding: "4px 4px 22px" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            fontWeight: 700,
            color: "#8b6d4c",
          }}
        >
          APPOINTMENTS
        </div>

        <h2
          style={{
            fontSize: 32,
            lineHeight: 1.05,
            margin: "8px 0 9px",
            letterSpacing: "-0.035em",
            fontWeight: 750,
          }}
        >
          Your time,
          <br />
          beautifully planned.
        </h2>

        <p style={{ margin: 0, color: "#70706b", lineHeight: 1.55 }}>
          Choose a service and a time that works for you.
        </p>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div style={appointmentCardStyle}>
          <div style={appointmentStepStyle}>01 · CHOOSE A SERVICE</div>

          <div style={{ display: "grid", gap: 10 }}>
            {visibleServices.map((service) => {
              const selected = selectedService?.id === service.id;

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedService(service)}
                  style={{
                    textAlign: "left",
                    borderRadius: 17,
                    border: selected
                      ? "1.5px solid #171411"
                      : "1px solid #e6e2dc",
                    background: selected ? "#f4efe8" : "#fff",
                    padding: "15px 16px",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong style={{ display: "block", fontSize: 16 }}>
                        {service.name}
                      </strong>

                      <span
                        style={{
                          display: "block",
                          marginTop: 5,
                          fontSize: 12,
                          color: "#77736e",
                        }}
                      >
                        {service.duration || `${durationMinutes} min`}
                      </span>
                    </div>

                    {service.price && (
                      <strong style={{ whiteSpace: "nowrap" }}>
                        {service.priceType === "starting_from" ? "From " : ""}
                        ₹{service.price}
                      </strong>
                    )}
                  </div>

                  {service.description && (
                    <div
                      style={{
                        marginTop: 9,
                        color: "#77736e",
                        fontSize: 13,
                        lineHeight: 1.45,
                      }}
                    >
                      {service.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={appointmentCardStyle}>
          <div style={appointmentStepStyle}>02 · CHOOSE A DATE</div>

          <input
            type="date"
            min={todayString}
            max={maxDateString}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setTime("");
              setError("");
            }}
            style={appointmentInputStyle}
          />

          {date && !dayAllowed && (
            <div
              style={{
                marginTop: 10,
                color: "#9b4d42",
                fontSize: 13,
              }}
            >
              {selectedDayName} is not available.
            </div>
          )}
        </div>

        <div style={appointmentCardStyle}>
          <div style={appointmentStepStyle}>03 · CHOOSE A TIME</div>

          {!date ? (
            <div style={{ color: "#8a8782", fontSize: 14 }}>
              Select a date first.
            </div>
          ) : !dayAllowed ? (
            <div style={{ color: "#8a8782", fontSize: 14 }}>
              Please choose another day.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {availableTimes.map((slot) => {
                const serviceDuration = selectedService?.duration ? parseInt(selectedService.duration) || 30 : 30;
                const unavailable = isSlotOverlapping(slot, serviceDuration);
                const selected = time === slot;

                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={unavailable}
                    onClick={() => {
                      setTime(slot);
                      setError("");
                    }}
                    style={{
                      border: selected
                        ? "1.5px solid #171411"
                        : "1px solid #e4dfd7",
                      borderRadius: 12,
                      padding: "11px 6px",
                      background: unavailable
                        ? "#f0efed"
                        : selected
                          ? "#171411"
                          : "#fff",
                      color: unavailable
                        ? "#aaa6a0"
                        : selected
                          ? "#fff"
                          : "#292723",
                      fontSize: 13,
                      cursor: unavailable ? "not-allowed" : "pointer",
                      textDecoration: unavailable ? "line-through" : "none",
                    }}
                  >
                    {formatTime(timeToMinutes(slot))}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={appointmentCardStyle}>
          <div style={appointmentStepStyle}>04 · YOUR DETAILS</div>

          <div style={{ display: "grid", gap: 12 }}>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              maxLength={100}
              autoComplete="name"
              style={appointmentInputStyle}
            />

            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Mobile number"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={15}
              style={appointmentInputStyle}
            />

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything we should know? (optional)"
              maxLength={500}
              rows={3}
              style={{
                ...appointmentInputStyle,
                resize: "vertical",
              }}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              borderRadius: 14,
              padding: "12px 14px",
              background: "#fff0ee",
              color: "#9b4d42",
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={() => void submitAppointment()}
          style={{
            width: "100%",
            border: 0,
            borderRadius: 18,
            padding: "17px 20px",
            background: "#171411",
            color: "#fff",
            fontSize: 15,
            fontWeight: 750,
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.65 : 1,
            boxShadow: "0 12px 25px rgba(23,20,17,0.16)",
          }}
        >
          {submitting ? "Confirming..." : "Confirm Appointment"}
        </button>
      </div>
    </section>
  );
}

const appointmentCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e9e4dd",
  borderRadius: 24,
  padding: 20,
  boxShadow: "0 10px 30px rgba(30,25,20,0.05)",
};

const appointmentStepStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 750,
  letterSpacing: "0.06em",
  marginBottom: 13,
};

const appointmentInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #ddd8d0",
  borderRadius: 14,
  padding: "14px",
  fontSize: 15,
  background: "#faf9f7",
  outline: "none",
};

function LoyaltySection({
  businessId,
  businessName,
  config,
}: {
  businessId: string;
  businessName: string;
  config: LoyaltyConfig;
}) {
  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [membership, setMembership] =
    useState<{
      id: string;
      visits: number;
      reward_claimed: boolean;
    } | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const programName =
    String(
      config.program_name ||
        ""
    ).trim() ||
    "TAPX Rewards";

  const reward =
    String(
      config.reward || ""
    ).trim() ||
    "Exclusive reward from the business";

  const requiredVisits =
    Math.max(
      1,
      Number(
        config.visits_required
      ) || 5
    );

  async function joinOrViewLoyalty() {
    const cleanName =
      name.trim();

    const cleanPhone =
      phone.replace(
        /\D/g,
        ""
      );

    setError("");
    setMessage("");

    if (!cleanName) {
      setError(
        "Please enter your name."
      );
      return;
    }

    if (
      cleanPhone.length < 10
    ) {
      setError(
        "Please enter a valid mobile number."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data: existingCustomer,
        error:
          customerLookupError,
      } = await supabase
        .from("customers")
        .select(
          "id, name, phone"
        )
        .eq(
          "phone",
          cleanPhone
        )
        .maybeSingle();

      if (
        customerLookupError
      ) {
        throw customerLookupError;
      }

      let customerId =
        existingCustomer?.id as
          | string
          | undefined;

      if (!customerId) {
        const {
          data: newCustomer,
          error:
            customerInsertError,
        } = await supabase
          .from("customers")
          .insert({
            name:
              cleanName,
            phone:
              cleanPhone,
          })
          .select("id")
          .single();

        if (
          customerInsertError
        ) {
          throw customerInsertError;
        }

        customerId =
          newCustomer.id;
      } else if (
        existingCustomer?.name !==
        cleanName
      ) {
        const {
          error:
            customerUpdateError,
        } = await supabase
          .from("customers")
          .update({
            name:
              cleanName,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            customerId
          );

        if (
          customerUpdateError
        ) {
          throw customerUpdateError;
        }
      }

      setName(cleanName);

      const {
        data: existingMembership,
        error:
          membershipLookupError,
      } = await supabase
        .from(
          "loyalty_memberships"
        )
        .select(
          "id, visits, reward_claimed"
        )
        .eq(
          "business_id",
          businessId
        )
        .eq(
          "customer_id",
          customerId
        )
        .maybeSingle();

      if (
        membershipLookupError
      ) {
        throw membershipLookupError;
      }

      let membershipData =
        existingMembership;

      if (!membershipData) {
        const {
          data: newMembership,
          error:
            membershipInsertError,
        } = await supabase
          .from(
            "loyalty_memberships"
          )
          .insert({
            business_id:
              businessId,
            customer_id:
              customerId,
            visits: 0,
            reward_claimed:
              false,
          })
          .select(
            "id, visits, reward_claimed"
          )
          .single();

        if (
          membershipInsertError
        ) {
          throw membershipInsertError;
        }

        membershipData =
          newMembership;

        setMessage(
          `Welcome to ${programName}, ${cleanName}!`
        );
      } else {
        setMessage(
          `Welcome back, ${cleanName}!`
        );
      }

      setMembership({
        id: String(
          membershipData.id
        ),
        visits:
          Number(
            membershipData.visits
          ) || 0,
        reward_claimed:
          membershipData.reward_claimed ===
          true,
      });
    } catch (err) {
      console.error(
        "TAPX loyalty error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your loyalty account."
      );
    } finally {
      setLoading(false);
    }
  }

  const visits =
    membership?.visits || 0;

  const progress =
    Math.min(
      100,
      Math.round(
        (visits /
          requiredVisits) *
          100
      )
    );

  const rewardUnlocked =
    visits >=
      requiredVisits &&
    membership?.reward_claimed !==
      true;

  return (
    <section
      style={
        styles.loyaltySection
      }
    >
      <div
        style={
          styles.loyaltyHeader
        }
      >
        <div>
          <div
            style={
              styles.loyaltyEyebrow
            }
          >
            REWARDS
          </div>

          <h2
            style={
              styles.loyaltyTitle
            }
          >
            {programName}
          </h2>

          <p
            style={
              styles.loyaltySubtitle
            }
          >
            Earn rewards when you
            visit{" "}
            {businessName}.
          </p>
        </div>

        <div
          style={
            styles.loyaltyMark
          }
        >
          🎁
        </div>
      </div>

      {!membership ? (
        <div
          style={
            styles.loyaltyFormCard
          }
        >
          <h3
            style={
              styles.loyaltyFormTitle
            }
          >
            Join the loyalty
            program
          </h3>

          <p
            style={
              styles.loyaltyFormText
            }
          >
            Enter your details to
            join or view your
            existing loyalty
            account.
          </p>

          <label
            style={
              styles.loyaltyLabel
            }
          >
            Name
          </label>

          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            placeholder="Your name"
            autoComplete="name"
            style={
              styles.loyaltyInput
            }
          />

          <label
            style={
              styles.loyaltyLabel
            }
          >
            Mobile number
          </label>

          <input
            type="tel"
            value={phone}
            onChange={(event) =>
              setPhone(
                event.target.value
              )
            }
            placeholder="10-digit mobile number"
            autoComplete="tel"
            inputMode="numeric"
            style={
              styles.loyaltyInput
            }
          />

          {error && (
            <div
              style={
                styles.loyaltyError
              }
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              void joinOrViewLoyalty()
            }
            disabled={loading}
            style={
              styles.loyaltyPrimaryButton
            }
          >
            {loading
              ? "Loading..."
              : "Continue"}
          </button>

          <div
            style={
              styles.loyaltyRewardPreview
            }
          >
            <span
              style={
                styles.loyaltyRewardIcon
              }
            >
              🎁
            </span>

            <div>
              <div
                style={
                  styles.loyaltyRewardLabel
                }
              >
                YOUR REWARD
              </div>

              <div
                style={
                  styles.loyaltyRewardText
                }
              >
                {reward}
              </div>

              <div
                style={
                  styles.loyaltyRequirement
                }
              >
                Unlock after{" "}
                {
                  requiredVisits
                }{" "}
                visits
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={
            styles.loyaltyProgressCard
          }
        >
          <div
            style={
              styles.loyaltyWelcomeRow
            }
          >
            <div>
              <div
                style={
                  styles.loyaltySmallLabel
                }
              >
                MEMBER
              </div>

              <div
                style={
                  styles.loyaltyMemberName
                }
              >
                {name.trim() ||
                  "Loyalty Member"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMembership(
                  null
                );
                setMessage("");
                setError("");
              }}
              style={
                styles.loyaltyChangeButton
              }
            >
              Change
            </button>
          </div>

          <div
            style={
              styles.loyaltyProgressHeader
            }
          >
            <div>
              <div
                style={
                  styles.loyaltyProgressLabel
                }
              >
                Your progress
              </div>

              <div
                style={
                  styles.loyaltyProgressCount
                }
              >
                {visits} /{" "}
                {
                  requiredVisits
                }{" "}
                visits
              </div>
            </div>

            <div
              style={
                styles.loyaltyProgressPercent
              }
            >
              {progress}%
            </div>
          </div>

          <div
            style={
              styles.loyaltyProgressTrack
            }
          >
            <div
              style={{
                ...styles.loyaltyProgressFill,
                width: `${progress}%`,
              }}
            />
          </div>

          <div
            style={
              styles.loyaltyDots
            }
          >
            {Array.from(
              {
                length:
                  requiredVisits,
              },
              (_, index) => (
                <span
                  key={index}
                  style={{
                    ...styles.loyaltyDot,

                    ...(index <
                    visits
                      ? styles.loyaltyDotActive
                      : {}),
                  }}
                >
                  {index < visits
                    ? "✓"
                    : ""}
                </span>
              )
            )}
          </div>

          <div
            style={
              rewardUnlocked
                ? styles.loyaltyUnlockedCard
                : styles.loyaltyRewardCard
            }
          >
            <div
              style={
                styles.loyaltyRewardIconLarge
              }
            >
              {rewardUnlocked
                ? "🎉"
                : "🎁"}
            </div>

            <div
              style={{
                minWidth: 0,
              }}
            >
              <div
                style={
                  styles.loyaltyRewardLabel
                }
              >
                {rewardUnlocked
                  ? "REWARD UNLOCKED"
                  : "YOUR REWARD"}
              </div>

              <div
                style={
                  styles.loyaltyRewardText
                }
              >
                {reward}
              </div>

              {!rewardUnlocked && (
                <div
                  style={
                    styles.loyaltyRequirement
                  }
                >
                  {Math.max(
                    0,
                    requiredVisits -
                      visits
                  )}{" "}
                  more visit
                  {requiredVisits -
                    visits ===
                  1
                    ? ""
                    : "s"}{" "}
                  to unlock
                </div>
              )}

              {rewardUnlocked && (
                <div
                  style={
                    styles.loyaltyClaimHint
                  }
                >
                  Show this screen to
                  the business staff
                  to redeem your
                  reward.
                </div>
              )}
            </div>
          </div>

          {message && (
            <div
              style={
                styles.loyaltySuccess
              }
            >
              {message}
            </div>
          )}

          <div
            style={
              styles.loyaltyInfo
            }
          >
            Loyalty visits are
            recorded by the business
            when your visit or
            eligible transaction is
            completed.
          </div>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   DIGITAL MENU
   ========================================================= */

function DigitalMenu({
  categories,
  items,
}: {
  categories: DigitalMenuCategory[];
  items: DigitalMenuItem[];
}) {
  const visibleCategories =
    categories
      .map((category) => ({
        category,
        items: items.filter(
          (item) =>
            item.categoryId ===
              category.id &&
            item.available !== false
        ),
      }))
      .filter(
        (group) =>
          group.items.length > 0
      );

  if (
    visibleCategories.length ===
    0
  ) {
    return null;
  }

  return (
    <section
      id="digital-menu"
      style={styles.menuSection}
    >
      <div
        style={styles.menuTop}
      >
        <div>
          <div
            style={
              styles.menuEyebrow
            }
          >
            OUR MENU
          </div>

          <h2
            style={
              styles.menuTitle
            }
          >
            Digital Menu
          </h2>

          <p
            style={
              styles.menuSubtitle
            }
          >
            Explore our menu,
            freshly presented for
            you.
          </p>
        </div>

        <div
          style={
            styles.menuMark
          }
        >
          🍽️
        </div>
      </div>

      <div
        style={styles.menuTabs}
      >
        {visibleCategories.map(
          ({ category }) => (
            <a
              key={category.id}
              href={`#menu-${category.id}`}
              style={
                styles.menuTab
              }
            >
              {category.name}
            </a>
          )
        )}
      </div>

      <div
        style={
          styles.menuGroups
        }
      >
        {visibleCategories.map(
          ({
            category,
            items:
              categoryItems,
          }) => (
            <section
              key={category.id}
              id={`menu-${category.id}`}
              style={
                styles.menuGroup
              }
            >
              <div
                style={
                  styles.menuGroupHeading
                }
              >
                <div>
                  <h3
                    style={
                      styles.menuCategoryName
                    }
                  >
                    {
                      category.name
                    }
                  </h3>

                  {category.description && (
                    <p
                      style={
                        styles.menuCategoryDescription
                      }
                    >
                      {
                        category.description
                      }
                    </p>
                  )}
                </div>

                <div
                  style={
                    styles.menuLine
                  }
                />
              </div>

              <div
                style={
                  styles.menuCards
                }
              >
                {categoryItems.map(
                  (item) => (
                    <article
                      key={
                        item.id
                      }
                      style={
                        styles.menuCustomerCard
                      }
                    >
                      {item.imageUrl ? (
                        <img
                          src={
                            item.imageUrl
                          }
                          alt={
                            item.name
                          }
                          style={
                            styles.menuFoodImage
                          }
                        />
                      ) : (
                        <div
                          style={
                            styles.menuFoodPlaceholder
                          }
                        >
                          🍽️
                        </div>
                      )}

                      <div
                        style={
                          styles.menuFoodBody
                        }
                      >
                        <div
                          style={
                            styles.menuFoodNameRow
                          }
                        >
                          <h4
                            style={
                              styles.menuFoodName
                            }
                          >
                            {
                              item.name
                            }
                          </h4>

                          {item.popular && (
                            <span
                              style={
                                styles.menuPopular
                              }
                            >
                              ★ Popular
                            </span>
                          )}
                        </div>

                        <div
                          style={
                            styles.menuFoodMeta
                          }
                        >
                          {item.dietary &&
                            item.dietary !==
                              "none" && (
                              <span
                                style={{
                                  ...styles.menuDietaryDot,

                                  ...(item.dietary ===
                                  "veg"
                                    ? styles.menuDietaryVeg
                                    : styles.menuDietaryNonVeg),
                                }}
                              >
                                {item.dietary ===
                                "veg"
                                  ? "V"
                                  : "•"}
                              </span>
                            )}

                          {item.description && (
                            <p
                              style={
                                styles.menuFoodDescription
                              }
                            >
                              {
                                item.description
                              }
                            </p>
                          )}
                        </div>

                        <div
                          style={
                            styles.menuFoodBottom
                          }
                        >
                          <strong
                            style={
                              styles.menuFoodPrice
                            }
                          >
                            {item.price
                              ? `₹${item.price}`
                              : "Price on request"}
                          </strong>
                        </div>
                      </div>
                    </article>
                  )
                )}
              </div>
            </section>
          )
        )}
      </div>
    </section>
  );
}

/* =========================================================
   PRODUCTS
   ========================================================= */

function ProductCatalogue({
  products,
}: {
  products: ProductItem[];
}) {
  return (
    <section
      id="product-catalogue"
      style={
        styles.productSection
      }
    >
      <div
        style={
          styles.productHeader
        }
      >
        <div>
          <div
            style={
              styles.productEyebrow
            }
          >
            SHOP
          </div>

          <h2
            style={
              styles.productTitle
            }
          >
            Product Catalogue
          </h2>

          <p
            style={
              styles.productSubtitle
            }
          >
            Browse our latest
            products and prices.
          </p>
        </div>

        <div
          style={
            styles.productCount
          }
        >
          {products.length}{" "}
          {products.length === 1
            ? "item"
            : "items"}
        </div>
      </div>

      <div
        style={
          styles.productGrid
        }
      >
        {products.map(
          (product) => (
            <article
              key={
                product.id
              }
              style={
                styles.productCard
              }
            >
              <div
                style={
                  styles.productIcon
                }
              >
                🛍️
              </div>

              <div
                style={
                  styles.productContent
                }
              >
                <div
                  style={
                    styles.productName
                  }
                >
                  {product.name}
                </div>

                {product.price && (
                  <div
                    style={
                      styles.productPrice
                    }
                  >
                    ₹
                    {
                      product.price
                    }
                  </div>
                )}

                {product.description && (
                  <div
                    style={
                      styles.productDescription
                    }
                  >
                    {
                      product.description
                    }
                  </div>
                )}
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}

/* =========================================================
   SERVICES
   ========================================================= */

function ServicesCatalogue({
  services,
}: {
  services: ServiceItem[];
}) {
  const visibleServices =
    services.filter(
      (service) =>
        service.available !==
        false
    );

  const groups =
    visibleServices.reduce<
      {
        name: string;
        services: ServiceItem[];
      }[]
    >(
      (
        result,
        service
      ) => {
        const category =
          service.category?.trim() ||
          "Services";

        const existing =
          result.find(
            (group) =>
              group.name.toLowerCase() ===
              category.toLowerCase()
          );

        if (existing) {
          existing.services.push(
            service
          );
        } else {
          result.push({
            name: category,
            services: [
              service,
            ],
          });
        }

        return result;
      },
      []
    );

  if (!groups.length) {
    return null;
  }

  return (
    <section
      style={
        styles.servicesSection
      }
    >
      <div
        style={
          styles.servicesHeader
        }
      >
        <div>
          <div
            style={
              styles.servicesEyebrow
            }
          >
            SERVICES
          </div>

          <h2
            style={
              styles.servicesTitle
            }
          >
            Our Services
          </h2>

          <p
            style={
              styles.servicesSubtitle
            }
          >
            Explore our professional
            services and pricing.
          </p>
        </div>

        <div
          style={
            styles.servicesMark
          }
        >
          ✨
        </div>
      </div>

      {groups.length > 1 && (
        <div
          style={
            styles.servicesTabs
          }
        >
          {groups.map(
            (
              group,
              index
            ) => (
              <a
                key={`${group.name}-${index}`}
                href={`#service-${slugify(
                  group.name
                )}`}
                style={
                  styles.servicesTab
                }
              >
                {
                  group.name
                }
              </a>
            )
          )}
        </div>
      )}

      <div
        style={
          styles.serviceGroups
        }
      >
        {groups.map(
          (
            group,
            groupIndex
          ) => (
            <section
              key={`${group.name}-${groupIndex}`}
              id={`service-${slugify(
                group.name
              )}`}
              style={
                styles.serviceGroup
              }
            >
              <div
                style={
                  styles.serviceGroupHeading
                }
              >
                <div>
                  <div
                    style={
                      styles.serviceGroupEyebrow
                    }
                  >
                    {String(
                      groupIndex +
                        1
                    ).padStart(
                      2,
                      "0"
                    )}
                  </div>

                  <h3
                    style={
                      styles.serviceGroupTitle
                    }
                  >
                    {
                      group.name
                    }
                  </h3>
                </div>

                <div
                  style={
                    styles.serviceGroupLine
                  }
                />
              </div>

              <div
                style={
                  styles.servicesList
                }
              >
                {group.services.map(
                  (
                    service
                  ) => (
                    <article
                      key={
                        service.id
                      }
                      style={
                        styles.serviceCard
                      }
                    >
                      <div
                        style={
                          styles.serviceIcon
                        }
                      >
                        ✨
                      </div>

                      <div
                        style={
                          styles.serviceContent
                        }
                      >
                        <div
                          style={
                            styles.serviceNameRow
                          }
                        >
                          <div
                            style={
                              styles.serviceName
                            }
                          >
                            {
                              service.name
                            }
                          </div>

                          {service.popular && (
                            <span
                              style={
                                styles.servicePopular
                              }
                            >
                              ★ Popular
                            </span>
                          )}
                        </div>

                        {service.description && (
                          <div
                            style={
                              styles.serviceDescription
                            }
                          >
                            {
                              service.description
                            }
                          </div>
                        )}

                        <div
                          style={
                            styles.serviceBottomRow
                          }
                        >
                          <div
                            style={
                              styles.serviceDuration
                            }
                          >
                            {service.duration
                              ? `◷ ${service.duration}`
                              : "Professional service"}
                          </div>

                          {service.price && (
                            <div
                              style={
                                styles.servicePriceBlock
                              }
                            >
                              <span
                                style={
                                  styles.servicePriceLabel
                                }
                              >
                                {service.priceType ===
                                "starting_from"
                                  ? "Starting from"
                                  : ""}
                              </span>

                              <strong
                                style={
                                  styles.servicePrice
                                }
                              >
                                ₹
                                {
                                  service.price
                                }
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                )}
              </div>
            </section>
          )
        )}
      </div>
    </section>
  );
}

function slugify(
  value: string
) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      ) ||
    "services"
  );
}

/* =========================================================
   OFFERS
   ========================================================= */

function OffersSection({
  offers,
}: {
  offers: OfferItem[];
}) {
  return (
    <section
      id="offers"
      style={
        styles.offersSection
      }
    >
      <div
        style={
          styles.offersHeader
        }
      >
        <div>
          <div
            style={
              styles.offersEyebrow
            }
          >
            SPECIAL FOR YOU
          </div>

          <h2
            style={
              styles.offersTitle
            }
          >
            Offers & Promotions
          </h2>

          <p
            style={
              styles.offersSubtitle
            }
          >
            Enjoy our latest deals
            and special offers.
          </p>
        </div>

        <div
          style={
            styles.offersBadge
          }
        >
          {offers.length}{" "}
          {offers.length === 1
            ? "offer"
            : "offers"}
        </div>
      </div>

      <div
        style={
          styles.offersList
        }
      >
        {offers.map(
          (offer) => (
            <article
              key={
                offer.id
              }
              style={
                styles.offerCard
              }
            >
              <div
                style={
                  styles.offerAccent
                }
              >
                ★
              </div>

              <div
                style={
                  styles.offerContent
                }
              >
                <h3
                  style={
                    styles.offerName
                  }
                >
                  {offer.name}
                </h3>

                {offer.description && (
                  <p
                    style={
                      styles.offerDescription
                    }
                  >
                    {
                      offer.description
                    }
                  </p>
                )}

                <div
                  style={
                    styles.offerLabel
                  }
                >
                  LIMITED OFFER
                </div>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}

/* =========================================================
   CORE ACTION CARD
   ========================================================= */

function ActionCard({
  icon,
  title,
  subtitle,
  href,
}: {
  icon: string;
  title: string;
  subtitle: string;
  href?: string | null;
}) {
  const [isPressed, setIsPressed] = useState(false);

  const content = (
    <>
      <div style={styles.actionIcon}>{icon}</div>
      <div style={styles.actionTitle}>{title}</div>
      <div style={styles.actionSubtitle}>{subtitle}</div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        onTouchCancel={() => setIsPressed(false)}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        style={{
          ...styles.actionCard,
          transform: isPressed ? "scale(0.97)" : "scale(1.0)",
          transition:
            "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 150ms ease",
        }}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      style={{
        ...styles.actionCard,
        ...styles.actionCardDisabled,
      }}
      aria-disabled="true"
    >
      {content}
    </div>
  );
}

function ModuleActionCard({
  icon,
  title,
  subtitle,
  onClick,
  accentColor,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  accentColor?: string;
}) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onTouchCancel={() => setIsPressed(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      style={{
        ...styles.actionButton,
        transform: isPressed ? "scale(0.97)" : "scale(1.0)",
        transition:
          "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 150ms ease",
        ...(accentColor
          ? {
              borderColor: `${accentColor}33`,
            }
          : {}),
      }}
      aria-label={`${title}: ${subtitle}`}
    >
      <div
        style={{
          ...styles.actionIcon,
          ...(accentColor
            ? {
                color: accentColor,
                background: `${accentColor}14`,
              }
            : {}),
        }}
      >
        {icon}
      </div>

      <div style={styles.actionTitle}>{title}</div>
      <div style={styles.actionSubtitle}>{subtitle}</div>
    </button>
  );
}

function getInitials(
  name: string
) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (word) => word[0]
    )
    .join("")
    .toUpperCase();
}

/* =========================================================
   ROOM SERVICE SECTION
   ========================================================= */

function RoomServiceSection({
  businessId,
  businessName,
  deviceCode,
  location,
  categories,
  items,
}: {
  businessId: string;
  businessName: string;
  deviceCode: string;
  location: string | null;
  categories: RoomServiceCategory[];
  items: RoomServiceItem[];
}) {
  type ActiveOrder = {
    id: string;
    table_number: number;
    customer_name: string;
    customer_phone: string | null;
    status: string;
    subtotal: number;
    total: number;
    created_at: string;
  };

  type ActiveOrderItem = {
    id: string;
    item_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  };

  const storageKey = `tapx_active_room_order_${businessId}_${deviceCode}`;

  const [roomNumber, setRoomNumber] = useState(
    location ? location.replace(/\D/g, "") || "101" : "101"
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [currentOrder, setCurrentOrder] = useState<ActiveOrder | null>(null);
  const [currentOrderItems, setCurrentOrderItems] = useState<ActiveOrderItem[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const availableItems = items.filter((item) => item.available !== false);

  const activeStatuses = [
    "pending",
    "accepted",
    "preparing",
    "ready",
    "served",
  ];

  const isActiveOrder = (status?: string | null) =>
    Boolean(status && activeStatuses.includes(status));

  async function loadCurrentRoomOrder(orderIdOverride?: string) {
    setLoadingOrder(true);
    try {
      const savedOrderId =
        orderIdOverride ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem(storageKey)
          : null);

      if (!savedOrderId) {
        setCurrentOrder(null);
        setCurrentOrderItems([]);
        return;
      }

      const { data: order, error: orderError } = await supabase
        .from("tapx_orders")
        .select(
          "id, table_number, customer_name, customer_phone, status, subtotal, total, created_at"
        )
        .eq("id", savedOrderId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (orderError || !order) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(storageKey);
        }
        setCurrentOrder(null);
        setCurrentOrderItems([]);
        return;
      }

      const typedOrder = order as ActiveOrder;
      setCurrentOrder(typedOrder);
      if (typedOrder.table_number) {
        setRoomNumber(String(typedOrder.table_number));
      }
      setCustomerName(typedOrder.customer_name || "");
      setCustomerPhone(typedOrder.customer_phone || "");

      if (!isActiveOrder(typedOrder.status)) {
        setCurrentOrderItems([]);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(storageKey);
        }
        return;
      }

      const { data: orderItems, error: itemsError } = await supabase
        .from("tapx_order_items")
        .select("id, item_name, unit_price, quantity, line_total")
        .eq("order_id", typedOrder.id)
        .order("created_at", { ascending: true });

      if (!itemsError) {
        setCurrentOrderItems((orderItems || []) as ActiveOrderItem[]);
      }
    } catch (err) {
      console.error("TAPX room order restore error:", err);
    } finally {
      setLoadingOrder(false);
    }
  }

  useEffect(() => {
    void loadCurrentRoomOrder();
    const timer = window.setInterval(() => {
      void loadCurrentRoomOrder();
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const cartList = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = items.find((i) => i.id === id);
        const price = Number(item?.price || 0);
        return {
          id,
          item,
          quantity: qty,
          unitPrice: price,
          lineTotal: price * qty,
        };
      })
      .filter((i) => Boolean(i.item));
  }, [cart, items]);

  const cartTotal = cartList.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartQuantity = cartList.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(id: string) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }

  function removeFromCart(id: string) {
    setCart((prev) => {
      const next = { ...prev };
      if (next[id] > 1) {
        next[id] -= 1;
      } else {
        delete next[id];
      }
      return next;
    });
  }

  async function placeRoomOrder() {
    setError("");
    if (!roomNumber.trim()) {
      setError("Please enter your room number.");
      return;
    }
    if (!customerName.trim()) {
      setError("Please enter guest name.");
      return;
    }
    if (!cartList.length) {
      setError("Please select at least one item or request.");
      return;
    }

    setPlacing(true);
    try {
      const cleanPhone = customerPhone.replace(/\D/g, "");
      const numericRoom = parseInt(roomNumber.replace(/\D/g, ""), 10) || 101;

      const { data, error: rpcError } = await supabase.rpc(
        "create_tapx_table_order",
        {
          p_business_id: businessId,
          p_table_number: numericRoom,
          p_customer_name: `${customerName.trim()} (Room ${roomNumber})`,
          p_customer_phone: cleanPhone || null,
          p_source_device_code: deviceCode,
          p_items: cartList.map((item) => ({
            item_id: item.id,
            quantity: item.quantity,
          })),
        }
      );

      if (rpcError) throw rpcError;

      const newOrderId = String(data || "");
      if (!newOrderId) throw new Error("Order ID was not generated.");

      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, newOrderId);
      }

      setCart({});
      await loadCurrentRoomOrder(newOrderId);
      setShowOrderModal(true);
    } catch (err) {
      console.error("Room service order error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send room service request."
      );
    } finally {
      setPlacing(false);
    }
  }

  const filteredItems = availableItems.filter((item) => {
    if (selectedCategory === "all") return true;
    return item.categoryId === selectedCategory || item.category === selectedCategory;
  });

  return (
    <div style={styles.roomServiceContainer}>
      <header style={styles.roomHeader}>
        <div>
          <span style={styles.roomBadge}>IN-ROOM DINING & SERVICES</span>
          <h2 style={styles.roomTitle}>Room Service</h2>
          <p style={styles.roomSubtitle}>
            Food, drinks, extra towels, water & room essentials delivered to your door.
          </p>
        </div>
      </header>

      {/* ACTIVE ORDER BANNER */}
      {currentOrder && isActiveOrder(currentOrder.status) && (
        <div style={styles.roomActiveBanner}>
          <div>
            <div style={styles.roomActiveTag}>LIVE ROOM REQUEST</div>
            <div style={styles.roomActiveTitle}>
              Room {currentOrder.table_number} · Status: <strong>{currentOrder.status.toUpperCase()}</strong>
            </div>
            <div style={styles.roomActiveSub}>
              {currentOrderItems.map((i) => `${i.quantity}x ${i.item_name}`).join(", ")}
            </div>
          </div>
          <button
            type="button"
            style={styles.roomTrackButton}
            onClick={() => setShowOrderModal(true)}
          >
            Track Status
          </button>
        </div>
      )}

      {/* CATEGORY TABS */}
      {categories.length > 0 && (
        <div style={styles.roomCategoryBar}>
          <button
            type="button"
            style={{
              ...styles.roomCategoryChip,
              ...(selectedCategory === "all" ? styles.roomCategoryChipActive : {}),
            }}
            onClick={() => setSelectedCategory("all")}
          >
            All Items ({availableItems.length})
          </button>
          {categories.map((cat) => {
            const count = availableItems.filter(
              (i) => i.categoryId === cat.id || i.category === cat.name
            ).length;
            return (
              <button
                key={cat.id}
                type="button"
                style={{
                  ...styles.roomCategoryChip,
                  ...(selectedCategory === cat.id ? styles.roomCategoryChipActive : {}),
                }}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* ITEMS LIST */}
      <div style={styles.roomItemsGrid}>
        {filteredItems.length === 0 ? (
          <div style={styles.roomEmptyState}>No items available in this category.</div>
        ) : (
          filteredItems.map((item) => {
            const qty = cart[item.id] || 0;
            return (
              <div key={item.id} style={styles.roomItemCard}>
                <div style={styles.roomItemMain}>
                  <div style={styles.roomItemName}>{item.name}</div>
                  {item.description && (
                    <div style={styles.roomItemDesc}>{item.description}</div>
                  )}
                  <div style={styles.roomItemMeta}>
                    {item.price && (
                      <span style={styles.roomItemPrice}>
                        {item.priceType === "starting_from" ? "From " : ""}₹{item.price}
                      </span>
                    )}
                    {item.deliveryTime && (
                      <span style={styles.roomItemTime}>⏱ {item.deliveryTime}</span>
                    )}
                  </div>
                </div>

                <div style={styles.roomItemQtyControls}>
                  {qty > 0 ? (
                    <div style={styles.roomQtyGroup}>
                      <button
                        type="button"
                        style={styles.roomQtyBtn}
                        onClick={() => removeFromCart(item.id)}
                      >
                        -
                      </button>
                      <span style={styles.roomQtyVal}>{qty}</span>
                      <button
                        type="button"
                        style={styles.roomQtyBtn}
                        onClick={() => addToCart(item.id)}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      style={styles.roomAddBtn}
                      onClick={() => addToCart(item.id)}
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CHECKOUT BOTTOM BAR */}
      {cartQuantity > 0 && (
        <div style={styles.roomCheckoutBar}>
          <div style={styles.roomCheckoutSummary}>
            <div style={styles.roomCheckoutQty}>{cartQuantity} item{cartQuantity > 1 ? "s" : ""} selected</div>
            <div style={styles.roomCheckoutTotal}>₹{cartTotal}</div>
          </div>

          <button
            type="button"
            style={styles.roomSendBtn}
            onClick={() => setShowOrderModal(true)}
          >
            Review Room Request →
          </button>
        </div>
      )}

      {/* REQUEST FORM MODAL */}
      {showOrderModal && (
        <div style={styles.roomModalOverlay}>
          <div style={styles.roomModalContent}>
            <button
              type="button"
              style={styles.roomModalClose}
              onClick={() => setShowOrderModal(false)}
            >
              ✕
            </button>
            <h3 style={styles.roomModalTitle}>Confirm Room Service Request</h3>
            <p style={styles.roomModalSub}>Enter your room details to send request directly to hotel staff.</p>

            {error && <div style={styles.roomErrorBox}>{error}</div>}

            <div style={styles.roomFormGroup}>
              <label style={styles.roomFormLabel}>Room Number / Suite *</label>
              <input
                type="text"
                placeholder="e.g. 302"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                style={styles.roomInput}
              />
            </div>

            <div style={styles.roomFormGroup}>
              <label style={styles.roomFormLabel}>Guest Name *</label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={styles.roomInput}
              />
            </div>

            <div style={styles.roomFormGroup}>
              <label style={styles.roomFormLabel}>Mobile Number (Optional)</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={styles.roomInput}
              />
            </div>

            {/* ORDER ITEMS REVIEW */}
            <div style={styles.roomReviewSection}>
              <div style={styles.roomReviewHeading}>Request Summary</div>
              {cartList.map((c) => (
                <div key={c.id} style={styles.roomReviewRow}>
                  <span>{c.quantity}x {c.item?.name}</span>
                  <strong>{c.lineTotal ? `₹${c.lineTotal}` : "Included"}</strong>
                </div>
              ))}
              {cartTotal > 0 && (
                <div style={styles.roomReviewTotalRow}>
                  <span>Total Amount</span>
                  <strong>₹{cartTotal}</strong>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={placing}
              style={{
                ...styles.roomSubmitBtn,
                opacity: placing ? 0.6 : 1,
              }}
              onClick={() => void placeRoomOrder()}
            >
              {placing ? "Sending Request..." : "Send Request to Staff"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   HOTEL SERVICES SECTION
   ========================================================= */

function HotelServicesSection({
  businessId,
  businessName,
  deviceCode,
  location,
  whatsappLink,
  phone,
  categories,
  services,
}: {
  businessId: string;
  businessName: string;
  deviceCode: string;
  location: string | null;
  whatsappLink: string | null;
  phone: string | null;
  categories: HotelServiceCategory[];
  services: HotelServiceItem[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [requestModalService, setRequestModalService] = useState<HotelServiceItem | null>(null);
  const [roomNumber, setRoomNumber] = useState(location ? location.replace(/\D/g, "") || "101" : "101");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const availableServices = services.filter((s) => s.available !== false);

  const filteredServices = availableServices.filter((s) => {
    if (selectedCategory === "all") return true;
    return s.categoryId === selectedCategory || s.category === selectedCategory;
  });

  async function submitServiceRequest() {
    if (!requestModalService) return;
    setError("");
    if (!roomNumber.trim()) {
      setError("Please enter your room number.");
      return;
    }
    if (!guestName.trim()) {
      setError("Please enter your name.");
      return;
    }

    setSubmitting(true);
    try {
      const cleanPhone = guestPhone.replace(/\D/g, "");
      const numericRoom = parseInt(roomNumber.replace(/\D/g, ""), 10) || 101;

      const { error: rpcError } = await supabase.rpc("create_tapx_table_order", {
        p_business_id: businessId,
        p_table_number: numericRoom,
        p_customer_name: `${guestName.trim()} (Room ${roomNumber}) - ${requestModalService.name}`,
        p_customer_phone: cleanPhone || null,
        p_source_device_code: deviceCode,
        p_items: [
          {
            item_id: requestModalService.id,
            quantity: 1,
          },
        ],
      });

      if (rpcError) throw rpcError;

      setSuccessMessage(`Your request for "${requestModalService.name}" has been sent to hotel staff!`);
      setRequestModalService(null);
      setNotes("");
    } catch (err) {
      console.error("Hotel service request error:", err);
      setError(err instanceof Error ? err.message : "Unable to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.hotelServicesContainer}>
      <header style={styles.hotelHeader}>
        <div>
          <span style={styles.hotelBadge}>HOTEL AMENITIES & FACILITIES</span>
          <h2 style={styles.hotelTitle}>Hotel Services</h2>
          <p style={styles.hotelSubtitle}>
            Explore facilities, spa, fitness, housekeeping, transport and front desk assistance.
          </p>
        </div>
      </header>

      {successMessage && (
        <div style={styles.hotelSuccessAlert}>
          <span>✓</span> {successMessage}
        </div>
      )}

      {/* CATEGORIES TABS */}
      {categories.length > 0 && (
        <div style={styles.hotelCatBar}>
          <button
            type="button"
            style={{
              ...styles.hotelCatChip,
              ...(selectedCategory === "all" ? styles.hotelCatChipActive : {}),
            }}
            onClick={() => setSelectedCategory("all")}
          >
            All Facilities ({availableServices.length})
          </button>
          {categories.map((cat) => {
            const count = availableServices.filter(
              (s) => s.categoryId === cat.id || s.category === cat.name
            ).length;
            return (
              <button
                key={cat.id}
                type="button"
                style={{
                  ...styles.hotelCatChip,
                  ...(selectedCategory === cat.id ? styles.hotelCatChipActive : {}),
                }}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* SERVICES CARDS GRID */}
      <div style={styles.hotelGrid}>
        {filteredServices.length === 0 ? (
          <div style={styles.hotelEmpty}>No services found in this section.</div>
        ) : (
          filteredServices.map((service) => (
            <div key={service.id} style={styles.hotelCard}>
              <div style={styles.hotelCardHead}>
                <h3 style={styles.hotelCardTitle}>{service.name}</h3>
                {service.action === "request" && (
                  <span style={styles.hotelActionBadge}>Request Enabled</span>
                )}
                {service.action === "contact" && (
                  <span style={styles.hotelContactBadge}>Direct Contact</span>
                )}
              </div>

              {service.description && (
                <p style={styles.hotelCardDesc}>{service.description}</p>
              )}

              {service.availability && (
                <div style={styles.hotelCardMeta}>
                  <span>🕒 Hours:</span> <strong>{service.availability}</strong>
                </div>
              )}

              <div style={styles.hotelCardFooter}>
                {service.action === "request" ? (
                  <button
                    type="button"
                    style={styles.hotelPrimaryAction}
                    onClick={() => {
                      setSuccessMessage("");
                      setRequestModalService(service);
                    }}
                  >
                    Request Service
                  </button>
                ) : service.action === "contact" ? (
                  whatsappLink ? (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.hotelSecondaryAction}
                    >
                      💬 WhatsApp Staff
                    </a>
                  ) : phone ? (
                    <a href={`tel:${phone}`} style={styles.hotelSecondaryAction}>
                      📞 Call Front Desk
                    </a>
                  ) : (
                    <span style={styles.hotelInfoBadge}>Available at Desk</span>
                  )
                ) : (
                  <span style={styles.hotelInfoBadge}>Facility Information</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* SERVICE REQUEST MODAL */}
      {requestModalService && (
        <div style={styles.hotelModalOverlay}>
          <div style={styles.hotelModalContent}>
            <button
              type="button"
              style={styles.hotelModalClose}
              onClick={() => setRequestModalService(null)}
            >
              ✕
            </button>
            <h3 style={styles.hotelModalTitle}>Request {requestModalService.name}</h3>
            <p style={styles.hotelModalSub}>Staff will receive your room request immediately.</p>

            {error && <div style={styles.hotelErrorBox}>{error}</div>}

            <div style={styles.hotelFormGroup}>
              <label style={styles.hotelFormLabel}>Room Number / Suite *</label>
              <input
                type="text"
                placeholder="e.g. 204"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                style={styles.hotelInput}
              />
            </div>

            <div style={styles.hotelFormGroup}>
              <label style={styles.hotelFormLabel}>Guest Name *</label>
              <input
                type="text"
                placeholder="e.g. Priya Patel"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                style={styles.hotelInput}
              />
            </div>

            <div style={styles.hotelFormGroup}>
              <label style={styles.hotelFormLabel}>Mobile Number (Optional)</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                style={styles.hotelInput}
              />
            </div>

            <div style={styles.hotelFormGroup}>
              <label style={styles.hotelFormLabel}>Notes / Request details</label>
              <textarea
                placeholder="e.g. Please bring at 4:00 PM"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={styles.hotelTextarea}
              />
            </div>

            <button
              type="button"
              disabled={submitting}
              style={{
                ...styles.hotelSubmitBtn,
                opacity: submitting ? 0.6 : 1,
              }}
              onClick={() => void submitServiceRequest()}
            >
              {submitting ? "Sending..." : "Submit Request"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const styles: Record<
  string,
  CSSProperties
> = {
  /* ROOM SERVICE STYLES */
  roomServiceContainer: { padding: "18px" },
  roomHeader: { marginBottom: "16px" },
  roomBadge: {
    display: "inline-block",
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: "1px",
    color: "#2563eb",
    background: "#eff6ff",
    padding: "3px 8px",
    borderRadius: "6px",
    marginBottom: "6px",
  },
  roomTitle: { fontSize: "22px", fontWeight: 850, color: "#111827", margin: 0 },
  roomSubtitle: { fontSize: "12px", color: "#6b7280", margin: "4px 0 0" },
  roomActiveBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    padding: "12px 14px",
    borderRadius: "12px",
    marginBottom: "16px",
  },
  roomActiveTag: { fontSize: "9px", fontWeight: 800, color: "#166534", letterSpacing: "0.5px" },
  roomActiveTitle: { fontSize: "12px", color: "#14532d", margin: "2px 0" },
  roomActiveSub: { fontSize: "11px", color: "#15803d" },
  roomTrackButton: {
    background: "#166534",
    color: "#ffffff",
    border: "none",
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
  },
  roomCategoryBar: { display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "16px" },
  roomCategoryChip: {
    whiteSpace: "nowrap",
    padding: "7px 13px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 650,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#4b5563",
    cursor: "pointer",
  },
  roomCategoryChipActive: { background: "#111827", color: "#ffffff", borderColor: "#111827" },
  roomItemsGrid: { display: "flex", flexDirection: "column", gap: "10px" },
  roomEmptyState: { padding: "30px", textAlign: "center", color: "#9ca3af", fontSize: "13px" },
  roomItemCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px",
    background: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #f3f4f6",
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  },
  roomItemMain: { flex: 1, paddingRight: "12px" },
  roomItemName: { fontSize: "14px", fontWeight: 700, color: "#111827" },
  roomItemDesc: { fontSize: "11px", color: "#6b7280", marginTop: "3px" },
  roomItemMeta: { display: "flex", gap: "10px", marginTop: "6px", fontSize: "12px" },
  roomItemPrice: { fontWeight: 800, color: "#059669" },
  roomItemTime: { color: "#6b7280", fontSize: "11px" },
  roomItemQtyControls: { flexShrink: 0 },
  roomAddBtn: {
    background: "#f3f4f6",
    color: "#111827",
    border: "none",
    padding: "8px 14px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  roomQtyGroup: { display: "flex", alignItems: "center", gap: "8px", background: "#f3f4f6", borderRadius: "8px", padding: "3px 6px" },
  roomQtyBtn: { border: "none", background: "none", fontSize: "14px", fontWeight: 800, color: "#111827", width: "24px", height: "24px", cursor: "pointer" },
  roomQtyVal: { fontSize: "12px", fontWeight: 800, color: "#111827" },
  roomCheckoutBar: {
    position: "fixed",
    bottom: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "calc(100% - 32px)",
    maxWidth: "520px",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "12px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
    zIndex: 90,
  },
  roomCheckoutSummary: { display: "flex", flexDirection: "column" },
  roomCheckoutQty: { fontSize: "10px", color: "#9ca3af" },
  roomCheckoutTotal: { fontSize: "16px", fontWeight: 850 },
  roomSendBtn: { background: "#2563eb", color: "#ffffff", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 800, cursor: "pointer" },
  roomModalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
  roomModalContent: { width: "100%", maxWidth: "540px", background: "#ffffff", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", padding: "24px", maxHeight: "85vh", overflowY: "auto", position: "relative" },
  roomModalClose: { position: "absolute", top: "18px", right: "18px", border: "none", background: "#f3f4f6", borderRadius: "50%", width: "30px", height: "30px", fontSize: "14px", cursor: "pointer" },
  roomModalTitle: { fontSize: "18px", fontWeight: 800, color: "#111827", margin: 0 },
  roomModalSub: { fontSize: "12px", color: "#6b7280", margin: "4px 0 16px" },
  roomErrorBox: { background: "#fef2f2", color: "#991b1b", padding: "10px", borderRadius: "8px", fontSize: "12px", marginBottom: "14px" },
  roomFormGroup: { marginBottom: "14px" },
  roomFormLabel: { display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" },
  roomInput: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "13px", outline: "none" },
  roomReviewSection: { background: "#f9fafb", borderRadius: "10px", padding: "12px", margin: "16px 0" },
  roomReviewHeading: { fontSize: "11px", fontWeight: 800, color: "#4b5563", textTransform: "uppercase", marginBottom: "8px" },
  roomReviewRow: { display: "flex", justifyContent: "space-between", fontSize: "12px", margin: "4px 0" },
  roomReviewTotalRow: { display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 800, borderTop: "1px solid #e5e7eb", paddingTop: "8px", marginTop: "8px" },
  roomSubmitBtn: { width: "100%", padding: "14px", background: "#111827", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 800, cursor: "pointer" },

  /* HOTEL SERVICES STYLES */
  hotelServicesContainer: { padding: "18px" },
  hotelHeader: { marginBottom: "16px" },
  hotelBadge: { display: "inline-block", fontSize: "9px", fontWeight: 900, letterSpacing: "1px", color: "#7c3aed", background: "#f5f3ff", padding: "3px 8px", borderRadius: "6px", marginBottom: "6px" },
  hotelTitle: { fontSize: "22px", fontWeight: 850, color: "#111827", margin: 0 },
  hotelSubtitle: { fontSize: "12px", color: "#6b7280", margin: "4px 0 0" },
  hotelSuccessAlert: { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "12px", borderRadius: "10px", fontSize: "12px", fontWeight: 700, marginBottom: "16px" },
  hotelCatBar: { display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "16px" },
  hotelCatChip: { whiteSpace: "nowrap", padding: "7px 13px", borderRadius: "20px", fontSize: "11px", fontWeight: 650, border: "1px solid #e5e7eb", background: "#ffffff", color: "#4b5563", cursor: "pointer" },
  hotelCatChipActive: { background: "#111827", color: "#ffffff", borderColor: "#111827" },
  hotelGrid: { display: "flex", flexDirection: "column", gap: "12px" },
  hotelEmpty: { padding: "30px", textAlign: "center", color: "#9ca3af", fontSize: "13px" },
  hotelCard: { background: "#ffffff", borderRadius: "14px", border: "1px solid #f3f4f6", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" },
  hotelCardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  hotelCardTitle: { fontSize: "15px", fontWeight: 800, color: "#111827", margin: 0 },
  hotelActionBadge: { fontSize: "9px", fontWeight: 800, color: "#2563eb", background: "#eff6ff", padding: "3px 7px", borderRadius: "6px" },
  hotelContactBadge: { fontSize: "9px", fontWeight: 800, color: "#059669", background: "#ecfdf5", padding: "3px 7px", borderRadius: "6px" },
  hotelCardDesc: { fontSize: "12px", color: "#6b7280", margin: "6px 0" },
  hotelCardMeta: { fontSize: "11px", color: "#4b5563", marginTop: "6px" },
  hotelCardFooter: { marginTop: "14px", borderTop: "1px solid #f9fafb", paddingTop: "12px", display: "flex", justifyContent: "flex-end" },
  hotelPrimaryAction: { background: "#111827", color: "#ffffff", border: "none", padding: "9px 16px", borderRadius: "9px", fontSize: "12px", fontWeight: 700, cursor: "pointer" },
  hotelSecondaryAction: { display: "inline-block", background: "#ecfdf5", color: "#065f46", textDecoration: "none", padding: "9px 16px", borderRadius: "9px", fontSize: "12px", fontWeight: 700 },
  hotelInfoBadge: { fontSize: "11px", color: "#9ca3af" },
  hotelModalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
  hotelModalContent: { width: "100%", maxWidth: "540px", background: "#ffffff", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", padding: "24px", maxHeight: "85vh", overflowY: "auto", position: "relative" },
  hotelModalClose: { position: "absolute", top: "18px", right: "18px", border: "none", background: "#f3f4f6", borderRadius: "50%", width: "30px", height: "30px", fontSize: "14px", cursor: "pointer" },
  hotelModalTitle: { fontSize: "18px", fontWeight: 800, color: "#111827", margin: 0 },
  hotelModalSub: { fontSize: "12px", color: "#6b7280", margin: "4px 0 16px" },
  hotelErrorBox: { background: "#fef2f2", color: "#991b1b", padding: "10px", borderRadius: "8px", fontSize: "12px", marginBottom: "14px" },
  hotelFormGroup: { marginBottom: "14px" },
  hotelFormLabel: { display: "block", fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "4px" },
  hotelInput: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "13px", outline: "none" },
  hotelTextarea: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "13px", minHeight: "60px", outline: "none" },
  hotelSubmitBtn: { width: "100%", padding: "14px", background: "#111827", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 800, cursor: "pointer" },
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f7f7f5 0%, #ffffff 45%, #f8f8f6 100%)",
    color: "#111111",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },

  mobileContainer: {
    width: "100%",
    maxWidth: "560px",
    margin: "0 auto",
    paddingBottom: "24px",
  },

  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px",
    textAlign: "center",
  },

  loadingLogo: {
    fontSize: "32px",
    fontWeight: 900,
    letterSpacing: "-1px",
    color: "#111111",
    marginBottom: "24px",
  },

  spinner: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    border:
      "3px solid #e5e7eb",
    borderTop:
      "3px solid #111111",
    animation:
      "tapxSpin 0.9s linear infinite",
  },

  loadingText: {
    margin: "22px 0 4px",
    fontSize: "15px",
    fontWeight: 700,
    color: "#222222",
  },

  loadingSubText: {
    margin: 0,
    fontSize: "12px",
    color: "#888888",
  },

  errorContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px 20px",
    textAlign: "center",
  },

  errorIcon: {
    width: "54px",
    height: "54px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fee2e2",
    color: "#dc2626",
    fontSize: "25px",
    fontWeight: 800,
    marginBottom: "18px",
  },

  errorTitle: {
    margin: 0,
    fontSize: "23px",
    fontWeight: 800,
  },

  errorText: {
    maxWidth: "390px",
    margin: "10px 0 20px",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#666666",
  },

  retryButton: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 20px",
    background: "#111111",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "18px 18px 14px",
    background:
      "rgba(255,255,255,0.92)",
    borderBottom:
      "1px solid #eeeeee",
    position: "sticky",
    top: 0,
    zIndex: 20,
    backdropFilter:
      "blur(14px)",
  },

  businessIdentity: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    minWidth: 0,
  },

  businessLogo: {
    width: "44px",
    height: "44px",
    borderRadius: "13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#111111",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 900,
    overflow: "hidden",
    flexShrink: 0,
  },

  businessLogoImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  businessName: {
    fontSize: "15px",
    lineHeight: 1.2,
    fontWeight: 800,
    color: "#151515",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "250px",
  },

  businessCategory: {
    marginTop: "4px",
    fontSize: "11px",
    color: "#777777",
  },

  tapxBrand: {
    flexShrink: 0,
    fontSize: "13px",
    fontWeight: 900,
    letterSpacing: "1.5px",
    color: "#111111",
  },

  hero: {
    padding: "34px 20px 25px",
    textAlign: "center",
  },

  heroTitle: {
    margin: 0,
    fontSize: "29px",
    lineHeight: 1.13,
    fontWeight: 850,
    letterSpacing: "-0.8px",
    color: "#151515",
  },

  heroDescription: {
    maxWidth: "430px",
    margin: "10px auto 0",
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#737373",
  },

  locationBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "15px",
    padding: "7px 11px",
    borderRadius: "999px",
    background: "#f2f2ef",
    border:
      "1px solid #e6e6e2",
    color: "#5e5e5a",
    fontSize: "11px",
    fontWeight: 650,
  },

  sectionTitle: {
    margin: "0 18px 13px",
    fontSize: "18px",
    lineHeight: 1.2,
    fontWeight: 800,
    color: "#181818",
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    padding:
      "0 18px 28px",
  },

  actionCard: {
    minHeight: "135px",
    padding: "18px",
    border:
      "1px solid #e5e7eb",
    borderRadius: "18px",
    background: "#ffffff",
    color: "#111111",
    textDecoration: "none",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    boxShadow:
      "0 2px 8px rgba(0,0,0,0.03)",
    boxSizing: "border-box",
  },

  actionCardDisabled: {
    cursor: "default",
    opacity: 0.78,
  },

  actionButton: {
    minHeight: "135px",
    padding: "18px",
    border:
      "1px solid #e5e7eb",
    borderRadius: "18px",
    background: "#ffffff",
    color: "#111111",
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow:
      "0 2px 8px rgba(0,0,0,0.03)",
    appearance: "none",
    WebkitAppearance:
      "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    boxSizing: "border-box",
    width: "100%",
  },

  actionIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f3f0",
    color: "#111111",
    fontSize: "19px",
    marginBottom: "13px",
  },

  actionTitle: {
    fontSize: "14px",
    lineHeight: 1.25,
    fontWeight: 800,
    color: "#171717",
  },

  actionSubtitle: {
    marginTop: "4px",
    fontSize: "11px",
    lineHeight: 1.35,
    color: "#7a7a7a",
  },

  moduleView: {
    paddingTop: "8px",
    paddingBottom: "8px",
  },

  moduleBackButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    margin: "0 18px 15px",
    padding: "9px 13px",
    border:
      "1px solid #e5e5e2",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#222222",
    fontFamily: "inherit",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow:
      "0 2px 8px rgba(0,0,0,0.03)",
  },

  /* DIGITAL MENU */

  menuSection: {
    margin: "0 18px 30px",
    padding: "22px 16px 18px",
    borderRadius: "25px",
    background:
      "linear-gradient(180deg, #fffdf9 0%, #faf7f0 100%)",
    border:
      "1px solid #eee5d6",
    boxShadow:
      "0 12px 34px rgba(58,45,25,0.06)",
  },

  menuTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    marginBottom: "17px",
  },

  menuEyebrow: {
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: "2.2px",
    color: "#9b7650",
    marginBottom: "5px",
  },

  menuTitle: {
    margin: 0,
    fontSize: "25px",
    lineHeight: 1.1,
    fontWeight: 850,
    color: "#211a14",
  },

  menuSubtitle: {
    margin: "7px 0 0",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#817466",
  },

  menuMark: {
    width: "42px",
    height: "42px",
    flexShrink: 0,
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#211a14",
    color: "#f2d49b",
    fontSize: "20px",
  },

  menuTabs: {
    display: "flex",
    gap: "7px",
    overflowX: "auto",
    paddingBottom: "4px",
    marginBottom: "19px",
  },

  menuTab: {
    flexShrink: 0,
    textDecoration: "none",
    padding: "8px 11px",
    borderRadius: "999px",
    background: "#f0e7d7",
    color: "#674b2e",
    fontSize: "10px",
    fontWeight: 800,
  },

  menuGroups: {
    display: "flex",
    flexDirection: "column",
    gap: "25px",
  },

  menuGroup: {
    scrollMarginTop: "90px",
  },

  menuGroupHeading: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "11px",
  },

  menuCategoryName: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.25,
    fontWeight: 850,
    color: "#211a14",
  },

  menuCategoryDescription: {
    margin: "4px 0 0",
    fontSize: "10px",
    lineHeight: 1.4,
    color: "#8c7d6c",
  },

  menuLine: {
    flex: 1,
    height: "1px",
    background: "#e5d9c8",
  },

  menuCards: {
    display: "flex",
    flexDirection: "column",
    gap: "9px",
  },

  menuCustomerCard: {
    display: "flex",
    overflow: "hidden",
    minHeight: "108px",
    borderRadius: "17px",
    background: "#ffffff",
    border:
      "1px solid #ece3d6",
    boxShadow:
      "0 5px 17px rgba(50,35,10,0.045)",
  },

  menuFoodImage: {
    width: "105px",
    height: "108px",
    objectFit: "cover",
    flexShrink: 0,
  },

  menuFoodPlaceholder: {
    width: "105px",
    height: "108px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg,#efe6d7,#ddd0bc)",
    color: "#7b654d",
    fontSize: "25px",
  },

  menuFoodBody: {
    minWidth: 0,
    flex: 1,
    padding: "12px",
    display: "flex",
    flexDirection: "column",
  },

  menuFoodNameRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "6px",
  },

  menuFoodName: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.25,
    fontWeight: 800,
    color: "#211a14",
  },

  menuPopular: {
    flexShrink: 0,
    padding: "4px 6px",
    borderRadius: "5px",
    background: "#f7edd7",
    color: "#8b652c",
    fontSize: "8px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  menuFoodMeta: {
    display: "flex",
    alignItems: "flex-start",
    gap: "6px",
    marginTop: "6px",
    minHeight: "28px",
  },

  menuDietaryDot: {
    width: "16px",
    height: "16px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border:
      "1px solid currentColor",
    fontSize: "8px",
    fontWeight: 900,
  },

  menuDietaryVeg: {
    color: "#24823d",
    background: "#eff9f0",
  },

  menuDietaryNonVeg: {
    color: "#b13c32",
    background: "#fff2f0",
  },

  menuFoodDescription: {
    margin: 0,
    fontSize: "10px",
    lineHeight: 1.4,
    color: "#81766a",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },

  menuFoodBottom: {
    marginTop: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  menuFoodPrice: {
    fontSize: "13px",
    color: "#2a2119",
  },

  /* SERVICES */

  servicesSection: {
    margin: "0 18px 30px",
    padding: "22px 16px 20px",
    borderRadius: "26px",
    background:
      "linear-gradient(180deg, #fffefb 0%, #f6f5f0 100%)",
    border:
      "1px solid #e7e5df",
    boxShadow:
      "0 14px 36px rgba(35,30,22,0.055)",
  },

  servicesHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "16px",
  },

  servicesEyebrow: {
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: "2.2px",
    color: "#8a8175",
    marginBottom: "6px",
  },

  servicesTitle: {
    margin: 0,
    fontSize: "27px",
    lineHeight: 1.08,
    fontWeight: 900,
    color: "#201b16",
  },

  servicesSubtitle: {
    margin: "7px 0 0",
    fontSize: "11px",
    lineHeight: 1.5,
    color: "#7c756c",
  },

  servicesMark: {
    width: "44px",
    height: "44px",
    flexShrink: 0,
    borderRadius: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0eee8",
    border:
      "1px solid #e4e1d9",
    fontSize: "20px",
  },

  servicesTabs: {
    display: "flex",
    gap: "7px",
    overflowX: "auto",
    paddingBottom: "4px",
    margin: "0 0 19px",
  },

  servicesTab: {
    flexShrink: 0,
    padding: "8px 11px",
    borderRadius: "999px",
    background: "#ffffff",
    border:
      "1px solid #e2dfd7",
    color: "#514a42",
    textDecoration: "none",
    fontSize: "9px",
    fontWeight: 800,
  },

  serviceGroups: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },

  serviceGroup: {
    scrollMarginTop: "94px",
  },

  serviceGroupHeading: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
  },

  serviceGroupEyebrow: {
    fontSize: "8px",
    fontWeight: 900,
    letterSpacing: "1.6px",
    color: "#aaa298",
    marginBottom: "2px",
  },

  serviceGroupTitle: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.15,
    fontWeight: 900,
    color: "#27211b",
  },

  serviceGroupLine: {
    height: "1px",
    flex: 1,
    background: "#dedbd4",
  },

  servicesList: {
    display: "flex",
    flexDirection: "column",
    gap: "9px",
  },

  serviceCard: {
    display: "flex",
    gap: "12px",
    padding: "13px",
    borderRadius: "18px",
    background:
      "rgba(255,255,255,0.92)",
    border:
      "1px solid #e7e4dd",
    boxShadow:
      "0 5px 16px rgba(40,34,26,0.035)",
  },

  serviceIcon: {
    width: "39px",
    height: "39px",
    flexShrink: 0,
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f2f0ea",
    color: "#6d6256",
    fontSize: "16px",
  },

  serviceContent: {
    minWidth: 0,
    flex: 1,
  },

  serviceNameRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },

  serviceName: {
    fontSize: "14px",
    lineHeight: 1.25,
    fontWeight: 850,
    color: "#24201b",
  },

  servicePopular: {
    flexShrink: 0,
    padding: "4px 7px",
    borderRadius: "999px",
    background: "#f3f0e7",
    color: "#746550",
    fontSize: "8px",
    fontWeight: 850,
  },

  serviceDescription: {
    marginTop: "4px",
    fontSize: "10.5px",
    lineHeight: 1.45,
    color: "#81796f",
  },

  serviceBottomRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "10px",
    marginTop: "9px",
  },

  serviceDuration: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    minWidth: 0,
    fontSize: "9.5px",
    color: "#8b837a",
  },

  servicePriceBlock: {
    display: "flex",
    alignItems: "flex-end",
    flexDirection: "column",
    gap: "1px",
    flexShrink: 0,
  },

  servicePriceLabel: {
    minHeight: "9px",
    fontSize: "7px",
    fontWeight: 800,
    color: "#9a9187",
    letterSpacing: "0.3px",
    textTransform: "uppercase",
  },

  servicePrice: {
    fontSize: "15px",
    lineHeight: 1,
    fontWeight: 900,
    color: "#201b16",
  },

  /* LOYALTY */

  loyaltySection: {
    margin: "0 18px 30px",
    padding: "21px 16px 18px",
    borderRadius: "24px",
    background:
      "linear-gradient(180deg, #fbf9ff 0%, #f6f3ff 100%)",
    border:
      "1px solid #e5ddf7",
    boxShadow:
      "0 10px 28px rgba(55,35,100,0.06)",
  },

  loyaltyHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "17px",
  },

  loyaltyEyebrow: {
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: "2px",
    color: "#7660a0",
    marginBottom: "5px",
  },

  loyaltyTitle: {
    margin: 0,
    fontSize: "24px",
    lineHeight: 1.15,
    fontWeight: 850,
    color: "#21182f",
  },

  loyaltySubtitle: {
    margin: "6px 0 0",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#766d80",
  },

  loyaltyMark: {
    width: "42px",
    height: "42px",
    flexShrink: 0,
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#21182f",
    color: "#eadfff",
    fontSize: "20px",
  },

  loyaltyFormCard: {
    padding: "16px",
    borderRadius: "18px",
    background: "#ffffff",
    border:
      "1px solid #ebe6f3",
    boxShadow:
      "0 5px 18px rgba(55,35,100,0.04)",
  },

  loyaltyFormTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 850,
    color: "#251c31",
  },

  loyaltyFormText: {
    margin: "5px 0 16px",
    fontSize: "11px",
    lineHeight: 1.5,
    color: "#7d7485",
  },

  loyaltyLabel: {
    display: "block",
    margin: "12px 0 6px",
    fontSize: "10px",
    fontWeight: 800,
    color: "#4d4555",
  },

  loyaltyInput: {
    width: "100%",
    boxSizing: "border-box",
    border:
      "1px solid #ddd7e8",
    borderRadius: "12px",
    padding: "12px 13px",
    background: "#ffffff",
    color: "#21182f",
    fontFamily: "inherit",
    fontSize: "13px",
    outline: "none",
  },

  loyaltyError: {
    marginTop: "10px",
    padding: "10px 11px",
    borderRadius: "10px",
    background: "#fff1f1",
    border:
      "1px solid #f4d0d0",
    color: "#b42318",
    fontSize: "11px",
  },

  loyaltyPrimaryButton: {
    width: "100%",
    marginTop: "14px",
    border: "none",
    borderRadius: "12px",
    padding: "12px 14px",
    background: "#21182f",
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },

  loyaltyRewardPreview: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    marginTop: "16px",
    padding: "12px",
    borderRadius: "14px",
    background: "#f8f5ff",
    border:
      "1px solid #e9e0fb",
  },

  loyaltyRewardIcon: {
    width: "34px",
    height: "34px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    background: "#ece3ff",
    fontSize: "17px",
  },

  loyaltyRewardLabel: {
    fontSize: "8px",
    fontWeight: 900,
    letterSpacing: "1.3px",
    color: "#826da4",
  },

  loyaltyRewardText: {
    marginTop: "3px",
    fontSize: "12px",
    lineHeight: 1.4,
    fontWeight: 800,
    color: "#2b2137",
  },

  loyaltyRequirement: {
    marginTop: "4px",
    fontSize: "9.5px",
    color: "#83798e",
  },

  loyaltyProgressCard: {
    padding: "16px",
    borderRadius: "18px",
    background: "#ffffff",
    border:
      "1px solid #ebe6f3",
  },

  loyaltyWelcomeRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "19px",
  },

  loyaltySmallLabel: {
    fontSize: "8px",
    fontWeight: 900,
    letterSpacing: "1.4px",
    color: "#8b8192",
  },

  loyaltyMemberName: {
    marginTop: "3px",
    fontSize: "17px",
    fontWeight: 850,
    color: "#251c31",
  },

  loyaltyChangeButton: {
    border:
      "1px solid #ded7e8",
    borderRadius: "999px",
    padding: "7px 10px",
    background: "#ffffff",
    color: "#62586b",
    fontFamily: "inherit",
    fontSize: "9px",
    fontWeight: 800,
    cursor: "pointer",
  },

  loyaltyProgressHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "10px",
  },

  loyaltyProgressLabel: {
    fontSize: "10px",
    fontWeight: 750,
    color: "#77707d",
  },

  loyaltyProgressCount: {
    marginTop: "4px",
    fontSize: "18px",
    fontWeight: 900,
    color: "#251c31",
  },

  loyaltyProgressPercent: {
    fontSize: "13px",
    fontWeight: 900,
    color: "#7660a0",
  },

  loyaltyProgressTrack: {
    width: "100%",
    height: "9px",
    marginTop: "11px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "#ece8f1",
  },

  loyaltyProgressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#7660a0",
    transition:
      "width 0.3s ease",
  },

  loyaltyDots: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "12px",
  },

  loyaltyDot: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0edf3",
    border:
      "1px solid #e2dce8",
    color: "#8d8296",
    fontSize: "9px",
    fontWeight: 900,
  },

  loyaltyDotActive: {
    background: "#ece3ff",
    border:
      "1px solid #d8c8f5",
    color: "#6b4f91",
  },

  loyaltyRewardCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "11px",
    marginTop: "18px",
    padding: "13px",
    borderRadius: "15px",
    background: "#f8f5ff",
    border:
      "1px solid #e9e0fb",
  },

  loyaltyUnlockedCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "11px",
    marginTop: "18px",
    padding: "13px",
    borderRadius: "15px",
    background: "#fff8e8",
    border:
      "1px solid #f1dfae",
  },

  loyaltyRewardIconLarge: {
    width: "38px",
    height: "38px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "11px",
    background: "#ede4ff",
    fontSize: "18px",
  },

  loyaltyClaimHint: {
    marginTop: "6px",
    fontSize: "9.5px",
    lineHeight: 1.4,
    color: "#7d6740",
  },

  loyaltySuccess: {
    marginTop: "11px",
    padding: "9px 10px",
    borderRadius: "10px",
    background: "#effaf1",
    border:
      "1px solid #d5ecd9",
    color: "#28713a",
    fontSize: "10px",
    fontWeight: 700,
  },

  loyaltyInfo: {
    marginTop: "13px",
    paddingTop: "11px",
    borderTop:
      "1px solid #eeeaf2",
    fontSize: "9.5px",
    lineHeight: 1.45,
    color: "#8a818f",
  },

  /* PRODUCTS */

  productSection: {
    margin: "0 18px 30px",
    padding: "21px 16px 16px",
    borderRadius: "24px",
    background: "#ffffff",
    border:
      "1px solid #e7e7e4",
    boxShadow:
      "0 10px 28px rgba(0,0,0,0.04)",
  },

  productHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "15px",
  },

  productEyebrow: {
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: "2px",
    color: "#777777",
    marginBottom: "5px",
  },

  productTitle: {
    margin: 0,
    fontSize: "23px",
    lineHeight: 1.15,
    fontWeight: 850,
    color: "#171717",
  },

  productSubtitle: {
    margin: "6px 0 0",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#777777",
  },

  productCount: {
    flexShrink: 0,
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#f1f1ee",
    color: "#555555",
    fontSize: "10px",
    fontWeight: 800,
  },

  productGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(1, minmax(0,1fr))",
    gap: "9px",
  },

  productCard: {
    display: "flex",
    overflow: "hidden",
    minHeight: "78px",
    borderRadius: "16px",
    background: "#fafafa",
    border:
      "1px solid #eeeeec",
  },

  productIcon: {
    width: "58px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f0ed",
    color: "#555555",
    fontSize: "20px",
  },

  productContent: {
    minWidth: 0,
    padding: "11px 13px",
  },

  productName: {
    fontSize: "14px",
    lineHeight: 1.25,
    fontWeight: 800,
    color: "#202020",
  },

  productPrice: {
    marginTop: "4px",
    fontSize: "13px",
    fontWeight: 800,
    color: "#111111",
  },

  productDescription: {
    marginTop: "4px",
    fontSize: "10px",
    lineHeight: 1.4,
    color: "#777777",
  },

  /* OFFERS */

  offersSection: {
    margin: "0 18px 30px",
    padding: "20px 16px 16px",
    borderRadius: "24px",
    background: "#fffaf0",
    border:
      "1px solid #f1e2bf",
    boxShadow:
      "0 10px 28px rgba(90,65,20,0.05)",
  },

  offersHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "15px",
  },

  offersEyebrow: {
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "2px",
    color: "#9a6b1f",
    marginBottom: "5px",
  },

  offersTitle: {
    margin: 0,
    fontSize: "23px",
    lineHeight: 1.15,
    fontWeight: 800,
    color: "#241b0f",
  },

  offersSubtitle: {
    margin: "6px 0 0",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#7d6b50",
  },

  offersBadge: {
    flexShrink: 0,
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#f3dfb1",
    color: "#765016",
    fontSize: "10px",
    fontWeight: 800,
  },

  offersList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  offerCard: {
    display: "flex",
    alignItems: "stretch",
    overflow: "hidden",
    borderRadius: "17px",
    background: "#ffffff",
    border:
      "1px solid #eee2c9",
  },

  offerAccent: {
    width: "58px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#211a14",
    color: "#f3d28d",
    fontSize: "21px",
  },

  offerContent: {
    minWidth: 0,
    padding: "13px 14px",
  },

  offerName: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.3,
    fontWeight: 800,
    color: "#211a14",
  },

  offerDescription: {
    margin: "5px 0 0",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#746b60",
  },

  offerLabel: {
    display: "inline-block",
    marginTop: "8px",
    padding: "4px 7px",
    borderRadius: "5px",
    background: "#f8efd9",
    color: "#8a6428",
    fontSize: "8px",
    fontWeight: 800,
    letterSpacing: "1px",
  },

  /* ABOUT */

  aboutSection: {
    marginBottom: "28px",
  },

  aboutCard: {
    margin: "0 18px",
    overflow: "hidden",
    borderRadius: "18px",
    background: "#ffffff",
    border:
      "1px solid #e8e8e5",
    boxShadow:
      "0 5px 16px rgba(0,0,0,0.03)",
  },

  aboutRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    padding: "13px 15px",
    borderBottom:
      "1px solid #eeeeec",
  },

  aboutLabel: {
    flexShrink: 0,
    fontSize: "11px",
    fontWeight: 700,
    color: "#8a8a87",
  },

  aboutValue: {
    textAlign: "right",
    fontSize: "12px",
    fontWeight: 700,
    color: "#333333",
  },

  aboutLink: {
    textAlign: "right",
    fontSize: "12px",
    fontWeight: 700,
    color: "#111111",
    textDecoration: "none",
    wordBreak: "break-word",
  },

  /* TABLE ORDERING */

  orderSection: {
    padding: "4px 18px 8px",
  },

  orderHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    padding: "8px 0 18px",
  },

  orderEyebrow: {
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "1.4px",
    color: "#777777",
  },

  orderTitle: {
    margin: "5px 0 0",
    fontSize: "23px",
    lineHeight: 1.15,
    fontWeight: 850,
    color: "#171717",
  },

  orderText: {
    margin: "7px 0 0",
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#777777",
  },

  orderMark: {
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    background: "#f1f1ee",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    flexShrink: 0,
  },

  orderFormCard: {
    padding: "15px",
    borderRadius: "16px",
    border:
      "1px solid #eeeeec",
    background: "#fafafa",
    marginBottom: "18px",
  },

  orderLabel: {
    display: "block",
    margin: "0 0 6px",
    fontSize: "11px",
    fontWeight: 800,
    color: "#555555",
  },

  orderOptional: {
    fontWeight: 600,
    color: "#999999",
  },

  orderInput: {
    width: "100%",
    boxSizing: "border-box",
    marginBottom: "12px",
    padding: "12px",
    borderRadius: "11px",
    border:
      "1px solid #ddddda",
    background: "#ffffff",
    color: "#171717",
    fontSize: "13px",
    outline: "none",
  },

  orderCategoryBlock: {
    marginBottom: "18px",
  },

  orderCategoryTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 850,
    color: "#171717",
  },

  orderCategoryDescription: {
    margin: "4px 0 9px",
    fontSize: "11px",
    color: "#888888",
  },

  orderItemList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  orderItemCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "12px",
    borderRadius: "14px",
    border:
      "1px solid #eeeeec",
    background: "#ffffff",
  },

  orderItemMain: {
    minWidth: 0,
  },

  orderItemName: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#202020",
  },

  orderItemDescription: {
    marginTop: "3px",
    fontSize: "10px",
    lineHeight: 1.4,
    color: "#888888",
  },

  orderItemPrice: {
    marginTop: "5px",
    fontSize: "12px",
    fontWeight: 800,
    color: "#111111",
  },

  orderQuantityControls: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    flexShrink: 0,
  },

  orderQtyButton: {
    width: "32px",
    height: "32px",
    border:
      "1px solid #ddddda",
    borderRadius: "10px",
    background: "#f6f6f3",
    color: "#171717",
    fontSize: "18px",
    fontWeight: 800,
    cursor: "pointer",
  },

  orderQty: {
    minWidth: "15px",
    textAlign: "center",
    fontSize: "13px",
    fontWeight: 800,
  },

  orderError: {
    padding: "11px 12px",
    borderRadius: "11px",
    background: "#fff1f2",
    color: "#be123c",
    fontSize: "11px",
    marginBottom: "12px",
  },

  orderSummaryCard: {
    position: "sticky",
    bottom: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px",
    borderRadius: "16px",
    background: "#171717",
    boxShadow:
      "0 10px 30px rgba(0,0,0,0.16)",
  },

  orderSummaryLabel: {
    display: "block",
    fontSize: "10px",
    color: "#b7b7b7",
  },

  orderSummaryTotal: {
    display: "block",
    marginTop: "2px",
    fontSize: "18px",
    color: "#ffffff",
  },

  orderPrimaryButton: {
    border: "none",
    borderRadius: "11px",
    padding: "11px 15px",
    background: "#ffffff",
    color: "#171717",
    fontSize: "12px",
    fontWeight: 850,
    cursor: "pointer",
  },

  orderSuccessCard: {
    textAlign: "center",
    padding: "32px 18px",
    borderRadius: "20px",
    border:
      "1px solid #eeeeec",
    background: "#fafafa",
  },

  orderSuccessIcon: {
    width: "56px",
    height: "56px",
    margin: "0 auto 15px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#171717",
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: 900,
  },

  orderNumber: {
    display: "inline-block",
    margin: "13px 0 18px",
    padding: "8px 11px",
    borderRadius: "9px",
    background: "#eeeeec",
    color: "#444444",
    fontSize: "11px",
    fontWeight: 850,
    letterSpacing: "0.5px",
  },

  /* CUSTOMER FEEDBACK */

  feedbackSection: {
    padding: "4px 18px 8px",
  },

  feedbackHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
    padding: "8px 0 18px",
  },

  feedbackEyebrow: {
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "1.5px",
    color: "#777777",
  },

  feedbackTitle: {
    margin: "5px 0 0",
    fontSize: "23px",
    lineHeight: 1.15,
    fontWeight: 850,
    color: "#171717",
  },

  feedbackSubtitle: {
    margin: "7px 0 0",
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#777777",
  },

  feedbackMark: {
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    background: "#f1f1ee",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "23px",
    flexShrink: 0,
  },

  feedbackCard: {
    padding: "17px",
    borderRadius: "17px",
    border:
      "1px solid #eeeeec",
    background: "#fafafa",
  },

  feedbackQuestion: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#222222",
  },

  feedbackStars: {
    display: "flex",
    gap: "7px",
    marginTop: "12px",
  },

  feedbackStarButton: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    border:
      "1px solid #deded9",
    background: "#ffffff",
    color: "#c8c8c3",
    fontSize: "20px",
    cursor: "pointer",
    padding: 0,
  },

  feedbackStarActive: {
    background: "#111820",
    color: "#ffffff",
    borderColor: "#111820",
  },

  feedbackRatingHint: {
    minHeight: "17px",
    marginTop: "7px",
    fontSize: "11px",
    color: "#777777",
    fontWeight: 650,
  },

  feedbackLabel: {
    display: "block",
    margin: "16px 0 6px",
    fontSize: "11px",
    fontWeight: 800,
    color: "#333333",
  },

  feedbackOptional: {
    fontWeight: 500,
    color: "#999999",
  },

  feedbackTextarea: {
    width: "100%",
    minHeight: "110px",
    resize: "vertical",
    boxSizing: "border-box",
    border:
      "1px solid #deded9",
    borderRadius: "13px",
    background: "#ffffff",
    padding: "11px 12px",
    outline: "none",
    fontFamily: "inherit",
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#171717",
  },

  feedbackTwoColumn: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },

  feedbackInput: {
    width: "100%",
    height: "44px",
    boxSizing: "border-box",
    border:
      "1px solid #deded9",
    borderRadius: "13px",
    background: "#ffffff",
    padding: "0 12px",
    outline: "none",
    fontFamily: "inherit",
    fontSize: "12px",
    color: "#171717",
  },

  feedbackError: {
    marginTop: "12px",
    padding: "10px 11px",
    borderRadius: "11px",
    background: "#fff1f0",
    color: "#b42318",
    fontSize: "11px",
    lineHeight: 1.45,
  },

  feedbackPrimaryButton: {
    width: "100%",
    height: "46px",
    marginTop: "16px",
    border: "none",
    borderRadius: "13px",
    background: "#111820",
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },

  feedbackPrivacy: {
    marginTop: "9px",
    textAlign: "center",
    fontSize: "9px",
    lineHeight: 1.4,
    color: "#999999",
  },

  feedbackSuccessCard: {
    padding: "30px 18px",
    margin: "8px 0",
    borderRadius: "18px",
    border:
      "1px solid #eeeeec",
    background: "#fafafa",
    textAlign: "center",
  },

  feedbackSuccessIcon: {
    width: "54px",
    height: "54px",
    margin: "0 auto 15px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eaf7ef",
    color: "#087443",
    fontSize: "24px",
    fontWeight: 800,
  },

  feedbackSuccessTitle: {
    margin: "5px 0 0",
    fontSize: "22px",
    lineHeight: 1.2,
    fontWeight: 850,
    color: "#171717",
  },

  feedbackSuccessText: {
    maxWidth: "420px",
    margin: "8px auto 0",
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#777777",
  },

  feedbackSecondaryButton: {
    minHeight: "42px",
    marginTop: "18px",
    padding: "0 15px",
    borderRadius: "12px",
    border:
      "1px solid #deded9",
    background: "#ffffff",
    color: "#222222",
    fontFamily: "inherit",
    fontSize: "11px",
    fontWeight: 750,
    cursor: "pointer",
  },

  /* FOOTER */

  footer: {
    padding: "25px 18px 20px",
    textAlign: "center",
    borderTop:
      "1px solid #eeeeec",
  },

  footerBrand: {
    fontSize: "15px",
    fontWeight: 900,
    letterSpacing: "1.5px",
    color: "#171717",
  },

  footerText: {
    marginTop: "5px",
    fontSize: "10px",
    color: "#8a8a8a",
  },

  deviceInfo: {
    marginTop: "9px",
    fontSize: "9px",
    color: "#b0b0b0",
    letterSpacing: "0.7px",
  },
};