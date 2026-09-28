import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function testAll() {
  const { data: bData } = await supabase.from("businesses").select("id, name").ilike("name", "%virinchi%");
  console.log("Virinchi business:", bData);

  if (bData && bData.length > 0) {
    const vId = bData[0].id;
    console.log("Testing delete_tapx_business RPC with Virinchi ID:", vId);
    const res = await supabase.rpc("delete_tapx_business", { p_business_id: vId });
    console.log("Delete RPC response:", res);
  }
}

testAll();
