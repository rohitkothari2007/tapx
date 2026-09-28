import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import WebSocket from "ws";

global.WebSocket = WebSocket;

const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInteractions() {
  const { data, error } = await supabase.from("interactions").select("*").limit(5);
  console.log("Sample interactions:", data, "Error:", error);
}

checkInteractions();
