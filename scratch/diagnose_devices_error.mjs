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

async function testAllTabs() {
  console.log("=== 1. TESTING ALL DEVICES QUERY ===");
  const { data: allDevs, error: errAll } = await supabase.from("devices").select("*", { count: "exact" }).order("created_at", { ascending: false });
  console.log("All devices error:", errAll);
  console.log("All devices count:", allDevs?.length);

  console.log("\n=== 2. TESTING ASSIGNED (ACTIVE) DEVICES QUERY ===");
  const { data: activeDevs, error: errActive } = await supabase
    .from("devices")
    .select("*", { count: "exact" })
    .not("business_id", "is", null)
    .neq("status", "inactive")
    .neq("status", "faulty")
    .order("created_at", { ascending: false });

  console.log("Active (Assigned) devices error:", errActive);
  console.log("Active (Assigned) devices count:", activeDevs?.length);

  console.log("\n=== 3. TESTING UNASSIGNED DEVICES QUERY ===");
  const { data: unassignedDevs, error: errUnassigned } = await supabase
    .from("devices")
    .select("*", { count: "exact" })
    .is("business_id", null)
    .neq("status", "inactive")
    .neq("status", "faulty")
    .order("created_at", { ascending: false });

  console.log("Unassigned devices error:", errUnassigned);
  console.log("Unassigned devices count:", unassignedDevs?.length);

  console.log("\n=== 4. TESTING RETIRED DEVICES QUERY ===");
  const { data: retiredDevs, error: errRetired } = await supabase
    .from("devices")
    .select("*", { count: "exact" })
    .or("status.eq.inactive,status.eq.faulty")
    .order("created_at", { ascending: false });

  console.log("Retired devices error:", errRetired);
  console.log("Retired devices count:", retiredDevs?.length);
}

testAllTabs();
