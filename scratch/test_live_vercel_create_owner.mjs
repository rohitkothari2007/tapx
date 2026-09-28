import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const email = process.argv[2];
const password = process.argv[3];
const newOwnerEmail = process.argv[4] || "test.new.owner.99@gmail.com";

if (!email || !password) {
  console.log("Usage: node scratch/test_live_vercel_create_owner.mjs <admin_email> <admin_password> [new_owner_email]");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function testLiveRoute() {
  console.log(`Authenticating as admin ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    console.error("Admin Auth Error:", authError?.message);
    return;
  }

  const token = authData.session.access_token;
  console.log("Admin authenticated successfully. User ID:", authData.user.id);

  // Get a business ID (e.g. YUVA SELECTION)
  const { data: bus } = await supabase.from("businesses").select("id, name").eq("name", "YUVA SELECTION").single();
  console.log("Target business:", bus?.name, bus?.id);

  if (!bus) return;

  console.log(`Calling LIVE Vercel API /api/admin/create-owner for email ${newOwnerEmail}...`);
  const res = await fetch("https://tapx-roan.vercel.app/api/admin/create-owner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      businessId: bus.id,
      ownerEmail: newOwnerEmail,
    }),
  });

  const status = res.status;
  const data = await res.json();

  console.log(`\n========================================`);
  console.log(`LIVE VERCEL RESPONSE STATUS: ${status} ${res.statusText}`);
  console.log(`RESPONSE BODY:`, JSON.stringify(data, null, 2));
  console.log(`========================================`);
}

testLiveRoute();
