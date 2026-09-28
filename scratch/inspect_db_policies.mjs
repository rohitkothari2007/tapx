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
// Try to see if service role key is in env or test with anon key
const key = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(supabaseUrl, key);

async function inspectTables() {
  console.log("=== ALL CUSTOMERS ===");
  const { data: customers, error: cErr } = await supabase.from("customers").select("*");
  console.log("cErr:", cErr);
  console.log("Customers count:", customers?.length);
  console.log("Customers:", JSON.stringify(customers, null, 2));

  console.log("\n=== ALL LOYALTY MEMBERSHIPS ===");
  const { data: memberships, error: mErr } = await supabase.from("loyalty_memberships").select("*");
  console.log("mErr:", mErr);
  console.log("Memberships count:", memberships?.length);
  console.log("Memberships:", JSON.stringify(memberships, null, 2));

  process.exit(0);
}

inspectTables();
