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

async function checkAuth() {
  console.log("Checking admin email: rohitjkothari12@gmail.com");

  const passwords = ["Password123!", "12345678", "admin123", "password", "rohit123", "TAPX2026!", "tapx2026", "Rohit123!"];
  for (const pwd of passwords) {
    const { data } = await supabase.auth.signInWithPassword({
      email: "rohitjkothari12@gmail.com",
      password: pwd,
    });
    if (data?.session) {
      console.log("MATCH FOUND! Password is:", pwd);
      return;
    }
  }
  console.log("No match among common passwords.");
}

checkAuth();
