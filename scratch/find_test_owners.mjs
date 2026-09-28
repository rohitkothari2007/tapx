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

async function findOwners() {
  console.log("=== CLIENT USERS & BUSINESSES ===");
  const { data: clientUsers } = await supabase.from("tapx_client_users").select("*");
  const { data: businesses } = await supabase.from("businesses").select("id, name");

  console.log("Client Users:", clientUsers);
  console.log("Businesses:", businesses);
}

findOwners();
