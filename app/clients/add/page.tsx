"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import QRCode from "qrcode";
import ModuleConfigurator from "./ModuleConfigurator";

type Feature = {
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

type Device = {
  id: string;
  device_code: string;
  device_type: string | null;
  location: string | null;
  status: string | null;
  business_id: string | null;
};

type BusinessForm = {
  name: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  instagram_url: string;
  google_review_url: string;
  whatsapp_number: string;
  upi_id: string;
};

type ActivatedClient = {
  id: string;
  name: string;
  category: string;
  deviceCode: string;
  customerUrl: string;
  ownerEmail?: string;
  ownerAccessCreated?: boolean;
  qrDataUrl?: string;
};

const CATEGORIES = [
  {
    value: "retail",
    label: "Retail",
    icon: "🛍️",
    description: "Shops, stores, boutiques and retail businesses",
  },
  {
    value: "restaurant",
    label: "Restaurant",
    icon: "🍽️",
    description: "Restaurants and dining businesses",
  },
  {
    value: "cafe",
    label: "Café",
    icon: "☕",
    description: "Cafés, coffee shops and quick-service businesses",
  },
  {
    value: "hotel",
    label: "Hotel",
    icon: "🏨",
    description: "Hotels, resorts and guest properties",
  },
  {
    value: "salon",
    label: "Salon",
    icon: "💇",
    description: "Salons, spas and beauty businesses",
  },
  {
    value: "custom",
    label: "Custom",
    icon: "✨",
    description: "Custom business with flexible module selection",
  },
  {
    value: "general",
    label: "Other",
    icon: "🏢",
    description: "Other businesses and professional services",
  },
];

const EMPTY_FORM: BusinessForm = {
  name: "",
  category: "retail",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  instagram_url: "",
  google_review_url: "",
  whatsapp_number: "",
  upi_id: "",
};

export default function AddClientPage() {
  const router = useRouter();

  const [features, setFeatures] = useState<Feature[]>([]);
  const [recommendations, setRecommendations] = useState<
    Record<string, string[]>
  >({});
  const [devices, setDevices] = useState<Device[]>([]);

  const [form, setForm] = useState<BusinessForm>(EMPTY_FORM);

  const [selectedPaidFeatures, setSelectedPaidFeatures] = useState<string[]>(
    []
  );

  const [moduleConfigs, setModuleConfigs] = useState<
    Record<string, Record<string, any>>
  >({});

  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showPreview, setShowPreview] = useState(false);
  const [activatedClient, setActivatedClient] =
    useState<ActivatedClient | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPortal, setCopiedPortal] = useState(false);

  // =========================================================
  // LOAD TAPX ONBOARDING DATA
  // =========================================================

  useEffect(() => {
    loadOnboardingData();
  }, []);

  async function loadOnboardingData() {
    setLoading(true);
    setError("");

    try {
      const [
        featureResponse,
        recommendationResponse,
        deviceResponse,
      ] = await Promise.all([
        supabase
          .from("feature_catalog")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),

        supabase
          .from("feature_recommendations")
          .select(
            "business_category, feature_id, recommendation_priority"
          )
          .order("recommendation_priority", {
            ascending: true,
          }),

        // Load ALL devices.
        // We filter availability ourselves below.
        supabase
          .from("devices")
          .select("*")
          .order("created_at", {
            ascending: true,
          }),
      ]);

      if (featureResponse.error) {
        throw featureResponse.error;
      }

      if (recommendationResponse.error) {
        throw recommendationResponse.error;
      }

      if (deviceResponse.error) {
        throw deviceResponse.error;
      }

      setFeatures((featureResponse.data || []) as Feature[]);

      const grouped: Record<string, string[]> = {};

      (recommendationResponse.data || []).forEach((item) => {
        if (!grouped[item.business_category]) {
          grouped[item.business_category] = [];
        }

        grouped[item.business_category].push(item.feature_id);
      });

      setRecommendations(grouped);

      // =====================================================
      // AVAILABLE DEVICE LOGIC
      // =====================================================
      //
      // A device is available when:
      //
      // business_id === null
      // AND
      // status !== "inactive"
      //
      // This supports the TAPX lifecycle:
      //
      // available -> assigned/active -> available
      //
      const availableDevices = (
        (deviceResponse.data || []) as Device[]
      ).filter(
        (device) =>
          !device.business_id &&
          device.status !== "inactive"
      );

      setDevices(availableDevices);
    } catch (err) {
      console.error("TAPX onboarding loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load TAPX onboarding data."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // FEATURE GROUPS
  // =========================================================

  const coreFeatures = useMemo(() => {
    return features
      .filter((feature) => feature.is_core)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [features]);

  const recommendedFeatures = useMemo(() => {
    if (form.category === "custom") {
      return features
        .filter((feature) => feature.is_paid && !feature.is_core)
        .sort((a, b) => a.sort_order - b.sort_order);
    }

    const ids = recommendations[form.category] || [];

    const result: Feature[] = [];

    ids.forEach((id) => {
      const feature = features.find(
        (item) => item.id === id
      );

      if (
        feature &&
        feature.is_paid &&
        !feature.is_core
      ) {
        result.push(feature);
      }
    });

    return result;
  }, [features, recommendations, form.category]);

  const otherPaidFeatures = useMemo(() => {
    if (form.category === "custom") {
      return [];
    }

    const recommendedIds = new Set(
      recommendations[form.category] || []
    );

    return features
      .filter(
        (feature) =>
          feature.is_paid &&
          !feature.is_core &&
          !recommendedIds.has(feature.id)
      )
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [features, recommendations, form.category]);

  const selectedCategory =
    CATEGORIES.find(
      (category) => category.value === form.category
    ) || CATEGORIES[0];

  const selectedDevice = devices.find(
    (device) => device.id === selectedDeviceId
  );

  // =========================================================
  // FORM HELPERS
  // =========================================================

  function updateField(
    field: keyof BusinessForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  }

  function changeCategory(category: string) {
    setForm((current) => ({
      ...current,
      category,
    }));

    setSelectedPaidFeatures([]);
    setModuleConfigs({});
    setError("");
  }

  function togglePaidFeature(featureId: string) {
    setSelectedPaidFeatures((current) => {
      if (current.includes(featureId)) {
        setModuleConfigs((configs) => {
          const next = { ...configs };
          delete next[featureId];
          return next;
        });

        return current.filter((id) => id !== featureId);
      }

      setModuleConfigs((configs) => ({
        ...configs,
        [featureId]: configs[featureId] || {},
      }));

      return [...current, featureId];
    });

    setError("");
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  function validateBusinessForm() {
    if (!form.name.trim()) {
      return "Business name is required.";
    }

    if (!form.category) {
      return "Please select a business category.";
    }

    return "";
  }

  function validateActivation() {
    const businessError = validateBusinessForm();

    if (businessError) {
      return businessError;
    }

    if (devices.length === 0) {
      return (
        "No available TAPX device. " +
        "Go to Devices and register an available device first."
      );
    }

    if (!selectedDeviceId) {
      return "Please select a TAPX device before activating this client.";
    }

    return "";
  }

  // =========================================================
  // ACTIVATE CLIENT
  // =========================================================

  async function activateClient() {
    setError("");
    setSuccess("");
    setCopied(false);

    const validationError = validateActivation();

    if (validationError) {
      setError(validationError);
      return;
    }

    setActivating(true);

    try {
      // -----------------------------------------------------
      // STEP 1: CREATE BUSINESS
      // -----------------------------------------------------

      const {
        data: business,
        error: businessError,
      } = await supabase
        .from("businesses")
        .insert({
          name: form.name.trim(),
          category: form.category,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          instagram_url:
            form.instagram_url.trim() || null,
          google_review_url:
            form.google_review_url.trim() || null,
          whatsapp_number:
            form.whatsapp_number.trim() || null,
          upi_id: form.upi_id.trim() || null,
          payment_enabled:
            Boolean(form.upi_id.trim()),
          status: "active",
        })
        .select()
        .single();

      if (businessError) {
        throw new Error(
          `Unable to create business: ${businessError.message}`
        );
      }

      if (!business) {
        throw new Error(
          "Business was created but no business record was returned."
        );
      }

      // -----------------------------------------------------
      // STEP 2: ENABLE CORE FEATURES
      // -----------------------------------------------------

      const coreRows = coreFeatures.map((feature) => ({
        business_id: business.id,
        feature_id: feature.id,
        enabled: true,
        status: "active",
      }));

      // -----------------------------------------------------
      // STEP 3: ENABLE SELECTED PAID FEATURES
      // -----------------------------------------------------

      const paidRows = selectedPaidFeatures.map(
        (featureId) => ({
          business_id: business.id,
          feature_id: featureId,
          enabled: true,
          status: "active",
        })
      );

      const featureRows = [
        ...coreRows,
        ...paidRows,
      ];

      if (featureRows.length > 0) {
        const {
          error: featureError,
        } = await supabase
          .from("business_features")
          .insert(featureRows);

        if (featureError) {
          await supabase
            .from("businesses")
            .delete()
            .eq("id", business.id);

          throw new Error(
            `Unable to configure features: ${featureError.message}`
          );
        }
      }

      // -----------------------------------------------------
      // STEP 3B: SAVE PAID MODULE CONFIGURATIONS
      // -----------------------------------------------------

      const moduleConfigRows = selectedPaidFeatures
        .map((featureId) => {
          const feature = features.find(
            (item) => item.id === featureId
          );

          if (!feature) {
            return null;
          }

          return {
            business_id: business.id,
            feature_id: feature.id,
            module_key: feature.feature_key,
            config: moduleConfigs[feature.id] || {},
            status: "active",
          };
        })
        .filter(
          (
            row
          ): row is NonNullable<typeof row> =>
            Boolean(row)
        );

      if (moduleConfigRows.length > 0) {
        const {
          error: moduleConfigError,
        } = await supabase
          .from("business_module_configs")
          .insert(moduleConfigRows);

        if (moduleConfigError) {
          await supabase
            .from("business_module_configs")
            .delete()
            .eq("business_id", business.id);

          await supabase
            .from("business_features")
            .delete()
            .eq("business_id", business.id);

          await supabase
            .from("businesses")
            .delete()
            .eq("id", business.id);

          throw new Error(
            `Unable to save module configuration: ${moduleConfigError.message}`
          );
        }
      }

      // -----------------------------------------------------
      // STEP 4: ASSIGN DEVICE
      // -----------------------------------------------------
      //
      // Device assignment is now REQUIRED.
      //
      // We update only if:
      // - selected device matches
      // - business_id is still NULL
      //
      // Then status becomes active.
      //

      if (!selectedDeviceId) {
        throw new Error(
          "No TAPX device was selected."
        );
      }

      const {
        data: device,
        error: deviceError,
      } = await supabase
        .from("devices")
        .update({
          business_id: business.id,
          status: "active",
        })
        .eq("id", selectedDeviceId)
        .is("business_id", null)
        .select()
        .single();

      if (deviceError) {
        await supabase
          .from("business_module_configs")
          .delete()
          .eq("business_id", business.id);

        await supabase
          .from("business_features")
          .delete()
          .eq("business_id", business.id);

        await supabase
          .from("businesses")
          .delete()
          .eq("id", business.id);

        throw new Error(
          `Unable to assign device: ${deviceError.message}`
        );
      }

      if (!device) {
        await supabase
          .from("business_module_configs")
          .delete()
          .eq("business_id", business.id);

        await supabase
          .from("business_features")
          .delete()
          .eq("business_id", business.id);

        await supabase
          .from("businesses")
          .delete()
          .eq("id", business.id);

        throw new Error(
          "The selected device is no longer available. Refresh the page and select another device."
        );
      }

      // -----------------------------------------------------
      // STEP 5: CREATE OWNER ACCESS & GENERATE QR
      // -----------------------------------------------------

      const customerUrl = `${window.location.origin}/tap/${device.device_code}`;

      let qrDataUrl = "";
      try {
        qrDataUrl = await QRCode.toDataURL(customerUrl, { width: 300, margin: 2 });
      } catch (qrErr) {
        console.error("Failed to generate QR code:", qrErr);
      }

      let ownerAccessCreated = false;
      const ownerEmail = form.email.trim();

      if (ownerEmail) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;

          const ownerRes = await fetch("/api/admin/create-owner", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: token ? `Bearer ${token}` : "",
            },
            body: JSON.stringify({
              businessId: business.id,
              ownerEmail,
            }),
          });

          if (ownerRes.ok) {
            ownerAccessCreated = true;
          } else {
            const errJson = await ownerRes.json();
            console.warn("Owner access creation notice:", errJson.error);
          }
        } catch (authErr) {
          console.error("Owner access call failed:", authErr);
        }
      }

      const activated: ActivatedClient = {
        id: business.id,
        name: business.name,
        category: business.category,
        deviceCode: device.device_code,
        customerUrl,
        ownerEmail: ownerEmail || undefined,
        ownerAccessCreated,
        qrDataUrl,
      };

      setActivatedClient(activated);

      setSuccess(
        `Client activated successfully. ${device.device_code} is now assigned to ${business.name}.`
      );

      // Remove assigned device from local available list.
      setDevices((current) =>
        current.filter((item) => item.id !== device.id)
      );

      setSelectedDeviceId("");
    } catch (err) {
      console.error(
        "TAPX client activation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to activate client."
      );
    } finally {
      setActivating(false);
    }
  }

  // =========================================================
  // PREVIEW
  // =========================================================

  function openPreview() {
    const validationError =
      validateBusinessForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setShowPreview(true);
  }

  // =========================================================
  // COPY CUSTOMER URL
  // =========================================================

  async function copyToClipboard(text: string, type: "customer" | "portal") {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      if (type === "customer") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        setCopiedPortal(true);
        setTimeout(() => setCopiedPortal(false), 2500);
      }
    } catch (err) {
      console.error("Clipboard copy error:", err);
    }
  }

  async function copyCustomerUrl() {
    if (!activatedClient?.customerUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        activatedClient.customerUrl
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error(
        "Unable to copy URL:",
        err
      );

      setError(
        "Unable to copy the URL. Please copy it manually."
      );
    }
  }

  // =========================================================
  // LOADING SCREEN
  // =========================================================

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={loadingCardStyle}>
          <div
            style={{
              fontSize: "32px",
              marginBottom: "12px",
            }}
          >
            ⚡
          </div>

          <h2
            style={{
              margin: 0,
              color: "#111827",
            }}
          >
            Preparing TAPX onboarding
          </h2>

          <p
            style={{
              marginTop: "8px",
              color: "#64748b",
            }}
          >
            Loading features, recommendations
            and available devices...
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // ACTIVATION SUCCESS SCREEN
  // =========================================================

  if (activatedClient) {
    const portalUrl = `${window.location.origin}/client`;

    return (
      <main style={pageStyle}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px" }}>
          {/* Hero Header */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={successCheckStyle}>✓</div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "#15803d",
                marginBottom: "6px",
              }}
            >
              TAPX CLIENT ONBOARDED
            </div>
            <h1 style={{ margin: 0, fontSize: "32px", color: "#111827", fontWeight: 800 }}>
              Client Ready
            </h1>
            <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "15px" }}>
              Customer touchpoints and owner portal access generated for {activatedClient.name}
            </p>
          </div>

          {/* Side-by-Side Handoff Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
              gap: "24px",
              marginBottom: "32px",
            }}
          >
            {/* LEFT SIDE: CUSTOMER TOUCHPOINTS */}
            <div
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #f1f5f9",
                  paddingBottom: "16px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", letterSpacing: "0.05em" }}>
                    HANDOFF ITEM 1
                  </div>
                  <h2 style={{ margin: "2px 0 0", fontSize: "20px", color: "#111827", fontWeight: 700 }}>
                    Customer Experience
                  </h2>
                </div>
                <span
                  style={{
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "20px",
                  }}
                >
                  NFC / QR Live
                </span>
              </div>

              {/* QR Preview & Download */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  background: "#f8fafc",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                }}
              >
                {activatedClient.qrDataUrl ? (
                  <img
                    src={activatedClient.qrDataUrl}
                    alt="Customer QR Code"
                    style={{
                      width: "110px",
                      height: "110px",
                      borderRadius: "8px",
                      background: "white",
                      padding: "6px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "110px",
                      height: "110px",
                      background: "#e2e8f0",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                    }}
                  >
                    📱
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>ASSIGNED DEVICE</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                    {activatedClient.deviceCode}
                  </div>
                  <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
                    Category: <strong>{activatedClient.category}</strong>
                  </div>

                  {activatedClient.qrDataUrl && (
                    <a
                      href={activatedClient.qrDataUrl}
                      download={`TAPX_${activatedClient.name.replace(/\s+/g, "_")}_QR.png`}
                      style={{
                        display: "inline-block",
                        marginTop: "10px",
                        padding: "7px 14px",
                        background: "#0f172a",
                        color: "white",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      ↓ Download QR Code
                    </a>
                  )}
                </div>
              </div>

              {/* Customer Link Box */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>
                  CUSTOMER TAP URL (/tap/{activatedClient.deviceCode})
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#f1f5f9",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      color: "#0f172a",
                      fontWeight: 600,
                      wordBreak: "break-all",
                    }}
                  >
                    {activatedClient.customerUrl}
                  </span>
                  <button
                    type="button"
                    onClick={copyCustomerUrl}
                    style={{
                      padding: "6px 12px",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copied ? "✓ Copied" : "Copy Link"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.open(activatedClient.customerUrl, "_blank", "noopener,noreferrer")}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  color: "#0f172a",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                ↗ Open Live Customer Touchpoint
              </button>
            </div>

            {/* RIGHT SIDE: OWNER PORTAL ACCESS */}
            <div
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #f1f5f9",
                  paddingBottom: "16px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", letterSpacing: "0.05em" }}>
                    HANDOFF ITEM 2
                  </div>
                  <h2 style={{ margin: "2px 0 0", fontSize: "20px", color: "#111827", fontWeight: 700 }}>
                    Client Portal Access
                  </h2>
                </div>
                <span
                  style={{
                    background: activatedClient.ownerAccessCreated ? "#f0fdf4" : "#fefce8",
                    color: activatedClient.ownerAccessCreated ? "#15803d" : "#a16207",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "20px",
                  }}
                >
                  {activatedClient.ownerAccessCreated ? "✓ Credentials Created" : "Pending Setup"}
                </span>
              </div>

              {/* Owner Account Box */}
              <div
                style={{
                  background: "#f8fafc",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>REGISTERED OWNER EMAIL</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                    {activatedClient.ownerEmail || "No email specified during setup"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>SHARED DASHBOARD ROUTE</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#2563eb", marginTop: "2px" }}>
                    /client
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    (Single shared URL — login automatically resolves owner's workspace)
                  </div>
                </div>
              </div>

              {/* Copy Portal Link */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>
                  OWNER DASHBOARD LINK
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#f1f5f9",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  >
                    {portalUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(portalUrl, "portal")}
                    style={{
                      padding: "6px 12px",
                      background: "#0f172a",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copiedPortal ? "✓ Copied Dashboard URL" : "Copy Dashboard URL"}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => router.push(`/clients/${activatedClient.id}`)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#111827",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Manage Client Workspace
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/clients")}
                  style={{
                    padding: "12px 18px",
                    background: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    color: "#334155",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Back to Clients
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================
  // MAIN PAGE
  // =========================================================

  return (
    <main style={pageStyle}>
      {/* HEADER */}

      <div style={headerStyle}>
        <div>
          <button
            type="button"
            onClick={() =>
              router.push("/clients")
            }
            style={backButtonStyle}
          >
            ← Back to Clients
          </button>

          <h1 style={titleStyle}>
            Add New Client
          </h1>

          <p style={subtitleStyle}>
            Create and activate a complete TAPX
            customer experience.
          </p>
        </div>

        <div style={topBadgeStyle}>
          TAPX ONBOARDING
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div style={errorStyle}>
          <strong>
            Something went wrong
          </strong>

          <div style={{ marginTop: "5px" }}>
            {error}
          </div>
        </div>
      )}

      {/* SUCCESS */}

      {success && (
        <div style={successStyle}>
          <strong>
            ✓ Client activated
          </strong>

          <div style={{ marginTop: "5px" }}>
            {success}
          </div>
        </div>
      )}

      {/* =====================================================
          1. BUSINESS INFORMATION
      ===================================================== */}

      <section style={cardStyle}>
        <SectionHeader
          number="1"
          title="Business Information"
          description="Enter the basic details of the business."
        />

        <div style={twoColumnGrid}>
          <InputField
            label="Business Name *"
            placeholder="e.g. Yuva Selection"
            value={form.name}
            onChange={(value) =>
              updateField("name", value)
            }
          />

          <InputField
            label="Phone"
            placeholder="e.g. 9876543210"
            value={form.phone}
            onChange={(value) =>
              updateField("phone", value)
            }
          />

          <InputField
            label="Email"
            placeholder="business@example.com"
            value={form.email}
            onChange={(value) =>
              updateField("email", value)
            }
          />

          <InputField
            label="WhatsApp Number"
            placeholder="e.g. 9876543210"
            value={form.whatsapp_number}
            onChange={(value) =>
              updateField(
                "whatsapp_number",
                value
              )
            }
          />

          <InputField
            label="Instagram URL"
            placeholder="https://instagram.com/business"
            value={form.instagram_url}
            onChange={(value) =>
              updateField(
                "instagram_url",
                value
              )
            }
          />

          <InputField
            label="Google Review URL"
            placeholder="https://g.page/r/CXrdGmw-RmMwEBM/review"
            value={form.google_review_url}
            onChange={(value) =>
              updateField(
                "google_review_url",
                value
              )
            }
          />

          <InputField
            label="UPI ID"
            placeholder="business@upi"
            value={form.upi_id}
            onChange={(value) =>
              updateField("upi_id", value)
            }
          />

          <InputField
            label="City"
            placeholder="e.g. Mumbai"
            value={form.city}
            onChange={(value) =>
              updateField("city", value)
            }
          />

          <InputField
            label="State"
            placeholder="e.g. Maharashtra"
            value={form.state}
            onChange={(value) =>
              updateField("state", value)
            }
          />

          <div
            style={{
              gridColumn: "1 / -1",
            }}
          >
            <label style={labelStyle}>
              Business Address
            </label>

            <textarea
              rows={3}
              value={form.address}
              placeholder="Full business address"
              onChange={(event) =>
                updateField(
                  "address",
                  event.target.value
                )
              }
              style={textareaStyle}
            />
          </div>
        </div>
      </section>

      {/* =====================================================
          2. CATEGORY
      ===================================================== */}

      <section style={cardStyle}>
        <SectionHeader
          number="2"
          title="Business Category"
          description="TAPX uses this category to recommend the right modules."
        />

        <div style={categoryGridStyle}>
          {CATEGORIES.map((category) => {
            const selected =
              form.category === category.value;

            return (
              <button
                key={category.value}
                type="button"
                onClick={() =>
                  changeCategory(
                    category.value
                  )
                }
                style={{
                  ...categoryCardStyle,
                  borderColor: selected
                    ? "#111827"
                    : "#e5e7eb",
                  background: selected
                    ? "#f8fafc"
                    : "#ffffff",
                  boxShadow: selected
                    ? "0 0 0 2px rgba(17,24,39,0.08)"
                    : "none",
                }}
              >
                <div
                  style={{
                    fontSize: "29px",
                  }}
                >
                  {category.icon}
                </div>

                <div
                  style={{
                    marginTop: "9px",
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  {category.label}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "12px",
                    lineHeight: 1.4,
                    color: "#64748b",
                  }}
                >
                  {category.description}
                </div>

                {selected && (
                  <div
                    style={{
                      marginTop: "10px",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#15803d",
                    }}
                  >
                    ✓ Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* =====================================================
          3. CORE FEATURES
      ===================================================== */}

      <section style={cardStyle}>
        <SectionHeader
          number="3"
          title="Core TAPX Features"
          description="Included by default for every TAPX client."
        />

        <div style={featureGridStyle}>
          {coreFeatures.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              selected
              locked
              onToggle={() => {}}
            />
          ))}
        </div>
      </section>

      {/* =====================================================
          4. RECOMMENDED PAID MODULES
      ===================================================== */}

      <section style={cardStyle}>
        <SectionHeader
          number="4"
          title={`Recommended for ${selectedCategory.label}`}
          description="Optional paid modules TAPX recommends for this business."
        />

        {recommendedFeatures.length === 0 ? (
          <div style={emptyStyle}>
            No category-specific modules are
            configured yet.
          </div>
        ) : (
          <div style={featureGridStyle}>
            {recommendedFeatures.map(
              (feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  selected={selectedPaidFeatures.includes(
                    feature.id
                  )}
                  onToggle={() =>
                    togglePaidFeature(
                      feature.id
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </section>

      {/* =====================================================
          5. OTHER MODULES
      ===================================================== */}

      {otherPaidFeatures.length > 0 && (
        <section style={cardStyle}>
          <SectionHeader
            number="5"
            title="Other Available Modules"
            description="Additional modules you can offer to this client."
          />

          <div style={featureGridStyle}>
            {otherPaidFeatures.map(
              (feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  selected={selectedPaidFeatures.includes(
                    feature.id
                  )}
                  onToggle={() =>
                    togglePaidFeature(
                      feature.id
                    )
                  }
                />
              )
            )}
          </div>
        </section>
      )}

      {/* =====================================================
          6. CONFIGURE SELECTED MODULES
      ===================================================== */}

      {selectedPaidFeatures.length > 0 && (
        <section style={cardStyle}>
          <SectionHeader
            number="6"
            title="Configure Selected Modules"
            description="Set up the information customers will see when they use this client's TAPX experience."
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {selectedPaidFeatures.map(
              (featureId) => {
                const feature = features.find(
                  (item) =>
                    item.id === featureId
                );

                if (!feature) {
                  return null;
                }

                return (
                  <ModuleConfigurator
                    key={feature.id}
                    feature={feature}
                    config={
                      moduleConfigs[
                        feature.id
                      ] || {}
                    }
                    onChange={(config) =>
                      setModuleConfigs(
                        (current) => ({
                          ...current,
                          [feature.id]:
                            config,
                        })
                      )
                    }
                  />
                );
              }
            )}
          </div>
        </section>
      )}

      {/* =====================================================
          7. NFC DEVICE
      ===================================================== */}

      <section style={cardStyle}>
        <SectionHeader
          number="7"
          title="NFC Device"
          description="Assign an available TAPX device to this client."
        />

        {devices.length === 0 ? (
          <div style={deviceEmptyStyle}>
            <div
              style={{
                fontSize: "30px",
              }}
            >
              📡
            </div>

            <div style={{ flex: 1 }}>
              <strong
                style={{
                  color: "#111827",
                }}
              >
                No available TAPX devices
              </strong>

              <p
                style={{
                  margin: "5px 0 12px",
                  color: "#64748b",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                Register a physical TAPX device
                from Device Inventory before
                activating this client.
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push("/devices")
                }
                style={goDevicesButtonStyle}
              >
                Go to Devices →
              </button>
            </div>
          </div>
        ) : (
          <>
            <label style={labelStyle}>
              Available TAPX Device *
            </label>

            <select
              value={selectedDeviceId}
              onChange={(event) => {
                setSelectedDeviceId(
                  event.target.value
                );
                setError("");
              }}
              style={selectStyle}
            >
              <option value="">
                Select a device
              </option>

              {devices.map((device) => (
                <option
                  key={device.id}
                  value={device.id}
                >
                  {device.device_code}
                  {device.device_type
                    ? ` — ${device.device_type}`
                    : ""}
                  {device.location
                    ? ` — ${device.location}`
                    : ""}
                </option>
              ))}
            </select>

            {selectedDevice && (
              <div style={deviceSelectedStyle}>
                <strong>
                  ✓ {selectedDevice.device_code}
                </strong>{" "}
                will be assigned and activated
                for this client.
              </div>
            )}

            {!selectedDeviceId && (
              <div
                style={{
                  marginTop: "9px",
                  fontSize: "12px",
                  color: "#b45309",
                }}
              >
                A device is required to activate
                this client.
              </div>
            )}
          </>
        )}
      </section>

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section style={summaryCardStyle}>
        <div style={{ flex: 1 }}>
          <div style={summaryLabelStyle}>
            ACTIVATION SUMMARY
          </div>

          <h2
            style={{
              margin: "7px 0 0",
              fontSize: "21px",
              color: "white",
            }}
          >
            {form.name || "New TAPX Client"}
          </h2>

          <div style={summaryBadgesStyle}>
            <SummaryBadge>
              {selectedCategory.icon}{" "}
              {selectedCategory.label}
            </SummaryBadge>

            <SummaryBadge>
              {coreFeatures.length} core features
            </SummaryBadge>

            <SummaryBadge>
              {selectedPaidFeatures.length} paid
              modules
            </SummaryBadge>

            <SummaryBadge>
              {selectedDeviceId
                ? `Device: ${
                    selectedDevice?.device_code ||
                    "Selected"
                  }`
                : "NFC device required"}
            </SummaryBadge>
          </div>
        </div>

        <div style={buttonRowStyle}>
          <button
            type="button"
            onClick={openPreview}
            disabled={activating}
            style={{
              ...secondaryButtonStyle,
              opacity: activating ? 0.6 : 1,
            }}
          >
            👁 Preview
          </button>

          <button
            type="button"
            onClick={activateClient}
            disabled={
              activating ||
              !selectedDeviceId ||
              devices.length === 0
            }
            style={{
              ...primaryButtonStyle,
              opacity:
                activating ||
                !selectedDeviceId ||
                devices.length === 0
                  ? 0.5
                  : 1,
              cursor:
                activating ||
                !selectedDeviceId ||
                devices.length === 0
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {activating
              ? "Activating..."
              : !selectedDeviceId
              ? "Select Device First"
              : "⚡ Activate Client"}
          </button>
        </div>
      </section>

      {/* =====================================================
          PREVIEW
      ===================================================== */}

      {showPreview && (
        <div
          style={modalOverlayStyle}
          onClick={() =>
            setShowPreview(false)
          }
        >
          <div
            style={previewModalStyle}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div style={previewHeaderStyle}>
              <div>
                <div style={previewLabelStyle}>
                  TAPX CUSTOMER EXPERIENCE PREVIEW
                </div>

                <h2
                  style={{
                    margin: "5px 0 0",
                    color: "#111827",
                  }}
                >
                  {form.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowPreview(false)
                }
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <div style={customerPreviewStyle}>
              <div style={previewLogoStyle}>
                {selectedCategory.icon}
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: "25px",
                  color: "#111827",
                }}
              >
                {form.name}
              </h1>

              <p
                style={{
                  margin: "7px 0 22px",
                  color: "#64748b",
                }}
              >
                {selectedCategory.label}
              </p>

              <div
                style={
                  previewActionsGridStyle
                }
              >
                {coreFeatures.map((feature) => (
                  <PreviewAction
                    key={feature.id}
                    icon={feature.icon || "•"}
                    name={feature.name}
                  />
                ))}

                {selectedPaidFeatures.map(
                  (featureId) => {
                    const feature =
                      features.find(
                        (item) =>
                          item.id === featureId
                      );

                    if (!feature) {
                      return null;
                    }

                    return (
                      <PreviewAction
                        key={feature.id}
                        icon={
                          feature.icon || "✨"
                        }
                        name={feature.name}
                        paid
                      />
                    );
                  }
                )}
              </div>

              {(form.address ||
                form.city ||
                form.state) && (
                <div
                  style={previewAddressStyle}
                >
                  📍{" "}
                  {form.address ||
                    "Business location"}
                  {form.city
                    ? `, ${form.city}`
                    : ""}
                  {form.state
                    ? `, ${form.state}`
                    : ""}
                </div>
              )}
            </div>

            <div style={previewFooterStyle}>
              Preview only — no business has
              been activated yet.
            </div>
          </div>
        </div>
      )}

      {/* MOBILE STYLES */}

      <style jsx>{`
        @media (max-width: 850px) {
          main {
            padding: 22px !important;
          }

          section {
            padding: 20px !important;
          }
        }

        @media (max-width: 700px) {
          main {
            padding: 15px !important;
          }

          section {
            padding: 17px !important;
          }
        }
      `}</style>
    </main>
  );
}

// =========================================================
// COMPONENTS
// =========================================================

function SectionHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div style={sectionHeaderStyle}>
      <div style={sectionNumberStyle}>
        {number}
      </div>

      <div>
        <h2 style={sectionTitleStyle}>
          {title}
        </h2>

        <p style={sectionDescriptionStyle}>
          {description}
        </p>
      </div>
    </div>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
      </label>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        style={inputStyle}
      />
    </div>
  );
}

function FeatureCard({
  feature,
  selected,
  locked = false,
  onToggle,
}: {
  feature: Feature;
  selected: boolean;
  locked?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        locked ? undefined : onToggle
      }
      style={{
        ...featureCardStyle,
        borderColor: selected
          ? "#111827"
          : "#e5e7eb",
        background: selected
          ? "#f8fafc"
          : "#ffffff",
        cursor: locked
          ? "default"
          : "pointer",
      }}
    >
      <div style={featureIconStyle}>
        {feature.icon || "⚡"}
      </div>

      <div
        style={{
          flex: 1,
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            flexWrap: "wrap",
          }}
        >
          <strong
            style={{
              color: "#111827",
              fontSize: "14px",
            }}
          >
            {feature.name}
          </strong>

          {feature.is_paid && (
            <span style={paidBadgeStyle}>
              PAID
            </span>
          )}

          {locked && (
            <span
              style={includedBadgeStyle}
            >
              INCLUDED
            </span>
          )}
        </div>

        <p
          style={{
            margin: "5px 0 0",
            color: "#64748b",
            fontSize: "12px",
            lineHeight: 1.4,
          }}
        >
          {feature.description}
        </p>
      </div>

      <div
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "6px",
          border: selected
            ? "2px solid #111827"
            : "2px solid #cbd5e1",
          background: selected
            ? "#111827"
            : "#ffffff",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {selected ? "✓" : ""}
      </div>
    </button>
  );
}

function PreviewAction({
  icon,
  name,
  paid = false,
}: {
  icon: string;
  name: string;
  paid?: boolean;
}) {
  return (
    <div
      style={{
        ...previewActionStyle,
        borderColor: paid
          ? "#c7d2fe"
          : "#e5e7eb",
        background: paid
          ? "#eef2ff"
          : "#ffffff",
      }}
    >
      <span style={{ fontSize: "20px" }}>
        {icon}
      </span>

      <span>{name}</span>
    </div>
  );
}

function SummaryBadge({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: "20px",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        color: "#475569",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

// =========================================================
// STYLES
// =========================================================

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f5f7fb",
  padding: "40px",
  color: "#111827",
};

const headerStyle: CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto 28px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
};

const backButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  marginBottom: "10px",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "32px",
  fontWeight: 750,
};

const subtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: "15px",
};

const topBadgeStyle: CSSProperties = {
  background: "#111827",
  color: "white",
  borderRadius: "20px",
  padding: "8px 12px",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
};

const cardStyle: CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto 20px",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "26px",
};

const loadingCardStyle: CSSProperties = {
  maxWidth: "600px",
  margin: "120px auto",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "40px",
  textAlign: "center",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  gap: "14px",
  alignItems: "flex-start",
  marginBottom: "22px",
};

const sectionNumberStyle: CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "10px",
  background: "#111827",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: "13px",
  flexShrink: 0,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "19px",
  fontWeight: 700,
};

const sectionDescriptionStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.5,
};

const twoColumnGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "17px",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: "#475569",
  marginBottom: "7px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: "9px",
  padding: "12px 13px",
  fontSize: "14px",
  color: "#111827",
  background: "white",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  lineHeight: 1.5,
};

const selectStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: "9px",
  padding: "12px 13px",
  fontSize: "14px",
  color: "#111827",
  background: "white",
  outline: "none",
};

const categoryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "13px",
};

const categoryCardStyle: CSSProperties = {
  textAlign: "left",
  border: "1px solid #e5e7eb",
  borderRadius: "13px",
  padding: "17px",
  cursor: "pointer",
  transition: "all 0.15s",
};

const featureGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "12px",
};

const featureCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "15px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  textAlign: "left",
};

const featureIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "10px",
  background: "#f1f5f9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "19px",
  flexShrink: 0,
};

const paidBadgeStyle: CSSProperties = {
  padding: "3px 6px",
  borderRadius: "10px",
  background: "#fef3c7",
  color: "#92400e",
  fontSize: "9px",
  fontWeight: 800,
};

const includedBadgeStyle: CSSProperties = {
  padding: "3px 6px",
  borderRadius: "10px",
  background: "#dcfce7",
  color: "#166534",
  fontSize: "9px",
  fontWeight: 800,
};

const emptyStyle: CSSProperties = {
  padding: "25px",
  borderRadius: "10px",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: "13px",
  textAlign: "center",
};

const deviceEmptyStyle: CSSProperties = {
  display: "flex",
  gap: "15px",
  alignItems: "center",
  padding: "18px",
  borderRadius: "12px",
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
};

const goDevicesButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#111827",
  padding: "9px 13px",
  borderRadius: "8px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const deviceSelectedStyle: CSSProperties = {
  marginTop: "10px",
  padding: "11px 12px",
  borderRadius: "8px",
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#166534",
  fontSize: "13px",
};

const summaryCardStyle: CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto 40px",
  background: "#111827",
  color: "white",
  borderRadius: "16px",
  padding: "24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "25px",
  flexWrap: "wrap",
};

const summaryLabelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#94a3b8",
  letterSpacing: "0.05em",
};

const summaryBadgesStyle: CSSProperties = {
  marginTop: "10px",
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  flexShrink: 0,
};

const primaryButtonStyle: CSSProperties = {
  border: "none",
  background: "white",
  color: "#111827",
  padding: "12px 18px",
  borderRadius: "9px",
  fontWeight: 700,
  fontSize: "14px",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #475569",
  background: "transparent",
  color: "white",
  padding: "12px 17px",
  borderRadius: "9px",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
};

const errorStyle: CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto 20px",
  padding: "14px 16px",
  borderRadius: "10px",
  background: "#fee2e2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: "13px",
};

const successStyle: CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto 20px",
  padding: "14px 16px",
  borderRadius: "10px",
  background: "#dcfce7",
  border: "1px solid #bbf7d0",
  color: "#166534",
  fontSize: "13px",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 1000,
};

const previewModalStyle: CSSProperties = {
  width: "100%",
  maxWidth: "620px",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "white",
  borderRadius: "18px",
  boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
};

const previewHeaderStyle: CSSProperties = {
  padding: "20px 22px",
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const previewLabelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#64748b",
  letterSpacing: "0.05em",
};

const closeButtonStyle: CSSProperties = {
  border: "none",
  background: "#f1f5f9",
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  fontSize: "20px",
  color: "#475569",
  cursor: "pointer",
};

const customerPreviewStyle: CSSProperties = {
  padding: "35px 25px",
  textAlign: "center",
};

const previewLogoStyle: CSSProperties = {
  width: "72px",
  height: "72px",
  borderRadius: "18px",
  background: "#eef2ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "32px",
  margin: "0 auto 15px",
};

const previewActionsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
};

const previewActionStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px 10px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "7px",
  color: "#334155",
  fontSize: "12px",
  fontWeight: 600,
};

const previewAddressStyle: CSSProperties = {
  marginTop: "20px",
  padding: "14px",
  borderRadius: "12px",
  background: "#f8fafc",
  textAlign: "left",
  color: "#475569",
  fontSize: "13px",
};

const previewFooterStyle: CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  padding: "15px 20px",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: "11px",
  textAlign: "center",
};

// =========================================================
// SUCCESS / DEPLOYMENT STYLES
// =========================================================

const successPageWrapperStyle: CSSProperties = {
  maxWidth: "850px",
  margin: "35px auto",
};

const successHeroStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "35px",
  textAlign: "center",
  marginBottom: "18px",
};

const successCheckStyle: CSSProperties = {
  width: "62px",
  height: "62px",
  borderRadius: "50%",
  background: "#dcfce7",
  color: "#15803d",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "32px",
  fontWeight: 800,
  margin: "0 auto 17px",
};

const deploymentCardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "26px",
  marginBottom: "18px",
};

const deploymentHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  paddingBottom: "20px",
  borderBottom: "1px solid #e5e7eb",
};

const deploymentLabelStyle: CSSProperties = {
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.07em",
  color: "#64748b",
};

const categoryPillStyle: CSSProperties = {
  padding: "7px 11px",
  borderRadius: "20px",
  background: "#f1f5f9",
  color: "#475569",
  fontSize: "12px",
  fontWeight: 700,
};

const deploymentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  marginTop: "18px",
};

const deploymentItemStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "16px",
  background: "#fafafa",
};

const deploymentItemLabelStyle: CSSProperties = {
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  color: "#64748b",
  marginBottom: "7px",
};

const urlBoxStyle: CSSProperties = {
  marginTop: "12px",
  padding: "16px",
  borderRadius: "12px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const urlRowStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
};

const urlTextStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "14px",
  fontWeight: 650,
  color: "#111827",
};

const copyButtonStyle: CSSProperties = {
  flexShrink: 0,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#111827",
  padding: "9px 13px",
  borderRadius: "8px",
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer",
};

const successActionsStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "18px",
};

const openCustomerButtonStyle: CSSProperties = {
  border: "none",
  background: "#111827",
  color: "white",
  padding: "12px 16px",
  borderRadius: "9px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const manageClientButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#111827",
  padding: "12px 16px",
  borderRadius: "9px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const backClientsButtonStyle: CSSProperties = {
  border: "none",
  background: "#f1f5f9",
  color: "#475569",
  padding: "12px 16px",
  borderRadius: "9px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const nextStepCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "14px",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: "14px",
  padding: "17px",
};