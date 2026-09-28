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

async function confirmEmail() {
  console.log("Testing auth sign in with rohitjkothari12@gmail.com or other users...");
  // Check if we can sign in with rohitjkothari12@gmail.com
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "rohitjkothari12@gmail.com",
    password: "Password123!",
  });
  console.log("Sign in result:", data?.user?.id, error);
}

confirmEmail();
