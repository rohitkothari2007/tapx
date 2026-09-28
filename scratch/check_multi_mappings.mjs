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

async function checkUserMappings() {
  const email = "rohitjkothari12@gmail.com";
  console.log("Checking user mappings for:", email);

  const { data: userAuth } = await supabase.auth.signInWithPassword({
    email,
    password: "Yuva@5666",
  });

  if (!userAuth?.user) {
    console.error("Failed to authenticate user");
    return;
  }

  const userId = userAuth.user.id;
  console.log("User ID:", userId);

  const { data: cuData } = await supabase.from("tapx_client_users").select("*").eq("user_id", userId);
  console.log("tapx_client_users rows for user:", cuData);

  const { data: bData } = await supabase.from("businesses").select("id, name, email");
  console.log("Businesses:", bData);
}

checkUserMappings();
