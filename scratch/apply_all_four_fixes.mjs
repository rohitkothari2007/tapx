import fs from "fs";

// 1. Update app/client/page.tsx
const clientPath = "c:/Users/khush/Desktop/tapx/app/client/page.tsx";
let clientCode = fs.readFileSync(clientPath, "utf-8");

// Fix Part 1: Change "Good afternoon," to "Greetings,"
clientCode = clientCode.replace(
  `<h1>\n            Good afternoon,{" "}\n            <span>{business.name}.</span>\n          </h1>`,
  `<h1>\n            Greetings,{" "}\n            <span>{business.name}.</span>\n          </h1>`
);
clientCode = clientCode.replace(
  `Good afternoon,{" "}`,
  `Greetings,{" "}`
);

// Fix Part 3: Module Gate appointment-overview-card
const oldApptWidget = `<section className="appointment-overview-card">
        <div className="appointment-overview-top">
          <div>
            <div className="eyebrow">TODAY'S SCHEDULE</div>
            <h2>{todayAppointments.length} appointments today</h2>
            <p>Stay ahead of every booking and keep your customer schedule organized.</p>
          </div>
          <button type="button" onClick={() => navigate("appointments")}>
            Open appointments →
          </button>
        </div>
        <div className="appointment-overview-stats">
          <div><strong>{todayAppointments.length}</strong><span>Today</span></div>
          <div><strong>{pendingAppointments.length}</strong><span>Pending</span></div>
          <div><strong>{appointments.length}</strong><span>Total bookings</span></div>
        </div>
      </section>`;

const newApptWidget = `{hasModule("appointment_booking", "appointment-booking", "appointments") && (
        <section className="appointment-overview-card">
          <div className="appointment-overview-top">
            <div>
              <div className="eyebrow">TODAY'S SCHEDULE</div>
              <h2>{todayAppointments.length} appointments today</h2>
              <p>Stay ahead of every booking and keep your customer schedule organized.</p>
            </div>
            <button type="button" onClick={() => navigate("appointments")}>
              Open appointments →
            </button>
          </div>
          <div className="appointment-overview-stats">
            <div><strong>{todayAppointments.length}</strong><span>Today</span></div>
            <div><strong>{pendingAppointments.length}</strong><span>Pending</span></div>
            <div><strong>{appointments.length}</strong><span>Total bookings</span></div>
          </div>
        </section>
      )}`;

clientCode = clientCode.replace(oldApptWidget, newApptWidget);

// Fix Part 4: Resilient Device Tap Counting in Client Portal
const oldInteractionsQuery = `const interactionsData = (await (supabase.from("interactions").select("device_code").eq("business_id", businessId))).data;
      const counts: Record<string, number> = {};
      (interactionsData || []).forEach((t: { device_code: string | null }) => {
        if (t.device_code) {
          counts[t.device_code] = (counts[t.device_code] || 0) + 1;
        }
      });
      setDeviceInteractions(counts);`;

const newInteractionsQuery = `const interactionsData = (await (supabase.from("interactions").select("device_code, device_id").eq("business_id", businessId))).data;
      const counts: Record<string, number> = {};
      (interactionsData || []).forEach((t: { device_code: string | null; device_id: string | null }) => {
        if (t.device_code) {
          counts[t.device_code] = (counts[t.device_code] || 0) + 1;
        } else if (t.device_id) {
          const matchedDev = ((devicesRes?.data || []) as ClientDevice[]).find((d) => d.id === t.device_id);
          if (matchedDev?.device_code) {
            counts[matchedDev.device_code] = (counts[matchedDev.device_code] || 0) + 1;
          }
        }
      });
      setDeviceInteractions(counts);`;

clientCode = clientCode.replace(oldInteractionsQuery, newInteractionsQuery);

fs.writeFileSync(clientPath, clientCode, "utf-8");
console.log("Updated app/client/page.tsx successfully!");

// 2. Update app/tap/[deviceCode]/page.tsx
const tapPath = "c:/Users/khush/Desktop/tapx/app/tap/[deviceCode]/page.tsx";
let tapCode = fs.readFileSync(tapPath, "utf-8");

const oldTapInsert = `void supabase
        .from("interactions")
        .insert({
          device_id:
            deviceData.id,
          business_id:
            deviceData.business_id,
          interaction_type:
            "nfc_tap",
        })`;

const newTapInsert = `void supabase
        .from("interactions")
        .insert({
          device_id:
            deviceData.id,
          device_code:
            deviceData.device_code,
          business_id:
            deviceData.business_id,
          interaction_type:
            "nfc_tap",
        })`;

tapCode = tapCode.replace(oldTapInsert, newTapInsert);
fs.writeFileSync(tapPath, tapCode, "utf-8");
console.log("Updated app/tap/[deviceCode]/page.tsx successfully!");
