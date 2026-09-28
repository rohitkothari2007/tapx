const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function testOwnerLogin(email, password) {
  console.log(`\n========================================`);
  console.log(`  TAPX OWNER LOGIN & RLS QUERY TEST   `);
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

  // 2. Query tapx_client_users via Supabase REST API with the authenticated user's JWT
  const restRes = await fetch(
    `${supabaseUrl}/rest/v1/tapx_client_users?select=business_id,role&user_id=eq.${authData.user.id}`,
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
    console.log(`\n❌ Step 2: Client Mapping RLS Query Failed (${restRes.status}): ${JSON.stringify(restData)}`);
  } else if (!Array.isArray(restData) || restData.length === 0) {
    console.log(`\n⚠️ Step 2: Client Mapping RLS Query returned [] (EMPTY ARRAY)`);
    console.log(`   Reason: Row not found or RLS policy blocking SELECT for user_id = ${authData.user.id}`);
  } else {
    console.log(`\n🎉 Step 2: Client Mapping SUCCESS! Found mapping row:`);
    console.log(JSON.stringify(restData[0], null, 2));

    const businessId = restData[0].business_id;

    // 3. Test querying the business row
    const bizRes = await fetch(
      `${supabaseUrl}/rest/v1/businesses?select=id,name,category,status&id=eq.${businessId}`,
      {
        method: "GET",
        headers: {
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    const bizData = await bizRes.json();

    if (!bizRes.ok) {
      console.log(`\n❌ Step 3: Business RLS Query Failed (${bizRes.status}): ${JSON.stringify(bizData)}`);
    } else if (!Array.isArray(bizData) || bizData.length === 0) {
      console.log(`\n⚠️ Step 3: Business RLS Query returned [] (EMPTY ARRAY)`);
    } else {
      console.log(`\n🎉 Step 3: Connected Business RLS Query SUCCESS!`);
      console.log(JSON.stringify(bizData[0], null, 2));
    }
  }
}

const testEmail = process.argv[2];
const testPassword = process.argv[3];

if (testEmail && testPassword) {
  testOwnerLogin(testEmail, testPassword);
} else {
  console.log("Usage: node scratch/test_owner_login.mjs <owner_email> <password>");
}
