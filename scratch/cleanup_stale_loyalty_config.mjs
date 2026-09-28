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

async function cleanupStaleConfig() {
  console.log("=== UPDATING STALE LOYALTY CONFIG FOR YUVA SELECTION ===");
  const { data, error } = await supabase
    .from("business_module_configs")
    .update({
      config: {
        milestone_interval: 5,
        milestone_reward: "10% off next visit"
      },
      updated_at: new Date().toISOString()
    })
    .eq("business_id", yuvaId)
    .eq("module_key", "loyalty")
    .select();

  console.log("Update result:", data, error);
  process.exit(0);
}

cleanupStaleConfig();
