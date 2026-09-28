const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function cleanup() {
  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ email: "rohitjkothari12@gmail.com", password: "Yuva@5666" }),
  });
  const authData = await authRes.json();
  const token = authData.access_token;

  const delRes = await fetch(`${supabaseUrl}/rest/v1/devices?device_code=eq.TAPX999TEST`, {
    method: "DELETE",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  console.log("Cleanup status:", delRes.status);
}

cleanup();
