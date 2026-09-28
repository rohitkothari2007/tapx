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

// YUVA SELECTION Business ID
const businessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";

async function testQuery(name, endpoint) {
  const url = `${supabaseUrl}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    }
  });
  const text = await res.text();
  console.log(`[${res.status}] ${name} -> ${url}`);
  if (res.status !== 200) {
    console.log(`   ERROR BODY: ${text}`);
  } else {
    console.log(`   SUCCESS: ${text.substring(0, 100)}`);
  }
}

async function runAll() {
  console.log("=== Testing all 10 queries from app/client/page.tsx with Anon Key ===");
  await testQuery("1. Business", `businesses?select=*&id=eq.${businessId}`);
  await testQuery("2. Features", `features?select=*`);
  await testQuery("3. Business Features", `business_features?select=feature_id,enabled,status&business_id=eq.${businessId}`);
  await testQuery("4. Module Configs", `business_module_configs?select=module_key,config&business_id=eq.${businessId}`);
  await testQuery("5. Orders", `tapx_orders?select=id,business_id,table_number,customer_name,customer_phone,subtotal,total,status,source_device_code,created_at&business_id=eq.${businessId}`);
  await testQuery("6. Appointments", `tapx_appointments?select=id,business_id,customer_name,customer_phone,service_id,service_name,appointment_date,appointment_time,duration_minutes,status,notes,source_device_code,created_at,updated_at&business_id=eq.${businessId}`);
  await testQuery("7. Devices", `devices?select=*&business_id=eq.${businessId}`);
  await testQuery("8. Interactions (device_code)", `interactions?select=device_code&business_id=eq.${businessId}`);
  await testQuery("9. Customer Requests", `customer_requests?select=*&business_id=eq.${businessId}`);
  await testQuery("10. Customer Feedback", `customer_feedback?select=*&business_id=eq.${businessId}`);
}

runAll();
