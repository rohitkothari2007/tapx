const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function diagnose() {
  console.log("=== 1. LISTING ALL DEVICES VIA REST API ===");
  const devRes = await fetch(`${supabaseUrl}/rest/v1/devices?select=*`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });
  const devices = await devRes.json();
  console.log("Devices status:", devRes.status);
  console.log("Devices data:", JSON.stringify(devices, null, 2));

  console.log("\n=== 2. LISTING ALL BUSINESSES VIA REST API ===");
  const bizRes = await fetch(`${supabaseUrl}/rest/v1/businesses?select=*`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });
  const businesses = await bizRes.json();
  console.log("Businesses status:", bizRes.status);
  console.log("Businesses data:", JSON.stringify(businesses, null, 2));

  console.log("\n=== 3. CALLING resolve_tap_device RPC VIA REST API ===");
  if (Array.isArray(devices) && devices.length > 0) {
    for (const d of devices) {
      console.log(`\nTesting device_code: "${d.device_code}"`);
      const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_tap_device`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_device_code: d.device_code }),
      });
      const rpcData = await rpcRes.json();
      console.log(`RPC Status:`, rpcRes.status);
      console.log(`RPC Result:`, JSON.stringify(rpcData, null, 2));
    }
  }

  // Also test with TAPX001
  console.log('\nTesting device_code: "TAPX001"');
  const rpcRes001 = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_tap_device`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_device_code: "TAPX001" }),
  });
  const rpcData001 = await rpcRes001.json();
  console.log(`RPC Status:`, rpcRes001.status);
  console.log(`RPC Result:`, JSON.stringify(rpcData001, null, 2));
}

diagnose();
