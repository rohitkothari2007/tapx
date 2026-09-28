globalThis.WebSocket = class {};
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env.local", "utf8");
const envVars = {};
for (const line of envText.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim();
    envVars[k] = v;
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

async function inspectOrders() {
  console.log("Inspecting tapx_orders table...");

  // Fetch sample orders
  const { data: sampleOrders, error: sErr } = await supabase
    .from("tapx_orders")
    .select("*")
    .limit(20);

  if (sErr) {
    console.error("Error fetching sample orders:", sErr);
  } else {
    console.log("Sample order fields:", sampleOrders.length > 0 ? Object.keys(sampleOrders[0]) : "No orders found");
    console.log("Sample orders:", sampleOrders);
  }

  // Fetch distinct statuses
  const { data: distinctStatuses, error: stErr } = await supabase
    .from("tapx_orders")
    .select("status");

  if (stErr) {
    console.error("Error fetching statuses:", stErr);
  } else {
    const statuses = Array.from(new Set((distinctStatuses || []).map((o) => o.status)));
    console.log("Distinct statuses in tapx_orders:", statuses);
  }
}

inspectOrders();
