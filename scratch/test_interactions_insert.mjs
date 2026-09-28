import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function testInteractionInsert() {
  console.log("Calling resolve_tap_device for YVS001...");
  const { data: tapData, error: rpcError } = await supabase.rpc("resolve_tap_device", { p_device_code: "YVS001" });
  if (rpcError) {
    console.error("RPC Error:", rpcError);
    return;
  }
  console.log("RPC Data Device:", tapData?.device?.id, tapData?.device?.device_code, tapData?.device?.business_id);

  if (tapData?.device) {
    const dev = tapData.device;
    const res = await supabase.from("interactions").insert({
      device_id: dev.id,
      business_id: dev.business_id,
      interaction_type: "nfc_tap",
    });

    console.log("Insert Response Error:", JSON.stringify(res.error, null, 2));
    console.log("Insert Response Status:", res.status, res.statusText);
  }
}

testInteractionInsert();
