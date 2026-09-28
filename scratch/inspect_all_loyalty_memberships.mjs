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

async function inspectAllMemberships() {
  console.log("=== INSPECTING ALL LOYALTY MEMBERSHIPS ACROSS DB ===");

  const { data: allMembers, error } = await supabase
    .from("loyalty_memberships")
    .select(`
      *,
      customer:customers(*)
    `);

  if (error) {
    console.error("Fetch error:", error);
    return;
  }

  console.log(`Total loyalty memberships across DB: ${allMembers.length}`);
  console.log(JSON.stringify(allMembers, null, 2));
}

inspectAllMemberships();
