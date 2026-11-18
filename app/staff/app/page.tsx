"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { parseStaffMenu, type StaffMenuCategory, type StaffMenuItem } from "../../lib/staffMenu";
import WaiterHome, { type StaffWaiterOrder, type StaffRequest } from "../WaiterHome";
import KitchenHome, { type StaffKitchenOrder } from "../KitchenHome";

type StaffContext = {
  staff: {
    id: string;
    name: string;
    role: "waiter" | "kitchen" | "cashier";
    business_id: string;
  };
  business: {
    id: string;
    name: string;
    category?: string;
  };
  table_count: number | null;
  packing_charge: number;
  module_configs?: Array<{ module_key: string; config: unknown }>;
};

export default function StaffAppPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [serverFeatureMissing, setServerFeatureMissing] = useState(false);
  const [context, setContext] = useState<StaffContext | null>(null);

  const [categories, setCategories] = useState<StaffMenuCategory[]>([]);
  const [items, setItems] = useState<StaffMenuItem[]>([]);

  const [orders, setOrders] = useState<StaffKitchenOrder[]>([]);
  const [requests, setRequests] = useState<StaffRequest[]>([]);

  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Poll controller ref
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);

  const fetchLiveData = useCallback(async (role: "waiter" | "kitchen") => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (role === "waiter") {
        const [ordersRes, reqsRes] = await Promise.all([
          supabase.rpc("staff_list_orders"),
          supabase.rpc("staff_list_requests"),
        ]);

        if (ordersRes.error || reqsRes.error) {
          setIsOffline(true);
        } else {
          setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
          setRequests(Array.isArray(reqsRes.data) ? reqsRes.data : []);
          setIsOffline(false);
          setLastUpdated(new Date());
        }
      } else if (role === "kitchen") {
        const ordersRes = await supabase.rpc("staff_list_orders");

        if (ordersRes.error) {
          setIsOffline(true);
        } else {
          setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
          setIsOffline(false);
          setLastUpdated(new Date());
        }
      }
    } catch {
      setIsOffline(true);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Initial authentication & context load
  useEffect(() => {
    let active = true;

    async function loadStaffContext() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;
        if (!session?.user) {
          router.replace("/staff");
          return;
        }

        // Call staff_get_context
        const { data, error } = await supabase.rpc("staff_get_context");
        if (!active) return;

        if (error) {
          if (
            error.message?.includes("does not exist") ||
            error.code === "42883" ||
            error.message?.includes("not found")
          ) {
            setServerFeatureMissing(true);
            setLoading(false);
            return;
          }

          // Not a valid staff member or deactivated -> sign out
          await supabase.auth.signOut();
          router.replace("/staff");
          return;
        }

        const ctx = data as StaffContext;
        if (!ctx?.staff?.id || !ctx?.business?.id) {
          await supabase.auth.signOut();
          router.replace("/staff");
          return;
        }

        setContext(ctx);

        // Parse digital_menu for Waiter order entry
        if (ctx.staff.role === "waiter" && Array.isArray(ctx.module_configs)) {
          const parsed = parseStaffMenu(ctx.module_configs);
          setCategories(parsed.categories);
          setItems(parsed.items);
        }

        setLoading(false);

        // Fetch initial data
        if (ctx.staff.role === "waiter" || ctx.staff.role === "kitchen") {
          fetchLiveData(ctx.staff.role);
        }
      } catch {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStaffContext();

    return () => {
      active = false;
    };
  }, [router, fetchLiveData]);

  // 5-second polling while tab is visible
  useEffect(() => {
    const role = context?.staff?.role;
    if (role !== "waiter" && role !== "kitchen") return;
    const activeRole: "waiter" | "kitchen" = role;

    function startPolling() {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          fetchLiveData(activeRole);
        }
      }, 5000);
    }

    function stopPolling() {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchLiveData(activeRole); // Refresh immediately when visible again
        startPolling();
      } else {
        stopPolling(); // Pause when hidden
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [context?.staff?.role, fetchLiveData]);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/staff");
  }

  async function handleUpdateKitchenStatus(
    orderId: string,
    nextStatus: "accepted" | "preparing" | "ready"
  ) {
    try {
      const { error } = await supabase.rpc("staff_set_order_status", {
        p_order_id: orderId,
        p_status: nextStatus,
      });
      if (error) {
        alert(error.message || "Failed to update order status");
      } else {
        await fetchLiveData("kitchen");
      }
    } catch {
      alert("Network error updating status");
    }
  }

  async function handleMarkServed(orderId: string) {
    try {
      const { error } = await supabase.rpc("staff_set_order_status", {
        p_order_id: orderId,
        p_status: "served",
      });
      if (error) {
        alert(error.message || "Failed to mark order as served");
      } else {
        await fetchLiveData("waiter");
      }
    } catch {
      alert("Network error marking served");
    }
  }

  async function handleResolveRequest(requestId: string) {
    try {
      const { error } = await supabase.rpc("staff_resolve_request", {
        p_request_id: requestId,
      });
      if (error) {
        alert(error.message || "Failed to clear request");
      } else {
        await fetchLiveData("waiter");
      }
    } catch {
      alert("Network error resolving request");
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fffaf3",
          color: "#78716c",
          fontSize: 15,
        }}
      >
        Loading staff app...
      </div>
    );
  }

  if (serverFeatureMissing) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: "#fffaf3",
          textAlign: "center",
        }}
      >
        <div
          style={{
            maxWidth: 380,
            width: "100%",
            backgroundColor: "#fff",
            borderRadius: 20,
            padding: 28,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.06)",
            border: "1px solid #fed7aa",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1c1410", marginBottom: 8 }}>
            Server Setup Incomplete
          </h2>
          <p style={{ fontSize: 14, color: "#78716c", lineHeight: 1.5, marginBottom: 20 }}>
            Staff feature is not enabled on the server yet. Please contact the administrator.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: "100%",
              minHeight: 44,
              backgroundColor: "#f97316",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  if (!context || (context.staff.role !== "waiter" && context.staff.role !== "kitchen")) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: "#fffaf3",
          textAlign: "center",
        }}
      >
        <div
          style={{
            maxWidth: 380,
            width: "100%",
            backgroundColor: "#fff",
            borderRadius: 20,
            padding: 28,
            border: "1px solid #e7e5e4",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1c1410", marginBottom: 8 }}>
            Role not supported
          </h2>
          <p style={{ fontSize: 14, color: "#78716c", marginBottom: 20 }}>
            Only Waiter and Kitchen roles have access to the staff app at this time.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: "100%",
              minHeight: 44,
              backgroundColor: "#f97316",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  const roleLabel = context.staff.role === "waiter" ? "Waiter" : "Kitchen";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fffaf3" }}>
      {/* Top Header Bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 80,
          backgroundColor: "#fff",
          borderBottom: "1px solid #e7e5e4",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#1c1410", lineHeight: 1.2 }}>
            {context.business.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#78716c",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <span>Hi {context.staff.name}</span>
            <span>·</span>
            <span
              style={{
                backgroundColor: context.staff.role === "waiter" ? "#ffedd5" : "#fef3c7",
                color: context.staff.role === "waiter" ? "#c2410c" : "#b45309",
                fontWeight: 700,
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 6,
              }}
            >
              {roleLabel}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            minHeight: 36,
            padding: "0 12px",
            backgroundColor: "#f5f5f4",
            color: "#57534e",
            border: "1px solid #e7e5e4",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            cursor: signingOut ? "not-allowed" : "pointer",
          }}
        >
          {signingOut ? "..." : "Log out"}
        </button>
      </header>

      {/* Main Role Content */}
      <main>
        {context.staff.role === "waiter" ? (
          <WaiterHome
            businessId={context.business.id}
            tableCount={context.table_count || 10}
            packingCharge={context.packing_charge || 0}
            categories={categories}
            items={items}
            orders={orders as StaffWaiterOrder[]}
            requests={requests}
            onMarkServed={handleMarkServed}
            onResolveRequest={handleResolveRequest}
            isOffline={isOffline}
            lastUpdated={lastUpdated}
          />
        ) : (
          <KitchenHome
            orders={orders}
            onUpdateStatus={handleUpdateKitchenStatus}
            isOffline={isOffline}
            lastUpdated={lastUpdated}
          />
        )}
      </main>
    </div>
  );
}
