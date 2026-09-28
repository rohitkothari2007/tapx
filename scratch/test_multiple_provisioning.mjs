const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function testProvisioningMultipleCodes() {
  console.log("=== TESTING DEVICE PROVISIONING FOR MULTIPLE CODES ===");

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
  console.log("✅ Authenticated Admin:", authData.user.email);

  const testCodes = ["TAPX002", "TAPX003", "NFC_DEMO_99"];

  for (const code of testCodes) {
    // Delete if exists
    await fetch(`${supabaseUrl}/rest/v1/devices?device_code=eq.${code}`, {
      method: "DELETE",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    // Provision new device
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/devices`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        device_code: code,
        label: `Test Standee ${code}`,
        business_id: null,
        device_type: "NFC + QR Standee/Card",
        location: "Inventory",
        status: "available",
      }),
    });

    const insertData = await insertRes.json();
    console.log(`\nCode ${code} - Insert Status:`, insertRes.status);
    console.log(`Code ${code} - Result:`, JSON.stringify(insertData[0], null, 2));
  }
}

testProvisioningMultipleCodes();
