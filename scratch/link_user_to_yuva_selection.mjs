import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function linkUserToYuvaSelection() {
  console.log("Fetching YUVA SELECTION business ID...");
  const { data: bData } = await supabase.from("businesses").select("id, name, email").eq("name", "YUVA SELECTION").single();
  console.log("Business:", bData);

  if (!bData) return;

  // Let's check tapx_admin_users to find user_id for admin
  // Since RLS is enabled, we can use RPC or query with service role key if available or SQL editor query
  console.log("To complete linking in database, run SQL or create-owner API.");
}

linkUserToYuvaSelection();
