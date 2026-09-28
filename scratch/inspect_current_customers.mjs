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

async function inspectCurrentState() {
  console.log("=== CURRENT CUSTOMERS TABLE ===");
  const { data: custs } = await supabase.from("customers").select("*");
  console.table(custs);

  console.log("\n=== CURRENT LOYALTY MEMBERSHIPS TABLE ===");
  const { data: mems } = await supabase.from("loyalty_memberships").select("*, customer:customers(*)");
  console.dir(mems, { depth: null });

  process.exit(0);
}

inspectCurrentState();
