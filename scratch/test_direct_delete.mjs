import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function testDirectDelete() {
  const virinchiId = "13809a52-903e-4578-b727-5adab53fb4a3";

  console.log("=== TESTING DIRECT TABLE DELETIONS FOR VIRINCHI ===");

  // 1. Unassign devices
  const devRes = await supabase
    .from("devices")
    .update({ business_id: null, status: "unassigned", assigned_at: null })
    .eq("business_id", virinchiId);
  console.log("Devices update result:", devRes.error ? devRes.error : "Success");

  // 2. business_features
  const bfRes = await supabase
    .from("business_features")
    .delete()
    .eq("business_id", virinchiId);
  console.log("business_features delete result:", bfRes.error ? bfRes.error : "Success");

  // 3. business_module_configs
  const bmcRes = await supabase
    .from("business_module_configs")
    .delete()
    .eq("business_id", virinchiId);
  console.log("business_module_configs delete result:", bmcRes.error ? bmcRes.error : "Success");

  // 4. tapx_client_users
  const tcuRes = await supabase
    .from("tapx_client_users")
    .delete()
    .eq("business_id", virinchiId);
  console.log("tapx_client_users delete result:", tcuRes.error ? tcuRes.error : "Success");

  // 5. businesses
  const bizRes = await supabase
    .from("businesses")
    .delete()
    .eq("id", virinchiId);
  console.log("businesses delete result:", bizRes.error ? bizRes.error : "Success");
}

testDirectDelete();
