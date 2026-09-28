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

async function inspectRpc() {
  console.log("=== INSPECTING RECORD_TAPX_LOYALTY_VISIT RPC & POLICIES ===");

  // Query pg_proc or pg_policies if available
  const { data: policies, error: polErr } = await supabase.rpc("execute_read_only_query", {
    query_text: "SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('loyalty_memberships', 'customers');"
  });

  console.log("Policies:", policies, polErr);

  const { data: funcDef, error: funcErr } = await supabase.rpc("execute_read_only_query", {
    query_text: "SELECT routine_name, routine_definition FROM information_schema.routines WHERE routine_name LIKE '%loyalty%';"
  });

  console.log("Functions:", funcDef, funcErr);

  process.exit(0);
}

inspectRpc();
