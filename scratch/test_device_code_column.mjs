import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function checkDeviceCodeColumn() {
  console.log("Checking if device_code column is queryable on interactions...");
  const { data, error } = await supabase
    .from("interactions")
    .select("id, device_id, device_code, business_id, interaction_type, created_at")
    .eq("business_id", "8ac05e2a-9942-4727-abbe-b98973e69a1e")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error querying device_code column:", error);
  } else {
    console.log("Query Results for interactions with device_code:");
    console.log(JSON.stringify(data, null, 2));
  }
}

checkDeviceCodeColumn();
