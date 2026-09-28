import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function inspectDbSchema() {
  console.log("=== INSPECTING DEVICES TABLE & CONSTRAINTS ===");
  
  // Query devices table schema or sample row
  const { data: devices, error: devErr } = await supabase
    .from("devices")
    .select("*")
    .limit(5);

  console.log("Devices sample rows:", devices);

  // Let's test what values are allowed in devices status by inspecting RPC / testing update or running sql query if possible
  // Since anon key might not query pg_catalog directly unless exposed, let's test deleting virinchi or RPC if service key or inspect RPC definitions
  
  // Let's test what status values exist across all devices
  const { data: statusCounts } = await supabase.from("devices").select("status");
  const uniqueStatuses = [...new Set((statusCounts || []).map(d => d.status))];
  console.log("Unique device statuses currently in DB:", uniqueStatuses);

  // Check all tables referencing business_id
  const tables = [
    "devices",
    "tapx_client_users",
    "tapx_orders",
    "tapx_order_items",
    "interactions",
    "hotel_requests",
    "hotel_services",
    "hotel_categories",
    "tapx_appointments",
    "customer_feedback",
    "loyalty_memberships",
    "loyalty_transactions",
    "offers",
    "business_features",
    "business_module_configs",
    "customer_requests",
    "hardware_requests"
  ];

  console.log("\n=== CHECKING ROWS REFERENCING VIRINCHI (13809a52-903e-4578-b727-5adab53fb4a3) ===");
  const virinchiId = "13809a52-903e-4578-b727-5adab53fb4a3";

  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select("*").eq("business_id", virinchiId);
      if (error) {
        console.log(`Table ${t}: Error checking business_id: ${error.message}`);
      } else {
        console.log(`Table ${t}: ${data.length} rows linked to VIRINCHI`);
      }
    } catch (e) {
      console.log(`Table ${t}: exception ${e.message}`);
    }
  }
}

inspectDbSchema();
