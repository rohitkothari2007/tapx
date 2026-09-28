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

// Verify querying interactions with anon key
async function testAllTables() {
  const tables = [
    'businesses',
    'devices',
    'interactions',
    'customer_requests',
    'customer_feedback',
    'tapx_appointments',
    'tapx_orders',
    'business_features',
    'business_module_configs'
  ];

  console.log("=== Testing Anon Access to All Client Tables ===");
  for (const t of tables) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${t}?select=*&limit=1`, {
      headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
    });
    const text = await res.text();
    console.log(`Table ${t.padEnd(25)} -> Status ${res.status}: ${res.status === 200 ? 'OK' : text.substring(0, 150)}`);
  }
}

testAllTables();
