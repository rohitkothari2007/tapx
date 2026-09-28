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

async function checkPublicationAndRLS() {
  console.log("=== RUNNING FRESH REALTIME PUBLICATION & RLS TEST ===");
  
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    realtime: { transport: ws },
  });

  console.log("1. Creating Realtime channel for table 'interactions'...");
  const channel = supabase.channel("public_interactions_test_channel");

  let receivedEvent = null;

  channel
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "interactions" },
      (payload) => {
        console.log(">>> REALTIME EVENT RECEIVED OVER WEBSOCKET <<<");
        console.log(JSON.stringify(payload, null, 2));
        receivedEvent = payload;
      }
    )
    .subscribe((status, err) => {
      console.log(`2. Subscription channel status: ${status}`, err || "");
    });

  // Wait 4 seconds for WebSocket join response
  await new Promise((r) => setTimeout(r, 4000));

  console.log("3. Fetching existing device to populate required foreign key 'device_id'...");
  const { data: dev, error: devErr } = await supabase.from("devices").select("id, device_code, business_id").limit(1).maybeSingle();

  if (devErr) {
    console.error("Device fetch error:", devErr);
  }

  const testDeviceId = dev?.id || "73afd750-aa50-4629-9a77-63aa1bac5c79";
  const testBusinessId = dev?.business_id || "8ac05e2a-9942-4727-abbe-b98973e69a1e";
  const testDeviceCode = dev?.device_code || "YVS001";

  console.log(`4. Triggering INSERT into 'interactions' table (device_id: ${testDeviceId}, business_id: ${testBusinessId})...`);

  const { data: ins, error: insErr } = await supabase
    .from("interactions")
    .insert({
      device_id: testDeviceId,
      business_id: testBusinessId,
      device_code: testDeviceCode,
      interaction_type: "tap",
    })
    .select()
    .maybeSingle();

  console.log("5. Insert operation result:", ins ? `SUCCESS (row id: ${ins.id})` : `FAILED (${insErr?.message})`);

  console.log("6. Waiting 5 seconds to listen for Realtime push event payloads...");
  await new Promise((r) => setTimeout(r, 5000));

  console.log("\n=== SUMMARY OF REALTIME TEST RUN ===");
  console.log("Event Received:", receivedEvent ? "YES" : "NO");

  if (ins?.id) {
    // Cleanup inserted test row
    await supabase.from("interactions").delete().eq("id", ins.id);
  }

  supabase.removeChannel(channel);
  process.exit(0);
}

checkPublicationAndRLS().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
