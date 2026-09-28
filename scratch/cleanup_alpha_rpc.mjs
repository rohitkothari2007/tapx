import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function cleanupAlphaRpc() {
  const alphaId = "bc95f832-65b5-4ff4-ab68-05a480faafe6";
  await supabase.rpc("delete_tapx_business", { p_business_id: alphaId });
  const { data } = await supabase.from("businesses").select("id, name");
  console.log("Businesses remaining in database:", data);
}

cleanupAlphaRpc();
