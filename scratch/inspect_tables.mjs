import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { enable: false }
});

async function checkTables() {
  const tables = [
    "devices",
    "businesses",
    "interactions",
    "hardware_requests",
    "hotel_requests",
    "hotel_services",
    "hotel_categories",
    "tapx_orders",
    "tapx_appointments",
    "customer_feedback",
    "loyalty_memberships",
    "tapx_client_users",
    "offers",
    "feature_catalog",
    "business_features",
    "business_module_configs"
  ];

  console.log("=== CHECKING TABLE EXISTENCE & ACCESS ===");
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.log(`Table '${table}': ERROR -> ${error.message} (code: ${error.code})`);
    } else {
      console.log(`Table '${table}': EXISTS (sample row count: ${data.length})`);
    }
  }
}

checkTables();
