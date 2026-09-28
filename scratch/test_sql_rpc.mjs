import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function testRpcs() {
  const rpcs = ["exec_sql", "execute_sql", "run_sql", "delete_tapx_business"];
  for (const rpc of rpcs) {
    const { data, error } = await supabase.rpc(rpc, { p_business_id: "00000000-0000-0000-0000-000000000000", query: "SELECT 1" });
    console.log(`RPC '${rpc}':`, error ? error.message : "Exists!");
  }
}

testRpcs();
