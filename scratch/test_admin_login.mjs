const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function testAdminQuery(email, password) {
  console.log(`\n========================================`);
  console.log(`  TAPX ADMIN LOGIN & RLS QUERY TEST  `);
  console.log(`========================================`);
  console.log(`Target Email: ${email}`);

  // 1. Authenticate via Supabase Auth REST API
  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  const authData = await authRes.json();

  if (!authRes.ok) {
    console.log(`\n❌ Auth Error (${authRes.status}): ${authData.error_description || authData.msg || authData.message || JSON.stringify(authData)}`);
    return;
  }

  console.log(`\n✅ Step 1: Auth Successful!`);
  console.log(`   User ID: ${authData.user.id}`);
  console.log(`   Email:   ${authData.user.email}`);

  const accessToken = authData.access_token;

  // 2. Query tapx_admin_users via Supabase REST API with the authenticated user's JWT
  const restRes = await fetch(
    `${supabaseUrl}/rest/v1/tapx_admin_users?select=id,user_id,created_at&user_id=eq.${authData.user.id}`,
    {
      method: "GET",
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    }
  );

  const restData = await restRes.json();

  if (!restRes.ok) {
    console.log(`\n❌ Step 2: Admin RLS Query Failed (${restRes.status}): ${JSON.stringify(restData)}`);
  } else if (!Array.isArray(restData) || restData.length === 0) {
    console.log(`\n⚠️ Step 2: Admin RLS Query returned [] (EMPTY ARRAY)`);
    console.log(`   Reason: Row not found or RLS policy blocking SELECT for user_id = ${authData.user.id}`);
  } else {
    console.log(`\n🎉 Step 2: Admin Check SUCCESS! Found tapx_admin_users row:`);
    console.log(JSON.stringify(restData[0], null, 2));
  }
}

const testEmail = process.argv[2];
const testPassword = process.argv[3];

if (testEmail && testPassword) {
  testAdminQuery(testEmail, testPassword);
} else {
  console.log("Usage: node scratch/test_admin_login.mjs <email> <password>");
}
