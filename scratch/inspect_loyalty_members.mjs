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

async function inspectLoyaltyData() {
  console.log("=== INSPECTING LOYALTY MEMBERSHIPS FOR YUVA SELECTION ===");

  const yuvaBusinessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";

  const { data: members, error: memErr } = await supabase
    .from("loyalty_memberships")
    .select(`
      id,
      business_id,
      customer_id,
      visits,
      reward_claimed,
      updated_at,
      created_at,
      customer:customers(*)
    `)
    .eq("business_id", yuvaBusinessId);

  if (memErr) {
    console.error("Fetch error:", memErr);
    return;
  }

  console.log(`Found ${members.length} loyalty membership(s):`);
  console.log(JSON.stringify(members, null, 2));
}

inspectLoyaltyData();
