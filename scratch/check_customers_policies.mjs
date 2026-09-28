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

async function checkCustomersPolicies() {
  console.log("=== QUERYING RLS POLICIES ON CUSTOMERS TABLE ===");

  // Check policies via query if possible or test selecting customers with authenticated user or anon client
  const { data: custs, error: custErr } = await supabase.from("customers").select("*");
  console.log("Anon select on customers result:", { count: custs?.length, error: custErr });

  process.exit(0);
}

checkCustomersPolicies();
