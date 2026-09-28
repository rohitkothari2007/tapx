globalThis.WebSocket = class {};
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env.local", "utf8");
const envVars = {};
for (const line of envText.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim();
    envVars[k] = v;
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

async function inspectRPC() {
  console.log("Querying create_tapx_table_order function source...");

  const { data, error } = await supabase.rpc("inspect_function_source", {
    func_name: "create_tapx_table_order"
  });

  if (error) {
    console.log("Could not run inspect_function_source RPC:", error.message);
  } else {
    console.log("RPC Source:", data);
  }
}

inspectRPC();
