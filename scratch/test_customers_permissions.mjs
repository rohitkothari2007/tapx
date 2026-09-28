import fs from "fs";

globalThis.WebSocket = class {
  constructor() {}
  addEventListener() {}
  removeEventListener() {}
};

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

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(supabaseUrl, anonKey);

async function testPermissions() {
  console.log("=== TESTING ANON PERMISSIONS ON CUSTOMERS ===");

  const testPhone = "98765" + Math.floor(10000 + Math.random() * 90000);

  console.log("1. Trying SELECT on customers with anon key...");
  const selRes = await supabase.from("customers").select("*").eq("phone", testPhone);
  console.log("SELECT result:", selRes);

  console.log("\n2. Trying INSERT on customers with anon key...");
  const insRes = await supabase.from("customers").insert({ name: "Test Anon", phone: testPhone }).select();
  console.log("INSERT result:", insRes);

  console.log("\n3. Trying INSERT on loyalty_memberships with anon key...");
  const memRes = await supabase.from("loyalty_memberships").insert({
    business_id: "8ac05e2a-9942-4727-abbe-b98973e69a1e",
    customer_id: "f46c0a5d-157a-4959-bc11-e78b07ca7bd3",
    visits: 1
  }).select();
  console.log("MEMBERSHIP INSERT result:", memRes);

  process.exit(0);
}

testPermissions();
