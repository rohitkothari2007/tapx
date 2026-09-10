const url = "https://nzxmwerhrauqidinktgp.supabase.co/rest/v1/";
const key = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const tables = [
  "customer_requests",
  "tapx_offers",
  "products",
  "services",
  "customers",
  "loyalty_transactions"
];

async function checkRest() {
  console.log("=== CHECKING ADDITIONAL TABLES ===");
  for (const table of tables) {
    try {
      const res = await fetch(`${url}${table}?select=*&limit=1`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        console.log(`[${table}]: FAIL (${res.status}) -> ${JSON.stringify(data)}`);
      } else {
        console.log(`[${table}]: OK (${data.length} rows returned)`);
      }
    } catch (err) {
      console.log(`[${table}]: ERROR -> ${err.message}`);
    }
  }
}

checkRest();
