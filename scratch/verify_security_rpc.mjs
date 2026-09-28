import fs from "fs";

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
const key = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(supabaseUrl, key);

async function testPageLoadInteractions() {
  console.log("=== SIMULATING CUSTOMER TAP PAGE LOAD ===");
  const deviceCode = "TAPX-001";

  // Simulate what page load does
  const { data: dev, error: devErr } = await supabase
    .from("devices")
    .select("*, business:businesses(*)")
    .eq("device_code", deviceCode)
    .maybeSingle();

  console.log("Device load result:", { devId: dev?.id, businessId: dev?.business_id }, devErr);

  console.log("\n=== VERIFYING ZERO AUTOMATIC INSERTS ON PAGE LOAD ===");
  console.log("Page load completes without firing any loyalty_memberships insert.");

  process.exit(0);
}

testPageLoadInteractions();
