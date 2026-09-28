import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function findAdminUser() {
  console.log("Querying tapx_admin_users...");
  // Querying tapx_admin_users
  const { data, error } = await supabase.from("tapx_admin_users").select("*");
  console.log("Admin Users Data:", data, error);
}

findAdminUser();
