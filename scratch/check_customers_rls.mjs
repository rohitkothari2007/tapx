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

async function checkLoyaltyQuery() {
  console.log("=== CHECKING LOYALTY_MEMBERSHIPS QUERY ===");

  const { data: members, error } = await supabase
    .from("loyalty_memberships")
    .select("id, business_id, customer_id, visits, reward_claimed, updated_at, customer:customers(name, phone)");

  console.log("Query error:", error);
  console.log("Members returned:", JSON.stringify(members, null, 2));

  process.exit(0);
}

checkLoyaltyQuery();
