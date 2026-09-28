const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function checkPrivileges() {
  console.log("=== CHECKING ROUTINE PRIVILEGES FOR resolve_tap_device ===");

  // Call resolve_tap_device as anonymous user
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_tap_device`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_device_code: "YVS001" }),
  });

  console.log("Anon Role Call HTTP Status:", res.status);
  const data = await res.json();
  console.log("Anon Role Call Success:", res.status === 200);
}

checkPrivileges();
