import fs from "fs";

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

async function checkReachability() {
  console.log(`Checking connection to Supabase URL: ${supabaseUrl}...`);
  const startTime = Date.now();
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: anonKey,
      },
    });
    console.log(`✓ Response Status: ${res.status} (${Date.now() - startTime}ms)`);
    const text = await res.text();
    console.log(`Response text snippet: ${text.slice(0, 200)}`);
  } catch (err) {
    console.error(`❌ FETCH FAILED (${Date.now() - startTime}ms):`, err);
  }
}

checkReachability();
