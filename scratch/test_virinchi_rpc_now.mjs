import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function checkVirinchiNow() {
  console.log("=== CHECKING VIRINCHI IN DATABASE ===");
  const { data: virinchi } = await supabase.from("businesses").select("*").eq("id", "13809a52-903e-4578-b727-5adab53fb4a3");
  console.log("VIRINCHI row:", virinchi);

  const { data: devRows } = await supabase.from("devices").select("*").eq("business_id", "13809a52-903e-4578-b727-5adab53fb4a3");
  console.log("VIRINCHI assigned devices:", devRows);

  console.log("Calling delete_tapx_business RPC directly for VIRINCHI...");
  const rpcRes = await supabase.rpc("delete_tapx_business", { p_business_id: "13809a52-903e-4578-b727-5adab53fb4a3" });
  console.log("RPC Result:", JSON.stringify(rpcRes, null, 2));
}

checkVirinchiNow();
