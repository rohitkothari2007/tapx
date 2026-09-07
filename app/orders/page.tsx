"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Order = {
  id: string;
  business_id: string;
  table_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  source_device_code: string | null;
  status: string;
  subtotal: number;
  total: number;
  created_at: string;
  businesses?: {
    name: string;
  } | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

const statuses = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
];

/* =========================================================
   HELPERS
========================================================= */

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value || 0);

  return `₹${amount.toFixed(2)}`;
}

function statusStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    whiteSpace: "nowrap",
  };

  switch (status) {
    case "pending":
      return {
        ...base,
        background: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fed7aa",
      };

    case "accepted":
      return {
        ...base,
        background: "#eff6ff",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
      };

    case "preparing":
      return {
        ...base,
        background: "#f5f3ff",
        color: "#6d28d9",
        border: "1px solid #ddd6fe",
      };

    case "ready":
      return {
        ...base,
        background: "#ecfeff",
        color: "#0e7490",
        border: "1px solid #a5f3fc",
      };

    case "served":
      return {
        ...base,
        background: "#f0fdf4",
        color: "#15803d",
        border: "1px solid #bbf7d0",
      };

    case "completed":
      return {
        ...base,
        background: "#ecfdf5",
        color: "#047857",
        border: "1px solid #a7f3d0",
      };

    case "cancelled":
      return {
        ...base,
        background: "#fff1f2",
        color: "#be123c",
        border: "1px solid #fecdd3",
      };

    default:
      return {
        ...base,
        background: "#f5f5f4",
        color: "#57534e",
        border: "1px solid #e7e5e4",
      };
  }
}

/* =========================================================
   PAGE
========================================================= */

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);

  const [businessFilter, setBusinessFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [selectedOrder, setSelectedOrder] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /* =======================================================
     LOAD ORDERS
  ======================================================= */

  async function loadOrders() {
    setError("");

    try {
      const [
        {
          data: orderData,
          error: orderError,
        },
        {
          data: itemData,
          error: itemError,
        },
      ] = await Promise.all([
        supabase
          .from("tapx_orders")
          .select("*, businesses(name)")
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("tapx_order_items")
          .select("*")
          .order("created_at", {
            ascending: true,
          }),
      ]);

      if (orderError) {
        throw orderError;
      }

      if (itemError) {
        throw itemError;
      }

      setOrders(
        (orderData || []) as Order[]
      );

      setItems(
        (itemData || []) as OrderItem[]
      );
    } catch (err) {
      console.error(
        "TAPX orders load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load orders."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =======================================================
     INITIAL LOAD + AUTO REFRESH
  ======================================================= */

  useEffect(() => {
    void loadOrders();

    const timer = window.setInterval(() => {
      void loadOrders();
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  /* =======================================================
     BUSINESS FILTER OPTIONS
  ======================================================= */

  const businesses = useMemo(() => {
    const map = new Map<string, string>();

    orders.forEach((order) => {
      map.set(
        order.business_id,
        order.businesses?.name ||
          "Unknown business"
      );
    });

    return Array.from(map.entries()).sort(
      (a, b) =>
        a[1].localeCompare(b[1])
    );
  }, [orders]);

  /* =======================================================
     FILTERED ORDERS
  ======================================================= */

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesBusiness =
        businessFilter === "all" ||
        order.business_id ===
          businessFilter;

      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

      return (
        matchesBusiness &&
        matchesStatus
      );
    });
  }, [
    orders,
    businessFilter,
    statusFilter,
  ]);

  /* =======================================================
     STATS
  ======================================================= */

  const pendingCount = orders.filter(
    (order) =>
      order.status === "pending"
  ).length;

  const activeCount = orders.filter(
    (order) =>
      [
        "accepted",
        "preparing",
        "ready",
        "served",
      ].includes(order.status)
  ).length;

  const completedCount = orders.filter(
    (order) =>
      [
        "completed",
        "served",
      ].includes(order.status)
  ).length;

  const completedRevenue = orders
    .filter(
      (order) =>
        order.status === "completed"
    )
    .reduce(
      (sum, order) =>
        sum + Number(order.total || 0),
      0
    );

  /* =======================================================
     REFRESH
  ======================================================= */

  async function handleRefresh() {
    setRefreshing(true);
    await loadOrders();
  }

  /* =======================================================
     UPDATE ORDER STATUS
  ======================================================= */

  async function updateStatus(
    orderId: string,
    status: string
  ) {
    setError("");

    const {
      error: updateError,
    } = await supabase.rpc(
      "update_tapx_order_status",
      {
        p_order_id: orderId,
        p_status: status,
      }
    );

    if (updateError) {
      console.error(
        "TAPX order status update error:",
        updateError
      );

      setError(
        updateError.message
      );

      return;
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
  }

  /* =======================================================
     SELECTED ORDER
  ======================================================= */

  const selected = orders.find(
    (order) =>
      order.id === selectedOrder
  );

  const selectedItems = items.filter(
    (item) =>
      item.order_id === selectedOrder
  );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        {/* HEADER */}
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>
              TAPX OPERATIONS
            </div>

            <h1 style={styles.title}>
              Sales & Orders
            </h1>

            <p style={styles.subtitle}>
              Manage live table orders
              across all TAPX businesses.
            </p>
          </div>

          <button
            type="button"
            style={{
              ...styles.refresh,
              opacity: refreshing
                ? 0.65
                : 1,
            }}
            onClick={() =>
              void handleRefresh()
            }
            disabled={refreshing}
          >
            {refreshing
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>
        </header>

        {/* STATS */}
        <section
          style={styles.statsGrid}
        >
          <Stat
            label="Pending"
            value={pendingCount}
          />

          <Stat
            label="Active"
            value={activeCount}
          />

          <Stat
            label="Completed"
            value={completedCount}
          />

          <Stat
            label="Completed revenue"
            value={formatCurrency(
              completedRevenue
            )}
          />
        </section>

        {/* FILTERS */}
        <section
          style={styles.toolbar}
        >
          <select
            value={businessFilter}
            onChange={(event) =>
              setBusinessFilter(
                event.target.value
              )
            }
            style={styles.select}
          >
            <option value="all">
              All businesses
            </option>

            {businesses.map(
              ([id, name]) => (
                <option
                  key={id}
                  value={id}
                >
                  {name}
                </option>
              )
            )}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            style={styles.select}
          >
            <option value="all">
              All statuses
            </option>

            {statuses.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatStatus(
                    status
                  )}
                </option>
              )
            )}
          </select>

          <div
            style={styles.resultCount}
          >
            {filteredOrders.length}{" "}
            {filteredOrders.length === 1
              ? "order"
              : "orders"}
          </div>
        </section>

        {/* ERROR */}
        {error && (
          <div style={styles.error}>
            <div
              style={
                styles.errorTitle
              }
            >
              Unable to complete request
            </div>

            <div>
              {error}
            </div>
          </div>
        )}

        {/* CONTENT */}
        {loading ? (
          <div style={styles.empty}>
            <div
              style={
                styles.loadingIcon
              }
            >
              ⟳
            </div>

            <h3
              style={styles.emptyTitle}
            >
              Loading orders
            </h3>

            <p
              style={styles.emptyText}
            >
              Fetching the latest TAPX
              orders...
            </p>
          </div>
        ) : filteredOrders.length ===
          0 ? (
          <div style={styles.empty}>
            <div
              style={styles.emptyIcon}
            >
              ▣
            </div>

            <h3
              style={styles.emptyTitle}
            >
              No orders found
            </h3>

            <p
              style={styles.emptyText}
            >
              Customer table orders will
              appear here when customers
              order through the TAPX
              experience.
            </p>
          </div>
        ) : (
          <section
            style={styles.orderList}
          >
            {filteredOrders.map(
              (order) => (
                <article
                  key={order.id}
                  style={styles.orderCard}
                >
                  {/* ORDER TOP */}
                  <div
                    style={
                      styles.orderTop
                    }
                  >
                    <div
                      style={
                        styles.orderIdentity
                      }
                    >
                      <div
                        style={
                          styles.orderId
                        }
                      >
                        ORDER #
                        {order.id
                          .slice(
                            0,
                            8
                          )
                          .toUpperCase()}
                      </div>

                      <h2
                        style={
                          styles.businessName
                        }
                      >
                        {order
                          .businesses
                          ?.name ||
                          "Unknown business"}
                      </h2>

                      <div
                        style={
                          styles.meta
                        }
                      >
                        <span>
                          Table{" "}
                          {
                            order.table_number
                          }
                        </span>

                        <span
                          style={
                            styles.dot
                          }
                        >
                          ·
                        </span>

                        <span>
                          {order.customer_name ||
                            "Guest"}
                        </span>

                        {order.customer_phone && (
                          <>
                            <span
                              style={
                                styles.dot
                              }
                            >
                              ·
                            </span>

                            <span>
                              {
                                order.customer_phone
                              }
                            </span>
                          </>
                        )}

                        <span
                          style={
                            styles.dot
                          }
                        >
                          ·
                        </span>

                        <span>
                          {formatDateTime(
                            order.created_at
                          )}
                        </span>
                      </div>
                    </div>

                    <div
                      style={
                        styles.totalBlock
                      }
                    >
                      <span
                        style={
                          styles.totalLabel
                        }
                      >
                        TOTAL
                      </span>

                      <div
                        style={
                          styles.total
                        }
                      >
                        {formatCurrency(
                          order.total
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ORDER BOTTOM */}
                  <div
                    style={
                      styles.orderBottom
                    }
                  >
                    <span
                      style={statusStyle(
                        order.status
                      )}
                    >
                      {formatStatus(
                        order.status
                      )}
                    </span>

                    <div
                      style={
                        styles.actions
                      }
                    >
                      <button
                        type="button"
                        style={
                          styles.secondary
                        }
                        onClick={() =>
                          setSelectedOrder(
                            order.id
                          )
                        }
                      >
                        View items
                      </button>

                      <select
                        value={
                          order.status
                        }
                        onChange={(
                          event
                        ) =>
                          void updateStatus(
                            order.id,
                            event.target
                              .value
                          )
                        }
                        style={
                          styles.statusSelect
                        }
                      >
                        {statuses.map(
                          (status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {formatStatus(
                                status
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                </article>
              )
            )}
          </section>
        )}

        {/* =================================================
            ORDER DETAILS MODAL
        ================================================= */}

        {selected && (
          <div
            style={styles.overlay}
            onClick={() =>
              setSelectedOrder(null)
            }
          >
            <div
              style={styles.modal}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* MODAL HEADER */}
              <div
                style={
                  styles.modalHead
                }
              >
                <div>
                  <div
                    style={
                      styles.eyebrow
                    }
                  >
                    ORDER #
                    {selected.id
                      .slice(
                        0,
                        8
                      )
                      .toUpperCase()}
                  </div>

                  <h2
                    style={
                      styles.modalTitle
                    }
                  >
                    {selected
                      .businesses
                      ?.name ||
                      "Business"}{" "}
                    · Table{" "}
                    {
                      selected.table_number
                    }
                  </h2>
                </div>

                <button
                  type="button"
                  style={styles.close}
                  onClick={() =>
                    setSelectedOrder(
                      null
                    )
                  }
                  aria-label="Close order"
                >
                  ×
                </button>
              </div>

              {/* CUSTOMER */}
              <div
                style={
                  styles.customerBox
                }
              >
                <div>
                  <span
                    style={
                      styles.customerLabel
                    }
                  >
                    CUSTOMER
                  </span>

                  <strong
                    style={
                      styles.customerName
                    }
                  >
                    {selected.customer_name ||
                      "Guest"}
                  </strong>
                </div>

                {selected.customer_phone && (
                  <div>
                    <span
                      style={
                        styles.customerLabel
                      }
                    >
                      PHONE
                    </span>

                    <span
                      style={
                        styles.customerValue
                      }
                    >
                      {
                        selected.customer_phone
                      }
                    </span>
                  </div>
                )}

                <div>
                  <span
                    style={
                      styles.customerLabel
                    }
                  >
                    TABLE
                  </span>

                  <span
                    style={
                      styles.customerValue
                    }
                  >
                    Table{" "}
                    {
                      selected.table_number
                    }
                  </span>
                </div>

                {selected.source_device_code && (
                  <div>
                    <span
                      style={
                        styles.customerLabel
                      }
                    >
                      TAPX DEVICE
                    </span>

                    <span
                      style={
                        styles.customerValue
                      }
                    >
                      {
                        selected.source_device_code
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* ORDER ITEMS HEADER */}
              <div
                style={
                  styles.itemsHeader
                }
              >
                <span>
                  ORDER ITEMS
                </span>

                <span>
                  {selectedItems.length}{" "}
                  {selectedItems.length ===
                  1
                    ? "item"
                    : "items"}
                </span>
              </div>

              {/* ORDER ITEMS */}
              <div
                style={
                  styles.itemList
                }
              >
                {selectedItems.length ===
                0 ? (
                  <div
                    style={
                      styles.noItems
                    }
                  >
                    No order items found.
                  </div>
                ) : (
                  selectedItems.map(
                    (item) => (
                      <div
                        key={item.id}
                        style={
                          styles.itemRow
                        }
                      >
                        <div
                          style={
                            styles.itemInfo
                          }
                        >
                          <strong
                            style={
                              styles.itemName
                            }
                          >
                            {
                              item.item_name
                            }
                          </strong>

                          <span
                            style={
                              styles.itemMeta
                            }
                          >
                            {formatCurrency(
                              item.unit_price
                            )}{" "}
                            ×{" "}
                            {
                              item.quantity
                            }
                          </span>
                        </div>

                        <strong
                          style={
                            styles.itemTotal
                          }
                        >
                          {formatCurrency(
                            item.line_total
                          )}
                        </strong>
                      </div>
                    )
                  )
                )}
              </div>

              {/* TOTAL */}
              <div
                style={
                  styles.modalTotal
                }
              >
                <div>
                  <span
                    style={
                      styles.modalTotalLabel
                    }
                  >
                    ORDER TOTAL
                  </span>

                  <span
                    style={
                      styles.modalTotalSub
                    }
                  >
                    {formatStatus(
                      selected.status
                    )}
                  </span>
                </div>

                <strong
                  style={
                    styles.modalTotalValue
                  }
                >
                  {formatCurrency(
                    selected.total
                  )}
                </strong>
              </div>

              {/* STATUS UPDATE */}
              <div
                style={
                  styles.modalStatusSection
                }
              >
                <span
                  style={
                    styles.modalStatusLabel
                  }
                >
                  UPDATE ORDER STATUS
                </span>

                <select
                  value={
                    selected.status
                  }
                  onChange={(event) =>
                    void updateStatus(
                      selected.id,
                      event.target
                        .value
                    )
                  }
                  style={
                    styles.modalStatusSelect
                  }
                >
                  {statuses.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {formatStatus(
                          status
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* CLOSE */}
              <button
                type="button"
                style={
                  styles.doneButton
                }
                onClick={() =>
                  setSelectedOrder(
                    null
                  )
                }
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RESPONSIVE STYLES */}
      <style jsx>{`
        @media (max-width: 800px) {
          main {
            padding: 20px !important;
          }

          header {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          header button {
            width: 100%;
          }

          section {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 560px) {
          main {
            padding: 14px !important;
          }

          section {
            grid-template-columns: 1fr !important;
          }

          .order-top {
            flex-direction: column !important;
          }

          .order-bottom {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .actions {
            width: 100%;
            flex-direction: column !important;
          }

          .actions button,
          .actions select {
            width: 100%;
          }

          .customer-box {
            grid-template-columns: 1fr !important;
          }

          .modal-status {
            flex-direction: column !important;
            align-items: stretch !important;
          }
        }
      `}</style>
    </main>
  );
}

/* =========================================================
   STAT COMPONENT
========================================================= */

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>
        {label}
      </span>

      <strong style={styles.statValue}>
        {value}
      </strong>
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
    background: "#f6f6f3",
    color: "#171717",
    padding: "32px",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  shell: {
    maxWidth: 1180,
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 24,
    marginBottom: 26,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.5,
    color: "#737373",
    textTransform: "uppercase",
  },

  title: {
    margin: "6px 0 0",
    fontSize: 32,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: "-0.8px",
  },

  subtitle: {
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.5,
    color: "#737373",
  },

  refresh: {
    border: "1px solid #deded9",
    borderRadius: 11,
    padding: "11px 15px",
    background: "#ffffff",
    color: "#171717",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    boxShadow:
      "0 1px 2px rgba(0,0,0,0.03)",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  stat: {
    background: "#ffffff",
    border: "1px solid #e7e7e3",
    borderRadius: 16,
    padding: 18,
    minHeight: 92,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow:
      "0 2px 8px rgba(0,0,0,0.025)",
  },

  statLabel: {
    color: "#777",
    fontSize: 11,
    fontWeight: 700,
  },

  statValue: {
    marginTop: 12,
    color: "#171717",
    fontSize: 25,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "-0.5px",
  },

  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },

  select: {
    border: "1px solid #dcdcd7",
    borderRadius: 10,
    padding: "11px 13px",
    background: "#ffffff",
    color: "#242424",
    fontSize: 12,
    fontWeight: 700,
    outline: "none",
    cursor: "pointer",
  },

  resultCount: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: 800,
    color: "#888",
  },

  orderList: {
    display: "flex",
    flexDirection: "column",
    gap: 11,
  },

  orderCard: {
    background: "#ffffff",
    border: "1px solid #e5e5e1",
    borderRadius: 17,
    padding: 18,
    boxShadow:
      "0 2px 10px rgba(0,0,0,0.025)",
  },

  orderTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
  },

  orderIdentity: {
    minWidth: 0,
  },

  orderId: {
    fontSize: 10,
    fontWeight: 900,
    color: "#8a8a86",
    letterSpacing: 1.1,
  },

  businessName: {
    margin: "6px 0 5px",
    fontSize: 17,
    lineHeight: 1.2,
    fontWeight: 900,
    letterSpacing: "-0.2px",
  },

  meta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#777",
  },

  dot: {
    color: "#b0b0aa",
  },

  totalBlock: {
    textAlign: "right",
    flexShrink: 0,
  },

  totalLabel: {
    display: "block",
    fontSize: 9,
    fontWeight: 900,
    color: "#999",
    letterSpacing: 1,
    marginBottom: 4,
  },

  total: {
    fontSize: 21,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "-0.3px",
  },

  orderBottom: {
    marginTop: 16,
    paddingTop: 13,
    borderTop: "1px solid #eeeeeb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  secondary: {
    border: "1px solid #deded9",
    borderRadius: 9,
    padding: "9px 11px",
    background: "#ffffff",
    color: "#242424",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  statusSelect: {
    border: "1px solid #deded9",
    borderRadius: 9,
    padding: "9px 10px",
    background: "#ffffff",
    color: "#242424",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  empty: {
    padding: "55px 30px",
    textAlign: "center",
    background: "#ffffff",
    border: "1px solid #e5e5e1",
    borderRadius: 17,
    color: "#777",
  },

  emptyIcon: {
    width: 48,
    height: 48,
    margin: "0 auto 15px",
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "#f2f2ef",
    color: "#888",
    fontSize: 20,
  },

  loadingIcon: {
    width: 48,
    height: 48,
    margin: "0 auto 15px",
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "#f2f2ef",
    color: "#888",
    fontSize: 20,
  },

  emptyTitle: {
    margin: 0,
    color: "#222",
    fontSize: 16,
    fontWeight: 900,
  },

  emptyText: {
    maxWidth: 430,
    margin: "7px auto 0",
    fontSize: 12,
    lineHeight: 1.55,
    color: "#888",
  },

  error: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "13px 14px",
    background: "#fff1f2",
    color: "#be123c",
    border: "1px solid #fecdd3",
    borderRadius: 11,
    marginBottom: 13,
    fontSize: 12,
  },

  errorTitle: {
    fontWeight: 900,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background:
      "rgba(15, 15, 15, 0.48)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 100,
  },

  modal: {
    width: "min(560px, 100%)",
    maxHeight: "88vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 21,
    padding: 22,
    boxShadow:
      "0 25px 80px rgba(0,0,0,0.22)",
  },

  modalHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 15,
    marginBottom: 18,
  },

  modalTitle: {
    margin: "6px 0 0",
    fontSize: 20,
    lineHeight: 1.25,
    fontWeight: 900,
    letterSpacing: "-0.3px",
  },

  close: {
    width: 35,
    height: 35,
    flexShrink: 0,
    border: "none",
    borderRadius: 10,
    background: "#f1f1ee",
    color: "#444",
    fontSize: 23,
    lineHeight: 1,
    cursor: "pointer",
  },

  customerBox: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 12,
    padding: 14,
    background: "#f8f8f6",
    border: "1px solid #eeeeea",
    borderRadius: 13,
    marginBottom: 19,
  },

  customerLabel: {
    display: "block",
    fontSize: 9,
    fontWeight: 900,
    color: "#999",
    letterSpacing: 1,
    marginBottom: 4,
  },

  customerName: {
    display: "block",
    fontSize: 13,
    color: "#222",
  },

  customerValue: {
    display: "block",
    fontSize: 13,
    color: "#333",
  },

  itemsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1,
    color: "#888",
  },

  itemList: {
    display: "flex",
    flexDirection: "column",
  },

  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    padding: "13px 0",
    borderBottom: "1px solid #eeeeeb",
  },

  itemInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },

  itemName: {
    fontSize: 13,
    fontWeight: 800,
    color: "#222",
  },

  itemMeta: {
    fontSize: 11,
    color: "#888",
  },

  itemTotal: {
    flexShrink: 0,
    fontSize: 13,
  },

  noItems: {
    padding: 18,
    textAlign: "center",
    color: "#888",
    fontSize: 12,
  },

  modalTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    marginTop: 18,
    paddingTop: 17,
    borderTop: "1px solid #deded9",
  },

  modalTotalLabel: {
    display: "block",
    fontSize: 10,
    fontWeight: 900,
    color: "#555",
    letterSpacing: 0.8,
  },

  modalTotalSub: {
    display: "block",
    marginTop: 4,
    fontSize: 10,
    color: "#888",
  },

  modalTotalValue: {
    fontSize: 21,
    fontWeight: 900,
  },

  modalStatusSection: {
    marginTop: 17,
    paddingTop: 17,
    borderTop: "1px solid #eeeeeb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
  },

  modalStatusLabel: {
    fontSize: 9,
    fontWeight: 900,
    color: "#888",
    letterSpacing: 0.8,
  },

  modalStatusSelect: {
    minWidth: 145,
    border: "1px solid #deded9",
    borderRadius: 10,
    padding: "10px 11px",
    background: "#ffffff",
    color: "#222",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  doneButton: {
    width: "100%",
    marginTop: 18,
    border: "none",
    borderRadius: 11,
    padding: "12px 14px",
    background: "#171717",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
};