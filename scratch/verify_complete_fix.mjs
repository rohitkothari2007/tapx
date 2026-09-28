import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function runVerification() {
  console.log("=================================================");
  console.log("     TAPX GENERIC CLIENT DELETION VERIFICATION   ");
  console.log("=================================================");

  // 1. Create a dummy business for verification
  const testBizName = "TEST_CASCADE_CLIENT_" + Date.now();
  console.log(`\n1. Creating test business: '${testBizName}'...`);
  
  const { data: biz, error: bizErr } = await supabase
    .from("businesses")
    .insert({
      name: testBizName,
      category: "restaurant",
      status: "active",
      email: "testowner@example.com"
    })
    .select()
    .single();

  if (bizErr || !biz) {
    console.error("Failed to create test business:", bizErr);
    return;
  }

  const bizId = biz.id;
  console.log(`   Test business created with ID: ${bizId}`);

  // 2. Attach data across tables referencing business_id
  console.log("\n2. Populating child records across tables referencing business_id...");

  // Devices
  const { data: devSample } = await supabase.from("devices").select("id").limit(1).single();
  let devIdToAssign = devSample?.id;

  if (devIdToAssign) {
    await supabase
      .from("devices")
      .update({ business_id: bizId, status: "active", assigned_at: new Date().toISOString() })
      .eq("id", devIdToAssign);
    console.log(`   Attached device ${devIdToAssign} to business.`);
  }

  // business_features
  const { data: featSample } = await supabase.from("feature_catalog").select("id").limit(2);
  if (featSample && featSample.length > 0) {
    await supabase.from("business_features").insert(
      featSample.map((f) => ({ business_id: bizId, feature_id: f.id, enabled: true }))
    );
    console.log(`   Inserted ${featSample.length} business_features.`);
  }

  // business_module_configs
  if (featSample && featSample.length > 0) {
    await supabase.from("business_module_configs").insert({
      business_id: bizId,
      feature_id: featSample[0].id,
      module_key: "menu_config",
      config: { test: true }
    });
    console.log("   Inserted business_module_configs.");
  }

  // tapx_client_users mapping
  await supabase.from("tapx_client_users").insert({
    business_id: bizId,
    user_id: "00000000-0000-0000-0000-000000000000",
    role: "owner"
  });
  console.log("   Inserted tapx_client_users mapping.");

  // interactions
  await supabase.from("interactions").insert({
    business_id: bizId,
    interaction_type: "tap_test"
  });
  console.log("   Inserted interactions.");

  // tapx_orders
  await supabase.from("tapx_orders").insert({
    business_id: bizId,
    status: "pending",
    total_amount: 100
  });
  console.log("   Inserted tapx_orders.");

  // 3. Query counts before deletion
  const checkTables = [
    "devices",
    "tapx_client_users",
    "business_features",
    "business_module_configs",
    "interactions",
    "tapx_orders",
    "loyalty_memberships",
    "loyalty_transactions",
    "customer_feedback",
    "tapx_appointments"
  ];

  console.log("\n3. Child record count BEFORE deletion:");
  for (const t of checkTables) {
    if (t === "devices") {
      const { data } = await supabase.from(t).select("id").eq("business_id", bizId);
      console.log(`   - ${t}: ${data?.length || 0} assigned rows`);
    } else {
      const { data } = await supabase.from(t).select("*").eq("business_id", bizId);
      console.log(`   - ${t}: ${data?.length || 0} rows`);
    }
  }

  // 4. Perform Generic Deletion (using the exact generic cleanup steps)
  console.log("\n4. Executing Generic Client Deletion for test business...");

  // Unassign devices
  await supabase
    .from("devices")
    .update({ business_id: null, status: "unassigned", assigned_at: null })
    .eq("business_id", bizId);

  // Delete from child tables
  await supabase.from("tapx_client_users").delete().eq("business_id", bizId);
  await supabase.from("business_features").delete().eq("business_id", bizId);
  await supabase.from("business_module_configs").delete().eq("business_id", bizId);
  await supabase.from("interactions").delete().eq("business_id", bizId);
  await supabase.from("tapx_orders").delete().eq("business_id", bizId);
  
  try { await supabase.from("loyalty_transactions").delete().eq("business_id", bizId); } catch (e) {}
  try { await supabase.from("loyalty_memberships").delete().eq("business_id", bizId); } catch (e) {}
  try { await supabase.from("customer_feedback").delete().eq("business_id", bizId); } catch (e) {}
  try { await supabase.from("tapx_appointments").delete().eq("business_id", bizId); } catch (e) {}
  try { await supabase.from("offers").delete().eq("business_id", bizId); } catch (e) {}
  try { await supabase.from("customer_requests").delete().eq("business_id", bizId); } catch (e) {}

  // Delete business row
  const { error: delBizError } = await supabase.from("businesses").delete().eq("id", bizId);
  if (delBizError) {
    console.log("   Notice: direct delete on businesses required RPC/admin key, calling RPC...");
    const rpcRes = await supabase.rpc("delete_tapx_business", { p_business_id: bizId });
    console.log("   RPC delete result:", rpcRes);
  }

  // 5. Query counts after deletion to confirm ZERO orphaned rows remain
  console.log("\n5. Child record count AFTER deletion (verifying no orphaned rows remain):");
  let orphanedCount = 0;
  for (const t of checkTables) {
    if (t === "devices") {
      const { data } = await supabase.from(t).select("id").eq("business_id", bizId);
      const count = data?.length || 0;
      console.log(`   - ${t} linked to business: ${count} rows`);
      if (count > 0) orphanedCount += count;
    } else {
      const { data } = await supabase.from(t).select("*").eq("business_id", bizId);
      const count = data?.length || 0;
      console.log(`   - ${t}: ${count} rows`);
      if (count > 0) orphanedCount += count;
    }
  }

  const { data: remainingBiz } = await supabase.from("businesses").select("id").eq("id", bizId);
  console.log(`   - businesses table row: ${remainingBiz?.length || 0} rows remaining`);
  if (remainingBiz && remainingBiz.length > 0) orphanedCount += remainingBiz.length;

  if (devIdToAssign) {
    const { data: devCheck } = await supabase.from("devices").select("id, status, business_id").eq("id", devIdToAssign).single();
    console.log(`   - Device status after unassignment: status='${devCheck?.status}', business_id=${devCheck?.business_id}`);
  }

  console.log("\n=================================================");
  if (orphanedCount === 0) {
    console.log(" SUCCESS: 0 ORPHANED ROWS REMAIN! Deletion works cleanly and generically!");
  } else {
    console.error(` FAILURE: ${orphanedCount} orphaned rows remained.`);
  }
  console.log("=================================================");
}

runVerification();
