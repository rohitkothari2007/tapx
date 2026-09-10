const url = "https://nzxmwerhrauqidinktgp.supabase.co/rest/v1";
const anonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const tables = [
  "businesses",
  "devices",
  "tapx_orders",
  "tapx_appointments",
  "interactions",
  "customer_requests",
  "customer_feedback",
  "loyalty_memberships",
  "tapx_client_users",
  "business_features",
  "business_module_configs",
  "feature_catalog",
  "offers",
];

async function audit() {
  console.log("=== ANONYMOUS RLS EXPOSURE AUDIT (REST API DIRECT) ===\n");

  for (const table of tables) {
    console.log(`--- Table: ${table} ---`);

    // 1. SELECT test
    try {
      const res = await fetch(`${url}/${table}?select=*&limit=5`, {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`  [SELECT]: EXPOSED! (Status ${res.status}, read ${Array.isArray(data) ? data.length : 0} rows)`);
      } else {
        console.log(`  [SELECT]: BLOCKED! (Status ${res.status}, msg: ${data.message || JSON.stringify(data)})`);
      }
    } catch (e) {
      console.log(`  [SELECT]: Error -> ${e.message}`);
    }

    // 2. UPDATE test
    try {
      const res = await fetch(`${url}/${table}?id=eq.00000000-0000-0000-0000-000000000000`, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ status: "active" }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`  [UPDATE]: EXPOSED! (Status ${res.status}, update allowed)`);
      } else {
        console.log(`  [UPDATE]: BLOCKED! (Status ${res.status}, msg: ${data.message || JSON.stringify(data)})`);
      }
    } catch (e) {
      console.log(`  [UPDATE]: Error -> ${e.message}`);
    }

    // 3. DELETE test
    try {
      const res = await fetch(`${url}/${table}?id=eq.00000000-0000-0000-0000-000000000000`, {
        method: "DELETE",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Prefer: "return=representation",
        },
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`  [DELETE]: EXPOSED! (Status ${res.status}, delete allowed)`);
      } else {
        console.log(`  [DELETE]: BLOCKED! (Status ${res.status}, msg: ${data.message || JSON.stringify(data)})`);
      }
    } catch (e) {
      console.log(`  [DELETE]: Error -> ${e.message}`);
    }

    console.log("");
  }
}

audit();
