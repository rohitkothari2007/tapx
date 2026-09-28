const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function simulateClientTapPage(deviceCode) {
  console.log(`\n========================================`);
  console.log(`SIMULATING CLIENT RENDER FOR "${deviceCode}"`);
  console.log(`========================================`);

  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_tap_device`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_device_code: deviceCode }),
    });

    const tapData = await rpcRes.json();
    console.log("RPC Status:", rpcRes.status);

    if (!tapData || !tapData.device || !tapData.business) {
      console.log(`❌ ERROR: TAPX device "${deviceCode}" was not found or is inactive.`);
      return;
    }

    console.log(`✅ device found:`, tapData.device.device_code);
    console.log(`✅ business found:`, tapData.business.name);

    const deviceData = tapData.device;
    const businessData = tapData.business;

    const enabledFeatureIds = new Set(
      (tapData.enabled_features || [])
        .filter((item) => item.enabled && item.status !== "inactive")
        .map((item) => item.feature_id)
    );
    console.log(`✅ enabledFeatureIds count:`, enabledFeatureIds.size);

    const moduleConfigs = (tapData.module_configs || []).filter((item) =>
      enabledFeatureIds.has(item.feature_id)
    );
    console.log(`✅ moduleConfigs count:`, moduleConfigs.length);

    console.log("\n🎉 SIMULATION SUCCESSFUL FOR DEVICE:", deviceCode);
  } catch (err) {
    console.error("❌ CLIENT SIMULATION CRASHED:", err);
  }
}

async function runAll() {
  await simulateClientTapPage("YVS001");
  await simulateClientTapPage("RAD001");
  await simulateClientTapPage("TAPX0011");
}

runAll();
