import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function checkBusinessData() {
  console.log("Resolving YVS001...");
  const { data, error } = await supabase.rpc("resolve_tap_device", { p_device_code: "YVS001" });
  if (error) {
    console.error("RPC Error:", error);
    return;
  }
  console.log("Business Data for YVS001:");
  console.log("  id:", data.business?.id);
  console.log("  name:", data.business?.name);
  console.log("  google_review_url:", data.business?.google_review_url);
  console.log("  address:", data.business?.address);
  console.log("  city:", data.business?.city);
  console.log("  state:", data.business?.state);
  console.log("  phone:", data.business?.phone);
  console.log("  instagram_url:", data.business?.instagram_url);
}

checkBusinessData();
