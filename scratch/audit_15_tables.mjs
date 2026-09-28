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

const tables = [
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
  'tapx_admin_users',
  'tapx_client_users'
];

async function audit() {
  console.log("=== Auditing 15 Core Application Tables ===");
  const auditResults = [];

  for (const t of tables) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${t}?select=*&limit=1`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });

    const status = res.status;
    const bodyText = await res.text();
    let hasSelectGrantError = false;
    let details = "OK";

    if (status === 401 || status === 403) {
      hasSelectGrantError = true;
      try {
        const parsed = JSON.parse(bodyText);
        details = parsed.message || parsed.hint || bodyText;
      } catch (e) {
        details = bodyText;
      }
    }

    auditResults.push({
      table: t,
      status,
      missingGrantOrPolicy: hasSelectGrantError,
      errorDetails: details.substring(0, 120)
    });
  }

  console.table(auditResults);
}

audit();
