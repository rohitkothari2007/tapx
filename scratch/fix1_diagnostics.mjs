const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function runFix1Diagnostics() {
  console.log("=== ITEM 1A: CALLING public.resolve_tap_device('YVS001') ===");
  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_tap_device`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_device_code: "YVS001" }),
  });
  const rpcData = await rpcRes.json();
  console.log("HTTP Status Code:", rpcRes.status);
  console.log("RPC Response Body:");
  console.log(JSON.stringify(rpcData, null, 2));

  console.log("\n=== ITEM 1B: DEVICES ROW FOR YVS001 AND LINKED BUSINESSES ROW ===");
  const devRes = await fetch(`${supabaseUrl}/rest/v1/devices?device_code=eq.YVS001`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });
  const devRows = await devRes.json();
  console.log("devices row for YVS001:", JSON.stringify(devRows[0], null, 2));

  const businessId = devRows[0]?.business_id;
  console.log("\nLinked business_id:", businessId);

  if (businessId) {
    const bizRes = await fetch(`${supabaseUrl}/rest/v1/businesses?id=eq.${businessId}`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });
    const bizRows = await bizRes.json();
    console.log("businesses row linked to YVS001:", JSON.stringify(bizRows[0], null, 2));
  } else {
    console.log("businesses row: NULL (no business linked)");
  }

  console.log("\n=== ITEM 1D: RAW NETWORK REQUEST RESPONSE FOR /tap/YVS001 ===");
  const tapPageRes = await fetch("https://tapx-roan.vercel.app/tap/YVS001");
  console.log("HTTP Status Code:", tapPageRes.status);
  const tapPageHtml = await tapPageRes.text();
  console.log("Response Body (first 500 chars):");
  console.log(tapPageHtml.slice(0, 500));
}

runFix1Diagnostics();
