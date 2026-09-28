import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import path from "path";

globalThis.WebSocket = class {
  constructor() {}
  addEventListener() {}
  removeEventListener() {}
};

const envFile = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envFile.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, anonKey);

const artifactsDir = "C:/Users/khush/.gemini/antigravity/brain/b396a373-5bfc-4233-8cbe-9ba5c4b1f019";
const msedgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function runFullHardwareRequestLoopTest() {
  console.log("=== SUBMITTING REAL TEST HARDWARE REQUEST FROM CLIENT PORTAL ===");

  const { data: business } = await supabase.from("businesses").select("id, name, phone, email").limit(1).single();

  const testPayload = {
    business_id: business.id,
    customer_name: `${business.name} (Live Verification)`,
    customer_phone: business.phone || business.email || "9876543210",
    request_type: "hardware_request",
    status: "pending",
    payload: {
      quantity: 3,
      device_type: "NFC + QR Standee",
      notes: "Need 3 extra NFC + QR standees for outdoor seating area.",
      requested_at: new Date().toISOString(),
    },
  };

  const { data: submitted, error: insertErr } = await supabase
    .from("customer_requests")
    .insert(testPayload)
    .select()
    .single();

  if (insertErr) {
    console.error("❌ Insertion failed:", insertErr);
    process.exit(1);
  }

  console.log("✓ Successfully submitted hardware request to DB! Request ID:", submitted.id);
  console.log("Submitted Request Data:\n", JSON.stringify(submitted, null, 2));

  console.log("\n=== VERIFYING ADMIN DRAWER FETCH ===");
  const { data: adminFetch, error: adminErr } = await supabase
    .from("customer_requests")
    .select("*")
    .eq("request_type", "hardware_request")
    .order("created_at", { ascending: false });

  if (adminErr) {
    console.error("❌ Admin fetch error:", adminErr);
  } else {
    console.log(`✓ Admin side found ${adminFetch.length} hardware request(s) in drawer!`);
    console.log("Most recent request in admin drawer:\n", JSON.stringify(adminFetch[0], null, 2));
  }

  console.log("\n=== CAPTURING ADMIN DRAWER SCREENSHOT WITH REAL REQUEST ===");
  const outputPath = path.join(artifactsDir, "devices_hardware_requests_drawer_live.png");
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  const cmd = `"${msedgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --virtual-time-budget=5000 --window-size=1440,900 --screenshot="${outputPath}" "http://localhost:3000/devices?drawer=requests"`;
  
  try {
    execSync(cmd, { timeout: 25000 });
    console.log(`✓ Saved ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
  } catch (err) {
    console.error("Screenshot capture warning:", err.message);
  }

  process.exit(0);
}

runFullHardwareRequestLoopTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
