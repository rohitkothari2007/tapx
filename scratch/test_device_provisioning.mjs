const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function testProvisionDevice() {
  console.log("=== TESTING DEVICE PROVISIONING FOR TAPX001 WITH status='available' ===");

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
  console.log("✅ Admin Authenticated:", authData.user.email);

  // Delete TAPX001 if exists
  await fetch(`${supabaseUrl}/rest/v1/devices?device_code=eq.TAPX001`, {
    method: "DELETE",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  // Insert TAPX001 with status 'available'
  const insertRes = await fetch(`${supabaseUrl}/rest/v1/devices`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      device_code: "TAPX001",
      label: "Main Counter Standee",
      business_id: null,
      device_type: "NFC + QR Standee/Card",
      location: "Main Entrance",
      status: "available",
    }),
  });

  const insertData = await insertRes.json();
  console.log("Insert HTTP Status:", insertRes.status);
  console.log("Insert Result:", JSON.stringify(insertData, null, 2));

  // Query inventory row
  const selectRes = await fetch(`${supabaseUrl}/rest/v1/devices?device_code=eq.TAPX001`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  const selectData = await selectRes.json();
  console.log("\nConfirmed Inventory Row:");
  console.log(JSON.stringify(selectData, null, 2));
}

testProvisionDevice();
