import fs from "fs";
import dns from "dns";
import https from "https";

// Force IPv4 first in Node DNS resolution
dns.setDefaultResultOrder("ipv4first");

const envFile = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envFile.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function checkIPv4Reachability() {
  console.log(`Checking connection with dns.setDefaultResultOrder('ipv4first') to: ${supabaseUrl}...`);
  const start = Date.now();
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: anonKey,
      },
    });
    console.log(`✓ SUCCESS Status: ${res.status} (${Date.now() - start}ms)`);
    const text = await res.text();
    console.log("Response text snippet:", text.slice(0, 150));
  } catch (err) {
    console.error(`❌ FETCH STILL FAILED (${Date.now() - start}ms):`, err);
  }
}

checkIPv4Reachability();
