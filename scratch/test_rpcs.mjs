globalThis.WebSocket = class {};
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env.local", "utf8");
const envVars = {};
for (const line of envText.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim();
    envVars[k] = v;
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

async function testRPCs() {
  console.log("Testing update_tapx_order_status RPC...");

  // Test calling update_tapx_order_status with fake UUID to see if function exists
  const { data, error } = await supabase.rpc("update_tapx_order_status", {
    p_order_id: "00000000-0000-0000-0000-000000000000",
    p_status: "pending"
  });

  console.log("update_tapx_order_status result:", data, error);
}

testRPCs();
