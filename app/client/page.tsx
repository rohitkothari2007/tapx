"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import QRCode from "qrcode";

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
  payment_url?: string | null;
  payment_enabled?: boolean | null;
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

type InteractionLog = {
  id: string;
  device_id: string | null;
  business_id: string | null;
  interaction_type: string | null;
  created_at: string;
  device_code: string | null;
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

type ClientDevice = {
  id: string;
  device_code: string;
  device_type: string | null;
  location: string | null;
  label: string | null;
  assigned_at: string | null;
  status: string | null;
  created_at?: string;
};

type PageKey =
  | "overview"
  | "devices"
  | "hotel_requests"
  | "orders"
  | "appointments"
  | "menu"
  | "offers"
  | "loyalty"
  | "feedback"
  | "analytics"
  | "settings";

type HotelRequestItem = {
  id: string;
  business_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  request_type: string;
  status: string;
  created_at: string;
  payload: {
    room_number?: string;
    notes?: string;
    items?: Array<{ name: string; quantity: number; price?: number }>;
    service_name?: string;
    total?: number;
  } | null;
};

type FeedbackItem = {
  id: string;
  business_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

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

  const [clientDevices, setClientDevices] = useState<ClientDevice[]>([]);
  const [deviceInteractions, setDeviceInteractions] = useState<Record<string, number>>({});
  const [rawInteractions, setRawInteractions] = useState<InteractionLog[]>([]);
  const [hotelRequests, setHotelRequests] = useState<HotelRequestItem[]>([]);
  const [customerFeedbackList, setCustomerFeedbackList] = useState<FeedbackItem[]>([]);
  const [showRequestDeviceModal, setShowRequestDeviceModal] = useState(false);
  const [requestNotes, setRequestNotes] = useState("");
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [requestDeviceType, setRequestDeviceType] = useState("NFC + QR");
  const [requestSending, setRequestSending] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState("");

  async function handleSendHardwareRequest() {
    if (!business) return;
    setRequestSending(true);
    setRequestSuccess("");
    try {
      const { error: err } = await supabase
        .from("customer_requests")
        .insert({
          business_id: business.id,
          customer_name: business.name,
          customer_phone: business.phone || business.email || null,
          request_type: "hardware_request",
          status: "pending",
          payload: {
            quantity: Number(requestQuantity) || 1,
            device_type: requestDeviceType,
            notes: requestNotes.trim(),
            requested_at: new Date().toISOString(),
          },
        });

      if (err) throw err;

      setRequestSuccess("Hardware request submitted successfully! TAPX Admin team will review and process your request.");
      setRequestNotes("");
    } catch (err: any) {
      console.error("Hardware request error:", err);
      alert("Unable to submit hardware request: " + (err.message || err));
    } finally {
      setRequestSending(false);
    }
  }

  async function handleUpdateHotelRequestStatus(requestId: string, nextStatus: string) {
    try {
      const { error: updateErr } = await supabase
        .from("customer_requests")
        .update({ status: nextStatus })
        .eq("id", requestId);

      if (updateErr) throw updateErr;

      setHotelRequests((curr) =>
        curr.map((r) => (r.id === requestId ? { ...r, status: nextStatus } : r))
      );
    } catch (err: any) {
      alert("Unable to update request status: " + (err.message || err));
    }
  }

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
        devicesResult,
        interactionsResult,
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

        supabase
          .from("devices")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false }),

        supabase
          .from("interactions")
          .select("id, device_id, business_id, interaction_type, created_at, device_code")
          .eq("business_id", businessId),
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

      // Process devices & interaction counts
      const loadedDevices = (devicesResult?.data || []) as ClientDevice[];
      setClientDevices(loadedDevices);

      const loadedInteractions = (interactionsResult?.data || []) as InteractionLog[];
      setRawInteractions(loadedInteractions);

      const deviceIdToCodeMap: Record<string, string> = {};
      loadedDevices.forEach((dev) => {
        if (dev.id && dev.device_code) {
          deviceIdToCodeMap[dev.id] = dev.device_code;
        }
      });

      const counts: Record<string, number> = {};
      loadedInteractions.forEach((t) => {
        const code = t.device_code || (t.device_id ? deviceIdToCodeMap[t.device_id] : null);
        if (code) {
          counts[code] = (counts[code] || 0) + 1;
        }
      });
      setDeviceInteractions(counts);

      // Safely fetch optional hotel requests & feedback
      try {
        const [hotelReqsRes, feedbackRes] = await Promise.all([
          supabase.from("customer_requests").select("*").eq("business_id", businessId).in("request_type", ["hotel_room_service", "hotel_service", "custom_guest_request"]).order("created_at", { ascending: false }),
          supabase.from("customer_feedback").select("*").eq("business_id", businessId).order("created_at", { ascending: false })
        ]);
        setHotelRequests((hotelReqsRes.data || []) as HotelRequestItem[]);
        setCustomerFeedbackList((feedbackRes.data || []) as FeedbackItem[]);
      } catch (err) {
        setHotelRequests([]);
        setCustomerFeedbackList([]);
      }

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

  const [highlightedWidgets, setHighlightedWidgets] = useState<Record<string, boolean>>({});

  const triggerHighlight = useCallback((key: string) => {
    setHighlightedWidgets((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setHighlightedWidgets((prev) => ({ ...prev, [key]: false }));
    }, 1800);
  }, []);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  // Realtime Push Subscriptions & Auto-polling for Client Portal
  useEffect(() => {
    if (!business?.id) return;

    const bId = business.id;
    const channel = supabase
      .channel(`client_realtime_${bId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "interactions", filter: `business_id=eq.${bId}` },
        (payload: any) => {
          triggerHighlight("taps");
          if (payload?.new) {
            const newLog = payload.new as InteractionLog;
            setRawInteractions((prev) => {
              if (prev.some((item) => item.id === newLog.id)) return prev;
              return [newLog, ...prev];
            });
          }
          loadPortal();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tapx_orders", filter: `business_id=eq.${bId}` },
        () => {
          triggerHighlight("orders");
          loadPortal();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tapx_appointments", filter: `business_id=eq.${bId}` },
        () => {
          triggerHighlight("appointments");
          loadPortal();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_feedback", filter: `business_id=eq.${bId}` },
        () => {
          triggerHighlight("feedback");
          loadPortal();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loyalty_rewards", filter: `business_id=eq.${bId}` },
        () => {
          triggerHighlight("loyalty");
          loadPortal();
        }
      )
      .subscribe();

    // 25-Second Auto-Polling Interval for Lower-Urgency Aggregates
    const interval = setInterval(() => {
      loadPortal();
    }, 25000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [business?.id, loadPortal, triggerHighlight]);

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
    "table ordering",
    "room_service",
    "room-service",
    "room service",
    "hotel_services",
    "hotel-services",
    "hotel services"
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

  const todayActionCounts = useMemo(() => {
    const today = new Date();
    const counts = {
      totalTaps: 0,
      googleReviewClicks: 0,
      instagramClicks: 0,
      whatsappClicks: 0,
      callClicks: 0,
      locationClicks: 0,
      paymentClicks: 0,
    };

    rawInteractions.forEach((item) => {
      if (!item.created_at) return;
      const date = new Date(item.created_at);
      const isToday =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

      if (!isToday) return;

      const type = (item.interaction_type || "").toLowerCase();
      if (type === "nfc_tap") {
        counts.totalTaps += 1;
      } else if (type === "google_review_click") {
        counts.googleReviewClicks += 1;
      } else if (type === "instagram_click") {
        counts.instagramClicks += 1;
      } else if (type === "whatsapp_click") {
        counts.whatsappClicks += 1;
      } else if (type === "call_click") {
        counts.callClicks += 1;
      } else if (type === "location_click") {
        counts.locationClicks += 1;
      } else if (type === "payment_click") {
        counts.paymentClicks += 1;
      }
    });

    return counts;
  }, [rawInteractions]);

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
      key: "devices" as PageKey,
      label: "My Devices",
      icon: "📱",
      show: true,
      badge: clientDevices.length > 0 ? clientDevices.length : undefined,
    },
    {
      key: "hotel_requests" as PageKey,
      label: "Hotel Requests",
      icon: "🏨",
      show:
        normalizeKey(business?.category).includes("hotel") ||
        hasModule("hotel_services", "room_service", "hotel_requests"),
      badge: hotelRequests.filter((r) => r.status === "pending").length || undefined,
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
              Business platform
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
          Workspace navigation
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

          {activePage === "devices" && (
            <ClientDevicesSection
              devices={clientDevices}
              interactions={deviceInteractions}
              highlightTaps={highlightedWidgets["taps"]}
              onRequestDevice={() => {
                setShowRequestDeviceModal(true);
                setRequestSuccess("");
              }}
            />
          )}

          {activePage === "hotel_requests" && (
            <HotelRequestsSection
              requests={hotelRequests}
              onUpdateStatus={handleUpdateHotelRequestStatus}
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
            <OffersPortalSection businessId={business.id} />
          )}

          {activePage === "loyalty" && hasLoyalty && (
            <LoyaltyPortalSection businessId={business.id} businessName={business.name} />
          )}

          {activePage === "feedback" && hasFeedback && (
            <FeedbackSection feedback={customerFeedbackList} />
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
              todayActionCounts={
                todayActionCounts
              }
            />
          )}

          {activePage === "settings" && (
            <SettingsPage
              business={business}
              email={currentUserEmail}
              onUpdateBusiness={(updated) => setBusiness(updated)}
            />
          )}
        </div>

        {/* HARDWARE REQUEST MODAL */}
        {showRequestDeviceModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                maxWidth: "500px",
                width: "100%",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "18px 24px",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                    Request Additional Devices
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Submit a hardware request to TAPX provisioning team.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestDeviceModal(false)}
                  style={{ border: "none", background: "transparent", fontSize: "22px", cursor: "pointer", color: "#64748b" }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: "20px" }}>
                {requestSuccess ? (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      color: "#15803d",
                      borderRadius: "12px",
                      padding: "16px",
                      fontSize: "13px",
                      lineHeight: 1.5,
                      fontWeight: 600,
                    }}
                  >
                    ✓ {requestSuccess}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Quantity Needed *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={requestQuantity}
                        onChange={(e) => setRequestQuantity(Math.max(1, Number(e.target.value)))}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          border: "1px solid #cbd5e1",
                          borderRadius: "9px",
                          padding: "10px 12px",
                          fontSize: "13px",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Hardware Form Factor *
                      </label>
                      <select
                        value={requestDeviceType}
                        onChange={(e) => setRequestDeviceType(e.target.value)}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          border: "1px solid #cbd5e1",
                          borderRadius: "9px",
                          padding: "10px 12px",
                          fontSize: "13px",
                          background: "white",
                        }}
                      >
                        <option value="NFC + QR">NFC + QR Standee/Card</option>
                        <option value="NFC">NFC Sticker/Tag</option>
                        <option value="QR">QR Code Standee</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Special Notes / Delivery Address
                      </label>
                      <textarea
                        rows={3}
                        value={requestNotes}
                        onChange={(e) => setRequestNotes(e.target.value)}
                        placeholder="e.g. Need 2 for front desk and 3 for outdoor dining tables."
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          border: "1px solid #cbd5e1",
                          borderRadius: "9px",
                          padding: "10px 12px",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  padding: "14px 24px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowRequestDeviceModal(false)}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "white",
                    borderRadius: "9px",
                    padding: "9px 16px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  {requestSuccess ? "Close" : "Cancel"}
                </button>

                {!requestSuccess && (
                  <button
                    type="button"
                    disabled={requestSending}
                    onClick={handleSendHardwareRequest}
                    style={{
                      border: "none",
                      background: "#2563eb",
                      color: "white",
                      borderRadius: "9px",
                      padding: "9px 18px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {requestSending ? "Submitting..." : "Submit Hardware Request"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
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
            Greetings,{" "}
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

      {hasAppointment && (
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
      )}

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
  todayActionCounts,
}: {
  orders: Order[];
  todayOrders: Order[];
  pendingOrders: Order[];
  completedOrders: Order[];
  todayRevenue: number;
  completedRevenue: number;
  enabledPaidFeatures: Feature[];
  todayActionCounts?: {
    totalTaps: number;
    googleReviewClicks: number;
    instagramClicks: number;
    whatsappClicks: number;
    callClicks: number;
    locationClicks: number;
    paymentClicks: number;
  };
}) {
  const averageOrderValue =
    completedOrders.length > 0
      ? completedRevenue /
        completedOrders.length
      : 0;

  const actionCounts = todayActionCounts || {
    totalTaps: 0,
    googleReviewClicks: 0,
    instagramClicks: 0,
    whatsappClicks: 0,
    callClicks: 0,
    locationClicks: 0,
    paymentClicks: 0,
  };

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

      <div className="analytics-today-actions" style={{ marginTop: "24px" }}>
        <div className="eyebrow">TODAY'S CUSTOMER ACTIONS</div>
        <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "2px 0 14px", color: "#0f172a" }}>
          Today's Action Summary
        </h2>
        <div className="analytics-actions-grid">
          <AnalyticsCard
            title="Total Taps"
            value={String(actionCounts.totalTaps)}
            note="NFC & QR page opens today"
          />
          <AnalyticsCard
            title="Google Review Clicks"
            value={String(actionCounts.googleReviewClicks)}
            note="Review us button clicks"
          />
          <AnalyticsCard
            title="Instagram Clicks"
            value={String(actionCounts.instagramClicks)}
            note="Instagram profile visits"
          />
          <AnalyticsCard
            title="WhatsApp Clicks"
            value={String(actionCounts.whatsappClicks)}
            note="WhatsApp chat starts"
          />
          <AnalyticsCard
            title="Calls"
            value={String(actionCounts.callClicks)}
            note="Direct phone call attempts"
          />
          <AnalyticsCard
            title="Location Views"
            value={String(actionCounts.locationClicks)}
            note="Map location views"
          />
          <AnalyticsCard
            title="Payment Attempts"
            value={String(actionCounts.paymentClicks)}
            note="Pay Now & UPI clicks"
          />
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

        .analytics-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 13px;
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
  onUpdateBusiness,
}: {
  business: Business;
  email: string;
  onUpdateBusiness?: (updated: Business) => void;
}) {
  const [name, setName] = useState(business.name || "");
  const [category, setCategory] = useState(business.category || "custom");
  const [phone, setPhone] = useState(business.phone || "");
  const [whatsappNumber, setWhatsappNumber] = useState(business.whatsapp_number || "");
  const [businessEmail, setBusinessEmail] = useState(business.email || "");
  const [address, setAddress] = useState(business.address || "");
  const [city, setCity] = useState(business.city || "");
  const [state, setState] = useState(business.state || "");
  const [googleReviewUrl, setGoogleReviewUrl] = useState(business.google_review_url || "");
  const [instagramUrl, setInstagramUrl] = useState(business.instagram_url || "");
  const [upiId, setUpiId] = useState(business.upi_id || "");
  const [paymentUrl, setPaymentUrl] = useState(business.payment_url || "");
  const [paymentEnabled, setPaymentEnabled] = useState(business.payment_enabled ?? true);
  const [logoUrl, setLogoUrl] = useState(business.logo_url || "");

  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");

  useEffect(() => {
    setName(business.name || "");
    setCategory(business.category || "custom");
    setPhone(business.phone || "");
    setWhatsappNumber(business.whatsapp_number || "");
    setBusinessEmail(business.email || "");
    setAddress(business.address || "");
    setCity(business.city || "");
    setState(business.state || "");
    setGoogleReviewUrl(business.google_review_url || "");
    setInstagramUrl(business.instagram_url || "");
    setUpiId(business.upi_id || "");
    setPaymentUrl(business.payment_url || "");
    setPaymentEnabled(business.payment_enabled ?? true);
    setLogoUrl(business.logo_url || "");
  }, [business]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedBanner(false);
    setErrorBanner("");

    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        phone: phone.trim() || null,
        whatsapp_number: whatsappNumber.trim() || null,
        email: businessEmail.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        google_review_url: googleReviewUrl.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        upi_id: upiId.trim() || null,
        payment_url: paymentUrl.trim() || null,
        payment_enabled: paymentEnabled,
        logo_url: logoUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("businesses")
        .update(payload)
        .eq("id", business.id)
        .select()
        .single();

      if (error) throw error;

      setSavedBanner(true);
      if (onUpdateBusiness && data) {
        onUpdateBusiness(data as Business);
      }
      setTimeout(() => setSavedBanner(false), 5000);
    } catch (err: any) {
      console.error("Error saving business profile:", err);
      setErrorBanner(err?.message || "Failed to update business profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="settings-page">
      <div className="settings-intro">
        <div>
          <div className="eyebrow">BUSINESS CONFIGURATION</div>
          <h1>Settings & Profile</h1>
          <p>Manage your business information, location details, review links, and payment methods.</p>
        </div>
        <button type="submit" disabled={saving} className="save-btn">
          {saving ? "Saving Changes..." : "Save Business Profile"}
        </button>
      </div>

      {savedBanner && (
        <div className="banner success-banner">
          ✓ Business profile updated successfully! All changes are live immediately across customer tap pages.
        </div>
      )}

      {errorBanner && (
        <div className="banner error-banner">
          ⚠️ {errorBanner}
        </div>
      )}

      <div className="settings-grid">
        {/* PANEL 1: GENERAL IDENTITY */}
        <div className="settings-panel">
          <div className="settings-heading">
            <h3>General Identity</h3>
            <span>PROFILE</span>
          </div>

          <div className="input-group">
            <label>Business Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Yuva Selection"
            />
          </div>

          <div className="input-group">
            <label>Business Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="restaurant">Restaurant & Dining</option>
              <option value="salon">Salon & Spa</option>
              <option value="hotel">Hotel & Resort</option>
              <option value="cafe">Cafe & Bakery</option>
              <option value="retail">Retail Store</option>
              <option value="healthcare">Healthcare & Clinic</option>
              <option value="real_estate">Real Estate</option>
              <option value="custom">Custom / Other</option>
            </select>
          </div>

          <div className="input-group">
            <label>Logo Image URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>

        {/* PANEL 2: CONTACT & CHANNELS */}
        <div className="settings-panel">
          <div className="settings-heading">
            <h3>Contact & Channels</h3>
            <span>COMMUNICATION</span>
          </div>

          <div className="input-group">
            <label>Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 07387879977"
            />
          </div>

          <div className="input-group">
            <label>WhatsApp Number</label>
            <input
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="e.g. 917387879977"
            />
          </div>

          <div className="input-group">
            <label>Public Business Email</label>
            <input
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              placeholder="contact@business.com"
            />
          </div>
        </div>

        {/* PANEL 3: LOCATION & REVIEWS */}
        <div className="settings-panel">
          <div className="settings-heading">
            <h3>Location & Reviews</h3>
            <span>MAPS & REVIEWS</span>
          </div>

          <div className="input-group">
            <label>Street Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Main Road Shrirampur, Near Mamta Sweets"
            />
          </div>

          <div className="grid-2">
            <div className="input-group">
              <label>City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Shrirampur"
              />
            </div>
            <div className="input-group">
              <label>State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
              />
            </div>
          </div>

          <div className="input-group">
            <label>Google Review Link</label>
            <input
              type="url"
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/CXrdGmw-RmMwEBM/review"
            />
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
              Paste your Google Business review link, not your Maps location link
            </span>
          </div>

          <div className="input-group">
            <label>Instagram Handle / Link</label>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/yourbusiness"
            />
          </div>
        </div>

        {/* PANEL 4: PAYMENTS & UPI */}
        <div className="settings-panel">
          <div className="settings-heading">
            <h3>Payments & UPI</h3>
            <span>TRANSACTIONS</span>
          </div>

          <div className="checkbox-group">
            <input
              type="checkbox"
              id="paymentEnabledToggle"
              checked={paymentEnabled}
              onChange={(e) => setPaymentEnabled(e.target.checked)}
            />
            <label htmlFor="paymentEnabledToggle">Enable Customer Payments on Tap Page</label>
          </div>

          <div className="input-group">
            <label>UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. yuvaselection@upi"
            />
          </div>

          <div className="input-group">
            <label>Payment Link / Portal URL</label>
            <input
              type="url"
              value={paymentUrl}
              onChange={(e) => setPaymentUrl(e.target.value)}
              placeholder="https://razorpay.me/@yuvaselection"
            />
          </div>

          <div className="input-group">
            <label>Account Login Email (Read Only)</label>
            <input type="text" disabled value={email || "Authenticated account"} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={saving} className="save-btn">
          {saving ? "Saving Changes..." : "Save Business Profile"}
        </button>
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

        .settings-intro {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .settings-intro p {
          color: #8d96a2;
          font-size: 13px;
          margin: 8px 0 0;
        }

        .save-btn {
          background: #0f172a;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);
        }

        .save-btn:hover {
          background: #1e293b;
          transform: translateY(-1px);
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .banner {
          padding: 14px 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          margin-top: 20px;
        }

        .success-banner {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .error-banner {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 25px;
        }

        .settings-panel {
          background: white;
          border: 1px solid #e5e8ec;
          border-radius: 18px;
          padding: 24px;
        }

        .settings-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
        }

        .settings-heading h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }

        .settings-heading span {
          color: #98a1ad;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.12em;
        }

        .input-group {
          margin-bottom: 16px;
        }

        .input-group:last-child {
          margin-bottom: 0;
        }

        .input-group label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 6px;
        }

        .input-group input,
        .input-group select {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-size: 13px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s ease;
          background: #f8fafc;
        }

        .input-group input:focus,
        .input-group select:focus {
          border-color: #0f172a;
          background: white;
        }

        .input-group input:disabled {
          background: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }

        .checkbox-group input {
          width: 16px;
          height: 16px;
          accent-color: #0f172a;
          cursor: pointer;
        }

        .checkbox-group label {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
          user-select: none;
        }

        @media (max-width: 700px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }

          .settings-intro {
            flex-direction: column;
            align-items: stretch;
          }

          .save-btn {
            width: 100%;
          }

        }
      `}</style>
    </form>
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

function ClientDevicesSection({
  devices,
  interactions,
  onRequestDevice,
  highlightTaps,
}: {
  devices: ClientDevice[];
  interactions: Record<string, number>;
  onRequestDevice: () => void;
  highlightTaps?: boolean;
}) {
  const activeCount = devices.filter((d) => d.status !== "inactive" && d.status !== "faulty").length;
  const totalTaps = Object.values(interactions).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* HEADER CARD */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "white",
          borderRadius: "20px",
          padding: "28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", color: "#60a5fa", marginBottom: "6px" }}>
            TAPX HARDWARE PORTAL
          </div>
          <h2 style={{ margin: 0, fontSize: "26px", fontWeight: 800 }}>My Assigned Devices ({devices.length})</h2>
          <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: "14px" }}>
            Physical NFC cards, standees, and QR points configured for your business.
          </p>
        </div>

        <button
          type="button"
          onClick={onRequestDevice}
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "12px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
          }}
        >
          + Request Additional Devices
        </button>
      </div>

      {/* STATS METRICS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div style={clientMetricCard}>
          <div style={clientMetricLabel}>Total Devices</div>
          <div style={clientMetricValue}>{devices.length}</div>
          <div style={clientMetricSub}>Configured NFC/QR endpoints</div>
        </div>

        <div style={clientMetricCard}>
          <div style={clientMetricLabel}>Active Devices</div>
          <div style={{ ...clientMetricValue, color: "#16a34a" }}>{activeCount}</div>
          <div style={clientMetricSub}>Live & accepting taps</div>
        </div>

        <div
          style={{
            ...clientMetricCard,
            transition: "all 0.5s ease",
            ...(highlightTaps
              ? {
                  borderColor: "#f59e0b",
                  background: "#fffbeb",
                  boxShadow: "0 0 18px rgba(245, 158, 11, 0.35)",
                  transform: "scale(1.02)",
                }
              : {}),
          }}
        >
          <div style={clientMetricLabel}>Total Customer Taps</div>
          <div style={{ ...clientMetricValue, color: highlightTaps ? "#d97706" : "#2563eb" }}>{totalTaps}</div>
          <div style={clientMetricSub}>
            {highlightTaps ? "⚡ Live tap update received!" : "Recorded NFC & QR interactions"}
          </div>
        </div>
      </div>

      {/* DEVICES LIST */}
      {devices.length === 0 ? (
        <div style={{ background: "white", borderRadius: "16px", padding: "40px 20px", textAlign: "center", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📡</div>
          <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>No Devices Assigned</h3>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "13px" }}>
            You do not have any physical TAPX devices assigned yet. Contact your admin or click below to request hardware.
          </p>
          <button
            type="button"
            onClick={onRequestDevice}
            style={{ background: "#0f172a", color: "white", border: "none", borderRadius: "10px", padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}
          >
            Request TAPX Hardware
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
          {devices.map((device) => (
            <DeviceCardItem key={device.id} device={device} tapCount={interactions[device.device_code] || 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceCardItem({ device, tapCount }: { device: ClientDevice; tapCount: number }) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const customerUrl = typeof window !== "undefined" ? `${window.location.origin}/tap/${device.device_code}` : `/tap/${device.device_code}`;

  useEffect(() => {
    QRCode.toDataURL(customerUrl, { width: 400, margin: 2 })
      .then(setQrUrl)
      .catch(console.error);
  }, [customerUrl]);

  function copyUrl() {
    navigator.clipboard.writeText(customerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadQr() {
    if (!qrUrl) return;
    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `${device.label || device.device_code}_QR.png`.toLowerCase().replace(/[\s/]+/g, "_");
    link.click();
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: "16px",
        border: "1px solid #e2e8f0",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        boxShadow: "0 4px 15px rgba(0, 0, 0, 0.02)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
              {device.label || device.device_code}
            </span>
            {device.label && (
              <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                {device.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#64748b", marginTop: "4px" }}>
            Code: {device.device_code} • {device.device_type || "NFC + QR"}
          </div>
        </div>

        <span
          style={{
            background: device.status === "inactive" ? "#f1f5f9" : "#dcfce7",
            color: device.status === "inactive" ? "#64748b" : "#15803d",
            padding: "4px 10px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 800,
          }}
        >
          {device.status || "Active"}
        </span>
      </div>

      {/* QR PREVIEW & TAPS */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "#f8fafc", padding: "14px", borderRadius: "12px" }}>
        {qrUrl ? (
          <img src={qrUrl} alt="QR Code" style={{ width: "90px", height: "90px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
        ) : (
          <div style={{ width: "90px", height: "90px", background: "#e2e8f0", borderRadius: "8px" }} />
        )}

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Recorded Customer Taps</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: "2px 0 4px" }}>{tapCount}</div>
          <button
            type="button"
            onClick={downloadQr}
            style={{
              background: "white",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            📥 Download QR PNG
          </button>
        </div>
      </div>

      {/* URL BOX */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f1f5f9", padding: "8px 12px", borderRadius: "8px" }}>
        <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#334155", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {customerUrl}
        </span>
        <button
          type="button"
          onClick={copyUrl}
          style={{
            background: copied ? "#16a34a" : "#0f172a",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}

const clientMetricCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "20px",
};
const clientMetricLabel: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#64748b",
};
const clientMetricValue: React.CSSProperties = {
  fontSize: "30px",
  fontWeight: 800,
  color: "#0f172a",
  marginTop: "4px",
  lineHeight: 1,
};
const clientMetricSub: React.CSSProperties = {
  fontSize: "11px",
  color: "#94a3b8",
  marginTop: "6px",
};

/* =========================================================
   HOTEL REQUESTS PORTAL COMPONENT
========================================================= */

function HotelRequestsSection({
  requests,
  onUpdateStatus,
}: {
  requests: HotelRequestItem[];
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const inProgressCount = requests.filter((r) => r.status === "in_progress" || r.status === "accepted").length;

  const filtered = requests.filter((r) => {
    if (filter === "all") return true;
    if (filter === "pending") return r.status === "pending";
    if (filter === "in_progress") return r.status === "in_progress" || r.status === "accepted";
    if (filter === "completed") return r.status === "completed";
    if (filter === "cancelled") return r.status === "cancelled";
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* HEADER CARD */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
          color: "white",
          borderRadius: "20px",
          padding: "28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          boxShadow: "0 10px 30px rgba(49, 46, 129, 0.2)",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.12em", color: "#a5b4fc", marginBottom: "6px" }}>
            HOTEL GUEST DESK
          </div>
          <h2 style={{ margin: 0, fontSize: "26px", fontWeight: 800 }}>Room Service & Guest Requests ({requests.length})</h2>
          <p style={{ margin: "6px 0 0", color: "#c7d2fe", fontSize: "14px" }}>
            Live in-room requests submitted by hotel guests via TAPX NFC/QR devices.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 16px", borderRadius: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 800 }}>{pendingCount}</div>
            <div style={{ fontSize: "11px", color: "#c7d2fe" }}>Pending Action</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 16px", borderRadius: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#60a5fa" }}>{inProgressCount}</div>
            <div style={{ fontSize: "11px", color: "#c7d2fe" }}>In Progress</div>
          </div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
        {["all", "pending", "in_progress", "completed", "cancelled"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: filter === f ? "2px solid #4f46e5" : "1px solid #cbd5e1",
              background: filter === f ? "#e0e7ff" : "white",
              color: filter === f ? "#3730a3" : "#475569",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* REQUESTS LIST */}
      {filtered.length === 0 ? (
        <div style={{ background: "white", borderRadius: "16px", padding: "40px 20px", textAlign: "center", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>🛎️</div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>No Requests Found</h3>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>No guest service requests matching "{filter}".</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {filtered.map((req) => {
            const roomNum = req.payload?.room_number || "Guest Room";
            const items = req.payload?.items || [];
            const notes = req.payload?.notes || "";
            const total = req.payload?.total || 0;

            return (
              <div
                key={req.id}
                style={{
                  background: "white",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  padding: "20px",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.02)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ background: "#4f46e5", color: "white", padding: "4px 12px", borderRadius: "8px", fontWeight: 800, fontSize: "14px" }}>
                      Room {roomNum}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                      {req.customer_name || "Guest"} {req.customer_phone ? `(${req.customer_phone})` : ""}
                    </span>
                  </div>

                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
                    Requested {new Date(req.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} • {new Date(req.created_at).toLocaleDateString()}
                  </div>

                  {items.length > 0 && (
                    <div style={{ marginTop: "12px", background: "#f8fafc", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Requested Items:</div>
                      {items.map((it, idx) => (
                        <div key={idx} style={{ fontSize: "13px", color: "#0f172a" }}>
                          • {it.name} × {it.quantity} {it.price ? `(₹${it.price * it.quantity})` : ""}
                        </div>
                      ))}
                      {total > 0 && (
                        <div style={{ marginTop: "6px", fontSize: "13px", fontWeight: 800, color: "#16a34a" }}>
                          Total: ₹{total}
                        </div>
                      )}
                    </div>
                  )}

                  {notes && (
                    <div style={{ marginTop: "8px", fontSize: "13px", color: "#475569", fontStyle: "italic", background: "#fffbeb", padding: "8px 12px", borderRadius: "8px", border: "1px solid #fef3c7" }}>
                      Note: "{notes}"
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
                  <span
                    style={{
                      background:
                        req.status === "completed" ? "#dcfce7" : req.status === "in_progress" || req.status === "accepted" ? "#dbeafe" : req.status === "cancelled" ? "#fee2e2" : "#fef3c7",
                      color:
                        req.status === "completed" ? "#15803d" : req.status === "in_progress" || req.status === "accepted" ? "#1d4ed8" : req.status === "cancelled" ? "#991b1b" : "#b45309",
                      padding: "4px 12px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    {req.status.replace("_", " ")}
                  </span>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {req.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(req.id, "accepted")}
                        style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Accept Request
                      </button>
                    )}

                    {(req.status === "pending" || req.status === "accepted") && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(req.id, "in_progress")}
                        style={{ background: "#0284c7", color: "white", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                      >
                        In Progress
                      </button>
                    )}

                    {req.status !== "completed" && req.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(req.id, "completed")}
                        style={{ background: "#16a34a", color: "white", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                      >
                        ✓ Complete
                      </button>
                    )}

                    {req.status !== "completed" && req.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(req.id, "cancelled")}
                        style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   FEEDBACK DASHBOARD COMPONENT
========================================================= */

function FeedbackSection({ feedback }: { feedback: FeedbackItem[] }) {
  const total = feedback.length;
  const avgRating = total > 0 ? (feedback.reduce((sum, f) => sum + f.rating, 0) / total).toFixed(1) : "N/A";

  const ratingCounts = {
    5: feedback.filter((f) => f.rating === 5).length,
    4: feedback.filter((f) => f.rating === 4).length,
    3: feedback.filter((f) => f.rating === 3).length,
    2: feedback.filter((f) => f.rating === 2).length,
    1: feedback.filter((f) => f.rating === 1).length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* HEADER CARD */}
      <div style={{ background: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>Customer Feedback Dashboard</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", alignItems: "center" }}>
          <div style={{ textAlign: "center", background: "#f8fafc", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "40px", fontWeight: 800, color: "#f59e0b", lineHeight: 1 }}>{avgRating} ★</div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, marginTop: "6px" }}>Average Customer Rating</div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Based on {total} response(s)</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = ratingCounts[stars as keyof typeof ratingCounts];
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={stars} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
                  <span style={{ width: "40px", fontWeight: 700, color: "#475569" }}>{stars} ★</span>
                  <div style={{ flex: 1, background: "#f1f5f9", height: "8px", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, background: "#f59e0b", height: "100%", borderRadius: "999px" }} />
                  </div>
                  <span style={{ width: "30px", textAlign: "right", color: "#64748b", fontWeight: 700 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FEEDBACK LIST */}
      {total === 0 ? (
        <div style={{ background: "white", borderRadius: "16px", padding: "40px 20px", textAlign: "center", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>💬</div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>No Customer Feedback Yet</h3>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>Feedback submitted by customers via TAPX will appear here.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {feedback.map((item) => (
            <div key={item.id} style={{ background: "white", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                  {item.customer_name || "Anonymous Customer"} {item.customer_phone ? `(${item.customer_phone})` : ""}
                </div>
                <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: "14px" }}>
                  {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                </div>
              </div>
              {item.comment && (
                <div style={{ marginTop: "8px", fontSize: "13px", color: "#334155", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                  "{item.comment}"
                </div>
              )}
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "8px", textAlign: "right" }}>
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   LOYALTY PORTAL COMPONENT WITH MILESTONES & REWARDS
========================================================= */

function LoyaltyPortalSection({ businessId, businessName }: { businessId: string; businessName?: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [interval, setInterval] = useState<number>(5);
  const [rewardDesc, setRewardDesc] = useState<string>("10% off next visit");
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadLoyaltyData();
  }, [businessId]);

  async function loadLoyaltyData() {
    setLoading(true);
    try {
      // 1. Fetch Members
      const { data: memberData } = await supabase
        .from("loyalty_memberships")
        .select("id, customer_id, visits, redemption_count, reward_claimed, updated_at, customer:customers(name, phone)")
        .eq("business_id", businessId)
        .order("updated_at", { ascending: false });

      if (memberData) setMembers(memberData);

      // 2. Fetch Rewards
      const { data: rewardData } = await supabase
        .from("loyalty_rewards")
        .select("id, business_id, customer_id, membership_id, visit_count_at_reward, reward_description, status, created_at, customer:customers(name, phone)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (rewardData) setRewards(rewardData);

      // 3. Fetch Config
      const { data: cfgData } = await supabase
        .from("business_module_configs")
        .select("config")
        .eq("business_id", businessId)
        .eq("module_key", "loyalty")
        .maybeSingle();

      if (cfgData?.config) {
        const cfg = cfgData.config as any;
        if (cfg.milestone_interval) setInterval(Number(cfg.milestone_interval));
        if (cfg.milestone_reward) setRewardDesc(String(cfg.milestone_reward));
      }
    } catch (err) {
      console.error("Error loading loyalty data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSavingConfig(true);
    setMessage("");
    try {
      const { error } = await supabase
        .from("business_module_configs")
        .upsert(
          {
            business_id: businessId,
            feature_id: "loyalty",
            module_key: "loyalty",
            config: { milestone_interval: interval, milestone_reward: rewardDesc },
            status: "active",
          },
          { onConflict: "business_id,module_key" }
        );

      if (error) throw error;
      setMessage("✓ Loyalty milestone rules saved!");
    } catch (err: any) {
      setMessage(err?.message || "Failed to save config.");
    } finally {
      setSavingConfig(false);
    }
  }

  async function recordVisit(member: any) {
    setRecordingId(member.id);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("record_tapx_loyalty_visit", {
        p_business_id: businessId,
        p_customer_id: member.customer_id,
        p_membership_id: member.id,
        p_source: "owner_verified",
      });

      if (error) throw error;

      if (data?.reward_triggered) {
        setMessage(`🎉 Visit recorded for ${member.customer?.name || 'Customer'}! Milestone reward triggered!`);
      } else {
        setMessage(`✓ 1 Visit recorded for ${member.customer?.name || 'Customer'}.`);
      }

      await loadLoyaltyData();
    } catch (err: any) {
      setMessage(err?.message || "Failed to record visit.");
    } finally {
      setRecordingId(null);
    }
  }

  async function sendWhatsApp(reward: any) {
    const rawPhone = reward.customer?.phone?.replace(/\D/g, "") || "";
    const name = reward.customer?.name || "Valued Customer";
    const desc = reward.reward_description || "Special Reward";
    const visits = reward.visit_count_at_reward;
    const bName = businessName || "our business";

    const msg = `Hi ${name}! 🎉 You just hit visit #${visits} at ${bName} — thank you for being a regular! You've unlocked: ${desc}. Just show this message on your next visit to redeem it. See you soon!`;
    const phone = rawPhone ? (rawPhone.startsWith("91") ? rawPhone : `91${rawPhone}`) : "";
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

    window.open(waUrl, "_blank");

    try {
      await supabase.from("loyalty_rewards").update({ status: "sent" }).eq("id", reward.id);
      await loadLoyaltyData();
    } catch (e) {
      console.error(e);
    }
  }

  async function markRedeemed(reward: any) {
    try {
      await supabase.from("loyalty_rewards").update({ status: "redeemed" }).eq("id", reward.id);

      const membershipId = reward.membership_id;
      if (membershipId) {
        const { data: mem } = await supabase
          .from("loyalty_memberships")
          .select("redemption_count")
          .eq("id", membershipId)
          .maybeSingle();

        const currentRedemptions = Number((mem as any)?.redemption_count) || 0;

        await supabase
          .from("loyalty_memberships")
          .update({
            visits: 0,
            redemption_count: currentRedemptions + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", membershipId);
      } else if (reward.customer_id && businessId) {
        const { data: mem } = await supabase
          .from("loyalty_memberships")
          .select("id, redemption_count")
          .eq("business_id", businessId)
          .eq("customer_id", reward.customer_id)
          .maybeSingle();

        if (mem?.id) {
          const currentRedemptions = Number((mem as any)?.redemption_count) || 0;
          await supabase
            .from("loyalty_memberships")
            .update({
              visits: 0,
              redemption_count: currentRedemptions + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", mem.id);
        }
      }

      await loadLoyaltyData();
    } catch (e) {
      console.error("Error marking reward redeemed:", e);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* HEADER CARD */}
      <div style={{ background: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>Customer Loyalty & Rewards</h2>
        <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
          Track customer visits, configure automatic milestone rewards, and issue WhatsApp notifications.
        </p>
      </div>

      {message && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "12px 16px", borderRadius: "10px", fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* MILESTONE CONFIG CARD */}
      <div style={{ background: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>⚙ Loyalty Milestone Rules</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
              Milestone Interval (Visits)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value) || 5)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
            />
            <span style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", display: "block" }}>e.g. 5 = reward triggered every 5th visit</span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
              Reward Description
            </label>
            <input
              type="text"
              value={rewardDesc}
              onChange={(e) => setRewardDesc(e.target.value)}
              placeholder="e.g. 10% off next visit"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
            />
            <span style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", display: "block" }}>Text sent to customer upon reaching milestone</span>
          </div>
        </div>

        <button
          type="button"
          onClick={saveConfig}
          disabled={savingConfig}
          style={{ padding: "10px 18px", background: "#0f172a", color: "white", border: "none", borderRadius: "8px", fontWeight: 700, cursor: savingConfig ? "not-allowed" : "pointer" }}
        >
          {savingConfig ? "Saving..." : "Save Milestone Rules"}
        </button>
      </div>

      {/* MILESTONES & REWARDS WIDGET */}
      <div style={{ background: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
          🎁 Triggered Milestone Rewards ({rewards.filter((r) => r.status !== "redeemed").length} Active)
        </h3>

        {rewards.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "14px", fontStyle: "italic" }}>
            No milestone rewards generated yet. Rewards auto-trigger when visit count reaches the milestone interval.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rewards.map((reward) => (
              <div
                key={reward.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  background: reward.status === "pending" ? "#fefce8" : reward.status === "sent" ? "#eff6ff" : "#f8fafc",
                  border: `1px solid ${reward.status === "pending" ? "#fef08a" : reward.status === "sent" ? "#bfdbfe" : "#e2e8f0"}`,
                  borderRadius: "12px",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "15px", color: "#0f172a" }}>{reward.customer?.name || "Customer"}</strong>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: reward.status === "pending" ? "#fef08a" : reward.status === "sent" ? "#dbeafe" : "#e2e8f0",
                        color: reward.status === "pending" ? "#854d0e" : reward.status === "sent" ? "#1e40af" : "#475569",
                      }}
                    >
                      {reward.status === "pending" ? "● Reward Ready" : reward.status === "sent" ? "✓ Sent via WhatsApp" : "✓ Redeemed"}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#475569", marginTop: "3px" }}>
                    Hit <strong>Visit #{reward.visit_count_at_reward}</strong> • Reward: <em>"{reward.reward_description}"</em>
                  </div>
                  {reward.customer?.phone && <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>Mobile: {reward.customer.phone}</div>}
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {reward.status !== "redeemed" && (
                    <button
                      type="button"
                      onClick={() => sendWhatsApp(reward)}
                      style={{ padding: "8px 14px", background: "#16a34a", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      📲 Send via WhatsApp
                    </button>
                  )}
                  {reward.status !== "redeemed" && (
                    <button
                      type="button"
                      onClick={() => markRedeemed(reward)}
                      style={{ padding: "8px 14px", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >
                      ✓ Mark Redeemed
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MEMBERS & VISITS LIST */}
      <div style={{ background: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>👥 Loyalty Members & Visit Verification</h3>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer by name or mobile..."
          style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", marginBottom: "16px", boxSizing: "border-box" }}
        />

        {loading ? (
          <p style={{ color: "#64748b", fontSize: "14px" }}>Loading loyalty members...</p>
        ) : members.filter((m) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return m.customer?.name?.toLowerCase().includes(q) || m.customer?.phone?.toLowerCase().includes(q);
          }).length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "14px" }}>No loyalty members found.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {members
              .filter((m) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                return m.customer?.name?.toLowerCase().includes(q) || m.customer?.phone?.toLowerCase().includes(q);
              })
              .map((member) => (
                <div key={member.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <div>
                    <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>{member.customer?.name || "Customer"}</strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>{member.customer?.phone || "No phone"}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 700 }}>
                        {member.visits} verified visit{member.visits === 1 ? "" : "s"}
                      </span>
                      <span style={{ fontSize: "12px", color: "#166534", background: "#f0fdf4", padding: "2px 8px", borderRadius: "12px", border: "1px solid #bbf7d0", fontWeight: 700 }}>
                        🏆 {member.redemption_count || 0} reward{(member.redemption_count || 0) === 1 ? "" : "s"} redeemed all-time
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => recordVisit(member)}
                    disabled={recordingId === member.id}
                    style={{ padding: "8px 14px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: recordingId === member.id ? "not-allowed" : "pointer", opacity: recordingId === member.id ? 0.6 : 1 }}
                  >
                    {recordingId === member.id ? "Recording..." : "+ Record Visit"}
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   OFFERS & PROMOTIONS MANAGEMENT SECTION
========================================================= */

function OffersPortalSection({ businessId }: { businessId: string }) {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Form fields
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [activeTimeStart, setActiveTimeStart] = useState("");
  const [activeTimeEnd, setActiveTimeEnd] = useState("");

  const daysOfWeek = [
    { key: "mon", label: "Mon" },
    { key: "tue", label: "Tue" },
    { key: "wed", label: "Wed" },
    { key: "thu", label: "Thu" },
    { key: "fri", label: "Fri" },
    { key: "sat", label: "Sat" },
    { key: "sun", label: "Sun" },
  ];

  useEffect(() => {
    loadOffers();
  }, [businessId]);

  async function loadOffers() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("business_module_configs")
        .select("config")
        .eq("business_id", businessId)
        .or("module_key.eq.offers,module_key.eq.offers_promotions")
        .maybeSingle();

      if (data?.config?.offers && Array.isArray(data.config.offers)) {
        setOffers(data.config.offers);
      } else {
        setOffers([]);
      }
    } catch (err) {
      console.error("Error loading offers:", err);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(offer: any) {
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const daysMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const currentDay = daysMap[now.getDay()];
    const currentHHMM = now.toTimeString().slice(0, 5);

    if (offer.start_date && todayYMD < offer.start_date) {
      return { label: "Scheduled", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" };
    }
    if (offer.end_date && todayYMD > offer.end_date) {
      return { label: "Expired", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
    }
    if (Array.isArray(offer.active_days) && offer.active_days.length > 0) {
      const normalizedDays = offer.active_days.map((d: any) => String(d).toLowerCase().trim().slice(0, 3));
      if (!normalizedDays.includes(currentDay)) {
        return { label: "Scheduled", color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
      }
    }
    if (offer.active_time_start && currentHHMM < offer.active_time_start) {
      return { label: "Scheduled", color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
    }
    if (offer.active_time_end && currentHHMM > offer.active_time_end) {
      return { label: "Scheduled", color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
    }

    return { label: "Live now", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" };
  }

  function openAddModal() {
    setEditId(null);
    setName("");
    setDescription("");
    setCode("");
    setDiscount("");
    setStartDate("");
    setEndDate("");
    setActiveDays([]);
    setActiveTimeStart("");
    setActiveTimeEnd("");
    setShowModal(true);
  }

  function openEditModal(offer: any) {
    setEditId(offer.id);
    setName(offer.name || offer.title || "");
    setDescription(offer.description || "");
    setCode(offer.code || "");
    setDiscount(offer.discount || "");
    setStartDate(offer.start_date || "");
    setEndDate(offer.end_date || "");
    setActiveDays(Array.isArray(offer.active_days) ? offer.active_days : []);
    setActiveTimeStart(offer.active_time_start || "");
    setActiveTimeEnd(offer.active_time_end || "");
    setShowModal(true);
  }

  function toggleDay(dayKey: string) {
    if (activeDays.includes(dayKey)) {
      setActiveDays(activeDays.filter((d) => d !== dayKey));
    } else {
      setActiveDays([...activeDays, dayKey]);
    }
  }

  async function saveOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setMessage("");

    try {
      const offerId = editId || `offer_${Date.now()}`;
      const newOfferObj = {
        id: offerId,
        name: name.trim(),
        title: name.trim(),
        description: description.trim(),
        code: code.trim() || undefined,
        discount: discount.trim() || undefined,
        start_date: startDate || null,
        end_date: endDate || null,
        active_days: activeDays,
        active_time_start: activeTimeStart || null,
        active_time_end: activeTimeEnd || null,
        updated_at: new Date().toISOString(),
      };

      let updatedOffers: any[];
      if (editId) {
        updatedOffers = offers.map((o) => (o.id === editId ? newOfferObj : o));
      } else {
        updatedOffers = [newOfferObj, ...offers];
      }

      const { data: existingRow } = await supabase
        .from("business_module_configs")
        .select("id, config")
        .eq("business_id", businessId)
        .or("module_key.eq.offers,module_key.eq.offers_promotions")
        .maybeSingle();

      const newConfig = {
        ...(existingRow?.config || {}),
        offers: updatedOffers,
      };

      if (existingRow) {
        await supabase
          .from("business_module_configs")
          .update({ config: newConfig, updated_at: new Date().toISOString() })
          .eq("id", existingRow.id);
      } else {
        await supabase.from("business_module_configs").insert({
          business_id: businessId,
          module_key: "offers_promotions",
          feature_id: "568117e0-e67b-43d3-a0d9-fbf9b6b4132d",
          config: newConfig,
          status: "active",
        });
      }

      setOffers(updatedOffers);
      setShowModal(false);
      setMessage("Offer saved successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      console.error("Error saving offer:", err);
      alert("Failed to save offer: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  }

  async function deleteOffer(id: string) {
    if (!confirm("Are you sure you want to delete this offer?")) return;
    try {
      const updatedOffers = offers.filter((o) => o.id !== id);
      const { data: existingRow } = await supabase
        .from("business_module_configs")
        .select("id, config")
        .eq("business_id", businessId)
        .or("module_key.eq.offers,module_key.eq.offers_promotions")
        .maybeSingle();

      if (existingRow) {
        await supabase
          .from("business_module_configs")
          .update({ config: { ...existingRow.config, offers: updatedOffers } })
          .eq("id", existingRow.id);
      }

      setOffers(updatedOffers);
    } catch (err) {
      console.error("Error deleting offer:", err);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#64748b" }}>CUSTOMER ENGAGEMENT</span>
          <h1 style={{ margin: "4px 0 0", fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>Offers & Scheduled Promotions</h1>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          style={{ padding: "10px 18px", background: "#2563eb", color: "white", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
        >
          + Create New Offer
        </button>
      </div>

      {message && (
        <div style={{ padding: "12px 16px", background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: "8px", fontSize: "14px", fontWeight: 600 }}>
          {message}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading offers...</p>
      ) : offers.length === 0 ? (
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "40px", textAlign: "center" }}>
          <p style={{ color: "#64748b", margin: 0, fontSize: "15px" }}>No offers created yet. Create time-bound or recurring promotions to engage your customers.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {offers.map((offer) => {
            const badge = getStatusBadge(offer);
            return (
              <div key={offer.id} style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "16px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>{offer.name || offer.title || "Untitled Offer"}</strong>
                    <span style={{ padding: "4px 10px", borderRadius: "20px", background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontSize: "12px", fontWeight: 700 }}>
                      ● {badge.label}
                    </span>
                  </div>

                  {offer.description && (
                    <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 12px", lineHeight: "1.4" }}>{offer.description}</p>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#475569", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                    <div>📅 <strong>Dates:</strong> {offer.start_date || "Anytime"} → {offer.end_date || "No expiry"}</div>
                    <div>🕒 <strong>Hours:</strong> {offer.active_time_start || "All day"} {offer.active_time_end ? `to ${offer.active_time_end}` : ""}</div>
                    {Array.isArray(offer.active_days) && offer.active_days.length > 0 && (
                      <div>🗓️ <strong>Days:</strong> {offer.active_days.join(", ").toUpperCase()}</div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                  <button
                    type="button"
                    onClick={() => openEditModal(offer)}
                    style={{ padding: "6px 12px", background: "#f1f5f9", color: "#334155", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOffer(offer.id)}
                    style={{ padding: "6px 12px", background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <form onSubmit={saveOffer} style={{ background: "white", borderRadius: "20px", padding: "24px", maxWidth: "540px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>{editId ? "Edit Offer" : "Create New Offer"}</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Offer Title *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Weekend Flash Sale 20% Off"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Valid on all orders above ₹500"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Start Date (Optional)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>End Date (Optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Active Days (Leave blank for all days)</label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {daysOfWeek.map((day) => {
                    const isSelected = activeDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: isSelected ? "1px solid #2563eb" : "1px solid #cbd5e1",
                          background: isSelected ? "#eff6ff" : "white",
                          color: isSelected ? "#2563eb" : "#475569",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Time Start (Optional)</label>
                  <input
                    type="time"
                    value={activeTimeStart}
                    onChange={(e) => setActiveTimeStart(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Time End (Optional)</label>
                  <input
                    type="time"
                    value={activeTimeEnd}
                    onChange={(e) => setActiveTimeEnd(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ padding: "10px 16px", background: "#f1f5f9", color: "#334155", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: "10px 18px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}
              >
                {saving ? "Saving..." : "Save Offer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}