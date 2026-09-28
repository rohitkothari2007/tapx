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

const yuvaId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";

async function inspectYuvaConfig() {
  console.log("=== INSPECTING ALL BUSINESS_MODULE_CONFIGS FOR YUVA SELECTION ===");
  const { data: configs, error } = await supabase
    .from("business_module_configs")
    .select("*")
    .eq("business_id", yuvaId);

  console.log("Configs error:", error);
  console.log("Configs:", JSON.stringify(configs, null, 2));

  console.log("\n=== CHECKING ALL BUSINESSES FOR STALE LOYALTY CONFIGS ===");
  const { data: allLoyaltyConfigs } = await supabase
    .from("business_module_configs")
    .select("*, business:businesses(name)")
    .or("module_key.eq.loyalty,module_key.eq.customer_loyalty");

  console.log("All loyalty configs count:", allLoyaltyConfigs?.length);
  console.log("All loyalty configs:", JSON.stringify(allLoyaltyConfigs, null, 2));

  process.exit(0);
}

inspectYuvaConfig();
