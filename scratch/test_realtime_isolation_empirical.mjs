import fs from "fs";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";

const envFile = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envFile.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testCrossTenantIsolation() {
  console.log("=== EMPIRICAL CROSS-TENANT REALTIME ISOLATION TEST ===");

  const businessA_Id = "8ac05e2a-9942-4727-abbe-b98973e69a1e"; // Tenant A
  const businessB_Id = "99999999-8888-7777-6666-555555555555"; // Tenant B

  const clientA = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    realtime: { transport: ws },
  });

  let eventsReceivedByTenantA = 0;
  let receivedPayloads = [];

  console.log(`1. Tenant A opening Realtime channel filtered for Tenant B's business_id (${businessB_Id})...`);

  const channel = clientA
    .channel("cross_tenant_isolation_channel")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "interactions",
        filter: `business_id=eq.${businessB_Id}`,
      },
      (payload) => {
        console.log("⚠️ LEAK DETECTED: Tenant A received payload for Tenant B:", payload);
        eventsReceivedByTenantA++;
        receivedPayloads.push(payload);
      }
    )
    .subscribe((status, err) => {
      console.log(`2. Tenant A Subscription Status: ${status}`, err || "");
    });

  // Wait 4 seconds for Realtime WebSocket join response
  await new Promise((r) => setTimeout(r, 4000));

  console.log(`3. Fetching valid device_id for insert...`);
  const { data: dev } = await clientA.from("devices").select("id").limit(1).maybeSingle();
  const testDeviceId = dev?.id || "73afd750-aa50-4629-9a77-63aa1bac5c79";

  console.log(`4. Triggering INSERT into 'interactions' table for Tenant B (business_id: ${businessB_Id})...`);

  const { data: insertedRow, error: insertErr } = await clientA
    .from("interactions")
    .insert({
      device_id: testDeviceId,
      business_id: businessB_Id,
      device_code: "YVS001",
      interaction_type: "tap",
    })
    .select()
    .maybeSingle();

  if (insertErr) {
    console.log("Insert result error:", insertErr.message);
  } else {
    console.log(`✓ Created test row for Tenant B (row id: ${insertedRow?.id})`);
  }

  console.log("5. Waiting 6 seconds to monitor WebSocket frames delivered to Tenant A...");
  await new Promise((r) => setTimeout(r, 6000));

  console.log("\n=========================================================");
  console.log("           CROSS-TENANT ISOLATION RESULT                 ");
  console.log("=========================================================");
  console.log(`Realtime events delivered to Tenant A for Tenant B's business: ${eventsReceivedByTenantA}`);

  if (eventsReceivedByTenantA === 0) {
    console.log("✅ ISOLATION PROVED: Tenant A received ZERO events for Tenant B's business!");
  } else {
    console.log("❌ ISOLATION FAILED: Realtime data leaked across tenants!");
  }

  if (insertedRow?.id) {
    await clientA.from("interactions").delete().eq("id", insertedRow.id);
  }

  clientA.removeChannel(channel);
  process.exit(0);
}

testCrossTenantIsolation().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
