"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { daysBetweenIST, formatMoney, formatQuantity, shiftISTDate } from "../../lib/billing";
import { getISTDateStr } from "../../lib/orderNumber";

type RangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "this_week"
  | "this_month"
  | "last_month"
  | "custom";

type GroupType = "day" | "week" | "month";

interface SalesReportTotals {
  bills: number;
  revenue: number;
  avg_bill: number;
  items_sold: number;
  discount_total: number;
  unpaid_count: number;
  unpaid_total: number;
  void_count: number;
  void_total: number;
}

interface PaymentCategory {
  count: number;
  total: number;
}

interface SalesReportPayments {
  cash: PaymentCategory;
  upi: PaymentCategory;
  card: PaymentCategory;
  paid_other: PaymentCategory;
  unpaid: PaymentCategory;
}

interface SalesReportSeriesItem {
  period: string; // YYYY-MM-DD
  bills: number;
  revenue: number;
}

interface SalesReportTopItem {
  name: string;
  quantity: number;
  revenue: number;
  bills: number;
}

interface SalesReportHourItem {
  hour: number; // 0-23
  bills: number;
  revenue: number;
}

interface SalesReportData {
  from: string;
  to: string;
  group: GroupType;
  totals: SalesReportTotals;
  payments: SalesReportPayments;
  series: SalesReportSeriesItem[];
  top_items: SalesReportTopItem[];
  hours: SalesReportHourItem[];
}

interface Props {
  businessId: string;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatPeriodLabel(periodStr: string, group: GroupType): string {
  const parts = periodStr.split("-");
  if (parts.length < 3) return periodStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const monthName = MONTH_NAMES[m] || "";

  if (group === "day") {
    return `${d} ${monthName}`;
  }
  if (group === "week") {
    return `Week of ${d} ${monthName}`;
  }
  if (group === "month") {
    return `${monthName} ${y}`;
  }
  return periodStr;
}

function formatHourSpan(hour: number): string {
  const formatH = (h: number) => {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h < 12 ? "AM" : "PM";
    return `${h12} ${ampm}`;
  };
  const startStr = formatH(hour);
  const endStr = formatH((hour + 1) % 24);
  return `${startStr} – ${endStr}`;
}

function defaultGroupForSpan(spanDays: number): GroupType {
  if (spanDays <= 31) return "day";
  if (spanDays <= 120) return "week";
  return "month";
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  // Prevent spreadsheet formula injection (=, +, -, @)
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

function sanitizeReportData(raw: any, fallbackGroup: GroupType): SalesReportData {
  const groupRaw = raw?.group;
  const group: GroupType =
    groupRaw === "week" || groupRaw === "month" || groupRaw === "day"
      ? groupRaw
      : fallbackGroup;

  return {
    from: String(raw?.from || ""),
    to: String(raw?.to || ""),
    group,
    totals: {
      bills: Number(raw?.totals?.bills) || 0,
      revenue: Number(raw?.totals?.revenue) || 0,
      avg_bill: Number(raw?.totals?.avg_bill) || 0,
      items_sold: Number(raw?.totals?.items_sold) || 0,
      discount_total: Number(raw?.totals?.discount_total) || 0,
      unpaid_count: Number(raw?.totals?.unpaid_count) || 0,
      unpaid_total: Number(raw?.totals?.unpaid_total) || 0,
      void_count: Number(raw?.totals?.void_count) || 0,
      void_total: Number(raw?.totals?.void_total) || 0,
    },
    payments: {
      cash: {
        count: Number(raw?.payments?.cash?.count) || 0,
        total: Number(raw?.payments?.cash?.total) || 0,
      },
      upi: {
        count: Number(raw?.payments?.upi?.count) || 0,
        total: Number(raw?.payments?.upi?.total) || 0,
      },
      card: {
        count: Number(raw?.payments?.card?.count) || 0,
        total: Number(raw?.payments?.card?.total) || 0,
      },
      paid_other: {
        count: Number(raw?.payments?.paid_other?.count) || 0,
        total: Number(raw?.payments?.paid_other?.total) || 0,
      },
      unpaid: {
        count: Number(raw?.payments?.unpaid?.count) || 0,
        total: Number(raw?.payments?.unpaid?.total) || 0,
      },
    },
    series: Array.isArray(raw?.series)
      ? raw.series.map((s: any) => ({
          period: String(s?.period || ""),
          bills: Number(s?.bills) || 0,
          revenue: Number(s?.revenue) || 0,
        }))
      : [],
    top_items: Array.isArray(raw?.top_items)
      ? raw.top_items.map((it: any) => ({
          name: String(it?.name || "Unnamed item"),
          quantity: Number(it?.quantity) || 0,
          revenue: Number(it?.revenue) || 0,
          bills: Number(it?.bills) || 0,
        }))
      : [],
    hours: Array.isArray(raw?.hours)
      ? raw.hours.map((h: any) => ({
          hour: Number(h?.hour) || 0,
          bills: Number(h?.bills) || 0,
          revenue: Number(h?.revenue) || 0,
        }))
      : [],
  };
}

export default function SalesReport({ businessId }: Props) {
  const todayIST = getISTDateStr();

  const [preset, setPreset] = useState<RangePreset>("today");
  const [customFrom, setCustomFrom] = useState(todayIST);
  const [customTo, setCustomTo] = useState(todayIST);
  const [group, setGroup] = useState<GroupType>("day");
  const [sortBy, setSortBy] = useState<"quantity" | "revenue">("quantity");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [reportData, setReportData] = useState<SalesReportData | null>(null);

  // Request counter to safely ignore stale async responses
  const activeReqRef = useRef(0);

  // Compute active date range from preset or custom inputs in IST
  const activeRange = useMemo(() => {
    if (preset === "today") {
      return { from: todayIST, to: todayIST, span: 1, error: "" };
    }
    if (preset === "yesterday") {
      const y = shiftISTDate(todayIST, -1);
      return { from: y, to: y, span: 1, error: "" };
    }
    if (preset === "last7") {
      const from = shiftISTDate(todayIST, -6);
      return { from, to: todayIST, span: 7, error: "" };
    }
    if (preset === "this_week") {
      const m = todayIST.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        const d = new Date(
          Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))
        );
        const dayOfWeek = d.getUTCDay(); // 0 is Sunday, 1 is Monday
        const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = shiftISTDate(todayIST, -daysSinceMonday);
        const span = daysBetweenIST(monday, todayIST) + 1;
        return { from: monday, to: todayIST, span, error: "" };
      }
      return { from: todayIST, to: todayIST, span: 1, error: "" };
    }
    if (preset === "this_month") {
      const [y, mm] = todayIST.split("-");
      const firstOfMonth = `${y}-${mm}-01`;
      const span = daysBetweenIST(firstOfMonth, todayIST) + 1;
      return { from: firstOfMonth, to: todayIST, span, error: "" };
    }
    if (preset === "last_month") {
      const [yStr, mStr] = todayIST.split("-");
      let y = parseInt(yStr, 10);
      let m = parseInt(mStr, 10);
      if (m === 1) {
        y -= 1;
        m = 12;
      } else {
        m -= 1;
      }
      const prevMStr = String(m).padStart(2, "0");
      const firstDay = `${y}-${prevMStr}-01`;
      const lastDayNum = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const lastDay = `${y}-${prevMStr}-${String(lastDayNum).padStart(2, "0")}`;
      const span = daysBetweenIST(firstDay, lastDay) + 1;
      return { from: firstDay, to: lastDay, span, error: "" };
    }

    // Custom
    if (!customFrom || !customTo) {
      return { from: todayIST, to: todayIST, span: 1, error: "Please choose both From and To dates." };
    }
    if (customFrom > customTo) {
      return { from: customFrom, to: customTo, span: 0, error: "From date must be on or before To date." };
    }
    const span = daysBetweenIST(customFrom, customTo) + 1;
    if (span > 366) {
      return { from: customFrom, to: customTo, span, error: "Please choose a range of 366 days or less." };
    }
    return { from: customFrom, to: customTo, span, error: "" };
  }, [preset, todayIST, customFrom, customTo]);

  // Handle preset selection with automatic group defaulting
  const handleSelectPreset = (newPreset: RangePreset) => {
    setPreset(newPreset);
    let span = 1;
    if (newPreset === "last7") span = 7;
    else if (newPreset === "this_week") span = 7;
    else if (newPreset === "this_month") span = 30;
    else if (newPreset === "last_month") span = 30;
    else if (newPreset === "custom") {
      span = daysBetweenIST(customFrom, customTo) + 1;
    }
    setGroup(defaultGroupForSpan(span));
  };

  // Fetch report data from tapx_sales_report
  const fetchReport = useCallback(async () => {
    if (!businessId) return;

    if (activeRange.error) {
      setErrorMsg(activeRange.error);
      setLoading(false);
      return;
    }

    const reqId = ++activeReqRef.current;
    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase.rpc("tapx_sales_report", {
        p_business_id: businessId,
        p_from: activeRange.from,
        p_to: activeRange.to,
        p_group: group,
      });

      if (reqId !== activeReqRef.current) return; // Stale request, ignore

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const code = String(error.code || "");
        if (
          code === "42883" ||
          code === "pgrst202" ||
          msg.includes("does not exist") ||
          msg.includes("could not find") ||
          msg.includes("not found")
        ) {
          setErrorMsg("The sales report is not switched on yet. Please contact support.");
        } else {
          setErrorMsg(error.message || "Could not load sales report. Please try again.");
        }
        setReportData(null);
        return;
      }

      const sanitized = sanitizeReportData(data, group);
      setReportData(sanitized);
    } catch (err: any) {
      if (reqId !== activeReqRef.current) return;
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("could not find")) {
        setErrorMsg("The sales report is not switched on yet. Please contact support.");
      } else {
        setErrorMsg(err?.message || "Could not load sales report. Please try again.");
      }
      setReportData(null);
    } finally {
      if (reqId === activeReqRef.current) {
        setLoading(false);
      }
    }
  }, [businessId, activeRange.from, activeRange.to, activeRange.error, group]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  // Client-side sorting for top items
  const sortedTopItems = useMemo(() => {
    if (!reportData?.top_items) return [];
    const list = [...reportData.top_items];
    if (sortBy === "revenue") {
      list.sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);
    } else {
      list.sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
    }
    return list;
  }, [reportData?.top_items, sortBy]);

  // Sorted hours
  const sortedHours = useMemo(() => {
    if (!reportData?.hours) return [];
    return [...reportData.hours].sort((a, b) => a.hour - b.hour);
  }, [reportData?.hours]);

  const maxHourBills = useMemo(() => {
    if (sortedHours.length === 0) return 1;
    return Math.max(...sortedHours.map((h) => h.bills), 1);
  }, [sortedHours]);

  // Max revenue in series for scaling vertical bars
  const maxSeriesRevenue = useMemo(() => {
    if (!reportData?.series || reportData.series.length === 0) return 0;
    return Math.max(...reportData.series.map((s) => s.revenue), 0);
  }, [reportData?.series]);

  // Step for showing X labels if > 14 bars
  const seriesLen = reportData?.series?.length || 0;
  const labelStep = seriesLen > 14 ? Math.ceil(seriesLen / 14) : 1;

  // Build CSV in browser and trigger download
  const handleDownloadCsv = () => {
    if (!reportData) return;

    const lines: string[] = [];

    // 1. Summary Section
    lines.push("=== SALES REPORT SUMMARY ===");
    lines.push(`From,${escapeCsvCell(reportData.from)}`);
    lines.push(`To,${escapeCsvCell(reportData.to)}`);
    lines.push(`Grouping,${escapeCsvCell(reportData.group)}`);
    lines.push(`Total Revenue,${escapeCsvCell(reportData.totals.revenue)}`);
    lines.push(`Total Bills,${escapeCsvCell(reportData.totals.bills)}`);
    lines.push(`Average Bill,${escapeCsvCell(reportData.totals.avg_bill)}`);
    lines.push(`Items Sold,${escapeCsvCell(reportData.totals.items_sold)}`);
    lines.push(`Discounts Given,${escapeCsvCell(reportData.totals.discount_total)}`);
    lines.push(`Unpaid Amount,${escapeCsvCell(reportData.totals.unpaid_total)}`);
    lines.push(`Unpaid Bills Count,${escapeCsvCell(reportData.totals.unpaid_count)}`);
    lines.push(`Voided Count,${escapeCsvCell(reportData.totals.void_count)}`);
    lines.push(`Voided Total,${escapeCsvCell(reportData.totals.void_total)}`);
    lines.push("");

    // 2. Payments Section
    lines.push("=== PAYMENTS ===");
    lines.push("Payment Method,Bill Count,Amount");
    lines.push(
      `Cash,${escapeCsvCell(reportData.payments.cash.count)},${escapeCsvCell(reportData.payments.cash.total)}`
    );
    lines.push(
      `UPI,${escapeCsvCell(reportData.payments.upi.count)},${escapeCsvCell(reportData.payments.upi.total)}`
    );
    lines.push(
      `Card,${escapeCsvCell(reportData.payments.card.count)},${escapeCsvCell(reportData.payments.card.total)}`
    );
    if (reportData.payments.paid_other.count > 0) {
      lines.push(
        `Paid (other),${escapeCsvCell(reportData.payments.paid_other.count)},${escapeCsvCell(
          reportData.payments.paid_other.total
        )}`
      );
    }
    if (reportData.payments.unpaid.count > 0) {
      lines.push(
        `Unpaid,${escapeCsvCell(reportData.payments.unpaid.count)},${escapeCsvCell(
          reportData.payments.unpaid.total
        )}`
      );
    }
    lines.push("");

    // 3. Sales by Period
    lines.push("=== SALES BY PERIOD ===");
    lines.push("Period,Period Label,Bills,Revenue");
    for (const s of reportData.series) {
      const lbl = formatPeriodLabel(s.period, reportData.group);
      lines.push(
        `${escapeCsvCell(s.period)},${escapeCsvCell(lbl)},${escapeCsvCell(s.bills)},${escapeCsvCell(
          s.revenue
        )}`
      );
    }
    lines.push("");

    // 4. Best Sellers
    lines.push("=== BEST SELLERS ===");
    lines.push("Rank,Item Name,Quantity Sold,Revenue,Bills");
    sortedTopItems.forEach((it, idx) => {
      lines.push(
        `${idx + 1},${escapeCsvCell(it.name)},${escapeCsvCell(it.quantity)},${escapeCsvCell(
          it.revenue
        )},${escapeCsvCell(it.bills)}`
      );
    });
    lines.push("");

    // 5. Busiest Hours
    lines.push("=== BUSIEST HOURS ===");
    lines.push("Hour,Time Window,Bills,Revenue");
    for (const h of sortedHours) {
      lines.push(
        `${escapeCsvCell(h.hour)},${escapeCsvCell(formatHourSpan(h.hour))},${escapeCsvCell(
          h.bills
        )},${escapeCsvCell(h.revenue)}`
      );
    }

    const csvContent = lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sales-report_${reportData.from}_to_${reportData.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Payment totals percentage baseline
  const paymentsTotalAmount = useMemo(() => {
    if (!reportData) return 1;
    const p = reportData.payments;
    const sum = p.cash.total + p.upi.total + p.card.total + p.paid_other.total + p.unpaid.total;
    return sum > 0 ? sum : reportData.totals.revenue || 1;
  }, [reportData]);

  return (
    <div className="sales-report-root" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <style>{`
        .sales-report-root {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
        }
        .sales-report-root * {
          box-sizing: border-box;
        }
        .sales-scroll-row {
          display: flex;
          flex-wrap: nowrap;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          gap: 8px;
          padding-bottom: 4px;
        }
        .sales-scroll-row::-webkit-scrollbar {
          display: none;
        }
        .sales-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          width: 100%;
        }
        @media (min-width: 768px) {
          .sales-summary-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
        }
        @media (max-width: 767px) {
          .sales-report-root input,
          .sales-report-root select,
          .sales-report-root button {
            font-size: 16px !important;
          }
          .sales-stat-num {
            font-size: 17px !important;
          }
          .sales-stat-label {
            font-size: 10.5px !important;
          }
          .sales-stat-sub {
            font-size: 11px !important;
            word-break: break-word !important;
          }
        }
      `}</style>

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.14em",
              color: "#64748b",
            }}
          >
            BILLING ANALYTICS &amp; INSIGHTS
          </div>
          <h2
            style={{
              margin: "2px 0 0",
              fontSize: "24px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Sales report
          </h2>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchReport()}
            style={btnSecondaryStyle}
            title="Refresh sales report"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
          <button
            type="button"
            disabled={loading || !reportData}
            onClick={handleDownloadCsv}
            style={btnSecondaryStyle}
            title="Download CSV report"
          >
            📥 Download CSV
          </button>
        </div>
      </div>

      {/* CONTROLS: SINGLE HORIZONTALLY SCROLLABLE ROW FOR RANGE AND GROUPING */}
      <div className="sales-scroll-row" style={{ alignItems: "center" }}>
        {/* Preset Range Buttons */}
        <button
          type="button"
          onClick={() => handleSelectPreset("today")}
          style={preset === "today" ? btnActiveScrollStyle : btnInactiveScrollStyle}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => handleSelectPreset("yesterday")}
          style={preset === "yesterday" ? btnActiveScrollStyle : btnInactiveScrollStyle}
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => handleSelectPreset("last7")}
          style={preset === "last7" ? btnActiveScrollStyle : btnInactiveScrollStyle}
        >
          Last 7 days
        </button>
        <button
          type="button"
          onClick={() => handleSelectPreset("this_week")}
          style={preset === "this_week" ? btnActiveScrollStyle : btnInactiveScrollStyle}
        >
          This week
        </button>
        <button
          type="button"
          onClick={() => handleSelectPreset("this_month")}
          style={preset === "this_month" ? btnActiveScrollStyle : btnInactiveScrollStyle}
        >
          This month
        </button>
        <button
          type="button"
          onClick={() => handleSelectPreset("last_month")}
          style={preset === "last_month" ? btnActiveScrollStyle : btnInactiveScrollStyle}
        >
          Last month
        </button>
        <button
          type="button"
          onClick={() => handleSelectPreset("custom")}
          style={preset === "custom" ? btnActiveScrollStyle : btnInactiveScrollStyle}
        >
          Custom
        </button>

        {/* Divider */}
        <div
          style={{
            width: "1px",
            height: "26px",
            background: "#cbd5e1",
            margin: "0 4px",
            flexShrink: 0,
          }}
        />

        {/* Grouping Buttons */}
        <button
          type="button"
          onClick={() => setGroup("day")}
          style={group === "day" ? btnActiveGroupStyle : btnInactiveGroupStyle}
          title="Group by Day"
        >
          Day
        </button>
        <button
          type="button"
          onClick={() => setGroup("week")}
          style={group === "week" ? btnActiveGroupStyle : btnInactiveGroupStyle}
          title="Group by Week"
        >
          Week
        </button>
        <button
          type="button"
          onClick={() => setGroup("month")}
          style={group === "month" ? btnActiveGroupStyle : btnInactiveGroupStyle}
          title="Group by Month"
        >
          Month
        </button>
      </div>

      {/* CUSTOM DATE INPUTS (SHOWN WHEN PRESET IS CUSTOM) */}
      {preset === "custom" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px",
            background: "#f8fafc",
            padding: "10px 14px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>From:</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              max={todayIST}
              style={dateFieldStyle}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>To:</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              max={todayIST}
              style={dateFieldStyle}
            />
          </div>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            (Max range 366 days)
          </span>
        </div>
      )}

      {/* ERROR BANNER */}
      {errorMsg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "13.5px",
            fontWeight: 700,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => void fetchReport()}
            style={{
              ...btnSecondaryStyle,
              padding: "8px 16px",
              fontSize: "13px",
              borderColor: "#fca5a5",
              color: "#b91c1c",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && !reportData && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "48px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📊</div>
          <strong style={{ fontSize: "16px", color: "#0f172a" }}>
            Loading sales report...
          </strong>
        </div>
      )}

      {/* REPORT CONTENT */}
      {reportData && (
        <>
          {/* SECTION 3: SUMMARY STATS CARDS */}
          <div className="sales-summary-grid">
            <div style={statCardStyle}>
              <div className="sales-stat-label" style={statLabelStyle}>
                REVENUE
              </div>
              <div className="sales-stat-num" style={{ ...statValueStyle, color: "#0f172a" }}>
                {formatMoney(reportData.totals.revenue)}
              </div>
              <div className="sales-stat-sub" style={statSubStyle}>
                {reportData.totals.bills} {reportData.totals.bills === 1 ? "bill" : "bills"}
              </div>
            </div>

            <div style={statCardStyle}>
              <div className="sales-stat-label" style={statLabelStyle}>
                AVERAGE BILL
              </div>
              <div className="sales-stat-num" style={statValueStyle}>
                {formatMoney(reportData.totals.avg_bill)}
              </div>
              <div className="sales-stat-sub" style={statSubStyle}>
                Per bill issued
              </div>
            </div>

            <div style={statCardStyle}>
              <div className="sales-stat-label" style={statLabelStyle}>
                ITEMS SOLD
              </div>
              <div className="sales-stat-num" style={statValueStyle}>
                {formatQuantity(reportData.totals.items_sold)}
              </div>
              <div className="sales-stat-sub" style={statSubStyle}>
                Total units across bills
              </div>
            </div>

            <div style={statCardStyle}>
              <div className="sales-stat-label" style={statLabelStyle}>
                DISCOUNTS GIVEN
              </div>
              <div className="sales-stat-num" style={{ ...statValueStyle, color: "#dc2626" }}>
                {formatMoney(reportData.totals.discount_total)}
              </div>
              <div className="sales-stat-sub" style={statSubStyle}>
                Total bill discounts
              </div>
            </div>

            <div style={statCardStyle}>
              <div className="sales-stat-label" style={statLabelStyle}>
                UNPAID
              </div>
              <div className="sales-stat-num" style={{ ...statValueStyle, color: "#ea580c" }}>
                {formatMoney(reportData.totals.unpaid_total)}
              </div>
              <div className="sales-stat-sub" style={statSubStyle}>
                {reportData.totals.unpaid_count}{" "}
                {reportData.totals.unpaid_count === 1 ? "unpaid bill" : "unpaid bills"}
              </div>
            </div>

            <div style={statCardStyle}>
              <div className="sales-stat-label" style={statLabelStyle}>
                VOIDED
              </div>
              <div className="sales-stat-num" style={statValueStyle}>
                {reportData.totals.void_count}
              </div>
              <div className="sales-stat-sub" style={statSubStyle}>
                {reportData.totals.void_total > 0
                  ? formatMoney(reportData.totals.void_total)
                  : "Cancelled bills"}
              </div>
            </div>
          </div>

          {/* SECTION 4: PAYMENTS BREAKDOWN */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: "16px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Payment collection
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Cash (always shown) */}
              <PaymentRow
                label="Cash"
                count={reportData.payments.cash.count}
                total={reportData.payments.cash.total}
                baseTotal={paymentsTotalAmount}
                color="#0284c7"
              />

              {/* UPI (always shown) */}
              <PaymentRow
                label="UPI"
                count={reportData.payments.upi.count}
                total={reportData.payments.upi.total}
                baseTotal={paymentsTotalAmount}
                color="#16a34a"
              />

              {/* Card (always shown) */}
              <PaymentRow
                label="Card"
                count={reportData.payments.card.count}
                total={reportData.payments.card.total}
                baseTotal={paymentsTotalAmount}
                color="#8b5cf6"
              />

              {/* Paid (method not recorded) - shown if count > 0 */}
              {reportData.payments.paid_other.count > 0 && (
                <PaymentRow
                  label="Paid (method not recorded)"
                  count={reportData.payments.paid_other.count}
                  total={reportData.payments.paid_other.total}
                  baseTotal={paymentsTotalAmount}
                  color="#f59e0b"
                />
              )}

              {/* Unpaid - shown if count > 0 */}
              {reportData.payments.unpaid.count > 0 && (
                <PaymentRow
                  label="Unpaid"
                  count={reportData.payments.unpaid.count}
                  total={reportData.payments.unpaid.total}
                  baseTotal={paymentsTotalAmount}
                  color="#ef4444"
                />
              )}
            </div>
          </div>

          {/* SECTION 5: SALES OVER TIME CHART */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Sales over time
                </h3>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  Vertical bars of revenue per {reportData.group} ({reportData.series.length}{" "}
                  {reportData.group === "day"
                    ? "days"
                    : reportData.group === "week"
                    ? "weeks"
                    : "months"}
                  )
                </div>
              </div>

              {maxSeriesRevenue > 0 && (
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                  Peak: <strong style={{ color: "#0f172a" }}>{formatMoney(maxSeriesRevenue)}</strong>
                </div>
              )}
            </div>

            {/* Scrollable chart container */}
            <div
              style={{
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                paddingBottom: "10px",
              }}
            >
              <div
                style={{
                  minWidth: `${Math.max(reportData.series.length * 40, 300)}px`,
                  height: "210px",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "6px",
                  paddingTop: "24px",
                  paddingBottom: "32px",
                  position: "relative",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                {/* Horizontal baseline guide */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "32px",
                    left: 0,
                    right: 0,
                    height: "1px",
                    background: "#cbd5e1",
                  }}
                />

                {maxSeriesRevenue === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "45%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      color: "#94a3b8",
                      fontSize: "14px",
                      fontWeight: 700,
                      pointerEvents: "none",
                    }}
                  >
                    No sales in this period
                  </div>
                )}

                {reportData.series.map((s, idx) => {
                  const rev = Number(s.revenue) || 0;
                  const barHeight =
                    maxSeriesRevenue > 0
                      ? Math.max(4, Math.round((rev / maxSeriesRevenue) * 140))
                      : 4;
                  const label = formatPeriodLabel(s.period, reportData.group);
                  const showLabel = idx % labelStep === 0 || idx === seriesLen - 1;
                  const tooltip = `${label}: ${formatMoney(rev)} (${s.bills} ${
                    s.bills === 1 ? "bill" : "bills"
                  })`;

                  return (
                    <div
                      key={s.period}
                      title={tooltip}
                      style={{
                        flex: 1,
                        minWidth: "24px",
                        maxWidth: "60px",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        position: "relative",
                        cursor: "pointer",
                      }}
                    >
                      {/* Bar */}
                      <div
                        style={{
                          width: "100%",
                          maxWidth: "24px",
                          height: `${barHeight}px`,
                          background: rev > 0 ? "#2563eb" : "#e2e8f0",
                          borderRadius: "4px 4px 0 0",
                          transition: "height 0.2s ease",
                        }}
                      />
                      {/* X Label */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          fontSize: "10px",
                          color: showLabel ? "#64748b" : "transparent",
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                          textAlign: "center",
                          pointerEvents: "none",
                        }}
                      >
                        {showLabel ? label : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 6: BEST SELLERS */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Best-selling items
              </h3>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                  Sort by:
                </span>
                <button
                  type="button"
                  onClick={() => setSortBy("quantity")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: sortBy === "quantity" ? "1px solid #0f172a" : "1px solid #cbd5e1",
                    background: sortBy === "quantity" ? "#0f172a" : "#ffffff",
                    color: sortBy === "quantity" ? "#ffffff" : "#475569",
                    cursor: "pointer",
                    minHeight: "44px",
                  }}
                >
                  Quantity
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("revenue")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: sortBy === "revenue" ? "1px solid #0f172a" : "1px solid #cbd5e1",
                    background: sortBy === "revenue" ? "#0f172a" : "#ffffff",
                    color: sortBy === "revenue" ? "#ffffff" : "#475569",
                    cursor: "pointer",
                    minHeight: "44px",
                  }}
                >
                  Revenue
                </button>
              </div>
            </div>

            {sortedTopItems.length === 0 ? (
              <div
                style={{
                  padding: "24px 0",
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: "13.5px",
                }}
              >
                No items sold in this period.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {sortedTopItems.map((it, idx) => (
                  <div
                    key={it.name + idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: idx % 2 === 0 ? "#f8fafc" : "#ffffff",
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    {/* Rank */}
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: idx < 3 ? "#e0e7ff" : "#f1f5f9",
                        color: idx < 3 ? "#3730a3" : "#64748b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </div>

                    {/* Name (wraps up to 2 lines) */}
                    <div
                      style={{
                        flex: "1 1 auto",
                        minWidth: 0,
                        fontSize: "13.5px",
                        fontWeight: 700,
                        color: "#0f172a",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        wordBreak: "break-word",
                      }}
                    >
                      {it.name}
                    </div>

                    {/* Quantity */}
                    <div
                      style={{
                        flexShrink: 0,
                        textAlign: "right",
                        fontSize: "12.5px",
                        color: "#475569",
                        fontWeight: 600,
                        minWidth: "50px",
                      }}
                    >
                      {formatQuantity(it.quantity)} sold
                    </div>

                    {/* Revenue */}
                    <div
                      style={{
                        flexShrink: 0,
                        textAlign: "right",
                        fontSize: "13.5px",
                        fontWeight: 800,
                        color: "#0f172a",
                        minWidth: "70px",
                      }}
                    >
                      {formatMoney(it.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 7: BUSIEST HOURS (HIDDEN IF EMPTY) */}
          {sortedHours.length > 0 && (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: "16px",
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Busiest hours
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {sortedHours.map((h) => {
                  const hourLabel = formatHourSpan(h.hour);
                  const pct = Math.max(4, Math.round((h.bills / maxHourBills) * 100));
                  return (
                    <div
                      key={h.hour}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "#f8fafc",
                        border: "1px solid #f1f5f9",
                      }}
                    >
                      <div
                        style={{
                          width: "95px",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "#334155",
                          flexShrink: 0,
                        }}
                      >
                        {hourLabel}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          minWidth: "50px",
                          height: "8px",
                          background: "#e2e8f0",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: "#3b82f6",
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "#0f172a",
                          flexShrink: 0,
                          textAlign: "right",
                          minWidth: "55px",
                        }}
                      >
                        {h.bills} {h.bills === 1 ? "bill" : "bills"}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          flexShrink: 0,
                          textAlign: "right",
                          minWidth: "65px",
                        }}
                      >
                        {formatMoney(h.revenue)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Payment Row Component with percentage calculation and progress bar
function PaymentRow({
  label,
  count,
  total,
  baseTotal,
  color,
}: {
  label: string;
  count: number;
  total: number;
  baseTotal: number;
  color: string;
}) {
  const pct = baseTotal > 0 ? Math.min(100, Math.round((total / baseTotal) * 100)) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: color,
              display: "inline-block",
            }}
          />
          <strong style={{ fontSize: "14px", color: "#0f172a" }}>{label}</strong>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            ({count} {count === 1 ? "bill" : "bills"})
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>
            {pct}%
          </span>
          <strong style={{ fontSize: "14px", color: "#0f172a" }}>
            {formatMoney(total)}
          </strong>
        </div>
      </div>

      <div
        style={{
          height: "6px",
          background: "#f1f5f9",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: "3px",
            transition: "width 0.2s ease",
          }}
        />
      </div>
    </div>
  );
}

// Style objects
const btnSecondaryStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#1e293b",
  borderRadius: "10px",
  padding: "9px 14px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "44px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const btnActiveScrollStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "#ffffff",
  border: "1px solid #0f172a",
  borderRadius: "10px",
  padding: "9px 16px",
  fontSize: "13.5px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  minHeight: "44px",
};

const btnInactiveScrollStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#334155",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "9px 16px",
  fontSize: "13.5px",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  minHeight: "44px",
};

const btnActiveGroupStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#ffffff",
  border: "1px solid #2563eb",
  borderRadius: "10px",
  padding: "9px 14px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  minHeight: "44px",
};

const btnInactiveGroupStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#334155",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "9px 14px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  minHeight: "44px",
};

const statCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "10.5px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: "#64748b",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "19px",
  fontWeight: 800,
  color: "#0f172a",
};

const statSubStyle: React.CSSProperties = {
  fontSize: "11.5px",
  color: "#64748b",
};

const dateFieldStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  fontSize: "16px",
  color: "#0f172a",
  outline: "none",
  minHeight: "44px",
};
