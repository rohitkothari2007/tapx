"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import QRCode from "qrcode";
import JSZip from "jszip";

type Device = {
  id: string;
  device_code: string;
  business_id: string | null;
  device_type: string | null;
  location: string | null;
  label: string | null;
  assigned_at: string | null;
  status: string | null;
  created_at: string | null;
};

type Business = {
  id: string;
  name: string;
  category?: string | null;
};

type HardwareRequest = {
  id: string;
  business_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  request_type: string;
  status: string;
  created_at: string;
  payload: {
    quantity?: number;
    device_type?: string;
    notes?: string;
    requested_at?: string;
  } | null;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [hardwareRequests, setHardwareRequests] = useState<HardwareRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  // Add / Provisioning Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "list" | "sequence">("single");

  // Single Add form
  const [deviceCode, setDeviceCode] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [deviceType, setDeviceType] = useState("NFC + QR");
  const [location, setLocation] = useState("");

  // List Batch form
  const [batchCodesText, setBatchCodesText] = useState("");

  // Sequence Batch form
  const [seqPrefix, setSeqPrefix] = useState("TAPX");
  const [seqStart, setSeqStart] = useState(101);
  const [seqCount, setSeqCount] = useState(10);
  const [seqPadLength, setSeqPadLength] = useState(3);

  // Selection & Bulk Assign Modal
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [targetBusinessId, setTargetBusinessId] = useState("");
  const [labelPattern, setLabelPattern] = useState<"table" | "room" | "desk" | "custom">("table");
  const [labelStartNum, setLabelStartNum] = useState(1);
  const [customLabelPrefix, setCustomLabelPrefix] = useState("Unit ");

  // Edit Label Modal
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editLabelInput, setEditLabelInput] = useState("");

  // Single QR Preview Modal
  const [qrModalDevice, setQrModalDevice] = useState<Device | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Hardware Requests Drawer
  const [showRequestsDrawer, setShowRequestsDrawer] = useState(false);
  const [updatingReqId, setUpdatingReqId] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadBusinessesAndRequests();
  }, []);

  useEffect(() => {
    loadDevicesPage();
  }, [page, pageSize, statusFilter, search]);

  async function loadBusinessesAndRequests() {
    try {
      const [
        { data: businessesData },
        { data: requestsData }
      ] = await Promise.all([
        supabase.from("businesses").select("id, name, category").order("name", { ascending: true }),
        supabase
          .from("customer_requests")
          .select("*")
          .eq("request_type", "hardware_request")
          .order("created_at", { ascending: false })
      ]);

      setBusinesses((businessesData || []) as Business[]);
      setHardwareRequests((requestsData || []) as HardwareRequest[]);
    } catch (err) {
      console.error("Load background metadata error:", err);
    }
  }

  async function loadDevicesPage() {
    setLoading(true);
    setError("");

    try {
      let query = supabase
        .from("devices")
        .select("*", { count: "exact" });

      if (statusFilter === "unassigned") {
        query = query.is("business_id", null).neq("status", "inactive").neq("status", "faulty");
      } else if (statusFilter === "active") {
        query = query.not("business_id", "is", null).neq("status", "inactive").neq("status", "faulty");
      } else if (statusFilter === "inactive" || statusFilter === "faulty") {
        query = query.eq("status", statusFilter);
      }

      if (search.trim()) {
        const s = search.trim();
        query = query.or(`device_code.ilike.%${s}%,label.ilike.%${s}%,location.ilike.%${s}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error: fetchError } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      setDevices((data || []) as Device[]);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Device management load error:", err);
      setError(err instanceof Error ? err.message : "Unable to load devices.");
    } finally {
      setLoading(false);
    }
  }

  function getBusinessName(businessId: string | null) {
    if (!businessId) return null;
    return (
      businesses.find((business) => business.id === businessId)?.name ||
      "Unknown Business"
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Single Device Creation with DB Collision Check
  async function addSingleDevice() {
    setError("");
    setSuccess("");

    const code = deviceCode.trim().toUpperCase();
    if (!code) {
      setError("Enter a device code.");
      return;
    }

    if (!/^[A-Z0-9_-]+$/.test(code)) {
      setError("Device code can contain only letters, numbers, hyphens and underscores.");
      return;
    }

    setSaving(true);

    try {
      // Database collision check
      const { data: existing } = await supabase
        .from("devices")
        .select("id")
        .eq("device_code", code)
        .maybeSingle();

      if (existing) {
        throw new Error(`Device code ${code} already exists in database.`);
      }

      const { data, error: insertError } = await supabase
        .from("devices")
        .insert({
          device_code: code,
          label: deviceLabel.trim() || null,
          business_id: null,
          device_type: deviceType,
          location: location.trim() || null,
          status: "unassigned",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setDeviceCode("");
      setDeviceLabel("");
      setLocation("");
      setShowAddModal(false);
      setSuccess(`${code} registered in TAPX database inventory.`);
      loadDevicesPage();
    } catch (err) {
      console.error("Unable to add device:", err);
      setError(err instanceof Error ? err.message : "Unable to add device.");
    } finally {
      setSaving(false);
    }
  }

  // Bulk Device Registration with DB Collision Check
  async function addBulkDevices() {
    setError("");
    setSuccess("");

    let proposedCodes: string[] = [];

    if (addMode === "list") {
      proposedCodes = batchCodesText
        .split(/[\n,;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter((c) => Boolean(c));
    } else if (addMode === "sequence") {
      const count = Math.min(Math.max(1, seqCount), 100);
      for (let i = 0; i < count; i++) {
        const numStr = String(seqStart + i).padStart(seqPadLength, "0");
        proposedCodes.push(`${seqPrefix.trim().toUpperCase()}${numStr}`);
      }
    }

    proposedCodes = Array.from(new Set(proposedCodes));

    if (proposedCodes.length === 0) {
      setError("No valid device codes generated or provided.");
      return;
    }

    setSaving(true);

    try {
      // Query database to check existing codes in chunk
      const { data: dbExisting } = await supabase
        .from("devices")
        .select("device_code")
        .in("device_code", proposedCodes);

      const existingSet = new Set((dbExisting || []).map((d) => d.device_code.toUpperCase()));
      const validNewCodes = proposedCodes.filter((c) => !existingSet.has(c));

      if (validNewCodes.length === 0) {
        throw new Error("All provided device codes already exist in the database.");
      }

      const payload = validNewCodes.map((code) => ({
        device_code: code,
        business_id: null,
        device_type: deviceType,
        status: "unassigned",
      }));

      const { error: insertError } = await supabase
        .from("devices")
        .insert(payload);

      if (insertError) throw insertError;

      const skippedCount = proposedCodes.length - validNewCodes.length;
      setBatchCodesText("");
      setShowAddModal(false);
      setSuccess(
        `Successfully registered ${validNewCodes.length} devices.` +
          (skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : "")
      );
      loadDevicesPage();
    } catch (err) {
      console.error("Bulk device error:", err);
      setError(err instanceof Error ? err.message : "Unable to bulk insert devices.");
    } finally {
      setSaving(false);
    }
  }

  // Bulk Assign Modal Execution
  async function executeBulkAssign() {
    if (selectedDeviceIds.length === 0) return;
    if (!targetBusinessId) {
      setError("Select a business to assign devices to.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const now = new Date().toISOString();
      const updates = selectedDeviceIds.map((id, index) => {
        let label = "";
        const num = labelStartNum + index;
        if (labelPattern === "table") label = `Table ${num}`;
        else if (labelPattern === "room") label = `Room ${num}`;
        else if (labelPattern === "desk") label = `Desk ${num}`;
        else label = `${customLabelPrefix}${num}`;

        return supabase
          .from("devices")
          .update({
            business_id: targetBusinessId,
            status: "active",
            label: label,
            assigned_at: now,
          })
          .eq("id", id);
      });

      await Promise.all(updates);

      await loadDevicesPage();
      setShowBulkAssignModal(false);
      const businessName = getBusinessName(targetBusinessId);
      setSuccess(
        `Assigned ${selectedDeviceIds.length} device(s) to ${businessName} with auto-labeling.`
      );
      setSelectedDeviceIds([]);
    } catch (err) {
      console.error("Bulk assign error:", err);
      setError(err instanceof Error ? err.message : "Unable to assign devices.");
    } finally {
      setSaving(false);
    }
  }

  // Save Edit Label
  async function saveDeviceLabel() {
    if (!editingDevice) return;
    setSaving(true);
    setError("");

    try {
      const newLabel = editLabelInput.trim() || null;
      const { error: updateError } = await supabase
        .from("devices")
        .update({ label: newLabel })
        .eq("id", editingDevice.id);

      if (updateError) throw updateError;

      setEditingDevice(null);
      setSuccess(`Label updated for ${editingDevice.device_code}`);
      loadDevicesPage();
    } catch (err) {
      console.error("Label update error:", err);
      setError(err instanceof Error ? err.message : "Unable to update label.");
    } finally {
      setSaving(false);
    }
  }

  // Exact Device Unassign Behavior (resets metadata, preserves device_code)
  async function unassignDevice(device: Device) {
    if (!device.business_id) return;
    const businessName = getBusinessName(device.business_id) || "this business";
    if (!window.confirm(`Unassign ${device.device_code} (${device.label || "No Label"}) from ${businessName}?`)) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("devices")
        .update({
          business_id: null,
          status: "unassigned",
          assigned_at: null,
          label: null,
          location: null,
        })
        .eq("id", device.id);

      if (updateError) throw updateError;

      setSuccess(`${device.device_code} unassigned and returned to inventory.`);
      loadDevicesPage();
    } catch (err) {
      console.error("Unassign error:", err);
      setError(err instanceof Error ? err.message : "Unable to unassign device.");
    }
  }

  // Hardware Request Status Update
  async function updateRequestStatus(reqId: string, status: string) {
    setUpdatingReqId(reqId);
    try {
      const { error: err } = await supabase
        .from("customer_requests")
        .update({ status })
        .eq("id", reqId);

      if (err) throw err;

      setHardwareRequests((curr) =>
        curr.map((r) => (r.id === reqId ? { ...r, status } : r))
      );
    } catch (err) {
      console.error("Hardware request update error:", err);
    } finally {
      setUpdatingReqId(null);
    }
  }

  // Single QR Preview
  async function openQrModal(device: Device) {
    setQrModalDevice(device);
    const customerUrl = `${window.location.origin}/tap/${device.device_code}`;
    try {
      const url = await QRCode.toDataURL(customerUrl, { width: 600, margin: 2 });
      setQrDataUrl(url);
    } catch (err) {
      console.error("QR generation error:", err);
    }
  }

  // Download Single QR Code (PNG or SVG)
  async function downloadSingleQr(format: "png" | "svg") {
    if (!qrModalDevice) return;
    const customerUrl = `${window.location.origin}/tap/${qrModalDevice.device_code}`;
    const filename = `${qrModalDevice.label || qrModalDevice.device_code}_QR.${format}`
      .toLowerCase()
      .replace(/[\s/]+/g, "_");

    if (format === "png") {
      const dataUrl = await QRCode.toDataURL(customerUrl, { width: 1200, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } else {
      const svgString = await QRCode.toString(customerUrl, { type: "svg", margin: 2 });
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    }
  }

  // Batch QR Code Export as ZIP
  async function exportQrBatch(devicesToExport: Device[]) {
    if (devicesToExport.length === 0) return;
    setBulkExporting(true);
    setError("");

    try {
      const zip = new JSZip();
      const origin = window.location.origin;

      for (const device of devicesToExport) {
        const customerUrl = `${origin}/tap/${device.device_code}`;
        const dataUrl = await QRCode.toDataURL(customerUrl, { width: 1000, margin: 2 });
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

        const labelPart = device.label
          ? device.label.toLowerCase().replace(/[\s/]+/g, "_")
          : device.device_code.toLowerCase();

        const filename = `${labelPart}_${device.device_code}.png`;
        zip.file(filename, base64Data, { base64: true });
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `TAPX_Devices_QR_Codes_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      setSuccess(`Exported ${devicesToExport.length} QR codes into ZIP archive.`);
    } catch (err) {
      console.error("Batch QR export error:", err);
      setError("Failed to generate ZIP export.");
    } finally {
      setBulkExporting(false);
    }
  }

  function toggleSelectAll() {
    if (selectedDeviceIds.length === devices.length) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(devices.map((d) => d.id));
    }
  }

  function toggleSelectDevice(id: string) {
    setSelectedDeviceIds((curr) =>
      curr.includes(id) ? curr.filter((item) => item !== id) : [...curr, id]
    );
  }

  const pendingRequestsCount = hardwareRequests.filter((r) => r.status === "pending").length;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>TAPX HARDWARE & PROVISIONING</div>
            <h1 style={styles.title}>Device Inventory</h1>
            <p style={styles.subtitle}>
              Register, manage, bulk label, and assign physical NFC & QR devices across all TAPX tenants.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowRequestsDrawer(true)}
              style={{ ...styles.secondaryButton, position: "relative" }}
            >
              📥 Hardware Requests
              {pendingRequestsCount > 0 && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "white",
                    borderRadius: "999px",
                    padding: "2px 7px",
                    fontSize: "11px",
                    marginLeft: "6px",
                    fontWeight: 800,
                  }}
                >
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            {selectedDeviceIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBulkAssignModal(true)}
                  style={{ ...styles.primaryButton, background: "#2563eb" }}
                >
                  ⚡ Bulk Assign ({selectedDeviceIds.length})
                </button>

                <button
                  type="button"
                  disabled={bulkExporting}
                  onClick={() =>
                    exportQrBatch(
                      devices.filter((d) => selectedDeviceIds.includes(d.id))
                    )
                  }
                  style={styles.secondaryButton}
                >
                  {bulkExporting ? "Zipping..." : `📦 Export QR ZIP (${selectedDeviceIds.length})`}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setError("");
                setSuccess("");
              }}
              style={styles.primaryButton}
            >
              + Provision Devices
            </button>
          </div>
        </div>

        {/* MESSAGES */}
        {error && (
          <div style={styles.errorBox}>
            <strong>Notice:</strong> {error}
          </div>
        )}

        {success && <div style={styles.successBox}>✓ {success}</div>}

        {/* INVENTORY CARD */}
        <section style={styles.card}>
          {/* TOOLBAR */}
          <div style={styles.filters}>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search code, label, location..."
              style={styles.searchInput}
            />

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={styles.filterSelect}
            >
              <option value="all">All Devices ({totalCount})</option>
              <option value="unassigned">Unassigned (Inventory)</option>
              <option value="active">Active Assigned</option>
              <option value="inactive">Inactive</option>
              <option value="faulty">Faulty</option>
            </select>

            <button
              type="button"
              disabled={bulkExporting || devices.length === 0}
              onClick={() => exportQrBatch(devices)}
              style={styles.secondaryButton}
              title="Download QR codes for currently loaded devices"
            >
              {bulkExporting ? "Generating..." : "Download Page QR ZIP"}
            </button>
          </div>

          {loading ? (
            <div style={styles.emptyState}>
              <div style={styles.loadingSpinner}>⟳</div>
              <div>Loading TAPX Device Inventory...</div>
            </div>
          ) : devices.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📡</div>
              <h3 style={styles.emptyTitle}>No Matching Devices</h3>
              <p style={styles.emptyText}>
                No devices found for this filter/search page.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={
                          devices.length > 0 &&
                          selectedDeviceIds.length === devices.length
                        }
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                    <th style={styles.th}>Device & Label</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Assigned Client</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Assigned Date</th>
                    <th style={styles.th}>Customer URL</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {devices.map((device) => {
                    const isSelected = selectedDeviceIds.includes(device.id);
                    const businessName = getBusinessName(device.business_id);
                    const isAssigned = Boolean(device.business_id);

                    return (
                      <tr
                        key={device.id}
                        style={{
                          background: isSelected ? "#eff6ff" : "transparent",
                        }}
                      >
                        <td style={styles.td}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectDevice(device.id)}
                            style={{ cursor: "pointer" }}
                          />
                        </td>

                        <td style={styles.td}>
                          <div style={styles.deviceCell}>
                            <div style={styles.deviceIcon}>📡</div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={styles.deviceCode}>{device.device_code}</span>
                                {device.label ? (
                                  <span style={styles.labelBadge}>{device.label}</span>
                                ) : (
                                  <span style={styles.noLabelBadge}>No Label</span>
                                )}
                              </div>
                              <div style={styles.deviceId}>
                                {device.location ? `Loc: ${device.location}` : `ID: ${device.id.slice(0, 8)}...`}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={styles.td}>
                          <span style={styles.typeBadge}>{device.device_type || "NFC + QR"}</span>
                        </td>

                        <td style={styles.td}>
                          {isAssigned ? (
                            <div style={styles.businessName}>{businessName}</div>
                          ) : (
                            <span style={{ color: "#2563eb", fontWeight: 700, fontSize: "12px" }}>
                              Unassigned (Inventory)
                            </span>
                          )}
                        </td>

                        <td style={styles.td}>
                          <StatusBadge status={device.status} isAssigned={isAssigned} />
                        </td>

                        <td style={styles.td}>
                          {device.assigned_at ? (
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                              {new Date(device.assigned_at).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                          )}
                        </td>

                        <td style={styles.td}>
                          <button
                            type="button"
                            onClick={() => window.open(`/tap/${device.device_code}`, "_blank")}
                            style={styles.urlButton}
                          >
                            /tap/{device.device_code} ↗
                          </button>
                        </td>

                        <td style={styles.td}>
                          <div style={styles.actionGroup}>
                            <button
                              type="button"
                              onClick={() => openQrModal(device)}
                              style={styles.smallButton}
                            >
                              📷 QR
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingDevice(device);
                                setEditLabelInput(device.label || "");
                              }}
                              style={styles.smallButton}
                            >
                              🏷️ Label
                            </button>

                            {isAssigned ? (
                              <button
                                type="button"
                                onClick={() => unassignDevice(device)}
                                style={styles.smallDangerButton}
                              >
                                Unassign
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDeviceIds([device.id]);
                                  setShowBulkAssignModal(true);
                                }}
                                style={{ ...styles.smallButton, borderColor: "#2563eb", color: "#2563eb" }}
                              >
                                Assign
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION BAR */}
          <div style={styles.paginationBar}>
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              Showing {totalCount > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(page * pageSize, totalCount)} of <strong>{totalCount}</strong> devices
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  ...styles.secondaryButton,
                  opacity: page <= 1 ? 0.5 : 1,
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                ← Previous
              </button>

              <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  ...styles.secondaryButton,
                  opacity: page >= totalPages ? 0.5 : 1,
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next →
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* HARDWARE REQUESTS DRAWER */}
      {showRequestsDrawer && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalContent, maxWidth: "700px" }}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Persistent Hardware Requests ({hardwareRequests.length})</h3>
                <p style={styles.modalSubtitle}>Device requests submitted by client portal users.</p>
              </div>
              <button type="button" onClick={() => setShowRequestsDrawer(false)} style={styles.closeButton}>×</button>
            </div>

            <div style={{ padding: "20px", maxHeight: "400px", overflowY: "auto" }}>
              {hardwareRequests.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
                  No hardware requests recorded yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {hardwareRequests.map((req) => (
                    <div key={req.id} style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px", background: "#f8fafc" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong style={{ fontSize: "15px", color: "#0f172a" }}>{req.customer_name || "Client"}</strong>
                          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                            Phone: {req.customer_phone || "N/A"} • Submitted {new Date(req.created_at).toLocaleString()}
                          </div>
                        </div>
                        <span
                          style={{
                            background: req.status === "fulfilled" ? "#dcfce7" : req.status === "rejected" ? "#fee2e2" : "#fef3c7",
                            color: req.status === "fulfilled" ? "#15803d" : req.status === "rejected" ? "#991b1b" : "#b45309",
                            padding: "3px 9px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 800,
                          }}
                        >
                          {req.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ marginTop: "10px", fontSize: "13px", color: "#334155" }}>
                        <strong>Requested Quantity:</strong> {req.payload?.quantity || 1} unit(s) •{" "}
                        <strong>Hardware Type:</strong> {req.payload?.device_type || "NFC + QR"}
                      </div>
                      {req.payload?.notes && (
                        <div style={{ marginTop: "4px", fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                          "{req.payload.notes}"
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end" }}>
                        {req.status === "pending" && (
                          <>
                            <button
                              type="button"
                              disabled={updatingReqId === req.id}
                              onClick={() => updateRequestStatus(req.id, "fulfilled")}
                              style={{ ...styles.smallButton, background: "#16a34a", color: "white", borderColor: "#16a34a" }}
                            >
                              Mark Fulfilled
                            </button>
                            <button
                              type="button"
                              disabled={updatingReqId === req.id}
                              onClick={() => updateRequestStatus(req.id, "rejected")}
                              style={styles.smallDangerButton}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button type="button" onClick={() => setShowRequestsDrawer(false)} style={styles.secondaryButton}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* PROVISIONING / ADD MODAL */}
      {showAddModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Provision New Devices</h3>
                <p style={styles.modalSubtitle}>
                  Add single or bulk physical NFC/QR devices to TAPX Inventory with DB collision check.
                </p>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} style={styles.closeButton}>×</button>
            </div>

            {/* TAB SELECTOR */}
            <div style={styles.tabBar}>
              <button
                type="button"
                onClick={() => setAddMode("single")}
                style={{
                  ...styles.tabItem,
                  ...(addMode === "single" ? styles.tabItemActive : {}),
                }}
              >
                Single Device
              </button>
              <button
                type="button"
                onClick={() => setAddMode("list")}
                style={{
                  ...styles.tabItem,
                  ...(addMode === "list" ? styles.tabItemActive : {}),
                }}
              >
                Code List Paste
              </button>
              <button
                type="button"
                onClick={() => setAddMode("sequence")}
                style={{
                  ...styles.tabItem,
                  ...(addMode === "sequence" ? styles.tabItemActive : {}),
                }}
              >
                Sequential Batch Generator
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              {addMode === "single" && (
                <div style={styles.formGridSingle}>
                  <div>
                    <label style={styles.label}>Device Code *</label>
                    <input
                      value={deviceCode}
                      onChange={(e) => setDeviceCode(e.target.value.toUpperCase())}
                      placeholder="e.g. TAPX101"
                      style={styles.input}
                    />
                    <div style={styles.helpText}>Unique code verified against database.</div>
                  </div>

                  <div>
                    <label style={styles.label}>Initial Label</label>
                    <input
                      value={deviceLabel}
                      onChange={(e) => setDeviceLabel(e.target.value)}
                      placeholder="e.g. Table 1 or VIP Stand"
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Hardware Type</label>
                    <select
                      value={deviceType}
                      onChange={(e) => setDeviceType(e.target.value)}
                      style={styles.input}
                    >
                      <option value="NFC + QR">NFC + QR Standee/Card</option>
                      <option value="NFC">NFC Sticker/Tag</option>
                      <option value="QR">QR Code Standee</option>
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Location / Note</label>
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Warehouse Shelf 3"
                      style={styles.input}
                    />
                  </div>
                </div>
              )}

              {addMode === "list" && (
                <div>
                  <label style={styles.label}>Paste Device Codes (one per line or comma-separated)</label>
                  <textarea
                    value={batchCodesText}
                    onChange={(e) => setBatchCodesText(e.target.value)}
                    placeholder={`TAPX101\nTAPX102\nTAPX103\nTAPX104`}
                    rows={6}
                    style={{ ...styles.input, fontFamily: "monospace" }}
                  />
                  <div style={styles.helpText}>
                    Database duplicates are automatically detected and skipped.
                  </div>
                </div>
              )}

              {addMode === "sequence" && (
                <div style={styles.formGridSeq}>
                  <div>
                    <label style={styles.label}>Code Prefix</label>
                    <input
                      value={seqPrefix}
                      onChange={(e) => setSeqPrefix(e.target.value.toUpperCase())}
                      placeholder="e.g. TAPX"
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Start Number</label>
                    <input
                      type="number"
                      value={seqStart}
                      onChange={(e) => setSeqStart(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Count (Total Devices)</label>
                    <input
                      type="number"
                      value={seqCount}
                      onChange={(e) => setSeqCount(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Padding Length</label>
                    <input
                      type="number"
                      value={seqPadLength}
                      onChange={(e) => setSeqPadLength(Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>

                  <div style={{ gridColumn: "span 2", background: "#f8fafc", padding: "12px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Preview Generated Sequence:</div>
                    <div style={{ fontSize: "13px", fontFamily: "monospace", color: "#2563eb", marginTop: "4px" }}>
                      {`${seqPrefix}${String(seqStart).padStart(seqPadLength, "0")}`} →{" "}
                      {`${seqPrefix}${String(seqStart + Math.max(0, seqCount - 1)).padStart(seqPadLength, "0")}`}{" "}
                      ({seqCount} devices checked against DB)
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={styles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={addMode === "single" ? addSingleDevice : addBulkDevices}
                style={styles.primaryButton}
              >
                {saving ? "Provisioning..." : "Add to Inventory"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ASSIGN & AUTO-LABELING MODAL */}
      {showBulkAssignModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>
                  Assign {selectedDeviceIds.length} Device(s) to Client
                </h3>
                <p style={styles.modalSubtitle}>
                  Bind devices to a business and configure auto-labeling pattern.
                </p>
              </div>
              <button type="button" onClick={() => setShowBulkAssignModal(false)} style={styles.closeButton}>×</button>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={styles.label}>Select Target Business *</label>
                <select
                  value={targetBusinessId}
                  onChange={(e) => setTargetBusinessId(e.target.value)}
                  style={styles.input}
                >
                  <option value="">-- Choose Business --</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.category || "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Auto-Labeling Scheme</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setLabelPattern("table")}
                    style={{
                      ...styles.patternBtn,
                      ...(labelPattern === "table" ? styles.patternBtnActive : {}),
                    }}
                  >
                    🍽️ Table {labelStartNum}, Table {labelStartNum + 1}...
                  </button>

                  <button
                    type="button"
                    onClick={() => setLabelPattern("room")}
                    style={{
                      ...styles.patternBtn,
                      ...(labelPattern === "room" ? styles.patternBtnActive : {}),
                    }}
                  >
                    🏨 Room {labelStartNum}, Room {labelStartNum + 1}...
                  </button>

                  <button
                    type="button"
                    onClick={() => setLabelPattern("desk")}
                    style={{
                      ...styles.patternBtn,
                      ...(labelPattern === "desk" ? styles.patternBtnActive : {}),
                    }}
                  >
                    💻 Desk {labelStartNum}, Desk {labelStartNum + 1}...
                  </button>

                  <button
                    type="button"
                    onClick={() => setLabelPattern("custom")}
                    style={{
                      ...styles.patternBtn,
                      ...(labelPattern === "custom" ? styles.patternBtnActive : {}),
                    }}
                  >
                    ✏️ Custom Prefix
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={styles.label}>Starting Number</label>
                  <input
                    type="number"
                    value={labelStartNum}
                    onChange={(e) => setLabelStartNum(Number(e.target.value))}
                    style={styles.input}
                  />
                </div>

                {labelPattern === "custom" && (
                  <div>
                    <label style={styles.label}>Custom Prefix</label>
                    <input
                      value={customLabelPrefix}
                      onChange={(e) => setCustomLabelPrefix(e.target.value)}
                      placeholder="e.g. Unit "
                      style={styles.input}
                    />
                  </div>
                )}
              </div>

              <div style={{ background: "#f0fdf4", padding: "12px", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#16a34a" }}>Label Preview:</div>
                <div style={{ fontSize: "13px", color: "#15803d", marginTop: "4px" }}>
                  {labelPattern === "table" && `Table ${labelStartNum} ... Table ${labelStartNum + selectedDeviceIds.length - 1}`}
                  {labelPattern === "room" && `Room ${labelStartNum} ... Room ${labelStartNum + selectedDeviceIds.length - 1}`}
                  {labelPattern === "desk" && `Desk ${labelStartNum} ... Desk ${labelStartNum + selectedDeviceIds.length - 1}`}
                  {labelPattern === "custom" && `${customLabelPrefix}${labelStartNum} ... ${customLabelPrefix}${labelStartNum + selectedDeviceIds.length - 1}`}
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" onClick={() => setShowBulkAssignModal(false)} style={styles.secondaryButton}>Cancel</button>
              <button
                type="button"
                disabled={saving}
                onClick={executeBulkAssign}
                style={styles.primaryButton}
              >
                {saving ? "Assigning..." : "Assign Devices & Apply Labels"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT LABEL MODAL */}
      {editingDevice && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalContent, maxWidth: "450px" }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit Device Label</h3>
              <button type="button" onClick={() => setEditingDevice(null)} style={styles.closeButton}>×</button>
            </div>

            <div style={{ padding: "20px" }}>
              <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "12px" }}>
                Device Code: <strong style={{ color: "#0f172a" }}>{editingDevice.device_code}</strong>
              </div>

              <label style={styles.label}>Display Label (e.g. Table 4 / Room 204)</label>
              <input
                value={editLabelInput}
                onChange={(e) => setEditLabelInput(e.target.value)}
                placeholder="e.g. Table 4"
                style={styles.input}
              />
            </div>

            <div style={styles.modalFooter}>
              <button type="button" onClick={() => setEditingDevice(null)} style={styles.secondaryButton}>Cancel</button>
              <button type="button" disabled={saving} onClick={saveDeviceLabel} style={styles.primaryButton}>
                {saving ? "Saving..." : "Save Label"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE QR CODE PREVIEW MODAL */}
      {qrModalDevice && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalContent, maxWidth: "480px", textAlign: "center" }}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>
                  {qrModalDevice.label || qrModalDevice.device_code}
                </h3>
                <p style={styles.modalSubtitle}>TAPX Physical NFC/QR Experience</p>
              </div>
              <button type="button" onClick={() => setQrModalDevice(null)} style={styles.closeButton}>×</button>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${qrModalDevice.device_code}`}
                  style={{ width: "240px", height: "240px", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                />
              ) : (
                <div style={{ width: "240px", height: "240px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  Generating QR...
                </div>
              )}

              <div style={{ fontSize: "13px", color: "#475569", fontWeight: 700 }}>
                URL: {window.location.origin}/tap/{qrModalDevice.device_code}
              </div>

              <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "center" }}>
                <button type="button" onClick={() => downloadSingleQr("png")} style={styles.primaryButton}>
                  Download PNG
                </button>
                <button type="button" onClick={() => downloadSingleQr("svg")} style={styles.secondaryButton}>
                  Download SVG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatusBadge({
  status,
  isAssigned,
}: {
  status: string | null;
  isAssigned: boolean;
}) {
  const norm = (status || "").toLowerCase();

  if (norm === "faulty") {
    return <span style={{ ...styles.statusBadge, background: "#fee2e2", color: "#991b1b" }}>Faulty</span>;
  }
  if (norm === "inactive") {
    return <span style={{ ...styles.statusBadge, background: "#f1f5f9", color: "#64748b" }}>Inactive</span>;
  }
  if (isAssigned || norm === "active") {
    return <span style={{ ...styles.statusBadge, background: "#dcfce7", color: "#15803d" }}>Active</span>;
  }
  return <span style={{ ...styles.statusBadge, background: "#dbeafe", color: "#1d4ed8" }}>Unassigned</span>;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "36px 24px 80px",
    color: "#111827",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  container: {
    maxWidth: "1440px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    color: "#2563eb",
    marginBottom: "6px",
  },
  title: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1.15,
    fontWeight: 800,
    color: "#0f172a",
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: "14px",
    color: "#64748b",
  },
  primaryButton: {
    border: "none",
    borderRadius: "10px",
    background: "#0f172a",
    color: "white",
    padding: "11px 18px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "white",
    color: "#334155",
    padding: "10px 16px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  closeButton: {
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: "24px",
    cursor: "pointer",
    lineHeight: 1,
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: "12px",
    padding: "12px 16px",
    marginBottom: "18px",
    fontSize: "13px",
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    borderRadius: "12px",
    padding: "12px 16px",
    marginBottom: "18px",
    fontSize: "13px",
    fontWeight: 600,
  },
  card: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
  },
  filters: {
    display: "flex",
    gap: "12px",
    padding: "16px 20px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    flexWrap: "wrap",
  },
  searchInput: {
    flex: 1,
    minWidth: "240px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px",
    outline: "none",
    background: "white",
  },
  filterSelect: {
    width: "220px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px",
    background: "white",
    color: "#334155",
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
    padding: "12px 16px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  td: {
    padding: "14px 16px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
    color: "#334155",
    verticalAlign: "middle",
  },
  deviceCell: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  deviceIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
  },
  deviceCode: {
    fontWeight: 800,
    color: "#0f172a",
    fontSize: "14px",
    fontFamily: "monospace",
  },
  labelBadge: {
    background: "#e0e7ff",
    color: "#3730a3",
    padding: "2px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 700,
  },
  noLabelBadge: {
    background: "#f1f5f9",
    color: "#94a3b8",
    padding: "2px 6px",
    borderRadius: "6px",
    fontSize: "10px",
  },
  deviceId: {
    marginTop: "2px",
    color: "#94a3b8",
    fontSize: "11px",
  },
  typeBadge: {
    background: "#f1f5f9",
    color: "#475569",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 700,
  },
  businessName: {
    fontWeight: 700,
    color: "#0f172a",
    fontSize: "13px",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "4px 10px",
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
    fontFamily: "monospace",
  },
  actionGroup: {
    display: "flex",
    gap: "6px",
  },
  smallButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#334155",
    borderRadius: "7px",
    padding: "5px 10px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
  },
  smallDangerButton: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#dc2626",
    borderRadius: "7px",
    padding: "5px 10px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
  },
  emptyState: {
    padding: "60px 20px",
    textAlign: "center",
    color: "#64748b",
  },
  emptyIcon: {
    fontSize: "42px",
    marginBottom: "12px",
  },
  emptyTitle: {
    margin: "0 0 6px",
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f172a",
  },
  emptyText: {
    margin: "0 0 16px",
    fontSize: "13px",
  },
  loadingSpinner: {
    fontSize: "24px",
    marginBottom: "10px",
  },
  paginationBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",
    background: "#f8fafc",
    borderTop: "1px solid #e2e8f0",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modalContent: {
    background: "white",
    borderRadius: "18px",
    width: "100%",
    maxWidth: "650px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "20px 24px",
    borderBottom: "1px solid #e2e8f0",
  },
  modalTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 800,
    color: "#0f172a",
  },
  modalSubtitle: {
    margin: "4px 0 0",
    fontSize: "12px",
    color: "#64748b",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    padding: "16px 24px",
    borderTop: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  tabItem: {
    flex: 1,
    padding: "12px",
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
  },
  tabItemActive: {
    color: "#2563eb",
    borderBottom: "2px solid #2563eb",
    background: "white",
  },
  formGridSingle: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },
  formGridSeq: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 700,
    color: "#334155",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    padding: "10px 12px",
    fontSize: "13px",
    outline: "none",
    background: "white",
  },
  helpText: {
    marginTop: "4px",
    fontSize: "11px",
    color: "#94a3b8",
  },
  patternBtn: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: "9px",
    padding: "10px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#475569",
    cursor: "pointer",
    textAlign: "left",
  },
  patternBtnActive: {
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#1d4ed8",
  },
};