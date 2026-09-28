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

async function backfillAssignedAt() {
  console.log("Checking for assigned devices with missing assigned_at timestamp...");

  const res = await fetch(`${supabaseUrl}/rest/v1/devices?select=id,device_code,business_id,created_at,assigned_at&business_id=not.is.null&assigned_at=is.null`, {
    headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
  });

  const devices = await res.json();
  console.log(`Found ${devices?.length || 0} assigned devices missing assigned_at.`);

  if (Array.isArray(devices) && devices.length > 0) {
    for (const dev of devices) {
      const assignedAt = dev.created_at || new Date().toISOString();
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/devices?id=eq.${dev.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ assigned_at: assignedAt })
      });

      if (!updateRes.ok) {
        console.error(`Failed to backfill device ${dev.device_code}:`, await updateRes.text());
      } else {
        console.log(`Successfully backfilled device ${dev.device_code} with assigned_at = ${assignedAt}`);
      }
    }
  } else {
    console.log("All assigned devices already have valid assigned_at timestamps!");
  }
}

backfillAssignedAt();
