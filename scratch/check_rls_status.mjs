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

async function run() {
  const businessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";

  console.log("Checking RLS & Grants for interactions & businesses...");

  // Let's test GET /rest/v1/interactions?select=device_code&business_id=eq.8ac05e2a-9942-4727-abbe-b98973e69a1e
  const r1 = await fetch(`${supabaseUrl}/rest/v1/interactions?select=device_code&business_id=eq.${businessId}`, {
    headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
  });
  console.log("Interactions select status:", r1.status, (await r1.text()).substring(0, 200));

  // Let's test GET /rest/v1/businesses?select=*&id=eq.8ac05e2a-9942-4727-abbe-b98973e69a1e
  const r2 = await fetch(`${supabaseUrl}/rest/v1/businesses?select=*&id=eq.${businessId}`, {
    headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
  });
  console.log("Businesses select status:", r2.status, (await r2.text()).substring(0, 200));

  // Let's test GET /rest/v1/interactions?select=* (without business_id filter)
  const r3 = await fetch(`${supabaseUrl}/rest/v1/interactions?select=*`, {
    headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
  });
  console.log("Interactions unfiltered select status:", r3.status, (await r3.text()).substring(0, 200));
}

run();
