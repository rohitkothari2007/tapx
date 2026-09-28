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

async function findMenuItems() {
  const businessId = "ec122dc0-b2f1-4d47-b3a8-c899dde5ccd1"; // HOTEL DWARKA

  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("business_id", businessId)
    .limit(5);

  console.log("Menu items for HOTEL DWARKA:", data, error);
}

findMenuItems();
