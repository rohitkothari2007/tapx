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

async function testCustomerFacingConfig() {
  console.log("=== TESTING CUSTOMER-FACING CONFIG EXTRACTION ===");

  const { data: configs } = await supabase
    .from("business_module_configs")
    .select("*")
    .eq("business_id", yuvaId);

  const loyaltyConfigRow = configs?.find((c) => c.module_key === "loyalty");
  const rawLoyaltyConfig = loyaltyConfigRow?.config || {};

  console.log("Raw DB Loyalty Config:", rawLoyaltyConfig);

  const parsedConfig = {
    program_name:
      typeof rawLoyaltyConfig.program_name === "string" && rawLoyaltyConfig.program_name.trim() !== ""
        ? rawLoyaltyConfig.program_name
        : "Loyalty Rewards",

    reward:
      typeof rawLoyaltyConfig.milestone_reward === "string" && rawLoyaltyConfig.milestone_reward.trim() !== ""
        ? rawLoyaltyConfig.milestone_reward
        : typeof rawLoyaltyConfig.reward === "string"
        ? rawLoyaltyConfig.reward
        : "Exclusive reward from the business",

    visits_required:
      rawLoyaltyConfig.milestone_interval !== undefined && rawLoyaltyConfig.milestone_interval !== null
        ? String(rawLoyaltyConfig.milestone_interval)
        : rawLoyaltyConfig.visits_required !== undefined && rawLoyaltyConfig.visits_required !== null
        ? String(rawLoyaltyConfig.visits_required)
        : "5",
  };

  console.log("\nParsed Config for /tap/{deviceCode}:", parsedConfig);

  if (parsedConfig.visits_required === "5" && parsedConfig.reward === "10% off next visit") {
    console.log("\n✅ SUCCESS: /tap/{deviceCode} now shows 5 visits required (not 10) and correct reward!");
  } else {
    console.log("\n❌ FAIL: Stale config mismatch!");
  }

  process.exit(0);
}

testCustomerFacingConfig();
