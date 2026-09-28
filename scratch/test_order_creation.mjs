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

async function testOrderCreate() {
  const businessId = "ec122dc0-b2f1-4d47-b3a8-c899dde5ccd1"; // HOTEL DWARKA

  console.log("Testing order creation via Supabase insert...");

  const { data, error } = await supabase
    .from("tapx_orders")
    .insert({
      business_id: businessId,
      table_number: 2,
      customer_name: "Test Customer",
      customer_phone: "9876543210",
      status: "pending",
      subtotal: 350,
      total: 350,
    })
    .select();

  console.log("Insert result:", data, error);
}

testOrderCreate();
