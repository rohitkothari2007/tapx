"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import ModuleConfigurator, {
  type Feature as ConfigFeature,
} from "../add/ModuleConfigurator";

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
  instagram_url: string | null;
  google_review_url: string | null;
  whatsapp_number: string | null;
  upi_id: string | null;
  payment_enabled: boolean | null;
  status: string | null;
  created_at: string;
};

type Feature = {
  id: string;
  feature_key: string;
  name: string;
  description: string | null;
  category: string | null;
  is_core: boolean;
  is_paid: boolean;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
};

type BusinessFeature = {
  id: string;
  business_id: string;
  feature_id: string;
  enabled: boolean;
  status: string | null;
};

type ModuleConfig = {
  id: string;
  business_id: string;
  feature_id: string;
  module_key: string;
  config: Record<string, unknown> | null;
  status: string | null;
};

type Device = {
  id: string;
  device_code: string;
  business_id: string | null;
  device_type: string | null;
  location: string | null;
  status: string | null;
  created_at?: string;
};

type Interaction = {
  id: string;
  interaction_type: string;
  created_at: string;
};

type TabKey =
  | "overview"
  | "experience"
  | "modules"
  | "analytics"
  | "devices"
  | "loyalty";

export default function ClientPage() {
  const params = useParams();
  const router = useRouter();

  const businessId = params.businessId as string;

  const [business, setBusiness] =
    useState<Business | null>(null);

  const [features, setFeatures] =
    useState<Feature[]>([]);

  const [businessFeatures, setBusinessFeatures] =
    useState<BusinessFeature[]>([]);

  const [moduleConfigs, setModuleConfigs] =
    useState<ModuleConfig[]>([]);

  const [devices, setDevices] =
    useState<Device[]>([]);

  const [interactions, setInteractions] =
    useState<Interaction[]>([]);

  const [activeTab, setActiveTab] =
    useState<TabKey>("overview");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  const [selectedFeatureId, setSelectedFeatureId] =
    useState<string | null>(null);

  const [editingConfig, setEditingConfig] =
    useState<Record<string, any>>({});

  const [savingModule, setSavingModule] =
    useState(false);

  const [moduleMessage, setModuleMessage] =
    useState("");

  type LoyaltyMember = {
    id: string;
    customer_id: string;
    visits: number;
    reward_claimed: boolean;
    updated_at: string;
    customer: { name: string; phone: string } | null;
  };

  const [loyaltyMembers, setLoyaltyMembers] =
    useState<LoyaltyMember[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] =
    useState(false);
  const [loyaltySearch, setLoyaltySearch] =
    useState("");
  const [loyaltyMessage, setLoyaltyMessage] =
    useState("");
  const [loyaltySavingCustomer, setLoyaltySavingCustomer] =
    useState<string | null>(null);

  useEffect(() => {
    if (!businessId) {
      return;
    }

    loadWorkspace();
  }, [businessId]);

  async function loadLoyaltyMembers(targetBusinessId: string) {
    setLoyaltyLoading(true);
    try {
      const { data, error } = await supabase
        .from("loyalty_memberships")
        .select(`
          id,
          customer_id,
          visits,
          reward_claimed,
          updated_at,
          customer:customers(name, phone)
        `)
        .eq("business_id", targetBusinessId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setLoyaltyMembers((data || []) as unknown as LoyaltyMember[]);
    } catch (err) {
      console.error("TAPX loyalty load error:", err);
      setLoyaltyMembers([]);
    } finally {
      setLoyaltyLoading(false);
    }
  }

  async function recordLoyaltyVisit(member: LoyaltyMember) {
    if (!businessId) return;

    setLoyaltySavingCustomer(member.id);
    setLoyaltyMessage("");

    try {
      const { error } = await supabase.rpc("record_tapx_loyalty_visit", {
        p_business_id: businessId,
        p_customer_id: member.customer_id,
        p_membership_id: member.id,
        p_source: "business_verified_visit",
      });

      if (error) throw error;

      setLoyaltyMessage(
        `${member.customer?.name || "Customer"} received 1 loyalty visit.`
      );
      await loadLoyaltyMembers(businessId);
    } catch (err) {
      console.error("TAPX loyalty visit error:", err);
      setLoyaltyMessage(
        err instanceof Error
          ? err.message
          : "Unable to record loyalty visit."
      );
    } finally {
      setLoyaltySavingCustomer(null);
    }
  }

  async function loadWorkspace() {
    setLoading(true);
    setError("");

    try {
      const [
        businessResponse,
        featureResponse,
        businessFeatureResponse,
        configResponse,
        deviceResponse,
        interactionResponse,
      ] = await Promise.all([
        supabase
          .from("businesses")
          .select("*")
          .eq("id", businessId)
          .single(),

        supabase
          .from("feature_catalog")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", {
            ascending: true,
          }),

        supabase
          .from("business_features")
          .select("*")
          .eq("business_id", businessId)
          .eq("enabled", true),

        supabase
          .from("business_module_configs")
          .select("*")
          .eq("business_id", businessId),

        supabase
          .from("devices")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", {
            ascending: true,
          }),

        supabase
          .from("interactions")
          .select(
            "id, interaction_type, created_at"
          )
          .eq("business_id", businessId)
          .order("created_at", {
            ascending: false,
          })
          .limit(100),
      ]);

      if (businessResponse.error) {
        throw businessResponse.error;
      }

      if (featureResponse.error) {
        throw featureResponse.error;
      }

      if (businessFeatureResponse.error) {
        throw businessFeatureResponse.error;
      }

      if (configResponse.error) {
        throw configResponse.error;
      }

      if (deviceResponse.error) {
        throw deviceResponse.error;
      }

      if (interactionResponse.error) {
        throw interactionResponse.error;
      }

      setBusiness(
        businessResponse.data as Business
      );

      setFeatures(
        (featureResponse.data || []) as Feature[]
      );

      setBusinessFeatures(
        (businessFeatureResponse.data ||
          []) as BusinessFeature[]
      );

      const loyaltyFeature =
        (featureResponse.data || []).find(
          (feature: Feature) =>
            feature.is_paid &&
            feature.feature_key
              .toLowerCase()
              .includes("loyalty")
        );

      const loyaltyEnabled = Boolean(
        loyaltyFeature &&
          (businessFeatureResponse.data || []).some(
            (item: BusinessFeature) =>
              item.feature_id === loyaltyFeature.id &&
              item.enabled &&
              item.status !== "inactive"
          )
      );

      if (loyaltyEnabled) {
        await loadLoyaltyMembers(businessId);
      } else {
        setLoyaltyMembers([]);
      }

      setModuleConfigs(
        (configResponse.data ||
          []) as ModuleConfig[]
      );

      setDevices(
        (deviceResponse.data || []) as Device[]
      );

      setInteractions(
        (interactionResponse.data ||
          []) as Interaction[]
      );
    } catch (err) {
      console.error(
        "TAPX client workspace error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load client workspace."
      );
    } finally {
      setLoading(false);
    }
  }

  const enabledFeatures = useMemo(() => {
    const enabledIds = new Set(
      businessFeatures
        .filter(
          (item) =>
            item.enabled &&
            item.status !== "inactive"
        )
        .map((item) => item.feature_id)
    );

    return features.filter((feature) =>
      enabledIds.has(feature.id)
    );
  }, [features, businessFeatures]);

  const coreFeatures = useMemo(() => {
    return enabledFeatures.filter(
      (feature) => feature.is_core
    );
  }, [enabledFeatures]);

  const paidFeatures = useMemo(() => {
    return enabledFeatures.filter(
      (feature) => feature.is_paid
    );
  }, [enabledFeatures]);

  const activeDevices = useMemo(() => {
    return devices.filter(
      (device) =>
        device.status?.toLowerCase() ===
        "active"
    );
  }, [devices]);

  const todayInteractions = useMemo(() => {
    const today = new Date();

    return interactions.filter(
      (interaction) => {
        const date = new Date(
          interaction.created_at
        );

        return (
          date.getFullYear() ===
            today.getFullYear() &&
          date.getMonth() ===
            today.getMonth() &&
          date.getDate() ===
            today.getDate()
        );
      }
    ).length;
  }, [interactions]);

  function getModuleConfig(featureId: string) {
    return moduleConfigs.find(
      (config) =>
        config.feature_id === featureId
    );
  }

  function openModuleEditor(feature: Feature) {
    const existing = getModuleConfig(feature.id);

    setSelectedFeatureId(feature.id);
    setEditingConfig(
      existing?.config
        ? { ...existing.config }
        : {}
    );
    setModuleMessage("");
  }

  async function enableModule(feature: Feature) {
    setModuleMessage("");

    try {
      const { data: existing, error: lookupError } =
        await supabase
          .from("business_features")
          .select("id")
          .eq("business_id", businessId)
          .eq("feature_id", feature.id)
          .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (existing?.id) {
        const { error: updateError } =
          await supabase
            .from("business_features")
            .update({
              enabled: true,
              status: "active",
            })
            .eq("id", existing.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } =
          await supabase
            .from("business_features")
            .insert({
              business_id: businessId,
              feature_id: feature.id,
              enabled: true,
              status: "active",
            });

        if (insertError) {
          throw insertError;
        }
      }

      setModuleMessage(
        `${feature.name} enabled successfully.`
      );

      await loadWorkspace();
      openModuleEditor(feature);
    } catch (err) {
      console.error(
        "TAPX enable module error:",
        err
      );

      setModuleMessage(
        err instanceof Error
          ? err.message
          : "Unable to enable this module."
      );
    }
  }

  async function saveModuleConfig(feature: Feature) {
    setSavingModule(true);
    setModuleMessage("");

    try {
      const cleanConfig = {
        ...editingConfig,
      };

      delete cleanConfig.__draft;

      const existing = getModuleConfig(
        feature.id
      );

      if (existing?.id) {
        const { error: updateError } =
          await supabase
            .from("business_module_configs")
            .update({
              module_key: feature.feature_key,
              config: cleanConfig,
              status: "active",
            })
            .eq("id", existing.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } =
          await supabase
            .from("business_module_configs")
            .insert({
              business_id: businessId,
              feature_id: feature.id,
              module_key: feature.feature_key,
              config: cleanConfig,
              status: "active",
            });

        if (insertError) {
          throw insertError;
        }
      }

      setModuleMessage(
        `${feature.name} configuration saved.`
      );

      await loadWorkspace();
    } catch (err) {
      console.error(
        "TAPX save module config error:",
        err
      );

      setModuleMessage(
        err instanceof Error
          ? err.message
          : "Unable to save module configuration."
      );
    } finally {
      setSavingModule(false);
    }
  }

  function getCustomerUrl(
    deviceCode: string
  ) {
    if (
      typeof window === "undefined"
    ) {
      return `/tap/${deviceCode}`;
    }

    return `${window.location.origin}/tap/${deviceCode}`;
  }

  function formatCategory(
    category: string | null
  ) {
    if (!category) {
      return "Business";
    }

    return category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }

  function formatInteraction(
    value: string
  ) {
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
  }

  function getFeatureIcon(
    feature: Feature
  ) {
    if (feature.icon) {
      return feature.icon;
    }

    const key =
      feature.feature_key.toLowerCase();

    if (key.includes("menu")) {
      return "🍽️";
    }

    if (key.includes("offer")) {
      return "🔥";
    }

    if (key.includes("appointment")) {
      return "📅";
    }

    if (key.includes("loyalty")) {
      return "⭐";
    }

    if (key.includes("service")) {
      return "🛠️";
    }

    if (key.includes("product")) {
      return "🛍️";
    }

    if (key.includes("order")) {
      return "🧾";
    }

    if (key.includes("hotel")) {
      return "🏨";
    }

    return "⚡";
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={loadingCard}>
          <div style={loadingIcon}>
            ⚡
          </div>

          <h2 style={loadingTitle}>
            Loading Client Workspace
          </h2>

          <p style={loadingText}>
            Preparing business data and
            modules...
          </p>
        </div>
      </main>
    );
  }

  if (error || !business) {
    return (
      <main style={pageStyle}>
        <div style={errorCard}>
          <div style={errorIcon}>
            ⚠️
          </div>

          <h2 style={errorTitle}>
            Unable to load client
          </h2>

          <p style={errorText}>
            {error ||
              "Business could not be found."}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push("/clients")
            }
            style={primaryButton}
          >
            ← Back to Clients
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      {/* HEADER */}

      <div style={header}>
        <div>
          <button
            type="button"
            onClick={() =>
              router.push("/clients")
            }
            style={backButton}
          >
            ← Back to Clients
          </button>

          <div style={businessHeader}>
            <div style={businessAvatar}>
              {business.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={business.name}
                  style={logoImage}
                />
              ) : (
                business.name
                  .substring(0, 2)
                  .toUpperCase()
              )}
            </div>

            <div>
              <h1 style={title}>
                {business.name}
              </h1>

              <div style={headerMeta}>
                <span
                  style={categoryBadge}
                >
                  {formatCategory(
                    business.category
                  )}
                </span>

                <span
                  style={clientSince}
                >
                  Client since{" "}
                  {formatDate(
                    business.created_at
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            onClick={loadWorkspace}
            style={secondaryButton}
          >
            ↻ Refresh
          </button>

          {enabledFeatures.some(
            (feature) =>
              feature.is_paid &&
              feature.feature_key
                .toLowerCase()
                .includes("loyalty")
          ) && (
            <button
              type="button"
              onClick={() => setActiveTab("loyalty")}
              style={secondaryButton}
            >
              🎁 Loyalty
            </button>
          )}

          {activeDevices.length > 0 && (
            <button
              type="button"
              onClick={() =>
                window.open(
                  getCustomerUrl(
                    activeDevices[0]
                      .device_code
                  ),
                  "_blank"
                )
              }
              style={primaryButton}
            >
              View Customer Page ↗
            </button>
          )}
        </div>
      </div>

      {/* STATUS BAR */}

      <div style={statusBar}>
        <div style={statusItem}>
          <span style={statusDot} />
          <strong>
            {business.status || "active"}
          </strong>
        </div>

        <div style={statusItem}>
          {activeDevices.length} active
          device
          {activeDevices.length !== 1
            ? "s"
            : ""}
        </div>

        <div style={statusItem}>
          {enabledFeatures.length} enabled
          module
          {enabledFeatures.length !== 1
            ? "s"
            : ""}
        </div>

        <div style={statusItem}>
          {interactions.length} interactions
        </div>
      </div>

      {/* NAVIGATION */}

      <div style={tabsContainer}>
        <Tab
          label="Overview"
          active={
            activeTab === "overview"
          }
          onClick={() =>
            setActiveTab("overview")
          }
        />

        <Tab
          label="Experience"
          active={
            activeTab === "experience"
          }
          onClick={() =>
            setActiveTab("experience")
          }
        />

        <Tab
          label="Modules"
          active={
            activeTab === "modules"
          }
          onClick={() =>
            setActiveTab("modules")
          }
        />

        {enabledFeatures.some(
          (feature) =>
            feature.is_paid &&
            feature.feature_key
              .toLowerCase()
              .includes("loyalty")
        ) && (
          <Tab
            label="Loyalty"
            active={activeTab === "loyalty"}
            onClick={() => setActiveTab("loyalty")}
          />
        )}

        <Tab
          label="Analytics"
          active={
            activeTab === "analytics"
          }
          onClick={() =>
            setActiveTab("analytics")
          }
        />

        <Tab
          label="Devices"
          active={
            activeTab === "devices"
          }
          onClick={() =>
            setActiveTab("devices")
          }
        />
      </div>

      {/* =====================================================
          OVERVIEW
      ===================================================== */}

      {activeTab === "overview" && (
        <section>
          <div style={metricsGrid}>
            <Metric
              title="Total Interactions"
              value={interactions.length}
              description="All recorded TAPX interactions"
            />

            <Metric
              title="Today"
              value={todayInteractions}
              description="Interactions today"
            />

            <Metric
              title="Enabled Modules"
              value={enabledFeatures.length}
              description={`${coreFeatures.length} core · ${paidFeatures.length} paid`}
            />

            <Metric
              title="Active Devices"
              value={activeDevices.length}
              description={`${devices.length} total assigned`}
            />
          </div>

          <div style={twoColumnGrid}>
            <Card>
              <CardHeader
                title="Business Information"
                description="Basic client details"
              />

              <InfoRow
                label="Business"
                value={business.name}
              />

              <InfoRow
                label="Category"
                value={formatCategory(
                  business.category
                )}
              />

              <InfoRow
                label="Phone"
                value={
                  business.phone ||
                  "Not configured"
                }
              />

              <InfoRow
                label="Email"
                value={
                  business.email ||
                  "Not configured"
                }
              />

              <InfoRow
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
            </Card>

            <Card>
              <CardHeader
                title="Core Experience"
                description="Standard TAPX features"
              />

              {coreFeatures.length === 0 ? (
                <EmptyState text="No core features configured." />
              ) : (
                <div style={featureGrid}>
                  {coreFeatures.map(
                    (feature) => (
                      <FeaturePill
                        key={feature.id}
                        feature={feature}
                      />
                    )
                  )}
                </div>
              )}
            </Card>
          </div>

          <Card style={{ marginTop: 20 }}>
            <CardHeader
              title="Recent Activity"
              description="Latest customer interactions"
            />

            {interactions.length === 0 ? (
              <EmptyState text="No interactions recorded yet." />
            ) : (
              <div>
                {interactions
                  .slice(0, 8)
                  .map(
                    (interaction) => (
                      <div
                        key={
                          interaction.id
                        }
                        style={activityRow}
                      >
                        <div
                          style={
                            activityIcon
                          }
                        >
                          ⚡
                        </div>

                        <div
                          style={{
                            flex: 1,
                          }}
                        >
                          <strong
                            style={
                              activityTitle
                            }
                          >
                            {formatInteraction(
                              interaction.interaction_type
                            )}
                          </strong>

                          <div
                            style={
                              activityDate
                            }
                          >
                            {new Date(
                              interaction.created_at
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
              </div>
            )}
          </Card>
        </section>
      )}

      {/* =====================================================
          EXPERIENCE
      ===================================================== */}

      {activeTab === "experience" && (
        <section>
          <Card>
            <CardHeader
              title="Customer Experience"
              description="The experience customers see after tapping the TAPX device"
            />

            {activeDevices.length === 0 ? (
              <EmptyState text="No active device is assigned to this client." />
            ) : (
              <div>
                {activeDevices.map(
                  (device) => {
                    const url =
                      getCustomerUrl(
                        device.device_code
                      );

                    return (
                      <div
                        key={device.id}
                        style={
                          experienceCard
                        }
                      >
                        <div
                          style={{
                            flex: 1,
                          }}
                        >
                          <div
                            style={
                              deviceCode
                            }
                          >
                            {
                              device.device_code
                            }
                          </div>

                          <div
                            style={
                              deviceUrl
                            }
                          >
                            {url}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              url,
                              "_blank"
                            )
                          }
                          style={
                            primaryButton
                          }
                        >
                          Open Experience ↗
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </Card>

          <Card
            style={{
              marginTop: 20,
            }}
          >
            <CardHeader
              title="Customer Actions"
              description="Core actions currently available"
            />

            <div style={featureGrid}>
              <ExperienceItem
                icon="💳"
                title="UPI Payment"
                enabled={
                  Boolean(
                    business.upi_id
                  ) &&
                  Boolean(
                    business.payment_enabled
                  )
                }
              />

              <ExperienceItem
                icon="💬"
                title="WhatsApp"
                enabled={Boolean(
                  business.whatsapp_number
                )}
              />

              <ExperienceItem
                icon="⭐"
                title="Google Review"
                enabled={Boolean(
                  business.google_review_url
                )}
              />

              <ExperienceItem
                icon="📸"
                title="Instagram"
                enabled={Boolean(
                  business.instagram_url
                )}
              />

              <ExperienceItem
                icon="📞"
                title="Call"
                enabled={Boolean(
                  business.phone
                )}
              />

              <ExperienceItem
                icon="📍"
                title="Location"
                enabled={Boolean(
                  business.address ||
                    business.city
                )}
              />
            </div>
          </Card>
        </section>
      )}

      {/* =====================================================
          MODULES
      ===================================================== */}

      {activeTab === "modules" && (
        <section>
          <div
            style={{
              marginBottom: 18,
            }}
          >
            <h2 style={sectionTitle}>
              Modules
            </h2>

            <p style={sectionDescription}>
              Enable and configure the features
              available to this client.
            </p>
          </div>

          {moduleMessage && (
            <div style={moduleMessageStyle}>
              {moduleMessage}
            </div>
          )}

          {enabledFeatures.length === 0 ? (
            <Card>
              <div style={moduleRecommendation}>
                <div>
                  <div style={recommendationEyebrow}>
                    RECOMMENDED FOR RETAIL
                  </div>

                  <h3
                    style={{
                      margin: "5px 0 6px",
                      fontSize: 19,
                    }}
                  >
                    Product Catalogue
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "#64748b",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    Let customers browse products,
                    prices and descriptions directly
                    from their TAPX experience.
                  </p>
                </div>

                {(() => {
                  const productFeature =
                    features.find((feature) =>
                      `${feature.feature_key} ${feature.name}`
                        .toLowerCase()
                        .includes("product catalogue")
                    );

                  return productFeature ? (
                    <button
                      type="button"
                      onClick={() =>
                        enableModule(productFeature)
                      }
                      style={primaryButton}
                    >
                      Enable Product Catalogue
                    </button>
                  ) : (
                    <span
                      style={{
                        color: "#b45309",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Product Catalogue is not in
                      feature catalog
                    </span>
                  );
                })()}
              </div>
            </Card>
          ) : (
            <>
              <div style={moduleGrid}>
                {enabledFeatures.map(
                  (feature) => {
                    const config =
                      getModuleConfig(
                        feature.id
                      );

                    const selected =
                      selectedFeatureId ===
                      feature.id;

                    return (
                      <div
                        key={feature.id}
                        style={{
                          ...moduleCard,
                          border: selected
                            ? "1px solid #2563eb"
                            : "1px solid #e5e7eb",
                        }}
                      >
                        <div style={moduleTop}>
                          <div style={moduleIcon}>
                            {getFeatureIcon(
                              feature
                            )}
                          </div>

                          <span
                            style={
                              feature.is_core
                                ? coreBadge
                                : paidBadge
                            }
                          >
                            {feature.is_core
                              ? "CORE"
                              : "PAID"}
                          </span>
                        </div>

                        <h3 style={moduleTitle}>
                          {feature.name}
                        </h3>

                        <p style={moduleDescription}>
                          {feature.description ||
                            "TAPX business module"}
                        </p>

                        <div
                          style={{
                            ...moduleFooter,
                            display: "flex",
                            alignItems: "center",
                            justifyContent:
                              "space-between",
                            gap: 10,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: config
                                ? "#15803d"
                                : "#d97706",
                              fontWeight: 700,
                            }}
                          >
                            {config
                              ? "✓ Configured"
                              : "⚠ Configuration needed"}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              openModuleEditor(
                                feature
                              )
                            }
                            style={secondaryButton}
                          >
                            {selected
                              ? "Editing"
                              : "Configure"}
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {(() => {
                const availablePaidFeatures = features.filter(
                  (feature) =>
                    feature.is_paid &&
                    !enabledFeatures.some(
                      (enabledFeature) =>
                        enabledFeature.id === feature.id
                    )
                );

                if (availablePaidFeatures.length === 0) {
                  return null;
                }

                const categoryLabel =
                  business.category
                    ? business.category.charAt(0).toUpperCase() +
                      business.category.slice(1)
                    : "this business";

                return (
                  <Card style={{ marginTop: 20 }}>
                    <div
                      style={{
                        marginBottom: 14,
                      }}
                    >
                      <div style={recommendationEyebrow}>
                        AVAILABLE PAID MODULES
                      </div>
                      <h3
                        style={{
                          margin: "5px 0 5px",
                          fontSize: 20,
                        }}
                      >
                        Add More to {business.name}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          color: "#64748b",
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        These modules are available for this client.
                        TAPX can recommend category-specific modules
                        for {categoryLabel}, but you can enable any
                        paid module when the client purchases it.
                      </p>
                    </div>

                    <div style={moduleGrid}>
                      {availablePaidFeatures.map((feature) => (
                        <div
                          key={feature.id}
                          style={moduleCard}
                        >
                          <div style={moduleTop}>
                            <div style={moduleIcon}>
                              {getFeatureIcon(feature)}
                            </div>

                            <span style={paidBadge}>PAID</span>
                          </div>

                          <h3 style={moduleTitle}>
                            {feature.name}
                          </h3>

                          <p style={moduleDescription}>
                            {feature.description ||
                              "TAPX business module"}
                          </p>

                          <div
                            style={{
                              ...moduleFooter,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                enableModule(feature)
                              }
                              style={primaryButton}
                            >
                              Enable Module
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })()}

              {selectedFeatureId && (
                (() => {
                  const selectedFeature =
                    enabledFeatures.find(
                      (feature) =>
                        feature.id ===
                        selectedFeatureId
                    );

                  if (!selectedFeature) {
                    return null;
                  }

                  return (
                    <Card
                      style={{
                        marginTop: 20,
                      }}
                    >
                      <div
                        style={
                          moduleEditorHeader
                        }
                      >
                        <div>
                          <div
                            style={
                              recommendationEyebrow
                            }
                          >
                            MODULE CONFIGURATION
                          </div>

                          <h3
                            style={{
                              margin:
                                "5px 0 4px",
                              fontSize: 20,
                            }}
                          >
                            {getFeatureIcon(
                              selectedFeature
                            )}{" "}
                            {selectedFeature.name}
                          </h3>

                          <p
                            style={{
                              margin: 0,
                              color: "#64748b",
                              fontSize: 13,
                            }}
                          >
                            Changes are saved to
                            this client's TAPX
                            experience.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFeatureId(
                              null
                            )
                          }
                          style={
                            secondaryButton
                          }
                        >
                          Close
                        </button>
                      </div>

                      <ModuleConfigurator
                        feature={
                          selectedFeature as ConfigFeature
                        }
                        config={editingConfig}
                        onChange={
                          setEditingConfig
                        }
                      />

                      <div
                        style={
                          moduleSaveBar
                        }
                      >
                        <span
                          style={{
                            color: "#64748b",
                            fontSize: 12,
                          }}
                        >
                          {Object.keys(
                            editingConfig
                          ).filter(
                            (key) =>
                              key !== "__draft"
                          ).length > 0
                            ? "Unsaved changes are shown above."
                            : "Start by adding your first item."}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            saveModuleConfig(
                              selectedFeature
                            )
                          }
                          disabled={savingModule}
                          style={{
                            ...primaryButton,
                            opacity:
                              savingModule
                                ? 0.65
                                : 1,
                            cursor:
                              savingModule
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {savingModule
                            ? "Saving..."
                            : "Save Configuration"}
                        </button>
                      </div>
                    </Card>
                  );
                })()
              )}
            </>
          )}
        </section>
      )}

      {/* =====================================================
          ANALYTICS
      ===================================================== */}

      {activeTab === "loyalty" && (
        <section>
          <div style={sectionHeadingRow}>
            <div>
              <h2 style={sectionTitle}>Customer Loyalty</h2>
              <p style={sectionDescription}>
                Verify completed visits and award loyalty progress. This module is available only because Customer Loyalty is enabled for this client.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadLoyaltyMembers(businessId)}
              style={secondaryButton}
            >
              ↻ Refresh
            </button>
          </div>

          {loyaltyMessage && (
            <div style={moduleMessageStyle}>{loyaltyMessage}</div>
          )}

          <div style={card}>
            <input
              value={loyaltySearch}
              onChange={(event) => setLoyaltySearch(event.target.value)}
              placeholder="Search customer by name or mobile..."
              style={loyaltySearchInput}
            />

            {loyaltyLoading ? (
              <p style={emptyText}>Loading loyalty members...</p>
            ) : loyaltyMembers.filter((member) => {
                const query = loyaltySearch.trim().toLowerCase();
                if (!query) return true;
                return (
                  member.customer?.name?.toLowerCase().includes(query) ||
                  member.customer?.phone?.toLowerCase().includes(query)
                );
              }).length === 0 ? (
              <p style={emptyText}>No loyalty members found.</p>
            ) : (
              <div>
                {loyaltyMembers
                  .filter((member) => {
                    const query = loyaltySearch.trim().toLowerCase();
                    if (!query) return true;
                    return (
                      member.customer?.name?.toLowerCase().includes(query) ||
                      member.customer?.phone?.toLowerCase().includes(query)
                    );
                  })
                  .map((member) => (
                    <div key={member.id} style={loyaltyMemberRow}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ display: "block" }}>
                          {member.customer?.name || "Unnamed customer"}
                        </strong>
                        <span style={loyaltyPhone}>
                          {member.customer?.phone || "No mobile"}
                        </span>
                        <div style={loyaltyProgressText}>
                          {member.visits} verified visit{member.visits === 1 ? "" : "s"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => recordLoyaltyVisit(member)}
                        disabled={loyaltySavingCustomer === member.id}
                        style={{
                          ...primaryButton,
                          opacity: loyaltySavingCustomer === member.id ? 0.6 : 1,
                        }}
                      >
                        {loyaltySavingCustomer === member.id
                          ? "Recording..."
                          : "+ Record Visit"}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "analytics" && (
        <section>
          <div style={metricsGrid}>
            <Metric
              title="Total Taps"
              value={interactions.length}
              description="All recorded interactions"
            />

            <Metric
              title="Today"
              value={todayInteractions}
              description="Interactions today"
            />

            <Metric
              title="Active Devices"
              value={activeDevices.length}
              description="Currently active"
            />

            <Metric
              title="Modules"
              value={enabledFeatures.length}
              description="Enabled modules"
            />
          </div>

          <Card
            style={{
              marginTop: 20,
            }}
          >
            <CardHeader
              title="Interaction History"
              description="Recent customer activity"
            />

            {interactions.length === 0 ? (
              <EmptyState text="No analytics data available yet." />
            ) : (
              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse:
                      "collapse",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        textAlign: "left",
                        background:
                          "#f8fafc",
                      }}
                    >
                      <th
                        style={
                          tableHeader
                        }
                      >
                        Interaction
                      </th>

                      <th
                        style={
                          tableHeader
                        }
                      >
                        Date & Time
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {interactions.map(
                      (interaction) => (
                        <tr
                          key={
                            interaction.id
                          }
                          style={
                            tableRow
                          }
                        >
                          <td
                            style={
                              tableCell
                            }
                          >
                            {formatInteraction(
                              interaction.interaction_type
                            )}
                          </td>

                          <td
                            style={
                              tableCell
                            }
                          >
                            {new Date(
                              interaction.created_at
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* =====================================================
          DEVICES
      ===================================================== */}

      {activeTab === "devices" && (
        <section>
          <Card>
            <CardHeader
              title="Assigned Devices"
              description="NFC and QR devices belonging to this client"
            />

            {devices.length === 0 ? (
              <EmptyState text="No devices assigned yet." />
            ) : (
              <div>
                {devices.map((device) => (
                  <div
                    key={device.id}
                    style={deviceRow}
                  >
                    <div
                      style={
                        deviceCodeBox
                      }
                    >
                      {device.device_code}
                    </div>

                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <strong>
                        {device.device_type ||
                          "NFC Device"}
                      </strong>

                      <div
                        style={
                          deviceLocation
                        }
                      >
                        {device.location ||
                          "No location specified"}
                      </div>
                    </div>

                    <span
                      style={{
                        ...statusBadge,
                        background:
                          device.status?.toLowerCase() ===
                          "active"
                            ? "#dcfce7"
                            : "#f1f5f9",
                        color:
                          device.status?.toLowerCase() ===
                          "active"
                            ? "#15803d"
                            : "#475569",
                      }}
                    >
                      {device.status ||
                        "unknown"}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          getCustomerUrl(
                            device.device_code
                          ),
                          "_blank"
                        )
                      }
                      style={
                        secondaryButton
                      }
                    >
                      Open ↗
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      )}
    </main>
  );
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...tabButton,
        color: active
          ? "#2563eb"
          : "#64748b",
        borderBottom: active
          ? "2px solid #2563eb"
          : "2px solid transparent",
        fontWeight: active ? 700 : 500,
      }}
    >
      {label}
    </button>
  );
}

function Metric({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <div style={metricCard}>
      <div style={metricLabel}>
        {title}
      </div>

      <div style={metricValue}>
        {value}
      </div>

      <div style={metricDescription}>
        {description}
      </div>
    </div>
  );
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        ...card,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div style={cardHeader}>
      <h3 style={cardTitle}>
        {title}
      </h3>

      <p style={cardDescription}>
        {description}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={infoRow}>
      <span style={infoLabel}>
        {label}
      </span>

      <span style={infoValue}>
        {value}
      </span>
    </div>
  );
}

function FeaturePill({
  feature,
}: {
  feature: Feature;
}) {
  return (
    <div style={featurePill}>
      <span>
        {feature.icon || "⚡"}
      </span>

      <span>{feature.name}</span>
    </div>
  );
}

function ExperienceItem({
  icon,
  title,
  enabled,
}: {
  icon: string;
  title: string;
  enabled: boolean;
}) {
  return (
    <div style={experienceItem}>
      <span style={experienceItemIcon}>
        {icon}
      </span>

      <div
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {title}
      </div>

      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: enabled
            ? "#15803d"
            : "#94a3b8",
        }}
      >
        {enabled
          ? "ACTIVE"
          : "NOT SET"}
      </span>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div style={emptyState}>
      {text}
    </div>
  );
}

/* =========================================================
   STYLES
========================================================= */

const sectionHeadingRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  marginBottom: 18,
};

const loyaltySearchInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  border: "1px solid #dbe1ea",
  borderRadius: 9,
  outline: "none",
  marginBottom: 10,
  fontSize: 14,
};

const loyaltyMemberRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "16px 0",
  borderBottom: "1px solid #eef2f7",
};

const loyaltyPhone: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 13,
  marginTop: 3,
};

const loyaltyProgressText: React.CSSProperties = {
  color: "#475569",
  fontSize: 13,
  marginTop: 8,
};

const emptyText: React.CSSProperties = {
  color: "#64748b",
  padding: "24px 0",
  textAlign: "center",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f5f7fb",
  padding: "32px 40px",
  color: "#111827",
};

const loadingCard: React.CSSProperties = {
  maxWidth: 500,
  margin: "100px auto",
  padding: 40,
  background: "white",
  borderRadius: 16,
  textAlign: "center",
  border: "1px solid #e5e7eb",
};

const loadingIcon: React.CSSProperties = {
  fontSize: 36,
};

const loadingTitle: React.CSSProperties = {
  margin: "12px 0 6px",
};

const loadingText: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
};

const errorCard: React.CSSProperties = {
  maxWidth: 500,
  margin: "100px auto",
  padding: 32,
  background: "white",
  borderRadius: 16,
  textAlign: "center",
  border: "1px solid #fecaca",
};

const errorIcon: React.CSSProperties = {
  fontSize: 36,
};

const errorTitle: React.CSSProperties = {
  margin: "12px 0 8px",
};

const errorText: React.CSSProperties = {
  color: "#64748b",
  marginBottom: 20,
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  marginBottom: 20,
};

const backButton: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "#2563eb",
  fontWeight: 600,
  cursor: "pointer",
};

const businessHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginTop: 16,
};

const businessAvatar: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 16,
  background: "#e0e7ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#3730a3",
  fontWeight: 800,
  fontSize: 20,
  overflow: "hidden",
};

const logoImage: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  fontWeight: 800,
};

const headerMeta: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
  marginTop: 6,
};

const categoryBadge: React.CSSProperties = {
  background: "#eef2ff",
  color: "#4338ca",
  padding: "4px 9px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 700,
};

const clientSince: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
};

const statusBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 28,
  flexWrap: "wrap",
  padding: "13px 16px",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  marginBottom: 20,
  fontSize: 13,
  color: "#64748b",
};

const statusItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
};

const statusDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#22c55e",
  marginRight: 7,
};

const tabsContainer: React.CSSProperties = {
  display: "flex",
  gap: 4,
  background: "white",
  borderBottom: "1px solid #e5e7eb",
  marginBottom: 24,
  overflowX: "auto",
};

const tabButton: React.CSSProperties = {
  padding: "13px 18px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const primaryButton: React.CSSProperties = {
  border: "none",
  background: "#111827",
  color: "white",
  padding: "10px 15px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryButton: React.CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1d4ed8",
  padding: "10px 15px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const metricsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: 16,
};

const metricCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 20,
};

const metricLabel: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  fontWeight: 600,
};

const metricValue: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 800,
  marginTop: 8,
  color: "#111827",
};

const metricDescription: React.CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  marginTop: 4,
};

const twoColumnGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: 20,
  marginTop: 20,
};

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 22,
};

const cardHeader: React.CSSProperties = {
  marginBottom: 20,
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  color: "#111827",
};

const cardDescription: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: 13,
};

const infoRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  padding: "12px 0",
  borderBottom: "1px solid #f1f5f9",
};

const infoLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const infoValue: React.CSSProperties = {
  color: "#111827",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "right",
};

const featureGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const featurePill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 14px",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  background: "#f8fafc",
  fontSize: 13,
  fontWeight: 600,
};

const activityRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #f1f5f9",
};

const activityIcon: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 9,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const activityTitle: React.CSSProperties = {
  fontSize: 14,
};

const activityDate: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 3,
};

const experienceCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  padding: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  marginBottom: 10,
};

const deviceCode: React.CSSProperties = {
  fontFamily: "monospace",
  fontWeight: 800,
  fontSize: 14,
};

const deviceUrl: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 5,
  wordBreak: "break-all",
};

const experienceItem: React.CSSProperties = {
  padding: 14,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const experienceItemIcon: React.CSSProperties = {
  fontSize: 20,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
};

const sectionDescription: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: 13,
};

const moduleGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3, minmax(0, 1fr))",
  gap: 16,
};

const moduleCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 20,
};

const moduleTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const moduleIcon: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 11,
  background: "#f1f5f9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const moduleTitle: React.CSSProperties = {
  margin: "16px 0 6px",
  fontSize: 17,
};

const moduleDescription: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.5,
};

const moduleFooter: React.CSSProperties = {
  marginTop: 16,
  paddingTop: 14,
  borderTop: "1px solid #e5e7eb",
};

const coreBadge: React.CSSProperties = {
  background: "#dcfce7",
  color: "#15803d",
  padding: "4px 8px",
  borderRadius: 20,
  fontSize: 10,
  fontWeight: 800,
};

const paidBadge: React.CSSProperties = {
  background: "#fef3c7",
  color: "#92400e",
  padding: "4px 8px",
  borderRadius: 20,
  fontSize: 10,
  fontWeight: 800,
};

const tableHeader: React.CSSProperties = {
  padding: 12,
  fontSize: 12,
  color: "#64748b",
};

const tableRow: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
};

const tableCell: React.CSSProperties = {
  padding: 13,
  fontSize: 13,
};

const deviceRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "16px 0",
  borderBottom: "1px solid #e5e7eb",
};

const deviceCodeBox: React.CSSProperties = {
  fontFamily: "monospace",
  fontWeight: 800,
  background: "#f1f5f9",
  padding: "8px 10px",
  borderRadius: 8,
};

const deviceLocation: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 3,
};

const statusBadge: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 700,
};

const moduleRecommendation: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
  padding: 20,
  border: "1px solid #dbeafe",
  borderRadius: 12,
  background: "#f8fbff",
};

const recommendationEyebrow: React.CSSProperties = {
  color: "#2563eb",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1,
};

const moduleMessageStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: "11px 14px",
  borderRadius: 9,
  background: "#eff6ff",
  border: "1px solid #dbeafe",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 600,
};

const moduleEditorHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 20,
  paddingBottom: 18,
  borderBottom: "1px solid #e5e7eb",
};

const moduleSaveBar: React.CSSProperties = {
  marginTop: 20,
  paddingTop: 16,
  borderTop: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const emptyState: React.CSSProperties = {
  padding: 30,
  textAlign: "center",
  color: "#64748b",
  background: "#f8fafc",
  borderRadius: 10,
};