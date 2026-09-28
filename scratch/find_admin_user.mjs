const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function checkAdminUser() {
  const res = await fetch(`${supabaseUrl}/rest/v1/tapx_admin_users?select=*`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    }
  });
  const data = await res.json();
  console.log("Admin Users:", data);
}

checkAdminUser();
