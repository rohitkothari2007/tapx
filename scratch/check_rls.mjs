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

async function checkClientQueries() {
  const email = "rohitjkothari12@gmail.com";
  console.log("Signing in as:", email);

  const { data: userAuth, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password: "Yuva@5666",
  });

  if (!userAuth?.user) {
    console.error("Sign in failed:", authErr);
    return;
  }

  const user = userAuth.user;
  console.log("User id:", user.id, "email:", user.email);

  // Query 1: tapx_client_users
  const { data: mappings, error: err1 } = await supabase
    .from("tapx_client_users")
    .select("business_id, role")
    .eq("user_id", user.id);

  console.log("tapx_client_users result:", mappings, err1);

  // Query 2: businesses by email
  const { data: bizByEmail, error: err2 } = await supabase
    .from("businesses")
    .select("id, name, category")
    .ilike("email", user.email || "");

  console.log("bizByEmail result:", bizByEmail, err2);
}

checkClientQueries();
