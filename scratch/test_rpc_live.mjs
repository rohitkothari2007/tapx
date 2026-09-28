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

async function testRpcCall() {
  console.log("=== CALLING get_or_join_tap_loyalty RPC VIA SUPABASE ANON CLIENT ===");

  const payload = {
    p_business_id: "8ac05e2a-9942-4727-abbe-b98973e69a1e",
    p_name: "Khushi Kothari",
    p_phone: "9923076666"
  };

  console.log("Payload sent:", payload);

  const { data, error } = await supabase.rpc("get_or_join_tap_loyalty", payload);

  console.log("\n=== RPC RESPONSE ===");
  console.log("Error:", error);
  console.log("Data:", data);

  process.exit(0);
}

testRpcCall();
