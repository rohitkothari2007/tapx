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

async function testRPCOrderCreate() {
  const businessId = "ec122dc0-b2f1-4d47-b3a8-c899dde5ccd1"; // HOTEL DWARKA

  console.log("Testing order creation via create_tapx_table_order RPC...");

  const { data, error } = await supabase.rpc("create_tapx_table_order", {
    p_business_id: businessId,
    p_table_number: 3,
    p_customer_name: "Empirical Test Customer",
    p_customer_phone: "9876543210",
    p_source_device_code: "TAPX002",
    p_items: [
      { item_id: "5d7aa27d-bb58-4210-ac1c-bf34ad793b38", quantity: 2 }
    ]
  });

  console.log("create_tapx_table_order result order ID:", data, error);
}

testRPCOrderCreate();
