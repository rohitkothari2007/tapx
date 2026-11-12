"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
import { supabase } from "../lib/supabase";
import { parseStandTableNumber } from "../lib/tableNumber";
import { getPublicSiteUrl } from "../lib/siteUrl";

export type TablesBoardDevice = {
  id: string;
  device_code: string;
  business_id?: string | null;
  label?: string | null;
  location?: string | null;
  status?: string | null;
  device_type?: string | null;
  assigned_at?: string | null;
  created_at?: string;
};

export type TablesBoardProps = {
  businessId: string;
  businessName: string;
  businessLogoUrl?: string | null;
  tableCount: number;
  devices: TablesBoardDevice[];
  primaryDeviceCode?: string | null;
  isAdmin?: boolean;
  onRefreshDevices?: () => Promise<void> | void;
  onUpdateTableCount?: (count: number) => Promise<void> | void;
  onUpdatePrimaryDeviceCode?: (code: string) => Promise<void> | void;
  origin?: string;
  onGoToSettings?: () => void;
  openRequestTables?: number[];
  activeOrderTables?: number[];
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(x, y, width, height, radius);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

/**
 * Shared Tables Board component for Admin Client Page, Owner Dashboard,
 * and Add-Client Activation Screen.
 * Config-driven, generic, per-business.
 */
export default function TablesBoard({
  businessId,
  businessName,
  businessLogoUrl,
  tableCount,
  devices,
  primaryDeviceCode,
  isAdmin = false,
  onRefreshDevices,
  onUpdateTableCount,
  onUpdatePrimaryDeviceCode,
  origin,
  onGoToSettings,
  openRequestTables = [],
  activeOrderTables = [],
}: TablesBoardProps) {
  const effectiveOrigin = useMemo(() => {
    return getPublicSiteUrl(origin);
  }, [origin]);

  // Primary stand device code state
  const [selectedPrimary, setSelectedPrimary] = useState<string>(() => {
    if (primaryDeviceCode) return primaryDeviceCode;
    return devices[0]?.device_code || "";
  });

  useEffect(() => {
    if (primaryDeviceCode) {
      setSelectedPrimary(primaryDeviceCode);
    } else if (devices.length > 0 && !selectedPrimary) {
      setSelectedPrimary(devices[0].device_code);
    }
  }, [primaryDeviceCode, devices, selectedPrimary]);

  // Quick table count setup state for empty state
  const [newTableCountInput, setNewTableCountInput] = useState<number>(10);
  const [savingTableCount, setSavingTableCount] = useState(false);

  // Stand assignment modal state (ADMIN ONLY)
  const [assignModalTable, setAssignModalTable] = useState<number | null>(null);
  const [inventoryDevices, setAvailableInventory] = useState<TablesBoardDevice[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [assigningDevice, setAssigningDevice] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);

  // QR preview cache for screen display
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Record<number, string>>({});
  const [copyFeedback, setCopyFeedback] = useState<Record<number, boolean>>({});

  // Batch download state
  const [exportingZip, setExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState("");

  // Print preview state
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Saving primary code state
  const [savingPrimary, setSavingPrimary] = useState(false);

  // Pre-generate QR data URLs for tables 1..tableCount
  useEffect(() => {
    if (tableCount <= 0) return;
    let active = true;

    async function generateAllQrs() {
      const urls: Record<number, string> = {};
      for (let t = 1; t <= tableCount; t++) {
        const matched = devices.filter(
          (d) => parseStandTableNumber(d.label, d.location) === t
        );
        const assigned = matched[0] || null;
        const code = assigned ? assigned.device_code : selectedPrimary;
        if (!code) continue;

        const targetUrl = assigned
          ? `${effectiveOrigin}/tap/${code}`
          : `${effectiveOrigin}/tap/${code}?table=${t}`;

        try {
          const dataUrl = await QRCode.toDataURL(targetUrl, {
            width: 320,
            margin: 1,
            color: { dark: "#0f172a", light: "#ffffff" },
          });
          urls[t] = dataUrl;
        } catch (err) {
          console.error(`Error generating QR for table ${t}:`, err);
        }
      }
      if (active) {
        setQrCodeDataUrls(urls);
      }
    }

    generateAllQrs();
    return () => {
      active = false;
    };
  }, [tableCount, devices, selectedPrimary, effectiveOrigin]);

  // Handle changing primary stand
  const handlePrimaryChange = async (newCode: string) => {
    setSelectedPrimary(newCode);
    setSavingPrimary(true);
    try {
      if (onUpdatePrimaryDeviceCode) {
        await onUpdatePrimaryDeviceCode(newCode);
      } else if (businessId) {
        const { data: existingRow } = await supabase
          .from("business_module_configs")
          .select("id, config")
          .eq("business_id", businessId)
          .eq("module_key", "table_ordering")
          .maybeSingle();

        const baseConfig = (existingRow?.config as Record<string, any>) || {};
        const mergedConfig = { ...baseConfig, primary_device_code: newCode };

        if (existingRow?.id) {
          await supabase
            .from("business_module_configs")
            .update({ config: mergedConfig })
            .eq("id", existingRow.id);
        }
      }
    } catch (err) {
      console.error("Failed to save primary stand:", err);
    } finally {
      setSavingPrimary(false);
    }
  };

  // Handle saving table count from empty state
  const handleSaveQuickTableCount = async () => {
    if (newTableCountInput <= 0) return;
    setSavingTableCount(true);
    try {
      if (onUpdateTableCount) {
        await onUpdateTableCount(newTableCountInput);
      } else if (businessId) {
        const { data: existingRow } = await supabase
          .from("business_module_configs")
          .select("id, config, feature_id")
          .eq("business_id", businessId)
          .eq("module_key", "table_ordering")
          .maybeSingle();

        const baseConfig = (existingRow?.config as Record<string, any>) || {};
        const mergedConfig = { ...baseConfig, table_count: newTableCountInput };

        if (existingRow?.id) {
          await supabase
            .from("business_module_configs")
            .update({ config: mergedConfig })
            .eq("id", existingRow.id);
        } else {
          const { data: fc } = await supabase
            .from("feature_catalog")
            .select("id")
            .eq("feature_key", "table_ordering")
            .maybeSingle();

          await supabase.from("business_module_configs").insert({
            business_id: businessId,
            feature_id: fc?.id || "",
            module_key: "table_ordering",
            config: mergedConfig,
            status: "active",
          });
        }
      }
      if (onRefreshDevices) {
        await onRefreshDevices();
      }
    } catch (err) {
      console.error("Failed to save table count:", err);
    } finally {
      setSavingTableCount(false);
    }
  };

  // Open assignment modal (ADMIN ONLY)
  const openAssignModal = async (tableNum: number) => {
    if (!isAdmin) return;
    setAssignModalTable(tableNum);
    setAssignmentMessage(null);
    setLoadingInventory(true);
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("id, device_code, business_id, label, location, status, device_type")
        .is("business_id", null)
        .order("device_code", { ascending: true });

      if (error) throw error;
      setAvailableInventory((data || []) as TablesBoardDevice[]);
    } catch (err) {
      console.error("Failed to load inventory stands:", err);
    } finally {
      setLoadingInventory(false);
    }
  };

  // Assign an inventory stand or reassign an existing stand to Table N
  const handleAssignStand = async (deviceId: string, isFromInventory: boolean) => {
    if (!assignModalTable || !businessId || !isAdmin) return;
    setAssigningDevice(true);
    setAssignmentMessage(null);
    try {
      const now = new Date().toISOString();
      const updatePayload: Record<string, any> = {
        label: `Table ${assignModalTable}`,
        location: `Table ${assignModalTable}`,
      };

      if (isFromInventory) {
        updatePayload.business_id = businessId;
        updatePayload.status = "active";
        updatePayload.assigned_at = now;
      }

      const { error } = await supabase
        .from("devices")
        .update(updatePayload)
        .eq("id", deviceId);

      if (error) throw error;

      setAssignmentMessage(`✓ Stand assigned to Table ${assignModalTable}`);
      if (onRefreshDevices) {
        await onRefreshDevices();
      }
      setTimeout(() => {
        setAssignModalTable(null);
        setAssignmentMessage(null);
      }, 700);
    } catch (err: any) {
      console.error("Assignment error:", err);
      setAssignmentMessage(`Error: ${err?.message || "Failed to assign stand"}`);
    } finally {
      setAssigningDevice(false);
    }
  };

  // Clear table assignment from device (keeps stand assigned to business)
  const handleClearTableAssignment = async (deviceId: string) => {
    if (!isAdmin) return;
    setAssigningDevice(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({
          label: null,
          location: null,
        })
        .eq("id", deviceId);

      if (error) throw error;
      if (onRefreshDevices) {
        await onRefreshDevices();
      }
      setAssignModalTable(null);
    } catch (err) {
      console.error("Clear table assignment error:", err);
    } finally {
      setAssigningDevice(false);
    }
  };

  // Release device back to general inventory
  const handleReleaseToInventory = async (deviceId: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Release this stand back to unassigned inventory?")) return;
    setAssigningDevice(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({
          business_id: null,
          status: "inventory",
          label: null,
          location: null,
        })
        .eq("id", deviceId);

      if (error) throw error;
      if (onRefreshDevices) {
        await onRefreshDevices();
      }
      setAssignModalTable(null);
    } catch (err) {
      console.error("Release stand error:", err);
    } finally {
      setAssigningDevice(false);
    }
  };

  // High-resolution Canvas generator for single table card (PNG)
  const createTableCardBlob = async (tableNum: number): Promise<Blob | null> => {
    const matched = devices.filter(
      (d) => parseStandTableNumber(d.label, d.location) === tableNum
    );
    const assigned = matched[0] || null;
    const code = assigned ? assigned.device_code : selectedPrimary;
    if (!code) return null;

    const targetUrl = assigned
      ? `${effectiveOrigin}/tap/${code}`
      : `${effectiveOrigin}/tap/${code}?table=${tableNum}`;

    // Generate high-resolution QR
    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 560,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    });

    const qrImg = new Image();
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = () => reject(new Error("QR image load failed"));
      qrImg.src = qrDataUrl;
    });

    // Create high-res canvas (1024 x 1280)
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer card border with rounded corners
    const pad = 40;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    const radius = 28;
    ctx.beginPath();
    drawRoundedRect(ctx, pad, pad, w, h, radius);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner dashed cut guide line
    ctx.save();
    ctx.setLineDash([12, 8]);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    drawRoundedRect(ctx, pad + 12, pad + 12, w - 24, h - 24, radius - 6);
    ctx.stroke();
    ctx.restore();

    let currentY = 130;

    // Optional Logo (with CORS error safety fallback)
    if (businessLogoUrl) {
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => resolve(); // continue if logo fails
          logoImg.src = businessLogoUrl;
        });
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const maxLogoH = 90;
          const scale = maxLogoH / logoImg.naturalHeight;
          const logoW = Math.min(logoImg.naturalWidth * scale, 300);
          const logoH = logoImg.naturalHeight * scale;
          ctx.drawImage(logoImg, (canvas.width - logoW) / 2, currentY, logoW, logoH);
          currentY += logoH + 24;
        }
      } catch {
        // Fallback gracefully
      }
    }

    // Business Name
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 44px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(businessName, canvas.width / 2, currentY);

    currentY += 76;

    // Table Badge Pill
    const badgeW = 420;
    const badgeH = 74;
    const badgeX = (canvas.width - badgeW) / 2;
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    drawRoundedRect(ctx, badgeX, currentY, badgeW, badgeH, 37);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`TABLE ${tableNum}`, canvas.width / 2, currentY + badgeH / 2);

    currentY += badgeH + 46;

    // Draw QR Code
    const qrSize = 520;
    const qrX = (canvas.width - qrSize) / 2;
    ctx.drawImage(qrImg, qrX, currentY, qrSize, qrSize);

    currentY += qrSize + 48;

    // Action Instruction
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Scan to view menu & place order", canvas.width / 2, currentY);

    currentY += 46;

    // Footer details
    ctx.fillStyle = "#64748b";
    ctx.font = "500 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const standInfo = assigned
      ? `Stand: ${assigned.device_code}`
      : `Virtual Table QR (${code})`;
    ctx.fillText(`${standInfo} • Powered by TAPX`, canvas.width / 2, currentY);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  };

  // Download individual Table PNG
  const handleDownloadSinglePng = async (tableNum: number) => {
    try {
      const blob = await createTableCardBlob(tableNum);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeBiz = businessName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      link.href = url;
      link.download = `${safeBiz}_table_${tableNum}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Download failed for table ${tableNum}:`, err);
    }
  };

  // Download all QRs as ZIP
  const handleDownloadAllZip = async () => {
    if (tableCount <= 0 || exportingZip) return;
    setExportingZip(true);
    setZipProgress("Starting ZIP generation...");
    try {
      const zip = new JSZip();
      const safeBiz = businessName.toLowerCase().replace(/[^a-z0-9]/g, "_");

      for (let t = 1; t <= tableCount; t++) {
        setZipProgress(`Rendering card ${t} of ${tableCount}...`);
        const blob = await createTableCardBlob(t);
        if (blob) {
          zip.file(`Table_${t}.png`, blob);
        }
      }

      setZipProgress("Compressing ZIP file...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${safeBiz}_tables_qr_pack_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
      setZipProgress(`✓ Successfully exported ${tableCount} table cards!`);
      setTimeout(() => setZipProgress(""), 2500);
    } catch (err) {
      console.error("ZIP export failed:", err);
      setZipProgress("Failed to create ZIP export");
    } finally {
      setExportingZip(false);
    }
  };

  // Copy table URL to clipboard
  const handleCopyUrl = async (tableNum: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedback((prev) => ({ ...prev, [tableNum]: true }));
      setTimeout(() => {
        setCopyFeedback((prev) => ({ ...prev, [tableNum]: false }));
      }, 1500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  // Trigger browser print
  const handlePrintAll = () => {
    window.print();
  };

  // Build table card data list
  const tablesData = useMemo(() => {
    if (tableCount <= 0) return [];
    const list = [];
    for (let t = 1; t <= tableCount; t++) {
      const matched = devices.filter(
        (d) => parseStandTableNumber(d.label, d.location) === t
      );
      const assigned = matched[0] || null;
      const isDuplicate = matched.length > 1;
      const isVirtual = !assigned;
      const code = assigned ? assigned.device_code : selectedPrimary;
      const targetUrl = assigned
        ? `${effectiveOrigin}/tap/${code}`
        : code
        ? `${effectiveOrigin}/tap/${code}?table=${t}`
        : "";

      list.push({
        tableNum: t,
        matched,
        assigned,
        isDuplicate,
        isVirtual,
        code,
        targetUrl,
        qrDataUrl: qrCodeDataUrls[t] || "",
      });
    }
    return list;
  }, [tableCount, devices, selectedPrimary, effectiveOrigin, qrCodeDataUrls]);

  // Summary counts
  const dedicatedCount = useMemo(() => {
    return tablesData.filter((t) => !t.isVirtual).length;
  }, [tablesData]);

  const virtualCount = useMemo(() => {
    return tablesData.filter((t) => t.isVirtual).length;
  }, [tablesData]);

  const duplicateConflicts = useMemo(() => {
    return tablesData.filter((t) => t.isDuplicate);
  }, [tablesData]);

  // A4 Print Chunks (6 cards per page: 2 columns x 3 rows)
  const printPages = useMemo(() => {
    const pages: (typeof tablesData)[] = [];
    for (let i = 0; i < tablesData.length; i += 6) {
      pages.push(tablesData.slice(i, i + 6));
    }
    return pages;
  }, [tablesData]);

  // EMPTY STATE: table_count missing or 0
  if (tableCount <= 0) {
    return (
      <div className="tables-board-empty" style={styles.emptyContainer}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>🪑</div>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
          Table QR Board Not Configured
        </h2>
        <p style={{ color: "#64748b", fontSize: "14px", maxWidth: "480px", margin: "0 auto 20px" }}>
          Set your table count in Table Ordering settings to generate table QRs and manage stand assignments.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
          {onGoToSettings && (
            <button
              type="button"
              onClick={onGoToSettings}
              style={{
                padding: "10px 18px",
                background: "#0f172a",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              ⚙️ Go to Table Ordering Settings
            </button>
          )}

          <div style={{ display: "flex", gap: "8px", alignItems: "center", background: "#f8fafc", padding: "6px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>Quick Setup:</span>
            <input
              type="number"
              min={1}
              max={150}
              value={newTableCountInput}
              onChange={(e) => setNewTableCountInput(parseInt(e.target.value, 10) || 1)}
              style={{
                width: "60px",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                fontWeight: 600,
                textAlign: "center",
              }}
            />
            <span style={{ fontSize: "12px", color: "#64748b" }}>tables</span>
            <button
              type="button"
              disabled={savingTableCount}
              onClick={handleSaveQuickTableCount}
              style={{
                padding: "6px 14px",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {savingTableCount ? "Saving..." : "Configure"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tables-board-wrapper">
      {/* GLOBAL PRINT STYLESHEET */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          .tables-board-print-root, .tables-board-print-root * {
            visibility: visible !important;
          }
          .tables-board-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            background: #ffffff !important;
          }
          .tables-board-screen-only {
            display: none !important;
          }
          .tables-board-print-page {
            page-break-after: always;
            break-after: page;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(3, 1fr) !important;
            gap: 8mm !important;
            height: 275mm !important;
            box-sizing: border-box !important;
            padding: 4mm !important;
          }
          .tables-board-print-card {
            border: 1.5px dashed #64748b !important;
            border-radius: 8px !important;
            padding: 12px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
            text-align: center !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
            height: 100% !important;
          }
        }
        @media screen {
          .tables-board-print-root {
            display: none;
          }
        }
      `}</style>

      {/* SCREEN VIEW */}
      <div className="tables-board-screen-only" style={styles.container}>
        {/* TOP BAR / HEADER */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>TABLE QR & STAND MANAGEMENT</div>
            <h2 style={styles.title}>Tables Board</h2>
            <p style={styles.subtitle}>
              {tableCount} tables configured ({dedicatedCount} with dedicated stands, {virtualCount} using primary QR)
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              onClick={handlePrintAll}
              style={styles.printBtn}
              title="Print all table QR cards on standard A4 paper (6 cards per page)"
            >
              <span>🖨️</span> Print All Cards (A4)
            </button>

            <button
              type="button"
              disabled={exportingZip}
              onClick={handleDownloadAllZip}
              style={styles.zipBtn}
              title="Download high-resolution PNG for every table packed in a ZIP"
            >
              <span>📦</span> {exportingZip ? (zipProgress || "Creating ZIP...") : "Download All (ZIP)"}
            </button>
          </div>
        </div>

        {/* PRIMARY STAND & CONFLICT NOTICES */}
        <div style={styles.configBar}>
          <div style={styles.primarySelectorBox}>
            <span style={styles.primaryLabel}>Primary Stand (Virtual QRs):</span>
            {devices.length > 0 ? (
              <select
                value={selectedPrimary}
                disabled={savingPrimary}
                onChange={(e) => handlePrimaryChange(e.target.value)}
                style={styles.primarySelect}
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.device_code}>
                    {d.device_code} {d.label ? `(${d.label})` : d.location ? `(${d.location})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span style={styles.primaryWarning}>⚠️ No stands assigned to this business</span>
            )}
            {savingPrimary && <span style={{ fontSize: "12px", color: "#2563eb" }}>Saving...</span>}
          </div>

          <div style={styles.statsPills}>
            <span style={styles.statPillGreen}>🟢 Dedicated: {dedicatedCount}</span>
            <span style={styles.statPillBlue}>🔷 Virtual: {virtualCount}</span>
            {duplicateConflicts.length > 0 && (
              <span style={styles.statPillRed}>
                ⚠️ {duplicateConflicts.length} Conflict{duplicateConflicts.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* DUPLICATE WARNING BANNER IF ANY */}
        {duplicateConflicts.length > 0 && (
          <div style={styles.conflictBanner}>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#b91c1c", marginBottom: "4px" }}>
              ⚠️ Stand Assignment Conflicts Detected
            </div>
            <div style={{ fontSize: "12px", color: "#991b1b", lineHeight: "1.5" }}>
              {duplicateConflicts.map((c) => (
                <div key={c.tableNum}>
                  • <strong>Table {c.tableNum}</strong> is assigned to {c.matched.length} stands:{" "}
                  {c.matched.map((m) => m.device_code).join(", ")}.
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABLES GRID */}
        <div style={styles.grid}>
          {tablesData.map((table) => {
            const isAssigned = Boolean(table.assigned);
            const isDup = table.isDuplicate;
            const hasOpenRequest = openRequestTables.includes(table.tableNum);
            const hasActiveOrder = activeOrderTables.includes(table.tableNum);

            return (
              <div
                key={table.tableNum}
                style={{
                  ...styles.card,
                  borderColor: isDup
                    ? "#fca5a5"
                    : hasOpenRequest
                    ? "#f59e0b"
                    : isAssigned
                    ? "#cbd5e1"
                    : "#e2e8f0",
                  backgroundColor: isDup ? "#fffafb" : hasOpenRequest ? "#fffbeb" : "#ffffff",
                }}
              >
                {/* Card Top / Table Title */}
                <div style={styles.cardHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <div style={styles.cardTitle}>Table {table.tableNum}</div>
                    {hasOpenRequest && (
                      <span
                        style={styles.badgeAmber}
                        title="Open staff request on this table"
                        aria-label="Open staff request"
                      >
                        🔔 Request
                      </span>
                    )}
                    {hasActiveOrder && (
                      <span
                        style={styles.badgeTeal}
                        title="Active table order"
                        aria-label="Active order"
                      >
                        ● Order
                      </span>
                    )}
                  </div>

                  {isDup ? (
                    <span style={styles.badgeRed} title="Multiple stands assigned with same table number">
                      ⚠️ Duplicate ({table.matched.length})
                    </span>
                  ) : isAssigned ? (
                    <span style={styles.badgeGreen} title="Has dedicated physical standee">
                      🟢 Dedicated Stand
                    </span>
                  ) : (
                    <span style={styles.badgeBlue} title="Uses primary stand virtual tap URL">
                      🔷 Virtual QR
                    </span>
                  )}
                </div>

                {/* Stand details */}
                <div style={styles.standInfo}>
                  {isAssigned ? (
                    <div>
                      <div style={styles.standCodeText}>
                        Stand: <strong>{table.assigned?.device_code}</strong>
                      </div>
                      <div style={styles.standSubText}>
                        Label: {table.assigned?.label || table.assigned?.location || "None"}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={styles.standCodeText}>
                        Uses: <strong>{table.code || "None"}</strong>
                      </div>
                      <div style={styles.standSubText}>
                        Query: ?table={table.tableNum}
                      </div>
                    </div>
                  )}
                </div>

                {/* QR Code Preview */}
                <div style={styles.qrContainer}>
                  {table.qrDataUrl ? (
                    <img
                      src={table.qrDataUrl}
                      alt={`QR Code Table ${table.tableNum}`}
                      style={styles.qrImage}
                    />
                  ) : (
                    <div style={styles.qrPlaceholder}>Generating QR...</div>
                  )}
                </div>

                {/* URL String & Copy Button */}
                <div style={styles.urlBox}>
                  <input
                    type="text"
                    readOnly
                    value={table.targetUrl}
                    style={styles.urlInput}
                    title={table.targetUrl}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(table.tableNum, table.targetUrl)}
                    style={styles.copyBtn}
                    title="Copy Tap URL"
                  >
                    {copyFeedback[table.tableNum] ? "✓" : "📋"}
                  </button>
                </div>

                {/* Card Actions */}
                <div style={styles.cardActions}>
                  <button
                    type="button"
                    onClick={() => handleDownloadSinglePng(table.tableNum)}
                    style={styles.downloadPngBtn}
                    title="Download high-res PNG table card"
                  >
                    <span>⬇</span> Download PNG
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => openAssignModal(table.tableNum)}
                      style={isAssigned ? styles.changeStandBtn : styles.assignStandBtn}
                      title="Assign or change standee for this table"
                    >
                      {isAssigned ? "Change Stand" : "+ Assign Stand"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PRINT-ONLY A4 PAGES (6 cards per page: 2 cols x 3 rows) */}
      <div className="tables-board-print-root">
        {printPages.map((pageCards, pageIdx) => (
          <div key={pageIdx} className="tables-board-print-page">
            {pageCards.map((table) => {
              const code = table.assigned ? table.assigned.device_code : selectedPrimary;
              return (
                <div key={table.tableNum} className="tables-board-print-card">
                  {/* Top: Business Info */}
                  <div style={{ width: "100%", paddingBottom: "6px", borderBottom: "1px solid #e2e8f0" }}>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        lineHeight: "1.2",
                      }}
                    >
                      {businessName}
                    </div>
                  </div>

                  {/* Table Badge */}
                  <div
                    style={{
                      background: "#0f172a",
                      color: "#ffffff",
                      fontWeight: 800,
                      fontSize: "20px",
                      padding: "6px 20px",
                      borderRadius: "20px",
                      margin: "8px 0",
                      letterSpacing: "0.5px",
                    }}
                  >
                    TABLE {table.tableNum}
                  </div>

                  {/* QR Image */}
                  <div style={{ width: "140px", height: "140px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {table.qrDataUrl ? (
                      <img
                        src={table.qrDataUrl}
                        alt={`Table ${table.tableNum} QR`}
                        style={{ width: "135px", height: "135px", objectFit: "contain" }}
                      />
                    ) : (
                      <div>QR</div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div style={{ marginTop: "6px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", marginBottom: "2px" }}>
                      Scan to view menu & place order
                    </div>
                    <div style={{ fontSize: "9px", color: "#64748b" }}>
                      {table.assigned ? `Stand: ${code}` : `Table ${table.tableNum} • Virtual QR`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ADMIN ONLY: STAND ASSIGNMENT MODAL */}
      {isAdmin && assignModalTable !== null && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "17px", color: "#0f172a", fontWeight: 700 }}>
                  Assign Stand to Table {assignModalTable}
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                  Select an unassigned inventory stand or reassign an existing stand.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalTable(null)}
                style={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>

            {assignmentMessage && (
              <div style={styles.modalAlert}>{assignmentMessage}</div>
            )}

            <div style={styles.modalBody}>
              {/* CURRENT TABLE STAND ACTIONS */}
              {(() => {
                const currentTableAssigned = devices.filter(
                  (d) => parseStandTableNumber(d.label, d.location) === assignModalTable
                );
                if (currentTableAssigned.length === 0) return null;

                return (
                  <div style={{ marginBottom: "16px", padding: "10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                      Currently Assigned Stand(s):
                    </div>
                    {currentTableAssigned.map((cur) => (
                      <div
                        key={cur.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 0",
                          borderBottom: "1px dashed #e2e8f0",
                        }}
                      >
                        <div>
                          <strong>{cur.device_code}</strong>{" "}
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            ({cur.label || cur.location || "No label"})
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            disabled={assigningDevice}
                            onClick={() => handleClearTableAssignment(cur.id)}
                            style={styles.actionBtnSmall}
                            title="Remove table number from stand, keep stand on business"
                          >
                            Clear Table #
                          </button>
                          <button
                            type="button"
                            disabled={assigningDevice}
                            onClick={() => handleReleaseToInventory(cur.id)}
                            style={styles.actionBtnSmallDanger}
                            title="Unassign from business back to inventory"
                          >
                            Release Stand
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* UNASSIGNED INVENTORY STANDS */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                  📦 Unassigned Inventory Stands:
                </div>
                {loadingInventory ? (
                  <div style={{ fontSize: "12px", color: "#64748b", padding: "12px 0" }}>
                    Loading available stands...
                  </div>
                ) : inventoryDevices.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#64748b", padding: "10px", background: "#f8fafc", borderRadius: "6px" }}>
                    No unassigned inventory stands available.
                  </div>
                ) : (
                  <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                    {inventoryDevices.map((inv) => (
                      <div
                        key={inv.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "13px", color: "#0f172a" }}>{inv.device_code}</strong>
                          <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "8px" }}>
                            {inv.device_type || "Standee"}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={assigningDevice}
                          onClick={() => handleAssignStand(inv.id, true)}
                          style={styles.selectAssignBtn}
                        >
                          Assign to Table {assignModalTable}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ALREADY ASSIGNED STANDS OF THIS CLIENT (REASSIGN) */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                  🔄 Reassign Existing Stand of this Business:
                </div>
                {devices.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#64748b" }}>No stands currently assigned.</div>
                ) : (
                  <div style={{ maxHeight: "140px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                    {devices.map((dev) => (
                      <div
                        key={dev.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "13px", color: "#0f172a" }}>{dev.device_code}</strong>
                          <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "8px" }}>
                            (Current: {dev.label || dev.location || "Unlabeled"})
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={assigningDevice}
                          onClick={() => handleAssignStand(dev.id, false)}
                          style={styles.selectReassignBtn}
                        >
                          Reassign
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Clean Styles for TablesBoard
const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  emptyContainer: {
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    borderRadius: "14px",
    padding: "48px 24px",
    textAlign: "center",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "20px",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 4px",
  },
  subtitle: {
    fontSize: "13px",
    color: "#475569",
    margin: 0,
  },
  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  printBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "10px 16px",
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.15)",
  },
  zipBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "10px 16px",
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(37, 99, 235, 0.15)",
  },
  configBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    padding: "12px 16px",
    background: "#f8fafc",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    marginBottom: "20px",
  },
  primarySelectorBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  primaryLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
  },
  primarySelect: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    fontWeight: 600,
    color: "#0f172a",
    background: "#ffffff",
  },
  primaryWarning: {
    fontSize: "12px",
    color: "#dc2626",
    fontWeight: 600,
  },
  statsPills: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  statPillGreen: {
    background: "#ecfdf5",
    color: "#047857",
    padding: "4px 10px",
    borderRadius: "16px",
    fontSize: "12px",
    fontWeight: 700,
  },
  statPillBlue: {
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "4px 10px",
    borderRadius: "16px",
    fontSize: "12px",
    fontWeight: 700,
  },
  statPillRed: {
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "4px 10px",
    borderRadius: "16px",
    fontSize: "12px",
    fontWeight: 700,
  },
  conflictBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "16px",
  },
  card: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    transition: "box-shadow 0.2s ease",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#0f172a",
  },
  badgeGreen: {
    background: "#ecfdf5",
    color: "#065f46",
    fontSize: "11px",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "12px",
  },
  badgeBlue: {
    background: "#eff6ff",
    color: "#1e40af",
    fontSize: "11px",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "12px",
  },
  badgeRed: {
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: "11px",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "12px",
  },
  badgeAmber: {
    background: "#fef3c7",
    color: "#b45309",
    border: "1px solid #fcd34d",
    fontSize: "11px",
    fontWeight: 800,
    padding: "2px 7px",
    borderRadius: "12px",
  },
  badgeTeal: {
    background: "#f0fdfa",
    color: "#0f766e",
    border: "1px solid #99f6e4",
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: "12px",
  },
  standInfo: {
    fontSize: "12px",
    marginBottom: "10px",
    minHeight: "34px",
  },
  standCodeText: {
    color: "#334155",
    fontSize: "12px",
  },
  standSubText: {
    color: "#64748b",
    fontSize: "11px",
  },
  qrContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "10px",
    background: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #f1f5f9",
    marginBottom: "10px",
  },
  qrImage: {
    width: "150px",
    height: "150px",
    display: "block",
  },
  qrPlaceholder: {
    width: "150px",
    height: "150px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: "11px",
  },
  urlBox: {
    display: "flex",
    gap: "6px",
    marginBottom: "12px",
  },
  urlInput: {
    flex: 1,
    padding: "5px 8px",
    fontSize: "11px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    color: "#475569",
    background: "#f8fafc",
    outline: "none",
  },
  copyBtn: {
    padding: "5px 9px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 600,
  },
  cardActions: {
    marginTop: "auto",
    display: "flex",
    gap: "6px",
  },
  downloadPngBtn: {
    flex: 1,
    padding: "8px 10px",
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
  },
  assignStandBtn: {
    padding: "8px 10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  changeStandBtn: {
    padding: "8px 10px",
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.5)",
    backdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "16px",
  },
  modalContent: {
    background: "#ffffff",
    borderRadius: "14px",
    width: "100%",
    maxWidth: "500px",
    padding: "20px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "14px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "10px",
  },
  modalCloseBtn: {
    background: "transparent",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    color: "#64748b",
  },
  modalAlert: {
    padding: "8px 12px",
    background: "#ecfdf5",
    color: "#065f46",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "12px",
  },
  modalBody: {
    display: "flex",
    flexDirection: "column",
  },
  selectAssignBtn: {
    padding: "4px 10px",
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "5px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  selectReassignBtn: {
    padding: "4px 10px",
    background: "#f1f5f9",
    color: "#1e293b",
    border: "1px solid #cbd5e1",
    borderRadius: "5px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  actionBtnSmall: {
    padding: "3px 8px",
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    fontSize: "11px",
    cursor: "pointer",
  },
  actionBtnSmallDanger: {
    padding: "3px 8px",
    background: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    borderRadius: "4px",
    fontSize: "11px",
    cursor: "pointer",
  },
};
