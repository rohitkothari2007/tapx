"use client";

import { useEffect, useState, useMemo, type CSSProperties } from "react";
import { supabase } from "../lib/supabase";
import DigitalMenuEditor, {
  type DigitalMenuConfig,
  type MenuCategory,
  type MenuItem,
  DEFAULT_QUICK_REQUESTS,
} from "../components/DigitalMenuEditor";
import { MENU_TOKENS } from "../lib/menuTheme";

type Props = {
  businessId: string;
  businessName: string;
  deviceCode?: string | null;
};

const MAX_PAYLOAD_BYTES = 300 * 1024; // 300 KB

export default function MenuManagerSection({
  businessId,
  businessName,
  deviceCode,
}: Props) {
  const [config, setConfig] = useState<DigitalMenuConfig>({
    categories: [],
    items: [],
    quick_requests: DEFAULT_QUICK_REQUESTS,
  });
  const [originalConfigJson, setOriginalConfigJson] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [saveError, setSaveError] = useState<string>("");

  // Load existing menu configuration
  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      if (!businessId) return;
      setLoading(true);
      setSaveError("");

      try {
        const { data, error } = await supabase
          .from("business_module_configs")
          .select("id, config, module_key")
          .eq("business_id", businessId)
          .or("module_key.eq.digital_menu,module_key.eq.digital-menu")
          .maybeSingle();

        if (error) {
          console.error("Error loading menu config:", error);
          if (isMounted) {
            setSaveError("Failed to load digital menu configuration.");
          }
          return;
        }

        const rawConfig = (data?.config || {}) as DigitalMenuConfig;
        const initialConfig: DigitalMenuConfig = {
          ...rawConfig,
          categories: Array.isArray(rawConfig.categories) ? rawConfig.categories : [],
          items: Array.isArray(rawConfig.items) ? rawConfig.items : [],
          quick_requests:
            Array.isArray(rawConfig.quick_requests) && rawConfig.quick_requests.length > 0
              ? rawConfig.quick_requests
              : DEFAULT_QUICK_REQUESTS,
        };

        if (isMounted) {
          setConfig(initialConfig);
          setOriginalConfigJson(JSON.stringify(initialConfig));
        }
      } catch (err: any) {
        console.error("Load menu exception:", err);
        if (isMounted) {
          setSaveError("An unexpected error occurred while loading the menu.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadMenu();

    return () => {
      isMounted = false;
    };
  }, [businessId]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!originalConfigJson) return false;
    return JSON.stringify(config) !== originalConfigJson;
  }, [config, originalConfigJson]);

  // Warn on browser exit or refresh if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Handle Save
  const handleSave = async () => {
    if (saving) return; // Prevent double save
    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      // 1. Validate limits
      const categories: MenuCategory[] = Array.isArray(config.categories)
        ? config.categories
        : [];
      const items: MenuItem[] = Array.isArray(config.items) ? config.items : [];

      if (categories.length > 20) {
        setSaveError("Cannot save: maximum 20 categories allowed.");
        setSaving(false);
        return;
      }

      if (items.length > 300) {
        setSaveError("Cannot save: maximum 300 items allowed.");
        setSaving(false);
        return;
      }

      // 2. Fetch existing row to merge cleanly without losing other keys
      const { data: existingRow, error: fetchErr } = await supabase
        .from("business_module_configs")
        .select("id, config")
        .eq("business_id", businessId)
        .or("module_key.eq.digital_menu,module_key.eq.digital-menu")
        .maybeSingle();

      if (fetchErr) {
        throw new Error(fetchErr.message || "Failed to query module configuration.");
      }

      const existingConfigObj = (existingRow?.config || {}) as Record<string, unknown>;

      const mergedConfig: DigitalMenuConfig = {
        ...existingConfigObj,
        categories,
        items,
        quick_requests:
          Array.isArray(config.quick_requests) && config.quick_requests.length > 0
            ? config.quick_requests
            : DEFAULT_QUICK_REQUESTS,
      };

      // 3. Payload size validation (< 300 KB)
      const encodedBytes = new TextEncoder().encode(JSON.stringify(mergedConfig)).length;
      if (encodedBytes > MAX_PAYLOAD_BYTES) {
        setSaveError(
          `Cannot save: menu configuration size (${Math.round(
            encodedBytes / 1024
          )} KB) exceeds the maximum allowed 300 KB limit. Please reduce image URLs or descriptions.`
        );
        setSaving(false);
        return;
      }

      if (!existingRow?.id) {
        // If row doesn't exist, insert new
        const { error: insertErr } = await supabase
          .from("business_module_configs")
          .insert({
            business_id: businessId,
            module_key: "digital_menu",
            config: mergedConfig,
          });

        if (insertErr) throw insertErr;
      } else {
        // Update existing row
        const { error: updateErr } = await supabase
          .from("business_module_configs")
          .update({
            config: mergedConfig,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRow.id);

        if (updateErr) throw updateErr;
      }

      // Update state
      setConfig(mergedConfig);
      setOriginalConfigJson(JSON.stringify(mergedConfig));
      setSaveMessage("Menu changes saved successfully! Updates are live on your stands.");

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSaveMessage("");
      }, 5000);
    } catch (err: any) {
      console.error("Save menu error:", err);
      setSaveError(err.message || "An unexpected error occurred while saving the menu.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCustomerMenu = () => {
    if (deviceCode) {
      window.open(`/tap/${deviceCode}#menu`, "_blank");
    } else {
      window.open(`/tap?businessId=${businessId}#menu`, "_blank");
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}>🍽️</div>
        <div style={styles.loadingText}>Loading Digital Menu Manager...</div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {/* STATUS & ACTIONS BAR */}
      <div style={styles.statusBar}>
        <div style={styles.statusLeft}>
          {hasUnsavedChanges ? (
            <span style={styles.unsavedBadge}>
              <span style={styles.unsavedDot}>●</span>
              <span>Unsaved changes</span>
            </span>
          ) : (
            <span style={styles.savedBadge}>
              <span style={styles.savedDot}>✓</span>
              <span>All changes saved</span>
            </span>
          )}
        </div>

        <div style={styles.statusActions}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            style={{
              ...styles.saveButton,
              opacity: saving || !hasUnsavedChanges ? 0.6 : 1,
              cursor: saving || !hasUnsavedChanges ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving Menu..." : "Save Menu Changes"}
          </button>
        </div>
      </div>

      {/* SUCCESS / ERROR NOTIFICATIONS */}
      {saveMessage && <div style={styles.successBanner}>{saveMessage}</div>}
      {saveError && <div style={styles.errorBanner}>{saveError}</div>}

      {/* SHARED MENU EDITOR */}
      <DigitalMenuEditor
        config={config}
        onChange={(next) => setConfig(next)}
        isOwnerMode={true}
        onPreviewCustomerMenu={handleOpenCustomerMenu}
      />

      {/* BOTTOM FLOATING SAVE BAR IF UNSAVED CHANGES */}
      {hasUnsavedChanges && (
        <div style={styles.floatingBar}>
          <div style={styles.floatingText}>
            You have unsaved changes in your menu.
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={styles.floatingSaveButton}
          >
            {saving ? "Saving..." : "Save Changes Now"}
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    maxWidth: "1100px",
    margin: "0 auto",
    paddingBottom: "80px",
    position: "relative",
    fontFamily: MENU_TOKENS.fonts.sans,
  },
  loadingContainer: {
    padding: "80px 20px",
    textAlign: "center",
    fontFamily: MENU_TOKENS.fonts.sans,
  },
  loadingSpinner: {
    fontSize: "32px",
    color: MENU_TOKENS.colors.light.muted,
    marginBottom: "12px",
  },
  loadingText: {
    fontSize: "14px",
    color: MENU_TOKENS.colors.light.muted,
    fontWeight: 600,
  },
  statusBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 18px",
    marginBottom: "20px",
    background: "#FFFFFF",
    border: `1px solid ${MENU_TOKENS.colors.light.hairline}`,
    borderRadius: MENU_TOKENS.radii.card,
    boxShadow: MENU_TOKENS.shadows.card,
  },
  statusLeft: {
    display: "flex",
    alignItems: "center",
  },
  unsavedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: MENU_TOKENS.radii.badge,
    background: MENU_TOKENS.colors.light.accentLight,
    border: `1px solid ${MENU_TOKENS.colors.light.accentBorder}`,
    color: "#8A6424",
    fontSize: "12px",
    fontWeight: 700,
  },
  unsavedDot: {
    fontSize: "10px",
    color: MENU_TOKENS.colors.light.accent,
  },
  savedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: MENU_TOKENS.radii.badge,
    background: MENU_TOKENS.colors.light.vegBg,
    border: "1px solid #A7F3D0",
    color: MENU_TOKENS.colors.light.veg,
    fontSize: "12px",
    fontWeight: 700,
  },
  savedDot: {
    fontWeight: 900,
  },
  statusActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  saveButton: {
    padding: "10px 20px",
    borderRadius: "10px",
    background: MENU_TOKENS.colors.light.ink,
    color: "#FFFFFF",
    border: "none",
    fontSize: "13px",
    fontWeight: 700,
    fontFamily: MENU_TOKENS.fonts.sans,
    minHeight: MENU_TOKENS.layout.minTouchTarget,
    transition: "background 0.15s ease",
  },
  successBanner: {
    padding: "12px 16px",
    marginBottom: "18px",
    borderRadius: "12px",
    background: MENU_TOKENS.colors.light.vegBg,
    border: "1px solid #A7F3D0",
    color: MENU_TOKENS.colors.light.veg,
    fontSize: "13px",
    fontWeight: 700,
  },
  errorBanner: {
    padding: "12px 16px",
    marginBottom: "18px",
    borderRadius: "12px",
    background: "#FDF2F2",
    border: "1px solid #FECACA",
    color: "#B91C1C",
    fontSize: "13px",
    fontWeight: 700,
  },
  floatingBar: {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 999,
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 22px",
    background: MENU_TOKENS.colors.light.ink,
    color: "#FFFFFF",
    borderRadius: MENU_TOKENS.radii.chip,
    boxShadow: MENU_TOKENS.shadows.floatingBar,
  },
  floatingText: {
    fontSize: "13px",
    fontWeight: 600,
  },
  floatingSaveButton: {
    padding: "8px 18px",
    borderRadius: MENU_TOKENS.radii.chip,
    background: "#FFFFFF",
    color: MENU_TOKENS.colors.light.ink,
    border: "none",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: MENU_TOKENS.fonts.sans,
    minHeight: "36px",
  },
};
