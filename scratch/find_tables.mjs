const url = "https://nzxmwerhrauqidinktgp.supabase.co/rest/v1/";
const key = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const candidateTables = [
  "devices",
  "businesses",
  "interactions",
  "customer_requests",
  "tapx_orders",
  "tapx_appointments",
  "customer_feedback",
  "loyalty_memberships",
  "loyalty_transactions",
  "customers",
  "feature_catalog",
  "business_features",
  "business_module_configs",
  "tapx_client_users",
  "hardware_requests",
  "hotel_requests",
  "hotel_services",
  "hotel_categories",
  "room_service_requests",
  "hotel_room_requests",
  "offers",
  "promotions",
  "menu_items",
  "digital_menu",
  "tapx_offers"
];

async function testTables() {
  console.log("=== COMPREHENSIVE TABLE AUDIT ===");
  for (const table of candidateTables) {
    try {
      const res = await fetch(`${url}${table}?select=*&limit=1`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      });
      const data = await res.json();
      if (res.status === 200 || res.status === 206) {
        console.log(`✓ Table '${table}': ACCESSIBLE (Status ${res.status}, sample: ${JSON.stringify(data[0] || {})})`);
      } else if (res.status === 401 || res.status === 403) {
        console.log(`🔒 Table '${table}': RLS SECURED (Status ${res.status}, msg: ${data.message})`);
      } else {
        console.log(`❌ Table '${table}': NOT FOUND (Status ${res.status})`);
      }
    } catch (err) {
      console.log(`Error testing ${table}: ${err.message}`);
    }
  }
}

testTables();
