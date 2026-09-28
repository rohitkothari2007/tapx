const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function testScheduledOffers() {
  console.log("=== TESTING SCHEDULED OFFERS END-TO-END ===");

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

  const businessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";

  const testOffers = [
    {
      id: "offer_active_1",
      name: "LIVE NOW - 20% OFF ALL ITEMS",
      description: "Available right now",
      start_date: null,
      end_date: null,
    },
    {
      id: "offer_future_2",
      name: "SCHEDULED - DIWALI 2099 SPECIAL",
      description: "Starts in the future",
      start_date: "2099-01-01",
      end_date: "2099-12-31",
    },
    {
      id: "offer_expired_3",
      name: "EXPIRED - NEW YEAR 2020 DEAL",
      description: "Expired long ago",
      start_date: "2020-01-01",
      end_date: "2020-01-05",
    },
  ];

  const existingRes = await fetch(
    `${supabaseUrl}/rest/v1/business_module_configs?business_id=eq.${businessId}&feature_id=eq.568117e0-e67b-43d3-a0d9-fbf9b6b4132d`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const existingRow = await existingRes.json();

  const newConfig = {
    ...(existingRow && existingRow[0] ? existingRow[0].config : {}),
    offers: testOffers,
  };

  if (existingRow && existingRow.length > 0) {
    await fetch(`${supabaseUrl}/rest/v1/business_module_configs?id=eq.${existingRow[0].id}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ config: newConfig }),
    });
  }

  console.log("✅ Updated offers in business_module_configs.");

  // Test Customer Tap Resolution
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
  const offersModule = rpcData.module_configs.find((m) => m.feature_id === "568117e0-e67b-43d3-a0d9-fbf9b6b4132d" || m.module_key === "offers");
  console.log("\nRaw DB Config Offers Count:", testOffers.length);
  console.log("DB Config Offers List:", JSON.stringify(offersModule?.config?.offers, null, 2));

  // Client-side filtering check (as performed by app/tap/[deviceCode]/page.tsx)
  const now = new Date();
  const todayYMD = now.toISOString().slice(0, 10);
  const activeCustomerOffers = offersModule.config.offers.filter((item) => {
    if (item.start_date && todayYMD < item.start_date) return false;
    if (item.end_date && todayYMD > item.end_date) return false;
    return true;
  });

  console.log("\n🎉 Customer-Facing /tap/YVS001 Filtered Active Offers Count:", activeCustomerOffers.length);
  console.log("Customer Visible Offers:", JSON.stringify(activeCustomerOffers, null, 2));
}

testScheduledOffers();
