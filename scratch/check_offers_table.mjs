const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function checkOffersTable() {
  const res = await fetch(`${supabaseUrl}/rest/v1/offers?select=*`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });
  console.log("offers table status:", res.status);
  if (res.ok) {
    const data = await res.json();
    console.log("offers table data:", data);
  }
}

checkOffersTable();
