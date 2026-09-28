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

async function fullAudit() {
  console.log("==========================================");
  console.log("      TAPX COMPREHENSIVE SCHEMA AUDIT     ");
  console.log("==========================================\n");

  const tables = [
    "devices",
    "businesses",
    "interactions",
    "customer_requests",
    "tapx_admin_users",
    "tapx_client_users",
    "tapx_orders",
    "tapx_appointments",
    "customer_feedback",
    "loyalty_rewards",
    "offers",
    "products",
    "loyalty_programs"
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.log(`❌ TABLE [${table}]: ERROR - ${error.message} (code: ${error.code})`);
    } else {
      const sample = data?.[0];
      if (sample) {
        console.log(`✓ TABLE [${table}]: EXISTS (${Object.keys(sample).length} columns)`);
        console.log(`  Columns: ${Object.keys(sample).join(", ")}`);
      } else {
        console.log(`⚠️ TABLE [${table}]: EXISTS but HAS 0 ROWS currently.`);
      }
    }
  }
}

fullAudit();
