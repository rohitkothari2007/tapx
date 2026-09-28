import { readFileSync } from 'fs';

const envLines = readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    const key = line.substring(0, idx).trim();
    const val = line.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// List of all known tables in the application
const allTables = [
  'businesses',
  'devices',
  'interactions',
  'customer_requests',
  'customer_feedback',
  'tapx_appointments',
  'tapx_orders',
  'tapx_order_items',
  'business_features',
  'business_module_configs',
  'feature_catalog',
  'loyalty_memberships',
  'loyalty_rewards',
  'loyalty_visits',
  'products',
  'product_categories',
  'offers',
  'hotel_room_service_items',
  'hotel_service_items',
  'hotel_guest_requests',
  'tapx_admin_users',
  'tapx_client_users'
];

async function auditTables() {
  console.log("=== Auditing Table Access & Grants via PostgREST ===");
  const results = [];

  for (const table of allTables) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });

    const status = res.status;
    const body = await res.text();
    let isPermissionDenied = false;
    let hint = null;

    if (status === 401 || status === 403) {
      isPermissionDenied = true;
      try {
        const json = JSON.parse(body);
        hint = json.hint || json.message;
      } catch (e) {
        hint = body;
      }
    }

    results.push({
      table,
      status,
      isPermissionDenied,
      hint: hint || (status === 200 ? 'ACCESSIBLE' : body.substring(0, 100))
    });
  }

  console.table(results);
}

auditTables();
