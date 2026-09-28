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
const key = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(supabaseUrl, key);

async function testWithServiceKey() {
  console.log("=== CHECKING CUSTOMERS TABLE RLS POLICIES ===");

  const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const adminSupabase = createClient(supabaseUrl, serviceKey);
    const { data: custs } = await adminSupabase.from("customers").select("*");
    console.log("Service key customers count:", custs?.length);
  } else {
    console.log("Service key not in .env.local");
  }

  process.exit(0);
}

testWithServiceKey();
