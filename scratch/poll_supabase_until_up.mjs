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

async function pollUntilActive() {
  console.log("Polling Supabase endpoint to detect when instance warm-up completes...");
  for (let i = 1; i <= 10; i++) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: "GET",
        headers: { apikey: anonKey },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      console.log(`✓ ATTEMPT ${i}: SUPABASE IS ACTIVE! Status Code: ${res.status} (${Date.now() - start}ms)`);
      process.exit(0);
    } catch (err) {
      console.log(`Attempt ${i} (${Date.now() - start}ms): ${err.name === 'AbortError' ? 'Timeout (4s)' : err.message}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("Supabase instance is still warming up. Will re-check.");
}

pollUntilActive();
