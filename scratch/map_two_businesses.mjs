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

async function mapTwoBusinesses() {
  const email = "rohitjkothari12@gmail.com";
  console.log("Signing in as:", email);

  const { data: userAuth } = await supabase.auth.signInWithPassword({
    email,
    password: "Yuva@5666",
  });

  if (!userAuth?.user) {
    console.error("Sign in failed");
    return;
  }

  const userId = userAuth.user.id;
  console.log("User ID:", userId);

  const business1 = "8ac05e2a-9942-4727-abbe-b98973e69a1e"; // YUVA SELECTION
  const business2 = "ec122dc0-b2f1-4d47-b3a8-c899dde5ccd1"; // HOTEL DWARKA

  const { error: err1 } = await supabase.from("tapx_client_users").upsert({
    user_id: userId,
    business_id: business1,
    role: "owner"
  });
  console.log("Upsert business 1 (YUVA SELECTION):", err1);

  const { error: err2 } = await supabase.from("tapx_client_users").upsert({
    user_id: userId,
    business_id: business2,
    role: "owner"
  });
  console.log("Upsert business 2 (HOTEL DWARKA):", err2);

  const { data: finalRows } = await supabase.from("tapx_client_users").select("*").eq("user_id", userId);
  console.log("Final tapx_client_users rows for user:", finalRows);
}

mapTwoBusinesses();
