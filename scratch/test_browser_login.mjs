import { execSync } from "child_process";
import fs from "fs";

const msedgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function testLiveLogin() {
  console.log("=== TESTING LOGIN REACHABILITY & AUTH ENDPOINT ===");
  const envFile = fs.readFileSync(".env.local", "utf8");
  const envVars = {};
  envFile.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      envVars[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    }
  });

  const url = envVars.NEXT_PUBLIC_SUPABASE_URL;

  console.log(`Pinging Supabase API gateway directly: ${url}/auth/v1/health...`);
  const start = Date.now();
  try {
    const res = await fetch(`${url}/auth/v1/health`, { method: "GET" });
    console.log(`✓ Gateway Status: ${res.status} (${Date.now() - start}ms)`);
    const data = await res.json();
    console.log("Health Data:", data);
  } catch (err) {
    console.error(`❌ Connection Error (${Date.now() - start}ms):`, err.message);
  }
}

testLiveLogin();
