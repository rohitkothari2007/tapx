import fs from 'fs';

const filePath = 'c:/Users/khush/Desktop/tapx/app/client/page.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const targetIdx = content.indexOf("function DeviceCardItem({");

const clientDevicesSectionCode = `function ClientDevicesSection({
  devices,
  interactions,
  onRequestDevice,
  highlightTaps,
}: {
  devices: ClientDevice[];
  interactions: Record<string, number>;
  onRequestDevice: () => void;
  highlightTaps?: boolean;
}) {
  const activeCount = devices.filter((d) => d.status !== "inactive" && d.status !== "faulty").length;
  const totalTaps = Object.values(interactions).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* HEADER CARD */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "white",
          borderRadius: "20px",
          padding: "28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", color: "#60a5fa", marginBottom: "6px" }}>
            TAPX HARDWARE PORTAL
          </div>
          <h2 style={{ margin: 0, fontSize: "26px", fontWeight: 800 }}>My Assigned Devices ({devices.length})</h2>
          <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: "14px" }}>
            Physical NFC cards, standees, and QR points configured for your business.
          </p>
        </div>

        <button
          type="button"
          onClick={onRequestDevice}
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "12px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
          }}
        >
          + Request Additional Devices
        </button>
      </div>

      {/* STATS METRICS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div style={clientMetricCard}>
          <div style={clientMetricLabel}>Total Devices</div>
          <div style={clientMetricValue}>{devices.length}</div>
          <div style={clientMetricSub}>Configured NFC/QR endpoints</div>
        </div>

        <div style={clientMetricCard}>
          <div style={clientMetricLabel}>Active Devices</div>
          <div style={{ ...clientMetricValue, color: "#16a34a" }}>{activeCount}</div>
          <div style={clientMetricSub}>Live & accepting taps</div>
        </div>

        <div
          style={{
            ...clientMetricCard,
            transition: "all 0.5s ease",
            ...(highlightTaps
              ? {
                  borderColor: "#f59e0b",
                  background: "#fffbeb",
                  boxShadow: "0 0 18px rgba(245, 158, 11, 0.35)",
                  transform: "scale(1.02)",
                }
              : {}),
          }}
        >
          <div style={clientMetricLabel}>Total Customer Taps</div>
          <div style={{ ...clientMetricValue, color: highlightTaps ? "#d97706" : "#2563eb" }}>{totalTaps}</div>
          <div style={clientMetricSub}>
            {highlightTaps ? "⚡ Live tap update received!" : "Recorded NFC & QR interactions"}
          </div>
        </div>
      </div>

      {/* DEVICES LIST */}
      {devices.length === 0 ? (
        <div style={{ background: "white", borderRadius: "16px", padding: "40px 20px", textAlign: "center", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📡</div>
          <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>No Devices Assigned</h3>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "13px" }}>
            You do not have any physical TAPX devices assigned yet. Contact your admin or click below to request hardware.
          </p>
          <button
            type="button"
            onClick={onRequestDevice}
            style={{ background: "#0f172a", color: "white", border: "none", borderRadius: "10px", padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}
          >
            Request TAPX Hardware
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
          {devices.map((device) => (
            <DeviceCardItem key={device.id} device={device} tapCount={interactions[device.device_code] || 0} />
          ))}
        </div>
      )}
    </div>
  );
}

`;

if (targetIdx !== -1) {
  content = content.slice(0, targetIdx) + clientDevicesSectionCode + content.slice(targetIdx);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("Successfully inserted ClientDevicesSection before DeviceCardItem!");
} else {
  console.error("DeviceCardItem not found!");
}
