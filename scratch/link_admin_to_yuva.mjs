import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log("Usage: node scratch/link_admin_to_yuva.mjs <email> <password>");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function linkAdminToYuva() {
  console.log(`Authenticating as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    console.error("Auth failed:", authError?.message);
    return;
  }

  const userId = authData.user.id;
  console.log("Authenticated User ID:", userId);

  // Get YUVA SELECTION business
  const { data: bus, error: busErr } = await supabase.from("businesses").select("id, name").eq("name", "YUVA SELECTION").single();
  if (busErr || !bus) {
    console.error("Business query error:", busErr?.message);
    return;
  }

  console.log("Found Business YUVA SELECTION ID:", bus.id);

  // Create authenticated client using user's access token
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
    auth: { persistSession: false },
    realtime: { transport: ws },
  });

  console.log("Inserting row into tapx_client_users...");
  const { data: linkData, error: linkErr } = await authClient
    .from("tapx_client_users")
    .upsert({
      user_id: userId,
      business_id: bus.id,
      role: "owner",
    })
    .select();

  if (linkErr) {
    console.error("Failed to insert into tapx_client_users:", linkErr);
  } else {
    console.log("🎉 SUCCESS! Row linked in tapx_client_users:");
    console.log(JSON.stringify(linkData, null, 2));
  }
}

linkAdminToYuva();
