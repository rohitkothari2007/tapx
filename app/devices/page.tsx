"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Device = {
  id: string;
  device_code: string;
  business_id: string | null;
  device_type: string | null;
  location: string | null;
  status: string | null;
  created_at: string | null;
};

type Business = {
  id: string;
  name: string;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAdd, setShowAdd] = useState(false);

  const [deviceCode, setDeviceCode] = useState("");
  const [deviceType, setDeviceType] = useState("NFC");
  const [location, setLocation] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        { data: devicesData, error: devicesError },
        { data: businessesData, error: businessesError },
      ] = await Promise.all([
        supabase
          .from("devices")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("businesses")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

      if (devicesError) {
        throw devicesError;
      }

      if (businessesError) {
        throw businessesError;
      }

      setDevices((devicesData || []) as Device[]);
      setBusinesses((businessesData || []) as Business[]);
    } catch (err) {
      console.error("Device management error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load devices."
      );
    } finally {
      setLoading(false);
    }
  }

  function getBusinessName(businessId: string | null) {
    if (!businessId) {
      return null;
    }

    return (
      businesses.find(
        (business) => business.id === businessId
      )?.name || "Unknown Business"
    );
  }

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const businessName =
        getBusinessName(device.business_id) || "";

      const matchesSearch =
        device.device_code
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        businessName
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (device.location || "")
          .toLowerCase()
          .includes(search.toLowerCase());

      const normalizedStatus =
        device.business_id
          ? "assigned"
          : device.status === "inactive"
          ? "inactive"
          : "available";

      const matchesStatus =
        statusFilter === "all" ||
        normalizedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [devices, businesses, search, statusFilter]);

  const totalDevices = devices.length;

  const availableDevices = devices.filter(
    (device) =>
      !device.business_id &&
      device.status !== "inactive"
  ).length;

  const assignedDevices = devices.filter(
    (device) => Boolean(device.business_id)
  ).length;

  const inactiveDevices = devices.filter(
    (device) =>
      !device.business_id &&
      device.status === "inactive"
  ).length;

  async function addDevice() {
    setError("");
    setSuccess("");

    const code = deviceCode.trim().toUpperCase();

    if (!code) {
      setError("Enter a device code.");
      return;
    }

    if (!/^[A-Z0-9_-]+$/.test(code)) {
      setError(
        "Device code can contain only letters, numbers, hyphens and underscores."
      );
      return;
    }

    const alreadyExists = devices.some(
      (device) =>
        device.device_code.toUpperCase() === code
    );

    if (alreadyExists) {
      setError(
        `Device ${code} already exists.`
      );
      return;
    }

    setSaving(true);

    try {
      const { data, error: insertError } =
        await supabase
          .from("devices")
          .insert({
            device_code: code,
            business_id: null,
            device_type: deviceType,
            location: location.trim() || null,
            status: "available",
          })
          .select()
          .single();

      if (insertError) {
        throw insertError;
      }

      if (!data) {
        throw new Error(
          "Device was created but no device record was returned."
        );
      }

      setDevices((current) => [
        data as Device,
        ...current,
      ]);

      setDeviceCode("");
      setLocation("");
      setDeviceType("NFC");
      setShowAdd(false);

      setSuccess(
        `${code} was added to TAPX device inventory.`
      );
    } catch (err) {
      console.error("Unable to add device:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to add device."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeDeviceStatus(
    device: Device,
    nextStatus: string
  ) {
    setError("");
    setSuccess("");

    try {
      const { error: updateError } =
        await supabase
          .from("devices")
          .update({
            status: nextStatus,
          })
          .eq("id", device.id);

      if (updateError) {
        throw updateError;
      }

      setDevices((current) =>
        current.map((item) =>
          item.id === device.id
            ? {
                ...item,
                status: nextStatus,
              }
            : item
        )
      );

      setSuccess(
        `${device.device_code} status updated.`
      );
    } catch (err) {
      console.error(
        "Unable to update device:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update device."
      );
    }
  }

  async function unassignDevice(device: Device) {
    if (!device.business_id) {
      return;
    }

    const businessName =
      getBusinessName(device.business_id) ||
      "this business";

    const confirmed = window.confirm(
      `Unassign ${device.device_code} from ${businessName}?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const { error: updateError } =
        await supabase
          .from("devices")
          .update({
            business_id: null,
            status: "available",
          })
          .eq("id", device.id);

      if (updateError) {
        throw updateError;
      }

      setDevices((current) =>
        current.map((item) =>
          item.id === device.id
            ? {
                ...item,
                business_id: null,
                status: "available",
              }
            : item
        )
      );

      setSuccess(
        `${device.device_code} is now available for another client.`
      );
    } catch (err) {
      console.error(
        "Unable to unassign device:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to unassign device."
      );
    }
  }

  function openCustomerExperience(
    device: Device
  ) {
    const url = `/tap/${device.device_code}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>
              TAPX PLATFORM
            </div>

            <h1 style={styles.title}>
              Device Inventory
            </h1>

            <p style={styles.subtitle}>
              Manage TAPX NFC and QR devices
              independently from businesses.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowAdd(true);
              setError("");
              setSuccess("");
            }}
            style={styles.primaryButton}
          >
            + Add Device
          </button>
        </div>

        {/* MESSAGES */}
        {error && (
          <div style={styles.errorBox}>
            <strong>Something went wrong</strong>
            <div style={{ marginTop: 4 }}>
              {error}
            </div>
          </div>
        )}

        {success && (
          <div style={styles.successBox}>
            ✓ {success}
          </div>
        )}

        {/* ADD DEVICE */}
        {showAdd && (
          <section style={styles.addCard}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>
                  Add TAPX Device
                </h2>

                <p style={styles.sectionSubtitle}>
                  Register a physical TAPX device before
                  assigning it to a business.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAdd(false)}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            <div style={styles.formGrid}>

              <div>
                <label style={styles.label}>
                  Device Code *
                </label>

                <input
                  value={deviceCode}
                  onChange={(event) =>
                    setDeviceCode(
                      event.target.value.toUpperCase()
                    )
                  }
                  placeholder="e.g. TAPX001"
                  style={styles.input}
                />

                <div style={styles.helpText}>
                  This unique code becomes part of the
                  customer URL.
                </div>
              </div>

              <div>
                <label style={styles.label}>
                  Device Type
                </label>

                <select
                  value={deviceType}
                  onChange={(event) =>
                    setDeviceType(
                      event.target.value
                    )
                  }
                  style={styles.input}
                >
                  <option value="NFC">
                    NFC
                  </option>

                  <option value="QR">
                    QR
                  </option>

                  <option value="NFC + QR">
                    NFC + QR
                  </option>
                </select>
              </div>

              <div>
                <label style={styles.label}>
                  Physical Location
                </label>

                <input
                  value={location}
                  onChange={(event) =>
                    setLocation(
                      event.target.value
                    )
                  }
                  placeholder="e.g. Front desk"
                  style={styles.input}
                />

                <div style={styles.helpText}>
                  Optional internal label.
                </div>
              </div>

            </div>

            <div style={styles.addActions}>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                style={styles.secondaryButton}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={addDevice}
                style={{
                  ...styles.primaryButton,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving
                  ? "Adding..."
                  : "Add Device"}
              </button>
            </div>
          </section>
        )}

        {/* STATS */}
        <div style={styles.statsGrid}>

          <StatCard
            label="Total Devices"
            value={totalDevices}
          />

          <StatCard
            label="Available"
            value={availableDevices}
          />

          <StatCard
            label="Assigned"
            value={assignedDevices}
          />

          <StatCard
            label="Inactive"
            value={inactiveDevices}
          />

        </div>

        {/* INVENTORY */}
        <section style={styles.card}>

          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                All Devices
              </h2>

              <p style={styles.sectionSubtitle}>
                Devices available to assign to any TAPX
                business.
              </p>
            </div>
          </div>

          {/* FILTERS */}
          <div style={styles.filters}>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search device or business..."
              style={styles.searchInput}
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              style={styles.filterSelect}
            >
              <option value="all">
                All Devices
              </option>

              <option value="available">
                Available
              </option>

              <option value="assigned">
                Assigned
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>

          </div>

          {loading ? (
            <div style={styles.emptyState}>
              <div style={styles.loadingSpinner}>
                ⟳
              </div>

              <div>
                Loading device inventory...
              </div>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div style={styles.emptyState}>

              <div style={styles.emptyIcon}>
                📡
              </div>

              <h3 style={styles.emptyTitle}>
                {devices.length === 0
                  ? "No devices registered"
                  : "No devices found"}
              </h3>

              <p style={styles.emptyText}>
                {devices.length === 0
                  ? "Add your first TAPX device to start assigning devices to clients."
                  : "Try changing your search or filter."}
              </p>

              {devices.length === 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setShowAdd(true)
                  }
                  style={styles.primaryButton}
                >
                  + Add First Device
                </button>
              )}

            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>

                <thead>
                  <tr>
                    <th style={styles.th}>
                      Device
                    </th>

                    <th style={styles.th}>
                      Type
                    </th>

                    <th style={styles.th}>
                      Business
                    </th>

                    <th style={styles.th}>
                      Location
                    </th>

                    <th style={styles.th}>
                      Status
                    </th>

                    <th style={styles.th}>
                      Customer URL
                    </th>

                    <th style={styles.th}>
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDevices.map(
                    (device) => {
                      const assigned =
                        Boolean(
                          device.business_id
                        );

                      const inactive =
                        device.status ===
                        "inactive";

                      return (
                        <tr key={device.id}>

                          {/* DEVICE */}
                          <td style={styles.td}>
                            <div style={styles.deviceCell}>

                              <div
                                style={
                                  styles.deviceIcon
                                }
                              >
                                📡
                              </div>

                              <div>
                                <div
                                  style={
                                    styles.deviceCode
                                  }
                                >
                                  {
                                    device.device_code
                                  }
                                </div>

                                <div
                                  style={
                                    styles.deviceId
                                  }
                                >
                                  ID:{" "}
                                  {device.id.slice(
                                    0,
                                    8
                                  )}
                                  ...
                                </div>
                              </div>

                            </div>
                          </td>

                          {/* TYPE */}
                          <td style={styles.td}>
                            {device.device_type ||
                              "NFC"}
                          </td>

                          {/* BUSINESS */}
                          <td style={styles.td}>

                            {assigned ? (
                              <div>
                                <div
                                  style={
                                    styles.businessName
                                  }
                                >
                                  {
                                    getBusinessName(
                                      device.business_id
                                    )
                                  }
                                </div>

                                <div
                                  style={
                                    styles.assignedText
                                  }
                                >
                                  Assigned
                                </div>
                              </div>
                            ) : (
                              <span
                                style={
                                  styles.unassignedText
                                }
                              >
                                Available
                              </span>
                            )}

                          </td>

                          {/* LOCATION */}
                          <td style={styles.td}>
                            {device.location ||
                              "—"}
                          </td>

                          {/* STATUS */}
                          <td style={styles.td}>

                            <StatusBadge
                              assigned={assigned}
                              inactive={inactive}
                            />

                          </td>

                          {/* CUSTOMER URL */}
                          <td style={styles.td}>

                            {assigned ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openCustomerExperience(
                                    device
                                  )
                                }
                                style={
                                  styles.urlButton
                                }
                              >
                                /tap/
                                {
                                  device.device_code
                                }
                              </button>
                            ) : (
                              <span
                                style={{
                                  color:
                                    "#94a3b8",
                                }}
                              >
                                Available after
                                assignment
                              </span>
                            )}

                          </td>

                          {/* ACTION */}
                          <td style={styles.td}>

                            <div
                              style={
                                styles.actionGroup
                              }
                            >

                              {assigned ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    unassignDevice(
                                      device
                                    )
                                  }
                                  style={
                                    styles.smallButton
                                  }
                                >
                                  Unassign
                                </button>
                              ) : inactive ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    changeDeviceStatus(
                                      device,
                                      "available"
                                    )
                                  }
                                  style={
                                    styles.smallButton
                                  }
                                >
                                  Activate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    changeDeviceStatus(
                                      device,
                                      "inactive"
                                    )
                                  }
                                  style={
                                    styles.smallDangerButton
                                  }
                                >
                                  Disable
                                </button>
                              )}

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}
                </tbody>

              </table>
            </div>
          )}

        </section>

        {/* HOW IT WORKS */}
        <section style={styles.infoCard}>

          <div style={styles.infoIcon}>
            ⚡
          </div>

          <div>

            <h3 style={styles.infoTitle}>
              How TAPX device assignment works
            </h3>

            <div style={styles.infoSteps}>

              <InfoStep
                number="1"
                text="Register physical TAPX devices here."
              />

              <InfoStep
                number="2"
                text="Create any business from Add Client."
              />

              <InfoStep
                number="3"
                text="Select an available device during activation."
              />

              <InfoStep
                number="4"
                text="TAPX automatically connects that device to the business."
              />

              <InfoStep
                number="5"
                text="The same /tap/[deviceCode] customer experience serves that business."
              />

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}


/* =========================================================
   COMPONENTS
========================================================= */

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={styles.statCard}>

      <div style={styles.statLabel}>
        {label}
      </div>

      <div style={styles.statValue}>
        {value}
      </div>

    </div>
  );
}


function StatusBadge({
  assigned,
  inactive,
}: {
  assigned: boolean;
  inactive: boolean;
}) {
  if (inactive) {
    return (
      <span
        style={{
          ...styles.statusBadge,
          background: "#f1f5f9",
          color: "#64748b",
        }}
      >
        Inactive
      </span>
    );
  }

  if (assigned) {
    return (
      <span
        style={{
          ...styles.statusBadge,
          background: "#dcfce7",
          color: "#15803d",
        }}
      >
        Assigned
      </span>
    );
  }

  return (
    <span
      style={{
        ...styles.statusBadge,
        background: "#dbeafe",
        color: "#1d4ed8",
      }}
    >
      Available
    </span>
  );
}


function InfoStep({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <div style={styles.infoStep}>

      <span style={styles.infoNumber}>
        {number}
      </span>

      <span>
        {text}
      </span>

    </div>
  );
}


/* =========================================================
   STYLES
========================================================= */

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "42px 24px 80px",
    color: "#111827",
  },

  container: {
    maxWidth: "1500px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "28px",
  },

  eyebrow: {
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    color: "#64748b",
    marginBottom: "8px",
  },

  title: {
    margin: 0,
    fontSize: "34px",
    lineHeight: 1.15,
    fontWeight: 800,
    color: "#0f172a",
  },

  subtitle: {
    margin: "9px 0 0",
    fontSize: "15px",
    color: "#64748b",
  },

  primaryButton: {
    border: "none",
    borderRadius: "11px",
    background: "#111827",
    color: "white",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: "11px",
    background: "white",
    color: "#374151",
    padding: "11px 17px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },

  closeButton: {
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: "28px",
    cursor: "pointer",
    lineHeight: 1,
  },

  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: "12px",
    padding: "13px 16px",
    marginBottom: "18px",
    fontSize: "14px",
  },

  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    borderRadius: "12px",
    padding: "13px 16px",
    marginBottom: "18px",
    fontSize: "14px",
    fontWeight: 600,
  },

  addCard: {
    background: "white",
    border: "1px solid #dbe3ee",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "22px",
    boxShadow:
      "0 4px 18px rgba(15, 23, 42, 0.04)",
  },

  card: {
    background: "white",
    border: "1px solid #dbe3ee",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow:
      "0 4px 18px rgba(15, 23, 42, 0.04)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    padding: "22px 24px",
    borderBottom: "1px solid #e5e7eb",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 750,
    color: "#111827",
  },

  sectionSubtitle: {
    margin: "6px 0 0",
    fontSize: "13px",
    color: "#64748b",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },

  statCard: {
    background: "white",
    border: "1px solid #dbe3ee",
    borderRadius: "15px",
    padding: "22px",
  },

  statLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 600,
  },

  statValue: {
    marginTop: "8px",
    fontSize: "31px",
    lineHeight: 1,
    fontWeight: 800,
    color: "#111827",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: "16px",
  },

  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    color: "#374151",
    marginBottom: "7px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "12px 13px",
    fontSize: "14px",
    outline: "none",
    background: "white",
  },

  helpText: {
    marginTop: "6px",
    fontSize: "11px",
    color: "#94a3b8",
  },

  addActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "22px",
  },

  filters: {
    display: "flex",
    gap: "12px",
    padding: "18px 24px",
    borderBottom: "1px solid #e5e7eb",
    background: "#fafbfc",
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "11px 13px",
    fontSize: "14px",
    outline: "none",
    background: "white",
  },

  filterSelect: {
    width: "190px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "11px 13px",
    fontSize: "14px",
    background: "white",
    color: "#374151",
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1100px",
  },

  th: {
    textAlign: "left",
    padding: "13px 16px",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    color: "#475569",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  td: {
    padding: "16px",
    borderBottom: "1px solid #eef2f7",
    fontSize: "13px",
    color: "#475569",
    verticalAlign: "middle",
  },

  deviceCell: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
  },

  deviceIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
  },

  deviceCode: {
    fontWeight: 800,
    color: "#111827",
    fontSize: "14px",
  },

  deviceId: {
    marginTop: "3px",
    color: "#94a3b8",
    fontSize: "11px",
  },

  businessName: {
    fontWeight: 700,
    color: "#111827",
  },

  assignedText: {
    marginTop: "3px",
    fontSize: "11px",
    color: "#16a34a",
  },

  unassignedText: {
    color: "#2563eb",
    fontWeight: 700,
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 800,
  },

  urlButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    color: "#2563eb",
    fontWeight: 700,
    fontSize: "12px",
    cursor: "pointer",
  },

  actionGroup: {
    display: "flex",
    gap: "7px",
  },

  smallButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#334155",
    borderRadius: "8px",
    padding: "7px 10px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
  },

  smallDangerButton: {
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#dc2626",
    borderRadius: "8px",
    padding: "7px 10px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
  },

  emptyState: {
    minHeight: "280px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "40px",
    color: "#64748b",
  },

  loadingSpinner: {
    fontSize: "30px",
    marginBottom: "10px",
  },

  emptyIcon: {
    fontSize: "40px",
    marginBottom: "12px",
  },

  emptyTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "18px",
  },

  emptyText: {
    maxWidth: "500px",
    margin: "7px 0 18px",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6,
  },

  infoCard: {
    display: "flex",
    gap: "18px",
    alignItems: "flex-start",
    marginTop: "22px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "15px",
    padding: "22px",
  },

  infoIcon: {
    width: "42px",
    height: "42px",
    flexShrink: 0,
    borderRadius: "11px",
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
  },

  infoTitle: {
    margin: 0,
    color: "#1e3a8a",
    fontSize: "15px",
    fontWeight: 800,
  },

  infoSteps: {
    display: "flex",
    flexDirection: "column",
    gap: "9px",
    marginTop: "13px",
    color: "#475569",
    fontSize: "13px",
  },

  infoStep: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
  },

  infoNumber: {
    width: "22px",
    height: "22px",
    flexShrink: 0,
    borderRadius: "50%",
    background: "#2563eb",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: 800,
  },
};