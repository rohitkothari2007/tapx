"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Business = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  status: string | null;
  instagram_url: string | null;
  google_review_url: string | null;
  whatsapp_number: string | null;
  upi_id: string | null;
};

type Feature = {
  id: string;
  feature_key: string;
  name: string;
  category: string | null;
  is_core: boolean;
  is_paid: boolean;
  is_active: boolean;
  icon: string | null;
  description: string | null;
};

type BusinessFeature = {
  feature_id: string;
  enabled: boolean;
  status: string | null;
};

type ModuleConfig = {
  module_key: string;
  config: Record<string, any> | null;
};

type Order = {
  id: string;
  business_id: string;
  table_number: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number | null;
  total: number | null;
  status: string;
  source_device_code: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

type Appointment = {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone: string;
  service_id: string | null;
  service_name: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  source_device_code: string | null;
  created_at: string;
  updated_at: string;
};

type PageKey =
  | "overview"
  | "orders"
  | "appointments"
  | "menu"
  | "offers"
  | "loyalty"
  | "feedback"
  | "analytics"
  | "settings";

const ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
] as const;

function normalizeKey(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function prettyName(value: string | null | undefined) {
  if (!value) return "Business";

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAppointmentDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAppointmentTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function todayDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function appointmentStatusLabel(status: AppointmentStatus) {
  return status === "no_show"
    ? "No-show"
    : status.charAt(0).toUpperCase() + status.slice(1);
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function isEnabled(
  key: string,
  features: Feature[],
  businessFeatures: BusinessFeature[],
  configs: ModuleConfig[]
) {
  const normalized = normalizeKey(key);

  const feature = features.find(
    (item) =>
      normalizeKey(item.feature_key) === normalized ||
      normalizeKey(item.name) === normalized
  );

  if (feature) {
    const bf = businessFeatures.find(
      (item) => item.feature_id === feature.id
    );

    if (bf) {
      return (
        bf.enabled &&
        normalizeKey(bf.status) !== "inactive"
      );
    }
  }

  // business_module_configs stores configuration only.
  // Module activation is controlled by business_features.
  return false;
}

export default function ClientPortalPage() {
  const router = useRouter();

  const [business, setBusiness] = useState<Business | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [businessFeatures, setBusinessFeatures] = useState<
    BusinessFeature[]
  >([]);
  const [moduleConfigs, setModuleConfigs] = useState<ModuleConfig[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);

  const [updatingAppointmentId, setUpdatingAppointmentId] =
    useState<string | null>(null);

  const [activePage, setActivePage] =
    useState<PageKey>("overview");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [updatingOrderId, setUpdatingOrderId] =
    useState<string | null>(null);

  const [currentUserEmail, setCurrentUserEmail] =
    useState("");

  const loadPortal = useCallback(async () => {
    try {
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/client/login");
        return;
      }

      setCurrentUserEmail(user.email || "");

      const { data: mapping, error: mappingError } =
        await supabase
          .from("tapx_client_users")
          .select("business_id, role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (mappingError) {
        throw new Error(mappingError.message);
      }

      if (!mapping?.business_id) {
        throw new Error(
          "Your account is not connected to a TAPX business yet."
        );
      }

      const businessId = mapping.business_id;

      const [
        businessResult,
        featuresResult,
        businessFeaturesResult,
        configsResult,
        ordersResult,
        appointmentsResult,
      ] = await Promise.all([
        supabase
          .from("businesses")
          .select(
            `
              id,
              name,
              category,
              phone,
              email,
              address,
              city,
              state,
              logo_url,
              status,
              instagram_url,
              google_review_url,
              whatsapp_number,
              upi_id
            `
          )
          .eq("id", businessId)
          .single(),

        supabase
          .from("feature_catalog")
          .select(
            `
              id,
              feature_key,
              name,
              category,
              is_core,
              is_paid,
              is_active,
              icon,
              description
            `
          )
          .eq("is_active", true),

        supabase
          .from("business_features")
          .select("feature_id, enabled, status")
          .eq("business_id", businessId),

        supabase
          .from("business_module_configs")
          .select("module_key, config")
          .eq("business_id", businessId),

        supabase
          .from("tapx_orders")
          .select(
            `
              id,
              business_id,
              table_number,
              customer_name,
              customer_phone,
              subtotal,
              total,
              status,
              source_device_code,
              created_at
            `
          )
          .eq("business_id", businessId)
          .order("created_at", {
            ascending: false,
          })
          .limit(100),

        supabase
          .from("tapx_appointments")
          .select(
            `
              id,
              business_id,
              customer_name,
              customer_phone,
              service_id,
              service_name,
              appointment_date,
              appointment_time,
              duration_minutes,
              status,
              notes,
              source_device_code,
              created_at,
              updated_at
            `
          )
          .eq("business_id", businessId)
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true })
          .limit(200),
      ]);

      if (businessResult.error) {
        throw new Error(businessResult.error.message);
      }

      if (featuresResult.error) {
        throw new Error(featuresResult.error.message);
      }

      if (businessFeaturesResult.error) {
        throw new Error(
          businessFeaturesResult.error.message
        );
      }

      if (configsResult.error) {
        throw new Error(configsResult.error.message);
      }

      if (ordersResult.error) {
        throw new Error(ordersResult.error.message);
      }

      if (appointmentsResult.error) {
        throw new Error(appointmentsResult.error.message);
      }

      const loadedOrders =
        (ordersResult.data || []) as Order[];

      setBusiness(businessResult.data as Business);
      setFeatures((featuresResult.data || []) as Feature[]);
      setBusinessFeatures(
        (businessFeaturesResult.data ||
          []) as BusinessFeature[]
      );
      setModuleConfigs(
        (configsResult.data || []) as ModuleConfig[]
      );
      setOrders(loadedOrders);
      setAppointments((appointmentsResult.data || []) as Appointment[]);

      if (loadedOrders.length > 0) {
        const orderIds = loadedOrders.map(
          (order) => order.id
        );

        const { data: items, error: itemsError } =
          await supabase
            .from("tapx_order_items")
            .select(
              `
                id,
                order_id,
                item_name,
                unit_price,
                quantity,
                line_total
              `
            )
            .in("order_id", orderIds);

        if (itemsError) {
          console.warn(
            "Could not load order items:",
            itemsError.message
          );
        }

        setOrderItems((items || []) as OrderItem[]);
      } else {
        setOrderItems([]);
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          "Unable to load your TAPX workspace."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  const refresh = async () => {
    setRefreshing(true);
    await loadPortal();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/client/login");
  };

  const enabledModuleKeys = useMemo(() => {
    const keys = new Set<string>();

    features.forEach((feature) => {
      const bf = businessFeatures.find(
        (item) => item.feature_id === feature.id
      );

      if (
        bf?.enabled &&
        normalizeKey(bf.status) !== "inactive"
      ) {
        keys.add(normalizeKey(feature.feature_key));
        keys.add(normalizeKey(feature.name));
      }
    });

    return keys;
  }, [features, businessFeatures]);

  const hasModule = useCallback(
    (...keys: string[]) => {
      return keys.some((key) =>
        enabledModuleKeys.has(normalizeKey(key))
      );
    },
    [enabledModuleKeys]
  );

  const hasOrders = hasModule(
    "table_ordering",
    "table-ordering",
    "orders",
    "table ordering"
  );

  const hasMenu = hasModule(
    "digital_menu",
    "digital-menu",
    "digital menu"
  );

  const hasOffers = hasModule(
    "offers",
    "offers_promotions",
    "offers-promotions",
    "offers & promotions"
  );

  const hasLoyalty = hasModule(
    "customer_loyalty",
    "customer-loyalty",
    "customer loyalty",
    "loyalty"
  );

  const hasFeedback = hasModule(
    "customer_feedback",
    "customer-feedback",
    "customer feedback",
    "feedback"
  );

  const today = new Date();

  const todayOrders = useMemo(() => {
    return orders.filter((order) => {
      const date = new Date(order.created_at);

      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
  }, [orders]);

  const pendingOrders = useMemo(() => {
    return orders.filter((order) =>
      ["pending", "accepted", "preparing", "ready"].includes(
        order.status
      )
    );
  }, [orders]);

  const completedOrders = useMemo(() => {
    return orders.filter((order) =>
      ["completed", "served"].includes(order.status)
    );
  }, [orders]);

  const todayRevenue = useMemo(() => {
    return todayOrders
      .filter((order) =>
        ["completed", "served"].includes(order.status)
      )
      .reduce(
        (sum, order) =>
          sum + Number(order.total || 0),
        0
      );
  }, [todayOrders]);

  const completedRevenue = useMemo(() => {
    return completedOrders.reduce(
      (sum, order) =>
        sum + Number(order.total || 0),
      0
    );
  }, [completedOrders]);

  const todayAppointments = useMemo(() => {
    const today = todayDateString();
    return appointments.filter(
      (appointment) =>
        appointment.appointment_date === today &&
        !["cancelled", "no_show", "completed"].includes(appointment.status)
    );
  }, [appointments]);

  const pendingAppointments = useMemo(() =>
    appointments.filter((appointment) => appointment.status === "pending"),
  [appointments]);

  const upcomingAppointments = useMemo(() => {
    const today = todayDateString();
    return appointments.filter(
      (appointment) =>
        appointment.appointment_date >= today &&
        !["cancelled", "no_show", "completed"].includes(appointment.status)
    );
  }, [appointments]);

  const updateOrderStatus = async (
    orderId: string,
    status: string
  ) => {
    try {
      setUpdatingOrderId(orderId);

      const { error: rpcError } =
        await supabase.rpc(
          "update_tapx_order_status",
          {
            p_order_id: orderId,
            p_status: status,
          }
        );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
              }
            : order
        )
      );

      setSelectedOrder((current) =>
        current?.id === orderId
          ? {
              ...current,
              status,
            }
          : current
      );
    } catch (err: any) {
      alert(
        err?.message ||
          "Unable to update order status."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const updateAppointmentStatus = async (
    appointmentId: string,
    status: AppointmentStatus
  ) => {
    try {
      setUpdatingAppointmentId(appointmentId);

      const { error: updateError } = await supabase
        .from("tapx_appointments")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === appointmentId
            ? { ...appointment, status, updated_at: new Date().toISOString() }
            : appointment
        )
      );

      setSelectedAppointment((current) =>
        current?.id === appointmentId
          ? { ...current, status, updated_at: new Date().toISOString() }
          : current
      );
    } catch (err: any) {
      alert(err?.message || "Unable to update appointment status.");
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  const navigate = (page: PageKey) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  const sidebarItems = [
    {
      key: "overview" as PageKey,
      label: "Overview",
      icon: "⌂",
      show: true,
    },
    {
      key: "orders" as PageKey,
      label: "Orders",
      icon: "▣",
      show: hasOrders,
      badge:
        pendingOrders.length > 0
          ? pendingOrders.length
          : undefined,
    },
    {
      key: "appointments" as PageKey,
      label: "Appointments",
      icon: "◷",
      show: hasModule(
        "appointment_booking",
        "appointment-booking",
        "appointment booking",
        "appointments"
      ),
      badge:
        pendingAppointments.length > 0
          ? pendingAppointments.length
          : undefined,
    },
    {
      key: "menu" as PageKey,
      label: "Digital Menu",
      icon: "☷",
      show: hasMenu,
    },
    {
      key: "offers" as PageKey,
      label: "Offers",
      icon: "✦",
      show: hasOffers,
    },
    {
      key: "loyalty" as PageKey,
      label: "Loyalty",
      icon: "♡",
      show: hasLoyalty,
    },
    {
      key: "feedback" as PageKey,
      label: "Feedback",
      icon: "◌",
      show: hasFeedback,
    },
    {
      key: "analytics" as PageKey,
      label: "Analytics",
      icon: "↗",
      show: true,
    },
    {
      key: "settings" as PageKey,
      label: "Settings",
      icon: "⚙",
      show: true,
    },
  ];

  const isSalon = normalizeKey(business?.category).includes("salon");

  const enabledPaidFeatures = features.filter(
    (feature) => {
      const bf = businessFeatures.find(
        (item) => item.feature_id === feature.id
      );

      return (
        feature.is_paid &&
        bf?.enabled &&
        normalizeKey(bf.status) !== "inactive"
      );
    }
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-brand">
          <div className="loading-logo">T</div>
          <div>
            <strong>TAPX</strong>
            <span>Business Platform</span>
          </div>
        </div>

        <div className="loading-spinner" />

        <p>Preparing your workspace…</p>

        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            background: #f6f7f9;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #667085;
            font-family:
              Inter,
              ui-sans-serif,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
          }

          .loading-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 35px;
          }

          .loading-logo {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            background: #111820;
            color: white;
            display: grid;
            place-items: center;
            font-size: 22px;
            font-weight: 800;
          }

          .loading-brand strong {
            display: block;
            color: #111820;
            font-size: 18px;
            letter-spacing: 0.08em;
          }

          .loading-brand span {
            display: block;
            font-size: 10px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            margin-top: 2px;
          }

          .loading-spinner {
            width: 34px;
            height: 34px;
            border: 3px solid #e5e7eb;
            border-top-color: #111820;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .loading-screen p {
            margin-top: 18px;
            font-size: 14px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="error-screen">
        <div className="error-card">
          <div className="error-icon">!</div>

          <h1>Workspace unavailable</h1>

          <p>
            {error ||
              "We couldn't load your TAPX business workspace."}
          </p>

          <div className="error-actions">
            <button onClick={refresh}>
              Try again
            </button>

            <button
              className="secondary"
              onClick={logout}
            >
              Sign out
            </button>
          </div>
        </div>

        <style jsx>{`
          .error-screen {
            min-height: 100vh;
            background: #f6f7f9;
            display: grid;
            place-items: center;
            padding: 24px;
            font-family:
              Inter,
              ui-sans-serif,
              system-ui,
              sans-serif;
          }

          .error-card {
            width: min(480px, 100%);
            background: white;
            border: 1px solid #e6e8eb;
            border-radius: 24px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(16, 24, 40, 0.08);
          }

          .error-icon {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: #fff0f0;
            color: #c73535;
            display: grid;
            place-items: center;
            margin: 0 auto 20px;
            font-weight: 800;
          }

          h1 {
            margin: 0;
            color: #111820;
            font-size: 26px;
          }

          p {
            color: #667085;
            line-height: 1.6;
            font-size: 14px;
            margin: 12px 0 26px;
          }

          .error-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
          }

          button {
            border: 0;
            border-radius: 11px;
            padding: 12px 18px;
            background: #111820;
            color: white;
            cursor: pointer;
            font-weight: 650;
          }

          button.secondary {
            background: #f2f4f7;
            color: #344054;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`portal ${isSalon ? "salon-portal" : ""}`}>
      <aside
        className={`sidebar ${
          mobileMenuOpen ? "open" : ""
        }`}
      >
        <div className="brand">
          <div className="brand-logo">T</div>

          <div>
            <div className="brand-name">TAPX</div>
            <div className="brand-sub">
              BUSINESS PLATFORM
            </div>
          </div>
        </div>

        <div className="business-card">
          <div className="business-avatar">
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={business.name}
              />
            ) : (
              getInitials(business.name)
            )}
          </div>

          <div className="business-info">
            <strong>{business.name}</strong>
            <span>
              {prettyName(business.category)}
            </span>
          </div>
        </div>

        <div className="nav-label">
          WORKSPACE
        </div>

        <nav className="nav">
          {sidebarItems
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.key}
                className={`nav-item ${
                  activePage === item.key
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  navigate(item.key)
                }
              >
                <span className="nav-icon">
                  {item.icon}
                </span>

                <span className="nav-text">
                  {item.label}
                </span>

                {item.badge ? (
                  <span className="nav-badge">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-icon">?</div>

            <div>
              <strong>Need help?</strong>
              <span>
                Contact your TAPX administrator.
              </span>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            <span>↪</span>
            Sign out
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          className="mobile-overlay"
          onClick={() =>
            setMobileMenuOpen(false)
          }
          aria-label="Close menu"
        />
      )}

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="hamburger"
              onClick={() =>
                setMobileMenuOpen(true)
              }
            >
              ☰
            </button>

            <div>
              <div className="breadcrumb">
                TAPX / BUSINESS
              </div>

              <div className="page-title">
                {activePage === "overview"
                  ? "Overview"
                  : sidebarItems.find(
                      (item) =>
                        item.key === activePage
                    )?.label}
              </div>
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="icon-button"
              onClick={refresh}
              disabled={refreshing}
              title="Refresh"
            >
              {refreshing ? "…" : "↻"}
            </button>

            <div className="account">
              <div className="account-avatar">
                {getInitials(business.name)}
              </div>

              <div className="account-details">
                <strong>{business.name}</strong>
                <span>{currentUserEmail}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="content">
          {activePage === "overview" && (
            <Overview
              business={business}
              todayRevenue={todayRevenue}
              todayOrders={todayOrders}
              pendingOrders={pendingOrders}
              completedRevenue={completedRevenue}
              orders={orders}
              enabledPaidFeatures={
                enabledPaidFeatures
              }
              navigate={navigate}
              hasOrders={hasOrders}
              hasMenu={hasMenu}
              hasOffers={hasOffers}
              hasLoyalty={hasLoyalty}
              hasFeedback={hasFeedback}
              hasAppointment={hasModule(
                "appointment_booking",
                "appointment-booking",
                "appointment booking",
                "appointments"
              )}
              appointments={appointments}
              todayAppointments={todayAppointments}
              pendingAppointments={pendingAppointments}
            />
          )}

          {activePage === "orders" && hasOrders && (
            <OrdersPage
              orders={orders}
              orderItems={orderItems}
              selectedOrder={selectedOrder}
              setSelectedOrder={
                setSelectedOrder
              }
              updateOrderStatus={
                updateOrderStatus
              }
              updatingOrderId={
                updatingOrderId
              }
            />
          )}

          {activePage === "appointments" &&
            hasModule(
              "appointment_booking",
              "appointment-booking",
              "appointment booking",
              "appointments"
            ) && (
              <AppointmentsPage
                appointments={appointments}
                selectedAppointment={selectedAppointment}
                setSelectedAppointment={setSelectedAppointment}
                updateAppointmentStatus={updateAppointmentStatus}
                updatingAppointmentId={updatingAppointmentId}
                isSalon={isSalon}
              />
            )}

          {activePage === "menu" && hasMenu && (
            <ModulePage
              title="Digital Menu"
              eyebrow="CUSTOMER EXPERIENCE"
              description="Manage the digital menu customers see through your TAPX touchpoint."
              icon="☷"
              items={[
                "Categories",
                "Menu items",
                "Prices",
                "Availability",
                "Item descriptions",
                "Menu preview",
              ]}
              status="Connected"
              emptyText="Your Digital Menu workspace is connected. Menu management will use the same configuration that powers your customer experience."
            />
          )}

          {activePage === "offers" && hasOffers && (
            <ModulePage
              title="Offers & Promotions"
              eyebrow="CUSTOMER ENGAGEMENT"
              description="Manage promotions that appear inside your TAPX customer experience."
              icon="✦"
              items={[
                "Active offers",
                "Create offers",
                "Edit promotions",
                "Activate / deactivate",
                "Offer visibility",
              ]}
              status="Connected"
              emptyText="Your offers module is active and ready for campaign management."
            />
          )}

          {activePage === "loyalty" &&
            hasLoyalty && (
              <ModulePage
                title="Customer Loyalty"
                eyebrow="CUSTOMER GROWTH"
                description="Build repeat visits and customer relationships through your TAPX loyalty program."
                icon="♡"
                items={[
                  "Members",
                  "Visits",
                  "Rewards",
                  "Progress",
                  "Loyalty configuration",
                ]}
                status="Connected"
                emptyText="Your loyalty module is active. Customer loyalty activity will appear here as your customers use TAPX."
              />
            )}

          {activePage === "feedback" &&
            hasFeedback && (
              <ModulePage
                title="Customer Feedback"
                eyebrow="CUSTOMER EXPERIENCE"
                description="Understand what customers think about their experience with your business."
                icon="◌"
                items={[
                  "Customer responses",
                  "Ratings",
                  "Recent feedback",
                  "Feedback trends",
                  "Experience insights",
                ]}
                status="Connected"
                emptyText="Your feedback module is active. Customer responses will appear here once feedback is collected."
              />
            )}

          {activePage === "analytics" && (
            <AnalyticsPage
              orders={orders}
              todayOrders={todayOrders}
              pendingOrders={pendingOrders}
              completedOrders={
                completedOrders
              }
              todayRevenue={todayRevenue}
              completedRevenue={
                completedRevenue
              }
              enabledPaidFeatures={
                enabledPaidFeatures
              }
            />
          )}

          {activePage === "settings" && (
            <SettingsPage
              business={business}
              email={currentUserEmail}
            />
          )}
        </div>
      </main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #f6f7f9;
        }

        body {
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          color: #111820;
        }

        button,
        input,
        select {
          font: inherit;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        .portal {
          min-height: 100vh;
          display: flex;
          background: #f6f7f9;
        }

        .sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 270px;
          background: #10161d;
          color: white;
          display: flex;
          flex-direction: column;
          padding: 25px 14px 16px;
          z-index: 50;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 10px;
        }

        .brand-logo {
          width: 44px;
          height: 44px;
          background: white;
          color: #111820;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-size: 21px;
          font-weight: 850;
        }

        .brand-name {
          font-size: 18px;
          font-weight: 850;
          letter-spacing: 0.1em;
        }

        .brand-sub {
          margin-top: 2px;
          font-size: 8px;
          letter-spacing: 0.2em;
          color: #8c98a8;
        }

        .business-card {
          margin: 30px 4px 28px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.045);
          border-radius: 16px;
          padding: 14px;
          display: flex;
          gap: 11px;
          align-items: center;
        }

        .business-avatar {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border-radius: 12px;
          background: #27313e;
          color: white;
          display: grid;
          place-items: center;
          font-size: 13px;
          font-weight: 750;
          overflow: hidden;
        }

        .business-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .business-info {
          min-width: 0;
        }

        .business-info strong {
          display: block;
          font-size: 13px;
          font-weight: 750;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .business-info span {
          display: block;
          color: #8e9aaa;
          font-size: 11px;
          margin-top: 4px;
        }

        .nav-label {
          padding: 0 13px 10px;
          color: #697483;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.18em;
        }

        .nav {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .nav-item {
          width: 100%;
          border: 0;
          background: transparent;
          color: #aab3bf;
          border-radius: 11px;
          min-height: 46px;
          padding: 0 13px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition:
            background 0.15s,
            color 0.15s;
        }

        .nav-item:hover {
          color: white;
          background: rgba(255, 255, 255, 0.055);
        }

        .nav-item.active {
          color: #111820;
          background: white;
        }

        .nav-icon {
          width: 20px;
          text-align: center;
          font-size: 16px;
        }

        .nav-text {
          flex: 1;
        }

        .nav-badge {
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          border-radius: 99px;
          background: #eaf8ef;
          color: #237143;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 800;
        }

        .sidebar-bottom {
          margin-top: auto;
        }

        .support-card {
          display: flex;
          gap: 10px;
          align-items: center;
          border-radius: 14px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.045);
          margin-bottom: 10px;
        }

        .support-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: #27313e;
          display: grid;
          place-items: center;
          font-size: 13px;
        }

        .support-card strong {
          display: block;
          font-size: 11px;
        }

        .support-card span {
          display: block;
          color: #778291;
          font-size: 9px;
          margin-top: 3px;
        }

        .logout-button {
          width: 100%;
          border: 0;
          background: transparent;
          color: #909aa8;
          min-height: 43px;
          border-radius: 10px;
          text-align: left;
          padding: 0 13px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }

        .logout-button:hover {
          color: white;
          background: rgba(255, 255, 255, 0.05);
        }

        .logout-button span {
          margin-right: 10px;
        }

        .main {
          margin-left: 270px;
          width: calc(100% - 270px);
          min-width: 0;
        }

        .topbar {
          min-height: 86px;
          background: rgba(255, 255, 255, 0.96);
          border-bottom: 1px solid #e7e9ed;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 0;
          z-index: 30;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .breadcrumb {
          color: #98a1ad;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.18em;
          margin-bottom: 5px;
        }

        .page-title {
          font-size: 20px;
          font-weight: 750;
          letter-spacing: -0.025em;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .icon-button {
          width: 42px;
          height: 42px;
          border: 1px solid #e2e5e9;
          background: white;
          color: #475467;
          border-radius: 12px;
          cursor: pointer;
          font-size: 18px;
        }

        .icon-button:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .account {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .account-avatar {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: #151c24;
          color: white;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 800;
        }

        .account-details strong {
          display: block;
          font-size: 12px;
          max-width: 150px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .account-details span {
          display: block;
          margin-top: 3px;
          color: #98a1ad;
          font-size: 10px;
          max-width: 180px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .content {
          padding: 32px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .hamburger {
          display: none;
          width: 42px;
          height: 42px;
          border: 1px solid #e3e6ea;
          border-radius: 11px;
          background: white;
          cursor: pointer;
        }

        .mobile-overlay {
          display: none;
        }

        .salon-portal .sidebar {
          background: #211b1d;
        }

        .salon-portal .brand-logo {
          background: #f7e9e8;
          color: #3a292d;
        }

        .salon-portal .nav-item.active {
          background: #f5e7e7;
          color: #3b292e;
        }

        .salon-portal .business-card {
          border-color: rgba(245, 231, 231, 0.14);
          background: rgba(245, 231, 231, 0.055);
        }

        .salon-portal .main {
          background: #fbf8f7;
        }

        .salon-portal .topbar {
          background: rgba(255, 252, 251, 0.96);
          border-bottom-color: #eee2e0;
        }

        .salon-portal .hero {
          background: linear-gradient(135deg, #35282c, #61464e 58%, #8a6b73);
        }

        .salon-portal .service-icon {
          background: #f7eceb;
          color: #65474e;
        }

        .salon-portal .service-card:hover {
          border-color: #dfc8c7;
          box-shadow: 0 16px 34px rgba(83, 54, 61, 0.09);
        }

        .salon-portal .stat-icon,
        .salon-portal .feature-icon,
        .salon-portal .empty-icon {
          background: #f7eceb;
          color: #684951;
        }

        .salon-portal .appointment-overview-card {
          background: linear-gradient(135deg, #fff8f7, #f6e9e8);
          border-color: #ead6d4;
        }

        .salon-portal .appointment-overview-card button {
          background: #4b343b;
          color: white;
        }

        @media (max-width: 1000px) {
          .sidebar {
            transform: translateX(-100%);
            transition: transform 0.22s ease;
          }

          .sidebar.open {
            transform: translateX(0);
          }

          .mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            border: 0;
            background: rgba(15, 23, 42, 0.42);
            z-index: 40;
          }

          .main {
            margin-left: 0;
            width: 100%;
          }

          .hamburger {
            display: block;
          }
        }

        @media (max-width: 700px) {
          .topbar {
            padding: 0 16px;
            min-height: 74px;
          }

          .topbar-right {
            gap: 7px;
          }

          .account-details {
            display: none;
          }

          .content {
            padding: 20px 16px 40px;
          }

          .breadcrumb {
            font-size: 8px;
          }

          .page-title {
            font-size: 18px;
          }

          .icon-button {
            width: 40px;
            height: 40px;
          }
        }
      `}</style>
    </div>
  );
}

function Overview({
  business,
  todayRevenue,
  todayOrders,
  pendingOrders,
  completedRevenue,
  orders,
  enabledPaidFeatures,
  navigate,
  hasOrders,
  hasMenu,
  hasOffers,
  hasLoyalty,
  hasFeedback,
  hasAppointment,
  appointments,
  todayAppointments,
  pendingAppointments,
}: {
  business: Business;
  todayRevenue: number;
  todayOrders: Order[];
  pendingOrders: Order[];
  completedRevenue: number;
  orders: Order[];
  enabledPaidFeatures: Feature[];
  navigate: (page: PageKey) => void;
  hasOrders: boolean;
  hasMenu: boolean;
  hasOffers: boolean;
  hasLoyalty: boolean;
  hasFeedback: boolean;
  hasAppointment: boolean;
  appointments: Appointment[];
  todayAppointments: Appointment[];
  pendingAppointments: Appointment[];
}) {
  const services = [
    hasOrders && {
      title: "Orders",
      description:
        "Manage incoming customer orders.",
      icon: "▣",
      page: "orders" as PageKey,
    },
    hasMenu && {
      title: "Digital Menu",
      description:
        "Manage your customer-facing menu.",
      icon: "☷",
      page: "menu" as PageKey,
    },
    hasOffers && {
      title: "Offers",
      description:
        "Manage promotions and campaigns.",
      icon: "✦",
      page: "offers" as PageKey,
    },
    hasLoyalty && {
      title: "Loyalty",
      description:
        "Grow repeat customer relationships.",
      icon: "♡",
      page: "loyalty" as PageKey,
    },
    hasFeedback && {
      title: "Feedback",
      description:
        "Understand your customers better.",
      icon: "◌",
      page: "feedback" as PageKey,
    },
    hasAppointment
      ? {
          title: "Appointments",
          description: "Manage bookings and your daily schedule.",
          icon: "◷",
          page: "appointments" as PageKey,
        }
      : null,
    {
      title: "Analytics",
      description:
        "Understand TAPX activity and performance.",
      icon: "↗",
      page: "analytics" as PageKey,
    },
  ].filter(Boolean) as {
    title: string;
    description: string;
    icon: string;
    page: PageKey;
  }[];

  return (
    <div className="overview">
      <section className="hero">
        <div>
          <div className="eyebrow">
            {prettyName(business.category)} · TAPX
          </div>

          <h1>
            Good afternoon,{" "}
            <span>{business.name}.</span>
          </h1>

          <p>
            Here's what's happening with your
            business today.
          </p>
        </div>

        <div className="hero-status">
          <div className="status-dot" />
          <span>TAPX EXPERIENCE ACTIVE</span>

          <strong>{business.name}</strong>

          <small>
            {prettyName(business.category)}
          </small>
        </div>
      </section>

      <section className="stats">
        <StatCard
          label="Today's revenue"
          value={formatCurrency(todayRevenue)}
          note={`${todayOrders.length} orders today`}
          icon="₹"
        />

        <StatCard
          label="Today's orders"
          value={String(todayOrders.length)}
          note={
            pendingOrders.length
              ? `${pendingOrders.length} need attention`
              : "No pending orders"
          }
          icon="▣"
        />

        <StatCard
          label="All orders"
          value={String(orders.length)}
          note="Recent TAPX orders"
          icon="◉"
        />

        <StatCard
          label="Completed revenue"
          value={formatCurrency(
            completedRevenue
          )}
          note="Completed & served"
          icon="↗"
        />
      </section>

      <section className="appointment-overview-card">
        <div className="appointment-overview-top">
          <div>
            <div className="eyebrow">TODAY'S SCHEDULE</div>
            <h2>{todayAppointments.length} appointments today</h2>
            <p>Stay ahead of every booking and keep your customer schedule organized.</p>
          </div>
          <button type="button" onClick={() => navigate("appointments")}>
            Open appointments →
          </button>
        </div>
        <div className="appointment-overview-stats">
          <div><strong>{todayAppointments.length}</strong><span>Today</span></div>
          <div><strong>{pendingAppointments.length}</strong><span>Pending</span></div>
          <div><strong>{appointments.length}</strong><span>Total bookings</span></div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2>Quick access</h2>
            <p>
              Jump directly into your TAPX services.
            </p>
          </div>
        </div>

        {services.length > 0 ? (
          <div className="services-grid">
            {services.map((service) => (
              <button
                key={service.page}
                className="service-card"
                onClick={() =>
                  navigate(service.page)
                }
              >
                <div className="service-icon">
                  {service.icon}
                </div>

                <div className="service-content">
                  <strong>{service.title}</strong>
                  <span>
                    {service.description}
                  </span>
                </div>

                <span className="service-arrow">
                  →
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-services">
            <div className="empty-icon">✦</div>

            <h3>
              Your TAPX experience is active
            </h3>

            <p>
              Your core TAPX services are available.
              Additional modules will appear here
              when enabled for your business.
            </p>
          </div>
        )}
      </section>

      <section className="bottom-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Your TAPX services</h3>
              <p>
                Services currently enabled for your
                business.
              </p>
            </div>

            <span className="live-pill">
              ● LIVE
            </span>
          </div>

          {enabledPaidFeatures.length > 0 ? (
            <div className="feature-list">
              {enabledPaidFeatures.map(
                (feature) => (
                  <div
                    className="feature-row"
                    key={feature.id}
                  >
                    <div className="feature-icon">
                      {feature.icon || "✦"}
                    </div>

                    <div>
                      <strong>
                        {feature.name}
                      </strong>
                      <span>
                        {feature.description ||
                          "Enabled TAPX service"}
                      </span>
                    </div>

                    <span className="enabled">
                      Enabled
                    </span>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="panel-empty">
              No additional paid modules are
              currently enabled.
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Workspace health</h3>
              <p>
                Your TAPX environment at a glance.
              </p>
            </div>
          </div>

          <div className="health">
            <HealthRow
              label="Business profile"
              value={
                business.name
                  ? "Configured"
                  : "Needs setup"
              }
              good={Boolean(business.name)}
            />

            <HealthRow
              label="Customer experience"
              value="Active"
              good
            />

            <HealthRow
              label="Orders"
              value={
                hasOrders
                  ? "Connected"
                  : "Not enabled"
              }
              good={hasOrders}
            />

            <HealthRow
              label="Digital Menu"
              value={
                hasMenu
                  ? "Connected"
                  : "Not enabled"
              }
              good={hasMenu}
            />
          </div>
        </div>
      </section>

      <style jsx>{`
        .hero {
          min-height: 230px;
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 85% 20%,
              rgba(80, 103, 128, 0.42),
              transparent 34%
            ),
            linear-gradient(
              125deg,
              #101820,
              #202c39
            );
          color: white;
          padding: 42px 38px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
          overflow: hidden;
        }

        .eyebrow {
          color: #91a0b1;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.2em;
          margin-bottom: 18px;
        }

        h1 {
          margin: 0;
          font-size: clamp(32px, 4vw, 49px);
          line-height: 1.04;
          letter-spacing: -0.045em;
          font-weight: 650;
        }

        h1 span {
          color: #9ba5b1;
        }

        .hero p {
          color: #aeb8c4;
          margin: 16px 0 0;
          font-size: 14px;
        }

        .hero-status {
          width: 225px;
          min-width: 225px;
          padding: 19px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.06);
        }

        .hero-status span {
          color: #9ba9b8;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.15em;
        }

        .status-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          background: #5de19a;
          border-radius: 50%;
          margin-right: 7px;
          box-shadow: 0 0 0 4px rgba(93,225,154,0.08);
        }

        .hero-status strong {
          display: block;
          margin-top: 18px;
          font-size: 15px;
        }

        .hero-status small {
          display: block;
          color: #8290a0;
          margin-top: 5px;
          font-size: 11px;
        }

        .appointment-overview-card {
          margin-top: 15px;
          border: 1px solid #e5e8ec;
          border-radius: 20px;
          background: linear-gradient(135deg, #f7f9fb, #ffffff);
          padding: 22px 24px;
        }

        .appointment-overview-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .appointment-overview-top .eyebrow {
          margin-bottom: 7px;
        }

        .appointment-overview-top h2 {
          margin: 0;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .appointment-overview-top p {
          margin: 6px 0 0;
          color: #8993a0;
          font-size: 11px;
          line-height: 1.5;
        }

        .appointment-overview-top button {
          border: 0;
          border-radius: 11px;
          background: #151c24;
          color: white;
          padding: 11px 14px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .appointment-overview-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
          margin-top: 17px;
        }

        .appointment-overview-stats div {
          border-radius: 13px;
          background: rgba(255,255,255,0.72);
          border: 1px solid rgba(220,225,230,0.8);
          padding: 12px 14px;
        }

        .appointment-overview-stats strong {
          display: block;
          font-size: 20px;
          letter-spacing: -0.03em;
        }

        .appointment-overview-stats span {
          display: block;
          color: #8993a0;
          font-size: 9px;
          margin-top: 4px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 15px;
        }

        .section {
          margin-top: 38px;
        }

        .section-heading h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -0.02em;
        }

        .section-heading p {
          margin: 5px 0 0;
          color: #98a1ad;
          font-size: 13px;
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 13px;
          margin-top: 17px;
        }

        .service-card {
          min-height: 112px;
          border: 1px solid #e5e8ec;
          border-radius: 17px;
          background: white;
          padding: 18px;
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 14px;
          transition:
            transform 0.16s,
            box-shadow 0.16s,
            border-color 0.16s;
        }

        .service-card:hover {
          transform: translateY(-2px);
          border-color: #d4d9df;
          box-shadow:
            0 12px 30px rgba(16,24,40,0.07);
        }

        .service-icon {
          width: 45px;
          height: 45px;
          flex: 0 0 45px;
          border-radius: 13px;
          background: #f1f3f5;
          display: grid;
          place-items: center;
          font-size: 18px;
          color: #1b2733;
        }

        .service-content {
          flex: 1;
          min-width: 0;
        }

        .service-content strong {
          display: block;
          color: #111820;
          font-size: 14px;
          font-weight: 750;
        }

        .service-content span {
          display: block;
          color: #8993a0;
          font-size: 11px;
          line-height: 1.45;
          margin-top: 5px;
        }

        .service-arrow {
          color: #a1a9b4;
          font-size: 18px;
        }

        .empty-services {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 18px;
          padding: 42px 25px;
          text-align: center;
          margin-top: 17px;
        }

        .empty-icon {
          width: 45px;
          height: 45px;
          border-radius: 14px;
          background: #f1f3f5;
          display: grid;
          place-items: center;
          margin: 0 auto 13px;
        }

        .empty-services h3 {
          margin: 0;
          font-size: 16px;
        }

        .empty-services p {
          max-width: 450px;
          margin: 8px auto 0;
          color: #8b95a1;
          font-size: 12px;
          line-height: 1.6;
        }

        .bottom-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 15px;
          margin-top: 15px;
        }

        .panel {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 18px;
          padding: 22px;
        }

        .panel-heading {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .panel-heading h3 {
          margin: 0;
          font-size: 15px;
        }

        .panel-heading p {
          margin: 5px 0 0;
          color: #929ba7;
          font-size: 11px;
        }

        .live-pill {
          color: #27774a;
          background: #edf8f1;
          padding: 6px 9px;
          border-radius: 99px;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.08em;
        }

        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .feature-row {
          display: flex;
          align-items: center;
          gap: 11px;
          border-top: 1px solid #f0f1f3;
          padding: 11px 0;
        }

        .feature-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: #f3f4f6;
          display: grid;
          place-items: center;
          font-size: 14px;
        }

        .feature-row > div:nth-child(2) {
          flex: 1;
        }

        .feature-row strong {
          display: block;
          font-size: 12px;
        }

        .feature-row span {
          display: block;
          color: #929ba7;
          font-size: 10px;
          margin-top: 3px;
        }

        .feature-row .enabled {
          color: #287548;
          background: #edf8f1;
          padding: 5px 8px;
          border-radius: 99px;
          font-size: 9px;
          font-weight: 700;
        }

        .panel-empty {
          padding: 25px 5px;
          color: #929ba7;
          font-size: 12px;
        }

        .health {
          border-top: 1px solid #f0f1f3;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .services-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 800px) {
          .appointment-overview-top {
            align-items: flex-start;
            flex-direction: column;
          }

          .appointment-overview-top button {
            width: 100%;
          }

          .hero {
            padding: 30px 25px;
          }

          .hero-status {
            display: none;
          }

          .bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .hero {
            min-height: 200px;
            border-radius: 19px;
            padding: 27px 22px;
          }

          h1 {
            font-size: 30px;
          }

          .stats {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .services-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon">{icon}</div>
        <span>{label}</span>
      </div>

      <strong>{value}</strong>

      <small>{note}</small>

      <style jsx>{`
        .stat-card {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 17px;
          padding: 19px;
          min-height: 140px;
        }

        .stat-top {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #8993a0;
          font-size: 11px;
        }

        .stat-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: #f1f3f5;
          color: #334155;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 800;
        }

        strong {
          display: block;
          margin-top: 17px;
          font-size: 28px;
          line-height: 1;
          letter-spacing: -0.035em;
        }

        small {
          display: block;
          color: #9aa2ad;
          margin-top: 10px;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}

function HealthRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="health-row">
      <div className="health-dot">
        {good ? "✓" : "–"}
      </div>

      <span>{label}</span>

      <strong className={good ? "good" : ""}>
        {value}
      </strong>

      <style jsx>{`
        .health-row {
          min-height: 53px;
          border-bottom: 1px solid #f0f1f3;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .health-dot {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          background: #f2f4f6;
          display: grid;
          place-items: center;
          color: #687384;
          font-size: 11px;
        }

        .health-row span {
          flex: 1;
          font-size: 12px;
          color: #475467;
        }

        .health-row strong {
          font-size: 10px;
          color: #98a1ad;
        }

        .health-row strong.good {
          color: #287548;
        }
      `}</style>
    </div>
  );
}

function AppointmentsPage({
  appointments,
  selectedAppointment,
  setSelectedAppointment,
  updateAppointmentStatus,
  updatingAppointmentId,
  isSalon,
}: {
  appointments: Appointment[];
  selectedAppointment: Appointment | null;
  setSelectedAppointment: (appointment: Appointment | null) => void;
  updateAppointmentStatus: (
    id: string,
    status: AppointmentStatus
  ) => Promise<void>;
  updatingAppointmentId: string | null;
  isSalon: boolean;
}) {
  const [filter, setFilter] = useState<
    "all" | "today" | "upcoming" | "pending" | "completed"
  >("all");
  const [search, setSearch] = useState("");

  const today = todayDateString();

  const visibleAppointments = appointments.filter((appointment) => {
    if (filter === "today" && appointment.appointment_date !== today) {
      return false;
    }

    if (
      filter === "upcoming" &&
      (appointment.appointment_date < today ||
        ["cancelled", "no_show", "completed"].includes(appointment.status))
    ) {
      return false;
    }

    if (filter === "pending" && appointment.status !== "pending") {
      return false;
    }

    if (filter === "completed" && appointment.status !== "completed") {
      return false;
    }

    const query = search.trim().toLowerCase();

    if (query) {
      const text = [
        appointment.customer_name,
        appointment.customer_phone,
        appointment.service_name,
        appointment.notes || "",
      ]
        .join(" ")
        .toLowerCase();

      if (!text.includes(query)) return false;
    }

    return true;
  });

  const todayCount = appointments.filter(
    (appointment) => appointment.appointment_date === today
  ).length;

  const pendingCount = appointments.filter(
    (appointment) => appointment.status === "pending"
  ).length;

  const confirmedCount = appointments.filter(
    (appointment) => appointment.status === "confirmed"
  ).length;

  const completedCount = appointments.filter(
    (appointment) => appointment.status === "completed"
  ).length;

  return (
    <div className={`appointments-page ${isSalon ? "salon-appointments" : ""}`}>
      <div className="appointments-header">
        <div>
          <div className="eyebrow">BOOKING MANAGEMENT</div>
          <h1>{isSalon ? "Your appointments" : "Appointments"}</h1>
          <p>
            {isSalon
              ? "A calm, organized view of every client booking and your daily schedule."
              : "Manage customer bookings and keep your schedule organized."}
          </p>
        </div>

        <div className="appointments-live">
          <span /> LIVE SCHEDULE
        </div>
      </div>

      <div className="appointment-stats">
        <div className="appointment-stat featured">
          <span>Today</span>
          <strong>{todayCount}</strong>
          <small>Bookings scheduled</small>
        </div>
        <div className="appointment-stat">
          <span>Pending</span>
          <strong>{pendingCount}</strong>
          <small>Need confirmation</small>
        </div>
        <div className="appointment-stat">
          <span>Confirmed</span>
          <strong>{confirmedCount}</strong>
          <small>Upcoming clients</small>
        </div>
        <div className="appointment-stat">
          <span>Completed</span>
          <strong>{completedCount}</strong>
          <small>Finished appointments</small>
        </div>
      </div>

      <div className="appointment-toolbar">
        <div className="appointment-filters">
          {(
            [
              ["all", "All"],
              ["today", "Today"],
              ["upcoming", "Upcoming"],
              ["pending", "Pending"],
              ["completed", "Completed"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customer or service..."
        />
      </div>

      <div className="appointment-list">
        {visibleAppointments.length === 0 ? (
          <div className="appointment-empty">
            <div className="appointment-empty-icon">◷</div>
            <h3>No appointments found</h3>
            <p>
              {appointments.length === 0
                ? "Bookings made through your TAPX customer experience will appear here."
                : "Try another filter or search term."}
            </p>
          </div>
        ) : (
          visibleAppointments.map((appointment) => (
            <button
              key={appointment.id}
              type="button"
              className="appointment-row"
              onClick={() => setSelectedAppointment(appointment)}
            >
              <div className="appointment-date-block">
                <strong>{formatAppointmentDate(appointment.appointment_date).split(" ")[0]}</strong>
                <span>{formatAppointmentDate(appointment.appointment_date).split(" ").slice(1).join(" ")}</span>
              </div>

              <div className="appointment-time">
                <strong>{formatAppointmentTime(appointment.appointment_time)}</strong>
                <span>{appointment.duration_minutes} min</span>
              </div>

              <div className="appointment-customer">
                <strong>{appointment.customer_name}</strong>
                <span>{appointment.customer_phone}</span>
              </div>

              <div className="appointment-service">
                <strong>{appointment.service_name}</strong>
                {appointment.notes ? (
                  <span>{appointment.notes}</span>
                ) : (
                  <span>Tap for booking details</span>
                )}
              </div>

              <div className={`appointment-status status-${appointment.status}`}>
                {appointmentStatusLabel(appointment.status)}
              </div>

              <span className="appointment-arrow">→</span>
            </button>
          ))
        )}
      </div>

      {selectedAppointment && (
        <div
          className="appointment-modal-backdrop"
          onClick={() => setSelectedAppointment(null)}
        >
          <div
            className="appointment-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="appointment-modal-top">
              <div>
                <div className="eyebrow">BOOKING DETAILS</div>
                <h2>{selectedAppointment.customer_name}</h2>
                <p>
                  {formatAppointmentDate(selectedAppointment.appointment_date)} · {formatAppointmentTime(selectedAppointment.appointment_time)}
                </p>
              </div>

              <button
                type="button"
                className="appointment-close"
                onClick={() => setSelectedAppointment(null)}
              >
                ×
              </button>
            </div>

            <div className="appointment-detail-grid">
              <Detail
                label="Service"
                value={selectedAppointment.service_name}
              />
              <Detail
                label="Duration"
                value={`${selectedAppointment.duration_minutes} minutes`}
              />
              <Detail
                label="Phone"
                value={selectedAppointment.customer_phone}
              />
              <Detail
                label="Source"
                value={selectedAppointment.source_device_code || "TAPX"}
              />
            </div>

            {selectedAppointment.notes && (
              <div className="appointment-notes">
                <span>CLIENT NOTE</span>
                <p>{selectedAppointment.notes}</p>
              </div>
            )}

            <div className="appointment-contact-actions">
              <a href={`tel:${selectedAppointment.customer_phone}`}>
                Call client
              </a>
              <a
                href={`https://wa.me/${selectedAppointment.customer_phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </div>

            <div className="appointment-status-editor">
              <label>Update booking status</label>
              <select
                value={selectedAppointment.status}
                disabled={updatingAppointmentId === selectedAppointment.id}
                onChange={(event) =>
                  updateAppointmentStatus(
                    selectedAppointment.id,
                    event.target.value as AppointmentStatus
                  )
                }
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No-show</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .appointments-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .appointments-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .eyebrow {
          color: #98a1ad;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.18em;
          margin-bottom: 9px;
        }

        .appointments-header h1 {
          margin: 0;
          font-size: 34px;
          letter-spacing: -0.045em;
        }

        .appointments-header p {
          margin: 8px 0 0;
          color: #8b95a1;
          font-size: 13px;
          line-height: 1.5;
        }

        .appointments-live {
          display: flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #dfe7e2;
          background: #f4faf6;
          color: #287548;
          border-radius: 99px;
          padding: 8px 11px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        .appointments-live span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #4dc784;
        }

        .appointment-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .appointment-stat {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 17px;
          padding: 18px;
        }

        .appointment-stat.featured {
          background: #111820;
          border-color: #111820;
          color: white;
        }

        .appointment-stat span {
          color: #929ba7;
          font-size: 10px;
        }

        .appointment-stat.featured span {
          color: #aeb8c4;
        }

        .appointment-stat strong {
          display: block;
          margin-top: 11px;
          font-size: 27px;
          letter-spacing: -0.04em;
        }

        .appointment-stat small {
          display: block;
          color: #9ba4af;
          font-size: 9px;
          margin-top: 6px;
        }

        .appointment-toolbar {
          margin-top: 16px;
          padding: 10px;
          border: 1px solid #e5e8ec;
          border-radius: 15px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .appointment-filters {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        .appointment-filters button {
          border: 0;
          background: transparent;
          color: #7c8794;
          border-radius: 9px;
          padding: 8px 11px;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .appointment-filters button.active {
          background: #111820;
          color: white;
        }

        .appointment-toolbar input {
          width: 250px;
          height: 37px;
          border: 1px solid #e0e4e8;
          border-radius: 9px;
          padding: 0 11px;
          outline: none;
          color: #344054;
          font-size: 10px;
        }

        .appointment-toolbar input:focus {
          border-color: #b8bec6;
        }

        .appointment-list {
          margin-top: 13px;
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 18px;
          overflow: hidden;
        }

        .appointment-row {
          width: 100%;
          border: 0;
          border-bottom: 1px solid #eef0f2;
          background: white;
          padding: 17px 19px;
          display: grid;
          grid-template-columns: 80px 105px 1.2fr 1.3fr auto 18px;
          align-items: center;
          gap: 14px;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
        }

        .appointment-row:last-child {
          border-bottom: 0;
        }

        .appointment-row:hover {
          background: #fcfcfb;
        }

        .appointment-date-block strong {
          display: block;
          font-size: 19px;
          letter-spacing: -0.03em;
        }

        .appointment-date-block span,
        .appointment-time span,
        .appointment-customer span,
        .appointment-service span {
          display: block;
          color: #929ba7;
          font-size: 9px;
          margin-top: 4px;
        }

        .appointment-time strong,
        .appointment-customer strong,
        .appointment-service strong {
          display: block;
          color: #222b35;
          font-size: 11px;
        }

        .appointment-service span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .appointment-status {
          border-radius: 99px;
          padding: 6px 9px;
          font-size: 8px;
          font-weight: 800;
          white-space: nowrap;
          background: #f2f4f6;
          color: #667085;
        }

        .status-pending {
          background: #fff5e7;
          color: #9a6100;
        }

        .status-confirmed {
          background: #edf3ff;
          color: #315b9d;
        }

        .status-completed {
          background: #eaf8f1;
          color: #287548;
        }

        .status-cancelled,
        .status-no_show {
          background: #fff0f0;
          color: #ad3636;
        }

        .appointment-arrow {
          color: #a3aab3;
          font-size: 16px;
        }

        .appointment-empty {
          padding: 75px 20px;
          text-align: center;
        }

        .appointment-empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          margin: 0 auto 14px;
          background: #f2f4f6;
          display: grid;
          place-items: center;
          font-size: 20px;
        }

        .appointment-empty h3 {
          margin: 0;
          font-size: 16px;
        }

        .appointment-empty p {
          max-width: 390px;
          margin: 8px auto 0;
          color: #929ba7;
          font-size: 11px;
          line-height: 1.6;
        }

        .appointment-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(15, 23, 42, 0.42);
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .appointment-modal {
          width: min(590px, 100%);
          max-height: 90vh;
          overflow: auto;
          background: white;
          border-radius: 24px;
          padding: 26px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.18);
        }

        .appointment-modal-top {
          display: flex;
          justify-content: space-between;
          gap: 15px;
        }

        .appointment-modal-top h2 {
          margin: 0;
          font-size: 27px;
          letter-spacing: -0.035em;
        }

        .appointment-modal-top p {
          margin: 7px 0 0;
          color: #8b95a1;
          font-size: 11px;
        }

        .appointment-close {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 10px;
          background: #f2f4f6;
          color: #667085;
          font-size: 22px;
          cursor: pointer;
        }

        .appointment-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 22px;
        }

        .appointment-notes {
          margin-top: 14px;
          padding: 14px;
          border-radius: 13px;
          background: #fafbfc;
          border: 1px solid #edf0f2;
        }

        .appointment-notes span {
          color: #98a1ad;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.12em;
        }

        .appointment-notes p {
          margin: 7px 0 0;
          color: #475467;
          font-size: 11px;
          line-height: 1.6;
        }

        .appointment-contact-actions {
          display: flex;
          gap: 8px;
          margin-top: 15px;
        }

        .appointment-contact-actions a {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          border: 1px solid #dfe3e7;
          border-radius: 10px;
          color: #344054;
          text-decoration: none;
          font-size: 10px;
          font-weight: 700;
        }

        .appointment-status-editor {
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid #edf0f2;
        }

        .appointment-status-editor label {
          display: block;
          margin-bottom: 8px;
          color: #667085;
          font-size: 10px;
          font-weight: 700;
        }

        .appointment-status-editor select {
          width: 100%;
          height: 44px;
          border: 1px solid #dfe3e7;
          border-radius: 10px;
          background: white;
          padding: 0 11px;
          outline: none;
          font-size: 11px;
        }

        .salon-appointments .appointments-header h1 {
          font-family: Georgia, "Times New Roman", serif;
          font-weight: 500;
          font-size: 39px;
          letter-spacing: -0.035em;
          color: #35282c;
        }

        .salon-appointments .appointments-header p {
          color: #8d777c;
        }

        .salon-appointments .appointment-stat.featured {
          background: linear-gradient(135deg, #3b2a2f, #694c54);
        }

        .salon-appointments .appointment-filters button.active {
          background: #4b343b;
        }

        .salon-appointments .appointment-list {
          border-color: #eadfdd;
        }

        .salon-appointments .appointment-row:hover {
          background: #fffafa;
        }

        @media (max-width: 900px) {
          .appointment-stats {
            grid-template-columns: 1fr 1fr;
          }

          .appointment-row {
            grid-template-columns: 70px 90px 1fr auto 18px;
          }

          .appointment-service {
            display: none;
          }
        }

        @media (max-width: 650px) {
          .appointments-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .appointments-header h1,
          .salon-appointments .appointments-header h1 {
            font-size: 29px;
          }

          .appointment-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .appointment-toolbar input {
            width: 100%;
          }

          .appointment-row {
            grid-template-columns: 58px 1fr auto;
            gap: 10px;
            padding: 15px;
          }

          .appointment-date-block strong {
            font-size: 16px;
          }

          .appointment-customer {
            min-width: 0;
          }

          .appointment-customer strong {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .appointment-time {
            display: none;
          }

          .appointment-arrow {
            display: none;
          }

          .appointment-detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e8eaed",
        borderRadius: 13,
        padding: "13px 14px",
        background: "#fafbfc",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#98a1ad",
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          display: "block",
          marginTop: 6,
          color: "#344054",
          fontSize: 11,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function OrdersPage({
  orders,
  orderItems,
  selectedOrder,
  setSelectedOrder,
  updateOrderStatus,
  updatingOrderId,
}: {
  orders: Order[];
  orderItems: OrderItem[];
  selectedOrder: Order | null;
  setSelectedOrder: (
    order: Order | null
  ) => void;
  updateOrderStatus: (
    id: string,
    status: string
  ) => Promise<void>;
  updatingOrderId: string | null;
}) {
  return (
    <div className="orders-page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            SALES & OPERATIONS
          </div>

          <h1>Orders</h1>

          <p>
            Manage customer orders from your TAPX
            experience.
          </p>
        </div>

        <div className="orders-count">
          {orders.length} total orders
        </div>
      </div>

      <div className="order-stats">
        <MiniStat
          label="Pending"
          value={
            orders.filter(
              (o) => o.status === "pending"
            ).length
          }
        />

        <MiniStat
          label="Active"
          value={
            orders.filter((o) =>
              [
                "accepted",
                "preparing",
                "ready",
              ].includes(o.status)
            ).length
          }
        />

        <MiniStat
          label="Completed"
          value={
            orders.filter((o) =>
              [
                "completed",
                "served",
              ].includes(o.status)
            ).length
          }
        />
      </div>

      <div className="orders-table-wrap">
        {orders.length === 0 ? (
          <div className="orders-empty">
            <div>▣</div>
            <h3>No orders yet</h3>
            <p>
              Customer orders will appear here when
              they order through your TAPX
              experience.
            </p>
          </div>
        ) : (
          <div className="orders-table">
            <div className="table-header">
              <span>ORDER</span>
              <span>CUSTOMER</span>
              <span>TABLE</span>
              <span>TIME</span>
              <span>TOTAL</span>
              <span>STATUS</span>
            </div>

            {orders.map((order) => (
              <button
                className="order-row"
                key={order.id}
                onClick={() =>
                  setSelectedOrder(order)
                }
              >
                <span>
                  <strong>
                    #{order.id.slice(0, 8)}
                  </strong>
                </span>

                <span>
                  {order.customer_name ||
                    "Customer"}
                </span>

                <span>
                  {order.table_number
                    ? `Table ${order.table_number}`
                    : "—"}
                </span>

                <span>
                  {formatDateTime(
                    order.created_at
                  )}
                </span>

                <span>
                  {formatCurrency(order.total)}
                </span>

                <span>
                  <StatusBadge
                    status={order.status}
                  />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedOrder && (
        <div
          className="modal-backdrop"
          onClick={() =>
            setSelectedOrder(null)
          }
        >
          <div
            className="order-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-top">
              <div>
                <div className="eyebrow">
                  ORDER DETAILS
                </div>

                <h2>
                  #{selectedOrder.id.slice(
                    0,
                    8
                  )}
                </h2>
              </div>

              <button
                className="close-button"
                onClick={() =>
                  setSelectedOrder(null)
                }
              >
                ×
              </button>
            </div>

            <div className="customer-summary">
              <div>
                <span>Customer</span>
                <strong>
                  {selectedOrder.customer_name ||
                    "Customer"}
                </strong>
              </div>

              <div>
                <span>Table</span>
                <strong>
                  {selectedOrder.table_number
                    ? `Table ${selectedOrder.table_number}`
                    : "—"}
                </strong>
              </div>

              <div>
                <span>Total</span>
                <strong>
                  {formatCurrency(
                    selectedOrder.total
                  )}
                </strong>
              </div>
            </div>

            <div className="items-heading">
              Items
            </div>

            <div className="modal-items">
              {orderItems
                .filter(
                  (item) =>
                    item.order_id ===
                    selectedOrder.id
                )
                .map((item) => (
                  <div
                    className="modal-item"
                    key={item.id}
                  >
                    <div>
                      <strong>
                        {item.item_name}
                      </strong>
                      <span>
                        {item.quantity} ×{" "}
                        {formatCurrency(
                          item.unit_price
                        )}
                      </span>
                    </div>

                    <strong>
                      {formatCurrency(
                        item.line_total
                      )}
                    </strong>
                  </div>
                ))}

              {orderItems.filter(
                (item) =>
                  item.order_id ===
                  selectedOrder.id
              ).length === 0 && (
                <p className="no-items">
                  No item details available.
                </p>
              )}
            </div>

            <div className="status-section">
              <label>Update order status</label>

              <select
                value={selectedOrder.status}
                disabled={
                  updatingOrderId ===
                  selectedOrder.id
                }
                onChange={(event) =>
                  updateOrderStatus(
                    selectedOrder.id,
                    event.target.value
                  )
                }
              >
                {ORDER_STATUSES.map(
                  (status) => (
                    <option
                      value={status}
                      key={status}
                    >
                      {prettyName(status)}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-intro {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 22px;
        }

        .eyebrow {
          color: #98a1ad;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.18em;
          margin-bottom: 9px;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.04em;
        }

        .page-intro p {
          color: #8d96a2;
          font-size: 13px;
          margin: 8px 0 0;
        }

        .orders-count {
          color: #667085;
          font-size: 12px;
          background: white;
          border: 1px solid #e5e8ec;
          padding: 10px 13px;
          border-radius: 10px;
        }

        .order-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 13px;
          margin-bottom: 15px;
        }

        .orders-table-wrap {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 18px;
          overflow: hidden;
        }

        .orders-table {
          min-width: 850px;
        }

        .table-header,
        .order-row {
          display: grid;
          grid-template-columns:
            1fr 1.4fr 1fr 1.2fr 1fr 1fr;
          gap: 15px;
          align-items: center;
          padding: 15px 19px;
        }

        .table-header {
          color: #98a1ad;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.12em;
          background: #fafbfc;
          border-bottom: 1px solid #edf0f2;
        }

        .order-row {
          width: 100%;
          border: 0;
          border-bottom: 1px solid #f0f1f3;
          background: white;
          text-align: left;
          color: #475467;
          font-size: 11px;
          cursor: pointer;
        }

        .order-row:hover {
          background: #fafbfc;
        }

        .order-row:last-child {
          border-bottom: 0;
        }

        .order-row strong {
          color: #111820;
          font-size: 11px;
        }

        .orders-empty {
          text-align: center;
          padding: 70px 20px;
        }

        .orders-empty > div {
          width: 52px;
          height: 52px;
          margin: 0 auto 14px;
          border-radius: 15px;
          background: #f2f4f6;
          display: grid;
          place-items: center;
        }

        .orders-empty h3 {
          margin: 0;
          font-size: 16px;
        }

        .orders-empty p {
          max-width: 390px;
          margin: 8px auto 0;
          color: #929ba7;
          font-size: 12px;
          line-height: 1.6;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(15, 23, 42, 0.45);
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .order-modal {
          width: min(600px, 100%);
          max-height: 90vh;
          overflow: auto;
          background: white;
          border-radius: 22px;
          padding: 25px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.18);
        }

        .modal-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .modal-top h2 {
          margin: 0;
          font-size: 25px;
        }

        .close-button {
          width: 35px;
          height: 35px;
          border: 0;
          border-radius: 10px;
          background: #f2f4f6;
          cursor: pointer;
          font-size: 22px;
          color: #667085;
        }

        .customer-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
          margin-top: 22px;
        }

        .customer-summary > div {
          background: #f7f8fa;
          border-radius: 12px;
          padding: 13px;
        }

        .customer-summary span {
          display: block;
          color: #98a1ad;
          font-size: 9px;
        }

        .customer-summary strong {
          display: block;
          margin-top: 6px;
          font-size: 12px;
        }

        .items-heading {
          margin-top: 25px;
          font-size: 13px;
          font-weight: 750;
        }

        .modal-items {
          margin-top: 8px;
          border-top: 1px solid #edf0f2;
        }

        .modal-item {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 13px 0;
          border-bottom: 1px solid #edf0f2;
        }

        .modal-item strong {
          display: block;
          font-size: 12px;
        }

        .modal-item span {
          display: block;
          color: #98a1ad;
          font-size: 10px;
          margin-top: 4px;
        }

        .no-items {
          color: #98a1ad;
          font-size: 12px;
        }

        .status-section {
          margin-top: 24px;
        }

        .status-section label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .status-section select {
          width: 100%;
          height: 44px;
          border: 1px solid #dfe3e7;
          border-radius: 11px;
          background: white;
          padding: 0 12px;
          color: #344054;
          outline: none;
        }

        @media (max-width: 700px) {
          .page-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          h1 {
            font-size: 28px;
          }

          .order-stats {
            grid-template-columns: 1fr 1fr;
          }

          .orders-table-wrap {
            overflow-x: auto;
          }

          .customer-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>

      <style jsx>{`
        .mini-stat {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 15px;
          padding: 17px;
        }

        .mini-stat span {
          display: block;
          color: #929ba7;
          font-size: 10px;
        }

        .mini-stat strong {
          display: block;
          margin-top: 9px;
          font-size: 25px;
          letter-spacing: -0.03em;
        }
      `}</style>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = normalizeKey(status);

  const label =
    normalized.charAt(0).toUpperCase() +
    normalized.slice(1).replace(/_/g, " ");

  return (
    <span
      className={`status-badge status-${normalized}`}
    >
      {label}

      <style jsx>{`
        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 8px;
          border-radius: 99px;
          font-size: 9px;
          font-weight: 750;
          background: #f2f4f6;
          color: #667085;
          white-space: nowrap;
        }

        .status-pending {
          background: #fff5e7;
          color: #9a6100;
        }

        .status-accepted,
        .status-preparing {
          background: #edf3ff;
          color: #315b9d;
        }

        .status-ready {
          background: #eaf8f1;
          color: #287548;
        }

        .status-served,
        .status-completed {
          background: #eaf8f1;
          color: #287548;
        }

        .status-cancelled {
          background: #fff0f0;
          color: #ad3636;
        }
      `}</style>
    </span>
  );
}

function ModulePage({
  title,
  eyebrow,
  description,
  icon,
  items,
  status,
  emptyText,
}: {
  title: string;
  eyebrow: string;
  description: string;
  icon: string;
  items: string[];
  status: string;
  emptyText: string;
}) {
  return (
    <div className="module-page">
      <div className="module-hero">
        <div className="module-icon">{icon}</div>

        <div>
          <div className="eyebrow">
            {eyebrow}
          </div>

          <h1>{title}</h1>

          <p>{description}</p>
        </div>

        <span className="connected">
          ● {status}
        </span>
      </div>

      <div className="module-grid">
        {items.map((item) => (
          <div className="module-card" key={item}>
            <div className="check">✓</div>
            <strong>{item}</strong>
            <span>Available in your workspace</span>
          </div>
        ))}
      </div>

      <div className="module-note">
        <div className="note-icon">✦</div>
        <div>
          <strong>Connected to TAPX</strong>
          <p>{emptyText}</p>
        </div>
      </div>

      <style jsx>{`
        .module-page {
          max-width: 1100px;
          margin: 0 auto;
        }

        .module-hero {
          background: #111a23;
          color: white;
          border-radius: 22px;
          padding: 31px;
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .module-icon {
          width: 55px;
          height: 55px;
          border-radius: 15px;
          background: rgba(255,255,255,0.08);
          display: grid;
          place-items: center;
          font-size: 22px;
        }

        .eyebrow {
          color: #93a0ae;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.18em;
          margin-bottom: 8px;
        }

        h1 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.035em;
        }

        .module-hero p {
          color: #aab5c1;
          font-size: 12px;
          line-height: 1.55;
          margin: 8px 0 0;
        }

        .connected {
          margin-left: auto;
          align-self: flex-start;
          background: rgba(93,225,154,0.1);
          color: #76dba5;
          padding: 7px 10px;
          border-radius: 99px;
          font-size: 9px;
          white-space: nowrap;
        }

        .module-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 15px;
        }

        .module-card {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 16px;
          padding: 19px;
        }

        .check {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: #eef8f2;
          color: #2b7b4d;
          display: grid;
          place-items: center;
          font-size: 12px;
          margin-bottom: 16px;
        }

        .module-card strong {
          display: block;
          font-size: 13px;
        }

        .module-card span {
          display: block;
          color: #98a1ad;
          font-size: 10px;
          margin-top: 5px;
        }

        .module-note {
          margin-top: 15px;
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 17px;
          padding: 20px;
          display: flex;
          gap: 13px;
        }

        .note-icon {
          width: 37px;
          height: 37px;
          border-radius: 11px;
          background: #f2f4f6;
          display: grid;
          place-items: center;
        }

        .module-note strong {
          font-size: 13px;
        }

        .module-note p {
          color: #8d96a2;
          font-size: 11px;
          line-height: 1.55;
          margin: 5px 0 0;
        }

        @media (max-width: 800px) {
          .module-hero {
            align-items: flex-start;
            flex-wrap: wrap;
            padding: 25px;
          }

          .connected {
            margin-left: 0;
          }

          .module-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 550px) {
          .module-grid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 25px;
          }
        }
      `}</style>
    </div>
  );
}

function AnalyticsPage({
  orders,
  todayOrders,
  pendingOrders,
  completedOrders,
  todayRevenue,
  completedRevenue,
  enabledPaidFeatures,
}: {
  orders: Order[];
  todayOrders: Order[];
  pendingOrders: Order[];
  completedOrders: Order[];
  todayRevenue: number;
  completedRevenue: number;
  enabledPaidFeatures: Feature[];
}) {
  const averageOrderValue =
    completedOrders.length > 0
      ? completedRevenue /
        completedOrders.length
      : 0;

  return (
    <div className="analytics-page">
      <div className="analytics-intro">
        <div>
          <div className="eyebrow">
            BUSINESS PERFORMANCE
          </div>

          <h1>Analytics</h1>

          <p>
            A clear view of your TAPX business
            activity.
          </p>
        </div>
      </div>

      <div className="analytics-grid">
        <AnalyticsCard
          title="Today's revenue"
          value={formatCurrency(todayRevenue)}
          note="Completed and served orders"
        />

        <AnalyticsCard
          title="Today's orders"
          value={String(todayOrders.length)}
          note="Orders created today"
        />

        <AnalyticsCard
          title="Active orders"
          value={String(pendingOrders.length)}
          note="Orders requiring attention"
        />

        <AnalyticsCard
          title="Average order"
          value={formatCurrency(
            averageOrderValue
          )}
          note="Based on completed orders"
        />
      </div>

      <div className="analytics-panels">
        <div className="analytics-panel">
          <h3>Order performance</h3>

          <AnalyticsLine
            label="Total orders"
            value={orders.length}
          />

          <AnalyticsLine
            label="Completed"
            value={completedOrders.length}
          />

          <AnalyticsLine
            label="Active"
            value={pendingOrders.length}
          />
        </div>

        <div className="analytics-panel">
          <h3>Enabled services</h3>

          {enabledPaidFeatures.length === 0 ? (
            <p className="analytics-empty">
              No paid modules are currently enabled.
            </p>
          ) : (
            enabledPaidFeatures.map(
              (feature) => (
                <div
                  className="analytics-service"
                  key={feature.id}
                >
                  <span>
                    {feature.icon || "✦"}
                  </span>

                  <strong>
                    {feature.name}
                  </strong>

                  <em>Active</em>
                </div>
              )
            )
          )}
        </div>
      </div>

      <style jsx>{`
        .analytics-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .eyebrow {
          color: #98a1ad;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.18em;
          margin-bottom: 9px;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.04em;
        }

        .analytics-intro p {
          color: #8d96a2;
          font-size: 13px;
          margin: 8px 0 0;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 13px;
          margin-top: 24px;
        }

        .analytics-panels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 15px;
        }

        .analytics-panel {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 18px;
          padding: 22px;
        }

        .analytics-panel h3 {
          margin: 0 0 18px;
          font-size: 15px;
        }

        .analytics-service {
          min-height: 47px;
          border-top: 1px solid #f0f1f3;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .analytics-service > span {
          width: 29px;
          height: 29px;
          border-radius: 8px;
          background: #f2f4f6;
          display: grid;
          place-items: center;
          font-size: 12px;
        }

        .analytics-service strong {
          flex: 1;
          font-size: 11px;
        }

        .analytics-service em {
          color: #287548;
          font-size: 9px;
          font-style: normal;
          font-weight: 700;
        }

        .analytics-empty {
          color: #929ba7;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .analytics-grid {
            grid-template-columns: 1fr 1fr;
          }

          .analytics-panels {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 550px) {
          .analytics-grid {
            grid-template-columns: 1fr 1fr;
          }

          h1 {
            font-size: 28px;
          }
        }
      `}</style>
    </div>
  );
}

function AnalyticsCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="analytics-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>

      <style jsx>{`
        .analytics-card {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 17px;
          padding: 20px;
        }

        span {
          color: #8993a0;
          font-size: 10px;
        }

        strong {
          display: block;
          margin-top: 13px;
          font-size: 27px;
          letter-spacing: -0.035em;
        }

        small {
          display: block;
          color: #a0a7b1;
          margin-top: 8px;
          font-size: 9px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

function AnalyticsLine({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="analytics-line">
      <span>{label}</span>
      <strong>{value}</strong>

      <style jsx>{`
        .analytics-line {
          min-height: 49px;
          border-top: 1px solid #f0f1f3;
          display: flex;
          align-items: center;
        }

        .analytics-line span {
          flex: 1;
          color: #667085;
          font-size: 11px;
        }

        .analytics-line strong {
          font-size: 17px;
        }
      `}</style>
    </div>
  );
}

function SettingsPage({
  business,
  email,
}: {
  business: Business;
  email: string;
}) {
  return (
    <div className="settings-page">
      <div className="settings-intro">
        <div>
          <div className="eyebrow">
            BUSINESS CONFIGURATION
          </div>

          <h1>Settings</h1>

          <p>
            Your TAPX business information and
            account details.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-panel">
          <div className="settings-heading">
            <h3>Business profile</h3>
            <span>BUSINESS</span>
          </div>

          <SettingRow
            label="Business name"
            value={business.name}
          />

          <SettingRow
            label="Category"
            value={prettyName(
              business.category
            )}
          />

          <SettingRow
            label="Phone"
            value={business.phone || "Not configured"}
          />

          <SettingRow
            label="Email"
            value={
              business.email || "Not configured"
            }
          />

          <SettingRow
            label="Location"
            value={
              [
                business.address,
                business.city,
                business.state,
              ]
                .filter(Boolean)
                .join(", ") ||
              "Not configured"
            }
          />
        </div>

        <div className="settings-panel">
          <div className="settings-heading">
            <h3>Account</h3>
            <span>ACCESS</span>
          </div>

          <SettingRow
            label="Login email"
            value={email || "Authenticated account"}
          />

          <SettingRow
            label="Portal"
            value="TAPX Client Workspace"
          />

          <SettingRow
            label="Account status"
            value="Active"
            green
          />
        </div>
      </div>

      <style jsx>{`
        .settings-page {
          max-width: 1000px;
          margin: 0 auto;
        }

        .eyebrow {
          color: #98a1ad;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.18em;
          margin-bottom: 9px;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.04em;
        }

        .settings-intro p {
          color: #8d96a2;
          font-size: 13px;
          margin: 8px 0 0;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 25px;
        }

        .settings-panel {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 18px;
          padding: 22px;
        }

        .settings-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .settings-heading h3 {
          margin: 0;
          font-size: 15px;
        }

        .settings-heading span {
          color: #98a1ad;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.12em;
        }

        @media (max-width: 700px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 28px;
          }
        }
      `}</style>
    </div>
  );
}

function SettingRow({
  label,
  value,
  green,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <strong className={green ? "green" : ""}>
        {value}
      </strong>

      <style jsx>{`
        .setting-row {
          min-height: 53px;
          border-top: 1px solid #f0f1f3;
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .setting-row span {
          width: 120px;
          color: #98a1ad;
          font-size: 10px;
        }

        .setting-row strong {
          flex: 1;
          text-align: right;
          color: #344054;
          font-size: 11px;
          font-weight: 650;
        }

        .setting-row strong.green {
          color: #287548;
        }

        @media (max-width: 500px) {
          .setting-row {
            display: block;
            padding: 12px 0;
          }

          .setting-row span {
            display: block;
            width: auto;
          }

          .setting-row strong {
            display: block;
            text-align: left;
            margin-top: 5px;
          }
        }
      `}</style>
    </div>
  );
}