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

async function setup() {
  const adminEmail = "rohitjkothari12+dwarka@gmail.com";
  const password = "Password123!";

  console.log("Signing in user:", adminEmail);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password,
  });

  if (authError || !authData?.user) {
    console.error("Sign in failed:", authError);
    return;
  }

  console.log("User ID:", authData.user.id);
  const { data: adminRow, error: insertError } = await supabase
    .from("tapx_admin_users")
    .upsert({ user_id: authData.user.id });

  console.log("Admin Row Upsert:", adminRow, insertError);
}

setup();
