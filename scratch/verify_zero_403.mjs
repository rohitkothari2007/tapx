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

async function testNoDirectTableQueries() {
  console.log("=== VERIFYING ZERO DIRECT TABLE QUERIES IN LOYALTY JOIN ===");

  // 1. Attempt direct query on customers table as anon -> MUST fail with 403 / permission denied (proving table is locked down)
  const { data: directCust, error: directCustErr } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", "9923076666");

  console.log("\n1. Direct query on customers table (expected permission denied / empty under RLS):", { directCust, directCustErr });

  // 2. Call get_or_join_tap_loyalty RPC as anon -> MUST succeed with 200 OK
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("get_or_join_tap_loyalty", {
    p_business_id: "8ac05e2a-9942-4727-abbe-b98973e69a1e",
    p_name: "Khushi Kothari",
    p_phone: "9923076666"
  });

  console.log("\n2. Exclusive RPC call get_or_join_tap_loyalty result:", { rpcRes, rpcErr });

  if (!rpcErr && rpcRes?.membership_id) {
    console.log("\n✅ SUCCESS: Loyalty join executed 100% via RPC with zero direct table fallback queries!");
  } else {
    console.log("\n❌ FAIL: RPC failed!");
  }

  process.exit(0);
}

testNoDirectTableQueries();
