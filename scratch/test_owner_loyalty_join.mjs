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

async function testOwnerLoyaltyJoin() {
  console.log("=== LOGGING IN AS YUVA SELECTION OWNER ===");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "rohitjkothari12@gmail.com",
    password: "Yuva@5666"
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    process.exit(1);
  }

  console.log("Logged in user ID:", authData.user.id);

  const yuvaId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";

  console.log("\n=== QUERYING LOYALTY_MEMBERSHIPS WITH JOINED CUSTOMERS ===");
  const { data: memberData, error: memberErr } = await supabase
    .from("loyalty_memberships")
    .select("id, customer_id, visits, redemption_count, reward_claimed, updated_at, customer:customers(name, phone)")
    .eq("business_id", yuvaId);

  console.log("Query Error:", memberErr);
  console.log("Returned Rows Count:", memberData?.length);
  console.log("Returned Rows:", JSON.stringify(memberData, null, 2));

  process.exit(0);
}

testOwnerLoyaltyJoin();
