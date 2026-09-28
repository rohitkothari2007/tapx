globalThis.WebSocket = class {};
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env.local", "utf8");
const envVars = {};
for (const line of envText.split("\n")) {
  const [k, v] = line.split("=");
  if (k && v) envVars[k.trim()] = v.trim();
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: adminUsers, error: aErr } = await supabaseAdmin
    .from("tapx_admin_users")
    .select("*");
  console.log("Admin Users:", JSON.stringify(adminUsers, null, 2), aErr);
}

main();
