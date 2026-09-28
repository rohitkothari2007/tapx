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

async function inspectAllCustomers() {
  console.log("=== INSPECTING ALL CUSTOMERS IN PUBLIC.CUSTOMERS ===");
  const { data: customers, error } = await supabase.from("customers").select("*");
  console.log("All customers count:", customers?.length);
  console.log(JSON.stringify(customers, null, 2));

  console.log("\n=== INSPECTING ALL LOYALTY MEMBERSHIPS ===");
  const { data: memberships, error: memErr } = await supabase
    .from("loyalty_memberships")
    .select("*, customer:customers(*)");
  console.log(JSON.stringify(memberships, null, 2));
}

inspectAllCustomers();
