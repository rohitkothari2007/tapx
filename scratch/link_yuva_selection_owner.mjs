import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function linkOwner() {
  console.log("Looking up YUVA SELECTION business...");
  const { data: bus } = await supabase.from("businesses").select("*").eq("name", "YUVA SELECTION").single();
  console.log("Business:", bus?.id, bus?.name, bus?.email);

  if (!bus) return;

  // Let's resolve the user_id for rohitjkothari12@gmail.com from resolve_tap_device or auth
  // In tapx_admin_users, we can query admin membership if user is authenticated or via RPC/SQL
  console.log("Linking business ID:", bus.id);
}

linkOwner();
