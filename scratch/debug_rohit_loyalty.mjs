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

async function testRohitLoyalty() {
  console.log("=== TESTING ROHIT KOTHARI LOYALTY JOIN WITH ANON CLIENT ===");

  const yuvaId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";
  const rawPhone = "+917387879977";
  const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);

  console.log("Calling get_or_join_tap_loyalty with:", {
    p_business_id: yuvaId,
    p_name: "Rohit Kothari",
    p_phone: cleanPhone
  });

  const { data, error } = await supabase.rpc("get_or_join_tap_loyalty", {
    p_business_id: yuvaId,
    p_name: "Rohit Kothari",
    p_phone: cleanPhone
  });

  console.log("RPC Data:", data);
  console.log("RPC Error:", JSON.stringify(error, null, 2));

  process.exit(0);
}

testRohitLoyalty();
