"use client";

import { useEffect, useState } from "react";
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
  status: string | null;
  created_at: string;

  // Customer experience settings
  google_review_url: string | null;
  instagram_url: string | null;
  payment_url: string | null;
  whatsapp_number: string | null;
};

type Device = {
  id: string;
  device_code: string;
  business_id: string | null;
  device_type: string | null;
  location: string | null;
  status: string | null;
};

type SettingsForm = {
  google_review_url: string;
  instagram_url: string;
  payment_url: string;
  whatsapp_number: string;
};

export default function ClientsPage() {
  const router = useRouter();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Selected business for settings
  const [selectedBusiness, setSelectedBusiness] =
    useState<Business | null>(null);

  const [settings, setSettings] = useState<SettingsForm>({
    google_review_url: "",
    instagram_url: "",
    payment_url: "",
    whatsapp_number: "",
  });

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Delete state
  const [deletingBusinessId, setDeletingBusinessId] =
    useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  // =========================================================
  // LOAD CLIENTS
  // =========================================================

  async function loadClients() {
    setLoading(true);
    setError("");

    try {
      const [
        { data: businessData, error: businessError },
        { data: deviceData, error: deviceError },
      ] = await Promise.all([
        supabase
          .from("businesses")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("devices")
          .select("*"),
      ]);

      if (businessError) {
        throw businessError;
      }

      if (deviceError) {
        throw deviceError;
      }

      setBusinesses((businessData || []) as Business[]);
      setDevices((deviceData || []) as Device[]);
    } catch (err) {
      console.error("Error loading clients:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load clients. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // DEVICE HELPERS
  // =========================================================

  function getDeviceCount(businessId: string) {
    return devices.filter(
      (device) => device.business_id === businessId
    ).length;
  }

  function getActiveDeviceCount(businessId: string) {
    return devices.filter(
      (device) =>
        device.business_id === businessId &&
        device.status?.toLowerCase() === "active"
    ).length;
  }

  // =========================================================
  // CLIENT HELPERS
  // =========================================================

  function getInitials(name: string) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }

  function isConfigured(value: string | null) {
    return !!value && value.trim().length > 0;
  }

  // =========================================================
  // OPEN SETTINGS
  // =========================================================

  function openSettings(business: Business) {
    setSelectedBusiness(business);

    setSettings({
      google_review_url: business.google_review_url || "",
      instagram_url: business.instagram_url || "",
      payment_url: business.payment_url || "",
      whatsapp_number: business.whatsapp_number || "",
    });

    setSaveMessage("");
    setError("");
  }

  // =========================================================
  // CLOSE SETTINGS
  // =========================================================

  function closeSettings() {
    if (saving) return;

    setSelectedBusiness(null);
    setSaveMessage("");
  }

  // =========================================================
  // SAVE SETTINGS
  // =========================================================

  async function saveSettings() {
    if (!selectedBusiness) return;

    setSaving(true);
    setSaveMessage("");
    setError("");

    try {
      const { data, error: updateError } = await supabase
        .from("businesses")
        .update({
          google_review_url:
            settings.google_review_url.trim() || null,

          instagram_url:
            settings.instagram_url.trim() || null,

          payment_url:
            settings.payment_url.trim() || null,

          whatsapp_number:
            settings.whatsapp_number.trim() || null,
        })
        .eq("id", selectedBusiness.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Update local business list immediately
      setBusinesses((currentBusinesses) =>
        currentBusinesses.map((business) =>
          business.id === selectedBusiness.id
            ? (data as Business)
            : business
        )
      );

      setSelectedBusiness(data as Business);

      setSettings({
        google_review_url: data.google_review_url || "",
        instagram_url: data.instagram_url || "",
        payment_url: data.payment_url || "",
        whatsapp_number: data.whatsapp_number || "",
      });

      setSaveMessage("Changes saved successfully.");
    } catch (err) {
      console.error(
        "Error saving business settings:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save changes. Please check your Supabase permissions."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // DELETE CLIENT
  // =========================================================

  async function deleteClient(business: Business) {
    if (deletingBusinessId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${business.name}" permanently?\n\n` +
        `This will remove the client, its TAPX configuration, ` +
        `enabled modules and interaction history.\n\n` +
        `Any NFC device assigned to this client will NOT be deleted. ` +
        `It will be returned to Available inventory.\n\n` +
        `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingBusinessId(business.id);
    setError("");

    try {
      const { error: deleteError } = await supabase.rpc(
        "delete_tapx_business",
        {
          p_business_id: business.id,
        }
      );

      if (deleteError) {
        console.error(
          "TAPX client deletion error:",
          deleteError
        );

        throw deleteError;
      }

      // -------------------------------------------------------
      // Remove client from local state
      // -------------------------------------------------------

      setBusinesses((currentBusinesses) =>
        currentBusinesses.filter(
          (item) => item.id !== business.id
        )
      );

      // -------------------------------------------------------
      // Release assigned devices locally
      // -------------------------------------------------------

      setDevices((currentDevices) =>
        currentDevices.map((device) =>
          device.business_id === business.id
            ? {
                ...device,
                business_id: null,
                status: "unassigned",
              }
            : device
        )
      );

      // -------------------------------------------------------
      // Close settings if this client was open
      // -------------------------------------------------------

      if (
        selectedBusiness &&
        selectedBusiness.id === business.id
      ) {
        setSelectedBusiness(null);
        setSaveMessage("");
      }

      alert(
        `"${business.name}" has been deleted successfully.`
      );
    } catch (err) {
      console.error(
        "Unable to delete TAPX client:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete client."
      );
    } finally {
      setDeletingBusinessId(null);
    }
  }

  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "40px",
      }}
    >
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "30px",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              border: "none",
              background: "transparent",
              color: "#64748b",
              padding: "0",
              marginBottom: "12px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            ← Back to Dashboard
          </button>

          <h1
            style={{
              fontSize: "32px",
              fontWeight: 700,
              margin: 0,
              color: "#111827",
            }}
          >
            Clients
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#64748b",
              fontSize: "16px",
            }}
          >
            Manage businesses and their TAPX customer
            experience.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {/* Dashboard */}
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              border: "1px solid #d1d5db",
              background: "white",
              color: "#374151",
              padding: "11px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Dashboard
          </button>

          {/* Add Client */}
          <button
            type="button"
            onClick={() => router.push("/clients/add")}
            style={{
              border: "none",
              background: "#111827",
              color: "white",
              padding: "11px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + Add New Client
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={loadClients}
            disabled={loading}
            style={{
              border: "1px solid #d1d5db",
              background: "#f8fafc",
              color: "#374151",
              padding: "11px 18px",
              borderRadius: "8px",
              cursor: loading
                ? "not-allowed"
                : "pointer",
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "16px",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          <strong>Something went wrong</strong>

          <div
            style={{
              marginTop: "5px",
            }}
          >
            {error}
          </div>
        </div>
      )}

      {/* =====================================================
          STATS
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <StatCard
          title="Total Clients"
          value={businesses.length}
        />

        <StatCard
          title="Active Clients"
          value={
            businesses.filter(
              (business) =>
                business.status?.toLowerCase() ===
                "active"
            ).length
          }
        />

        <StatCard
          title="Total Devices"
          value={devices.length}
        />

        <StatCard
          title="Unassigned Devices"
          value={
            devices.filter(
              (device) =>
                !device.business_id ||
                device.status?.toLowerCase() ===
                  "unassigned"
            ).length
          }
        />
      </div>

      {/* =====================================================
          CLIENTS TABLE
      ===================================================== */}

      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {/* Table Header */}
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              color: "#111827",
            }}
          >
            All Clients
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#64748b",
            }}
          >
            Businesses currently registered with TAPX.
          </p>
        </div>

        {/* Loading */}
        {loading ? (
          <div
            style={{
              padding: "60px 30px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <div
              style={{
                fontSize: "30px",
                marginBottom: "10px",
              }}
            >
              ⚡
            </div>

            <div
              style={{
                fontWeight: 600,
                color: "#334155",
              }}
            >
              Loading clients...
            </div>
          </div>
        ) : businesses.length === 0 ? (
          /* Empty */
          <div
            style={{
              padding: "60px 30px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <div
              style={{
                fontSize: "40px",
                marginBottom: "12px",
              }}
            >
              🏢
            </div>

            <h3
              style={{
                margin: 0,
                color: "#111827",
                fontSize: "18px",
              }}
            >
              No clients found
            </h3>

            <p
              style={{
                marginTop: "8px",
              }}
            >
              Start by adding your first TAPX client.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/clients/add")
              }
              style={{
                marginTop: "15px",
                border: "none",
                background: "#111827",
                color: "white",
                padding: "11px 18px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              + Add New Client
            </button>
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f8fafc",
                    textAlign: "left",
                  }}
                >
                  <th style={thStyle}>Business</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Location</th>
                  <th style={thStyle}>Devices</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>
                    Customer Experience
                  </th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>

              <tbody>
                {businesses.map((business) => {
                  const deviceCount =
                    getDeviceCount(business.id);

                  const activeDeviceCount =
                    getActiveDeviceCount(
                      business.id
                    );

                  const configuredCount = [
                    business.google_review_url,
                    business.instagram_url,
                    business.payment_url,
                    business.whatsapp_number,
                  ].filter(isConfigured).length;

                  const isDeleting =
                    deletingBusinessId ===
                    business.id;

                  return (
                    <tr
                      key={business.id}
                      style={{
                        borderTop:
                          "1px solid #e5e7eb",
                      }}
                    >
                      {/* =================================================
                          BUSINESS
                      ================================================= */}

                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          <div
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius: "10px",
                              background:
                                "#eef2ff",
                              display: "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              fontWeight: 700,
                              color: "#4338ca",
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(
                              business.name
                            )}
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/clients/${business.id}`)
                              }
                              disabled={isDeleting}
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                margin: 0,
                                fontWeight: 600,
                                color: "#111827",
                                cursor: isDeleting ? "not-allowed" : "pointer",
                                textAlign: "left",
                                fontSize: "inherit",
                              }}
                              title="Open Client Workspace"
                            >
                              {business.name}
                            </button>

                            <div
                              style={{
                                fontSize: "13px",
                                color: "#64748b",
                                marginTop: "3px",
                              }}
                            >
                              ID:{" "}
                              {business.id.substring(
                                0,
                                8
                              )}
                              ...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* =================================================
                          CATEGORY
                      ================================================= */}

                      <td style={tdStyle}>
                        {business.category || "—"}
                      </td>

                      {/* =================================================
                          LOCATION
                      ================================================= */}

                      <td style={tdStyle}>
                        <div>
                          {business.city || "—"}

                          {business.state
                            ? `, ${business.state}`
                            : ""}
                        </div>

                        {business.address && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#94a3b8",
                              marginTop: "4px",
                              maxWidth: "220px",
                            }}
                          >
                            {business.address}
                          </div>
                        )}
                      </td>

                      {/* =================================================
                          DEVICES
                      ================================================= */}

                      <td style={tdStyle}>
                        <strong>
                          {deviceCount}
                        </strong>

                        {deviceCount > 0 && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#16a34a",
                              marginTop: "3px",
                            }}
                          >
                            {activeDeviceCount}{" "}
                            active
                          </div>
                        )}

                        {deviceCount === 0 && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#f59e0b",
                              marginTop: "3px",
                            }}
                          >
                            No device
                          </div>
                        )}
                      </td>

                      {/* =================================================
                          STATUS
                      ================================================= */}

                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding:
                              "5px 10px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background:
                              business.status?.toLowerCase() ===
                              "active"
                                ? "#dcfce7"
                                : "#f1f5f9",
                            color:
                              business.status?.toLowerCase() ===
                              "active"
                                ? "#15803d"
                                : "#475569",
                          }}
                        >
                          {business.status ||
                            "Unknown"}
                        </span>
                      </td>

                      {/* =================================================
                          CUSTOMER EXPERIENCE
                      ================================================= */}

                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            alignItems:
                              "center",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius:
                                "50%",
                              background:
                                configuredCount ===
                                4
                                  ? "#16a34a"
                                  : configuredCount >
                                    0
                                  ? "#f59e0b"
                                  : "#cbd5e1",
                            }}
                          />

                          <span
                            style={{
                              fontSize: "13px",
                              color: "#475569",
                            }}
                          >
                            {configuredCount}/4
                            {" configured"}
                          </span>
                        </div>
                      </td>

                      {/* =================================================
                          ACTIONS
                      ================================================= */}

                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            alignItems:
                              "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          {/* Client Workspace */}
                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/clients/${business.id}`)
                            }
                            disabled={isDeleting}
                            style={{
                              border: "1px solid #dbeafe",
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              padding: "9px 14px",
                              borderRadius: "8px",
                              cursor: isDeleting
                                ? "not-allowed"
                                : "pointer",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              opacity: isDeleting ? 0.5 : 1,
                            }}
                            title="Open Client Workspace"
                          >
                            Workspace
                          </button>

                          {/* Manage - Customer Experience */}
                          <button
                            type="button"
                            onClick={() =>
                              openSettings(
                                business
                              )
                            }
                            disabled={isDeleting}
                            style={{
                              border:
                                "1px solid #dbeafe",
                              background:
                                "#eff6ff",
                              color: "#1d4ed8",
                              padding:
                                "9px 14px",
                              borderRadius:
                                "8px",
                              cursor: isDeleting
                                ? "not-allowed"
                                : "pointer",
                              fontWeight: 600,
                              whiteSpace:
                                "nowrap",
                              opacity:
                                isDeleting
                                  ? 0.5
                                  : 1,
                            }}
                          >
                            Manage
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() =>
                              deleteClient(
                                business
                              )
                            }
                            disabled={
                              isDeleting ||
                              deletingBusinessId !==
                                null
                            }
                            style={{
                              border:
                                "1px solid #fecaca",
                              background:
                                "#fef2f2",
                              color: "#dc2626",
                              padding:
                                "9px 14px",
                              borderRadius:
                                "8px",
                              cursor:
                                isDeleting ||
                                deletingBusinessId !==
                                  null
                                  ? "not-allowed"
                                  : "pointer",
                              fontWeight: 600,
                              whiteSpace:
                                "nowrap",
                              opacity:
                                isDeleting
                                  ? 0.65
                                  : 1,
                            }}
                          >
                            {isDeleting
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================
          SETTINGS MODAL
      ===================================================== */}

      {selectedBusiness && (
        <div
          onClick={closeSettings}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "720px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "white",
              borderRadius: "16px",
              boxShadow:
                "0 25px 60px rgba(0,0,0,0.2)",
            }}
          >
            {/* =================================================
                MODAL HEADER
            ================================================= */}

            <div
              style={{
                padding: "24px 28px",
                borderBottom:
                  "1px solid #e5e7eb",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: "20px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "22px",
                    color: "#111827",
                  }}
                >
                  {selectedBusiness.name}
                </h2>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#64748b",
                    fontSize: "14px",
                  }}
                >
                  Customer Experience
                  Settings
                </p>
              </div>

              <button
                type="button"
                onClick={closeSettings}
                disabled={saving}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                  fontSize: "20px",
                  color: "#475569",
                }}
              >
                ×
              </button>
            </div>

            {/* =================================================
                BUSINESS INFORMATION
            ================================================= */}

            <div
              style={{
                padding: "26px 28px 0",
              }}
            >
              <SectionTitle
                title="Business Information"
                description="Basic information shown on the customer experience."
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "28px",
                }}
              >
                <InfoBox
                  label="Business"
                  value={
                    selectedBusiness.name
                  }
                />

                <InfoBox
                  label="Category"
                  value={
                    selectedBusiness.category ||
                    "—"
                  }
                />

                <InfoBox
                  label="Phone"
                  value={
                    selectedBusiness.phone ||
                    "—"
                  }
                />

                <InfoBox
                  label="Email"
                  value={
                    selectedBusiness.email ||
                    "—"
                  }
                />

                <InfoBox
                  label="City"
                  value={
                    selectedBusiness.city ||
                    "—"
                  }
                />

                <InfoBox
                  label="State"
                  value={
                    selectedBusiness.state ||
                    "—"
                  }
                />
              </div>

              {/* =================================================
                  CUSTOMER EXPERIENCE
              ================================================= */}

              <SectionTitle
                title="Customer Experience"
                description="These links appear when a customer taps your TAPX chip."
              />

              <div
                style={{
                  display: "flex",
                  flexDirection:
                    "column",
                  gap: "18px",
                  paddingBottom: "28px",
                }}
              >
                {/* Google Review */}

                <SettingField
                  icon="⭐"
                  title="Google Review"
                  description="Send customers directly to the business Google review page. Paste your Google Business review link, not your Maps location link."
                  value={
                    settings.google_review_url
                  }
                  placeholder="https://g.page/r/CXrdGmw-RmMwEBM/review"
                  onChange={(value) =>
                    setSettings(
                      (current) => ({
                        ...current,
                        google_review_url:
                          value,
                      })
                    )
                  }
                />

                {/* Instagram */}

                <SettingField
                  icon="📸"
                  title="Instagram"
                  description="Open the business Instagram profile."
                  value={
                    settings.instagram_url
                  }
                  placeholder="https://instagram.com/yourbusiness"
                  onChange={(value) =>
                    setSettings(
                      (current) => ({
                        ...current,
                        instagram_url:
                          value,
                      })
                    )
                  }
                />

                {/* Payment */}

                <SettingField
                  icon="💳"
                  title="Payment / UPI"
                  description="Payment link that customers can use from TAPX."
                  value={
                    settings.payment_url
                  }
                  placeholder="https://..."
                  onChange={(value) =>
                    setSettings(
                      (current) => ({
                        ...current,
                        payment_url: value,
                      })
                    )
                  }
                />

                {/* WhatsApp */}

                <SettingField
                  icon="💬"
                  title="WhatsApp"
                  description="WhatsApp number used for customer communication."
                  value={
                    settings.whatsapp_number
                  }
                  placeholder="9876543210"
                  onChange={(value) =>
                    setSettings(
                      (current) => ({
                        ...current,
                        whatsapp_number:
                          value,
                      })
                    )
                  }
                />
              </div>
            </div>

            {/* =================================================
                SAVE AREA
            ================================================= */}

            <div
              style={{
                padding: "20px 28px",
                borderTop:
                  "1px solid #e5e7eb",
                background: "#f8fafc",
              }}
            >
              {saveMessage && (
                <div
                  style={{
                    background: "#dcfce7",
                    color: "#166534",
                    padding:
                      "12px 14px",
                    borderRadius: "8px",
                    marginBottom: "14px",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  ✓ {saveMessage}
                </div>
              )}

              {error && (
                <div
                  style={{
                    background: "#fee2e2",
                    color: "#991b1b",
                    padding:
                      "12px 14px",
                    borderRadius: "8px",
                    marginBottom: "14px",
                    fontSize: "14px",
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={closeSettings}
                  disabled={saving}
                  style={{
                    border:
                      "1px solid #d1d5db",
                    background: "white",
                    color: "#374151",
                    padding:
                      "11px 18px",
                    borderRadius: "8px",
                    cursor: saving
                      ? "not-allowed"
                      : "pointer",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={saving}
                  style={{
                    border: "none",
                    background: "#111827",
                    color: "white",
                    padding:
                      "11px 20px",
                    borderRadius: "8px",
                    cursor: saving
                      ? "not-allowed"
                      : "pointer",
                    fontWeight: 600,
                    opacity: saving
                      ? 0.7
                      : 1,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          RESPONSIVE
      ===================================================== */}

      <style jsx>{`
        @media (max-width: 900px) {
          main {
            padding: 24px !important;
          }
        }

        @media (max-width: 650px) {
          main {
            padding: 16px !important;
          }
        }
      `}</style>
    </main>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "24px",
      }}
    >
      <p
        style={{
          color: "#64748b",
          margin: 0,
          fontSize: "14px",
        }}
      >
        {title}
      </p>

      <h2
        style={{
          fontSize: "30px",
          margin: "10px 0 0",
          color: "#111827",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

/* =========================================================
   SECTION TITLE
========================================================= */

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        marginBottom: "18px",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: "17px",
          color: "#111827",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: "5px 0 0",
          fontSize: "13px",
          color: "#64748b",
        }}
      >
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   INFO BOX
========================================================= */

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: "9px",
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "#94a3b8",
          marginBottom: "4px",
          textTransform:
            "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 600,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#334155",
          fontWeight: 500,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* =========================================================
   SETTING FIELD
========================================================= */

function SettingField({
  icon,
  title,
  description,
  value,
  placeholder,
  onChange,
}: {
  icon: string;
  title: string;
  description: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const configured =
    value.trim().length > 0;

  return (
    <div
      style={{
        border:
          "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "18px",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems:
            "flex-start",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "#f1f5f9",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            fontSize: "19px",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div
          style={{
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: "8px",
              flexWrap:
                "wrap",
            }}
          >
            <strong
              style={{
                fontSize: "15px",
                color: "#111827",
              }}
            >
              {title}
            </strong>

            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding:
                  "3px 7px",
                borderRadius:
                  "20px",
                background:
                  configured
                    ? "#dcfce7"
                    : "#f1f5f9",
                color:
                  configured
                    ? "#15803d"
                    : "#64748b",
              }}
            >
              {configured
                ? "Configured"
                : "Not configured"}
            </span>
          </div>

          <p
            style={{
              margin:
                "4px 0 0",
              color: "#64748b",
              fontSize: "13px",
              lineHeight: 1.4,
            }}
          >
            {description}
          </p>
        </div>
      </div>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        style={{
          width: "100%",
          boxSizing:
            "border-box",
          border:
            "1px solid #d1d5db",
          borderRadius: "8px",
          padding:
            "11px 12px",
          fontSize: "14px",
          outline: "none",
          color: "#111827",
          background: "#fff",
        }}
      />
    </div>
  );
}

/* =========================================================
   TABLE STYLES
========================================================= */

const thStyle: React.CSSProperties = {
  padding: "15px 20px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#475569",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "18px 20px",
  fontSize: "14px",
  color: "#334155",
  verticalAlign: "middle",
};