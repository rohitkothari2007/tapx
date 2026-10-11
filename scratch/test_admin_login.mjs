import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function testAdminLogin() {
  const adminEmail = "rohitjkothari12+dwarka@gmail.com";
  const password = "Password123!";

  console.log("Signing in as Admin:", adminEmail);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password
  });

  if (authErr) {
    console.error("Admin Login Error:", authErr);
    return;
  }

  console.log("Admin Login SUCCESS! User ID:", authData.user.id);
  console.log("Access Token present:", !!authData.session?.access_token);

  // Check tapx_admin_users table
  const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
    realtime: { transport: ws }
  });

  const { data: adminRow, error: adminCheckErr } = await adminClient
    .from("tapx_admin_users")
    .select("*")
    .eq("user_id", authData.user.id)
    .single();

  console.log("tapx_admin_users check result:", adminRow, adminCheckErr);
}

testAdminLogin().catch(console.error);
