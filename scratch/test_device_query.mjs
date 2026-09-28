const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function inspectDevicesColumns() {
  const url = `${supabaseUrl}/rest/v1/devices?select=*&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    }
  });

  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    console.log("Devices Table Columns:", Object.keys(data[0]));
    console.log("Sample Device Row:", data[0]);
  } else {
    console.log("No devices found or error:", data);
  }
}

inspectDevicesColumns();
