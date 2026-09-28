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
const key = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(supabaseUrl, key);

async function runDeepAudit() {
  console.log("=== COMPREHENSIVE LIVE SCHEMA AUDIT ===");

  const tablesToAudit = [
    "devices",
    "businesses",
    "interactions",
    "tapx_orders",
    "tapx_appointments",
    "customer_feedback",
    "loyalty_rewards",
    "customer_requests",
    "tapx_admin_users",
    "tapx_client_users",
    "loyalty_programs",
    "offers",
    "products",
    "categories"
  ];

  for (const table of tablesToAudit) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.log(`❌ Table '${table}' fetch error: ${error.message} (${error.code})`);
    } else {
      const sample = data?.[0] || {};
      const cols = Object.keys(sample);
      console.log(`✓ Table '${table}' exists. Columns found (${cols.length}): ${cols.join(", ")}`);
    }
  }
}

runDeepAudit();
