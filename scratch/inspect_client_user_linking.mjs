import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function inspectLinking() {
  console.log("Checking YUVA SELECTION business...");
  const { data: bData } = await supabase.from("businesses").select("*").eq("name", "YUVA SELECTION").single();
  console.log("Business YUVA SELECTION:", bData?.id, bData?.name, bData?.email);

  if (bData) {
    const { data: linkData, error: linkErr } = await supabase.from("tapx_client_users").select("*").eq("business_id", bData.id);
    console.log("tapx_client_users rows for YUVA SELECTION:", linkData, linkErr);
  }

  console.log("Checking all tapx_client_users rows...");
  const { data: allLinks, error: allErr } = await supabase.from("tapx_client_users").select("*");
  console.log("All tapx_client_users:", allLinks, allErr);
}

inspectLinking();
