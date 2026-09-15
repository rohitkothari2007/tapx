"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "./lib/supabase";

type Client = {
  id: string;
  name: string;
  category: string;
  location: string;
  devices: number;
  status: string;
};

type Device = {
  id: string;
  device_code: string;
  business_id: string | null;
  device_type: string;
  location: string;
  status: string;
  created_at: string;
  business_name: string;
  taps: number;
};

/* ============================================================
   MAIN NAVIGATION
============================================================ */

const navigation = [
  {
    label: "Dashboard",
    href: "/",
    icon: "▦",
  },
  {
    label: "Clients",
    href: "/clients",
    icon: "◉",
  },
  {
    label: "Devices",
    href: "/devices",
    icon: "⌁",
  },
  {
    label: "Sales & Orders",
    href: "/orders",
    icon: "₹",
  },
  
];

/* ============================================================
   FEATURES STILL BEING BUILT
============================================================ */

const comingSoon = [
  {
    label: "Analytics",
    icon: "◫",
  },
  {
    label: "Accounts",
    icon: "▣",
  },
  {
    label: "Team",
    icon: "♙",
  },
  {
    label: "Settings",
    icon: "⚙",
  },
];

/* ============================================================
   DASHBOARD
============================================================ */

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();

  const [clients, setClients] = useState<Client[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingDevices, setLoadingDevices] = useState(true);

  const [clientError, setClientError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  /* ============================================================
     LOAD DASHBOARD DATA
  ============================================================ */

  async function loadDashboard() {
    setLoadingClients(true);
    setLoadingDevices(true);

    setClientError(null);
    setDeviceError(null);

    const [
      {
        data: businessesData,
        error: businessesError,
      },
      {
        data: devicesData,
        error: devicesError,
      },
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("devices")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (businessesError) {
      console.error(
        "Dashboard businesses error:",
        businessesError
      );

      setClientError(businessesError.message);
      setClients([]);
    }

    if (devicesError) {
      console.error(
        "Dashboard devices error:",
        devicesError
      );

      setDeviceError(devicesError.message);
      setDevices([]);
    }

    if (!businessesError && businessesData) {
      const formattedClients: Client[] =
        businessesData.map((business: any) => {
          const businessDevices =
            (devicesData || []).filter(
              (device: any) =>
                device.business_id === business.id
            );

          return {
            id: business.id,

            name:
              business.name ||
              "Unnamed Business",

            category:
              business.category ||
              "Business",

            location:
              [
                business.city,
                business.state,
              ]
                .filter(Boolean)
                .join(", ") ||
              "Location not available",

            devices: businessDevices.length,

            status:
              business.status ||
              "active",
          };
        });

      setClients(formattedClients);
    }

    if (!devicesError && devicesData) {
      const formattedDevices: Device[] =
        devicesData.map((device: any) => {
          const business =
            (businessesData || []).find(
              (item: any) =>
                item.id === device.business_id
            );

          return {
            id: device.id,

            device_code:
              device.device_code ||
              "Unknown",

            business_id:
              device.business_id ||
              null,

            device_type:
              device.device_type ||
              "Unknown",

            location:
              device.location ||
              "Not specified",

            status:
              device.status ||
              "unknown",

            created_at:
              device.created_at,

            business_name:
              business?.name ||
              "Available",

            taps: 0,
          };
        });

      setDevices(formattedDevices);
    }

    setLoadingClients(false);
    setLoadingDevices(false);
  }

  const [highlightedWidgets, setHighlightedWidgets] = useState<Record<string, boolean>>({});

  function triggerHighlight(key: string) {
    setHighlightedWidgets((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setHighlightedWidgets((prev) => ({ ...prev, [key]: false }));
    }, 1800);
  }

  useEffect(() => {
    loadDashboard();

    // Push-based Supabase Realtime Channel
    const channel = supabase
      .channel("admin_realtime_dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "interactions" },
        () => {
          triggerHighlight("taps");
          loadDashboard();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tapx_orders" },
        () => {
          triggerHighlight("orders");
          loadDashboard();
        }
      )
      .subscribe();

    // 25-second Auto-Polling Interval for Lower-Urgency Aggregates
    const interval = setInterval(() => {
      loadDashboard();
    }, 25000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  /* ============================================================
     DASHBOARD METRICS
  ============================================================ */

  const activeClients =
    clients.filter(
      (client) =>
        client.status.toLowerCase() ===
        "active"
    ).length;

  const activeDevices =
    devices.filter(
      (device) =>
        device.status.toLowerCase() ===
        "active"
    ).length;

  const availableDevices =
    devices.filter(
      (device) =>
        !device.business_id &&
        device.status.toLowerCase() !==
          "inactive"
    ).length;

  const totalInteractions =
    devices.reduce(
      (total, device) =>
        total + device.taps,
      0
    );

  /* ============================================================
     HELPERS
  ============================================================ */

  function initials(name: string) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function formatCategory(value: string) {
    if (!value) return "Business";

    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-gray-900">

      <div className="flex min-h-screen">

        {/* =====================================================
            SIDEBAR
        ====================================================== */}

        <aside className="w-64 shrink-0 bg-[#0b1220] text-white p-5">

          {/* LOGO */}

          <div className="mb-10 px-3">

            <Link
              href="/"
              className="block"
            >

              <h1 className="text-3xl font-bold tracking-tight">
                TAP
                <span className="text-blue-400">
                  X
                </span>
              </h1>

              <p className="text-xs text-gray-400 mt-1">
                Business Management Platform
              </p>

            </Link>

          </div>

          {/* MAIN NAVIGATION */}

          <nav className="space-y-2">

            {navigation.map((item) => {

              const active =
                pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm transition ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >

                  <span className="w-5 text-center">
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>

                </Link>
              );
            })}

          </nav>

          {/* ===================================================
              COMING SOON
          ==================================================== */}

          <div className="mt-10">

            <p className="px-3 mb-3 text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
              Platform
            </p>

            <nav className="space-y-1">

              {comingSoon.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() =>
                    alert(
                      `${item.label} is being built next.`
                    )
                  }
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm text-gray-500 hover:bg-white/5 hover:text-gray-300 transition"
                >

                  <span className="w-5 text-center">
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>

                  <span className="ml-auto text-[9px] text-gray-600">
                    SOON
                  </span>

                </button>
              ))}

            </nav>

          </div>

        </aside>

        {/* =====================================================
            MAIN
        ====================================================== */}

        <main className="flex-1 min-w-0">

          {/* ===================================================
              TOP BAR
          ==================================================== */}

          <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8">

            <div>

              <p className="text-sm text-gray-500">
                TAPX Admin
              </p>

              <h2 className="font-semibold">
                Control Center
              </h2>

            </div>

            <div className="flex items-center gap-3">

              <div className="text-right">

                <p className="text-sm font-semibold">
                  Administrator
                </p>

                <p className="text-xs text-gray-500">
                  TAPX Owner
                </p>

              </div>

              <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-semibold">
                TX
              </div>

            </div>

          </header>

          {/* ===================================================
              CONTENT
          ==================================================== */}

          <div className="p-8">

            {/* =================================================
                PAGE HEADER
            ================================================= */}

            <div className="flex items-start justify-between gap-5 mb-8">

              <div>

                <h1 className="text-3xl font-bold">
                  Dashboard
                </h1>

                <p className="text-gray-500 mt-1">
                  Here's what's happening across TAPX.
                </p>

              </div>

              {/* QUICK ACTIONS */}

              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={() =>
                    router.push("/clients/add")
                  }
                  className="px-4 py-3 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition"
                >
                  + Add Client
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push("/devices")
                  }
                  className="px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50 transition"
                >
                  + Manage Devices
                </button>

              </div>

            </div>

            {/* =================================================
                ERRORS
            ================================================= */}

            {clientError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">

                <p className="font-semibold text-red-700">
                  Unable to load clients
                </p>

                <p className="text-sm text-red-600 mt-1">
                  {clientError}
                </p>

              </div>
            )}

            {deviceError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">

                <p className="font-semibold text-red-700">
                  Unable to load devices
                </p>

                <p className="text-sm text-red-600 mt-1">
                  {deviceError}
                </p>

              </div>
            )}

            {/* =================================================
                METRICS
            ================================================= */}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

              <Metric
                title="Active Clients"
                value={
                  loadingClients
                    ? "..."
                    : activeClients.toString()
                }
                description="Businesses using TAPX"
              />

              <Metric
                title="Active Devices"
                value={
                  loadingDevices
                    ? "..."
                    : activeDevices.toString()
                }
                description="Devices currently live"
              />

              <Metric
                title="Available Devices"
                value={
                  loadingDevices
                    ? "..."
                    : availableDevices.toString()
                }
                description="Ready to assign"
              />

              <Metric
                title="Interactions"
                value={
                  loadingDevices
                    ? "..."
                    : totalInteractions.toString()
                }
                description="Recorded TAPX interactions"
                highlight={highlightedWidgets["taps"]}
              />

            </div>

            {/* =================================================
                MAIN GRID
            ================================================= */}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-6">

              {/* =================================================
                  CLIENTS
              ================================================= */}

              <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200">

                <div className="p-6 border-b border-gray-200 flex items-center justify-between">

                  <div>

                    <h3 className="font-semibold">
                      Clients
                    </h3>

                    <p className="text-xs text-gray-500 mt-1">
                      Businesses currently using TAPX
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push("/clients")
                    }
                    className="text-sm text-blue-600 font-medium hover:text-blue-800"
                  >
                    View all →
                  </button>

                </div>

                <div className="p-6">

                  {loadingClients ? (

                    <div className="text-sm text-gray-500">
                      Loading clients...
                    </div>

                  ) : clients.length === 0 ? (

                    <div className="text-center py-10">

                      <div className="text-4xl mb-3">
                        🏢
                      </div>

                      <h4 className="font-semibold">
                        No clients yet
                      </h4>

                      <p className="text-sm text-gray-500 mt-1 mb-5">
                        Create your first TAPX business.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            "/clients/add"
                          )
                        }
                        className="px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold"
                      >
                        + Add Client
                      </button>

                    </div>

                  ) : (

                    <div className="space-y-1">

                      {clients
                        .slice(0, 8)
                        .map((client) => (

                          <button
                            key={client.id}
                            type="button"
                            onClick={() =>
                              router.push(
                                `/clients/${client.id}`
                              )
                            }
                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition text-left"
                          >

                            <div className="flex items-center gap-4">

                              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                                {initials(
                                  client.name
                                )}
                              </div>

                              <div>

                                <h4 className="font-semibold">
                                  {client.name}
                                </h4>

                                <p className="text-sm text-gray-500">
                                  {formatCategory(
                                    client.category
                                  )}{" "}
                                  •{" "}
                                  {client.location}
                                </p>

                              </div>

                            </div>

                            <div className="text-right">

                              <span className="inline-flex px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                {client.status}
                              </span>

                              <p className="text-xs text-gray-500 mt-2">
                                {client.devices}{" "}
                                {client.devices === 1
                                  ? "device"
                                  : "devices"}
                              </p>

                            </div>

                          </button>

                        ))}

                    </div>

                  )}

                </div>

              </div>

              {/* =================================================
                  DEVICE INVENTORY SUMMARY
              ================================================= */}

              <div className="bg-white rounded-xl border border-gray-200">

                <div className="p-6 border-b border-gray-200">

                  <div className="flex items-center justify-between">

                    <div>

                      <h3 className="font-semibold">
                        Device Inventory
                      </h3>

                      <p className="text-xs text-gray-500 mt-1">
                        TAPX hardware allocation
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        router.push("/devices")
                      }
                      className="text-sm text-blue-600 font-medium"
                    >
                      Manage
                    </button>

                  </div>

                </div>

                <div className="p-6">

                  <div className="grid grid-cols-2 gap-3">

                    <MiniStat
                      label="Total"
                      value={
                        loadingDevices
                          ? "..."
                          : devices.length.toString()
                      }
                    />

                    <MiniStat
                      label="Available"
                      value={
                        loadingDevices
                          ? "..."
                          : availableDevices.toString()
                      }
                    />

                    <MiniStat
                      label="Assigned"
                      value={
                        loadingDevices
                          ? "..."
                          : devices
                              .filter(
                                (device) =>
                                  Boolean(
                                    device.business_id
                                  )
                              )
                              .length.toString()
                      }
                    />

                    <MiniStat
                      label="Inactive"
                      value={
                        loadingDevices
                          ? "..."
                          : devices
                              .filter(
                                (device) =>
                                  device.status.toLowerCase() ===
                                  "inactive"
                              )
                              .length.toString()
                      }
                    />

                  </div>

                  <div className="mt-6">

                    <div className="flex justify-between text-sm mb-2">

                      <span className="text-gray-500">
                        Device assignment
                      </span>

                      <span className="font-semibold">

                        {devices.length > 0
                          ? `${Math.round(
                              (devices.filter(
                                (device) =>
                                  Boolean(
                                    device.business_id
                                  )
                              ).length /
                                devices.length) *
                                100
                            )}%`
                          : "0%"}

                      </span>

                    </div>

                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">

                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width:
                            devices.length > 0
                              ? `${(
                                  (devices.filter(
                                    (device) =>
                                      Boolean(
                                        device.business_id
                                      )
                                  ).length /
                                    devices.length) *
                                  100
                                )}%`
                              : "0%",
                        }}
                      />

                    </div>

                  </div>

                </div>

              </div>

            </div>

            {/* =================================================
                DEVICES
            ================================================= */}

            <div className="bg-white rounded-xl border border-gray-200 mt-6">

              <div className="p-6 border-b border-gray-200 flex items-center justify-between">

                <div>

                  <h3 className="font-semibold">
                    TAPX Devices
                  </h3>

                  <p className="text-xs text-gray-500 mt-1">
                    Current device inventory
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push("/devices")
                  }
                  className="text-sm text-blue-600 font-medium"
                >
                  Open Device Inventory →
                </button>

              </div>

              <div className="overflow-x-auto">

                {loadingDevices ? (

                  <div className="p-6 text-sm text-gray-500">
                    Loading devices...
                  </div>

                ) : devices.length === 0 ? (

                  <div className="p-8 text-center">

                    <div className="text-3xl mb-2">
                      📡
                    </div>

                    <p className="text-sm text-gray-500">
                      No devices registered yet.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        router.push("/devices")
                      }
                      className="mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold"
                    >
                      Add Device
                    </button>

                  </div>

                ) : (

                  <table className="w-full text-sm">

                    <thead className="bg-gray-50">

                      <tr>

                        <th className="text-left px-6 py-4 text-xs text-gray-500">
                          DEVICE
                        </th>

                        <th className="text-left px-6 py-4 text-xs text-gray-500">
                          BUSINESS
                        </th>

                        <th className="text-left px-6 py-4 text-xs text-gray-500">
                          TYPE
                        </th>

                        <th className="text-left px-6 py-4 text-xs text-gray-500">
                          LOCATION
                        </th>

                        <th className="text-left px-6 py-4 text-xs text-gray-500">
                          STATUS
                        </th>

                        <th className="text-right px-6 py-4 text-xs text-gray-500">
                          ACTION
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {devices
                        .slice(0, 8)
                        .map((device) => (

                          <tr
                            key={device.id}
                            className="border-t border-gray-100"
                          >

                            <td className="px-6 py-4">

                              <div className="font-semibold">
                                {device.device_code}
                              </div>

                              <div className="text-xs text-gray-500">
                                {device.device_type}
                              </div>

                            </td>

                            <td className="px-6 py-4">

                              {device.business_id ? (

                                <button
                                  type="button"
                                  onClick={() =>
                                    router.push(
                                      `/clients/${device.business_id}`
                                    )
                                  }
                                  className="font-medium text-blue-600 hover:text-blue-800"
                                >
                                  {device.business_name}
                                </button>

                              ) : (

                                <span className="text-blue-600 font-medium">
                                  Available
                                </span>

                              )}

                            </td>

                            <td className="px-6 py-4 text-gray-600">
                              {device.device_type}
                            </td>

                            <td className="px-6 py-4 text-gray-500">
                              {device.location}
                            </td>

                            <td className="px-6 py-4">

                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  device.status.toLowerCase() ===
                                  "active"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {device.status}
                              </span>

                            </td>

                            <td className="px-6 py-4 text-right">

                              {device.business_id && (

                                <button
                                  type="button"
                                  onClick={() =>
                                    window.open(
                                      `/tap/${device.device_code}`,
                                      "_blank",
                                      "noopener,noreferrer"
                                    )
                                  }
                                  className="text-blue-600 font-medium hover:text-blue-800"
                                >
                                  Customer UI
                                </button>

                              )}

                            </td>

                          </tr>

                        ))}

                    </tbody>

                  </table>

                )}

              </div>

            </div>

            {/* =================================================
                QUICK ACTIONS
            ================================================= */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">

              <QuickAction
                icon="🏢"
                title="Create Client"
                description="Create a new business and configure its TAPX experience."
                onClick={() =>
                  router.push("/clients/add")
                }
              />

              <QuickAction
                icon="📡"
                title="Manage Devices"
                description="Register, assign and manage your TAPX device inventory."
                onClick={() =>
                  router.push("/devices")
                }
              />

              <QuickAction
                icon="👥"
                title="Manage Clients"
                description="View businesses, modules, devices and customer experiences."
                onClick={() =>
                  router.push("/clients")
                }
              />

            </div>

          </div>

        </main>

      </div>

    </div>
  );
}

/* ============================================================
   METRIC
============================================================ */

function Metric({
  title,
  value,
  description,
  highlight,
}: {
  title: string;
  value: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-6 transition-all duration-500 ${
        highlight
          ? "border-amber-400 bg-amber-50/50 shadow-md ring-2 ring-amber-400/50 scale-[1.02]"
          : "border-gray-200"
      }`}
    >

      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className={`text-3xl font-bold mt-3 transition-colors duration-500 ${highlight ? "text-amber-600" : "text-gray-900"}`}>
        {value}
      </p>

      <p className="text-xs text-gray-500 mt-2">
        {description}
      </p>

    </div>
  );
}

/* ============================================================
   MINI STAT
============================================================ */

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">

      <p className="text-xs text-gray-500">
        {label}
      </p>

      <p className="text-2xl font-bold mt-1">
        {value}
      </p>

    </div>
  );
}

/* ============================================================
   QUICK ACTION
============================================================ */

function QuickAction({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition"
    >

      <div className="text-2xl mb-3">
        {icon}
      </div>

      <h3 className="font-semibold">
        {title}
      </h3>

      <p className="text-sm text-gray-500 mt-1 leading-5">
        {description}
      </p>

      <div className="text-sm text-blue-600 font-medium mt-4">
        Open →
      </div>

    </button>
  );
}