import { createClient } from '@supabase/supabase-js';
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

// Fetch owner details from tapx_client_users using raw fetch with service role key if available or anon key
const businessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";

async function testFetch(endpoint, token = anonKey) {
  const url = `${supabaseUrl}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`
    }
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function run() {
  console.log("=== Testing feature_catalog ===");
  console.log(await testFetch('feature_catalog?select=*&is_active=eq.true'));

  console.log("\n=== Testing customer_requests ===");
  console.log(await testFetch(`customer_requests?select=*&business_id=eq.${businessId}`));

  console.log("\n=== Testing customer_feedback ===");
  console.log(await testFetch(`customer_feedback?select=*&business_id=eq.${businessId}`));

  console.log("\n=== Testing tapx_appointments ===");
  console.log(await testFetch(`tapx_appointments?select=*&business_id=eq.${businessId}`));

  console.log("\n=== Testing interactions ===");
  console.log(await testFetch(`interactions?select=device_code&business_id=eq.${businessId}`));
  console.log(await testFetch(`interactions?select=device_id&business_id=eq.${businessId}`));
}

run();
