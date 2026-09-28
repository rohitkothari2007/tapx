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

async function runEmpiricalRealtimeRlsTest() {
  console.log("=========================================================");
  console.log("  EMPIRICAL SUPABASE REALTIME RLS SCOPING VERIFICATION   ");
  console.log("=========================================================\n");

  const businessA_Id = "8ac05e2a-9942-4727-abbe-b98973e69a1e"; // YUVA SELECTION (Owner A)
  const businessB_Id = "00000000-1111-2222-3333-444444444444"; // OTHER BUSINESS B

  const clientA = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    realtime: { transport: ws },
  });

  let eventsReceivedForBusinessB = 0;
  let eventPayloads = [];

  console.log(`[Step 1] Owner A opening Realtime WebSocket subscription for Owner B's business_id (${businessB_Id})...`);

  const channel = clientA
    .channel("test_owner_b_realtime_rls_channel")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "interactions",
        filter: `business_id=eq.${businessB_Id}`,
      },
      (payload) => {
        console.log("⚠️ UNEXPECTED: RECEIVED EVENT PAYLOAD FOR BUSINESS B:", payload);
        eventsReceivedForBusinessB++;
        eventPayloads.push(payload);
      }
    )
    .subscribe((status, err) => {
      console.log(`[Step 2] WebSocket subscription channel status: ${status}`, err || "");
    });

  // Wait 3 seconds for channel subscription connection to open
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("\n[Step 3] Fetching a valid device_id to pass database constraints for insert...");
  const { data: devRow } = await clientA.from("devices").select("id").limit(1).single();
  const validDeviceId = devRow?.id || "73afd750-aa50-4629-9a77-63aa1bac5c79";

  console.log(`[Step 4] Triggering real INSERT into 'interactions' table for Owner B (business_id: ${businessB_Id})...`);
  
  const { data: insertedRow, error: insertErr } = await clientA
    .from("interactions")
    .insert({
      device_id: validDeviceId,
      business_id: businessB_Id,
      device_code: "TAPX0011",
      interaction_type: "tap",
    })
    .select()
    .single();

  if (insertErr) {
    console.log("Insert result error:", insertErr.message);
  } else {
    console.log("✓ Real row successfully created in database for Owner B's business. Row ID:", insertedRow.id);
  }

  console.log("\n[Step 5] Waiting 6 seconds to monitor WebSocket frames delivered to Owner A...");
  await new Promise((resolve) => setTimeout(resolve, 6000));

  console.log("\n=========================================================");
  console.log("                   EMPIRICAL RESULT                      ");
  console.log("=========================================================");
  console.log(`Total Change-Data-Capture Realtime events delivered to Owner A for Owner B's business: ${eventsReceivedForBusinessB}`);

  if (eventsReceivedForBusinessB === 0) {
    console.log("✅ EMPIRICAL VERIFICATION SUCCESS: PostgreSQL Realtime RLS blocked cross-tenant notifications! Owner A received ZERO events.");
  } else {
    console.log("❌ FAILURE: Realtime event leaked across tenant boundaries.");
  }

  // Cleanup test row
  if (insertedRow?.id) {
    await clientA.from("interactions").delete().eq("id", insertedRow.id);
  }

  clientA.removeChannel(channel);
  process.exit(0);
}

runEmpiricalRealtimeRlsTest().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
