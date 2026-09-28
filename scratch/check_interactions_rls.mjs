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

async function checkRLS() {
  const { data, error } = await supabase.rpc("get_policies_for_table", { table_name: "interactions" });
  if (error) {
    console.log("RPC get_policies_for_table error, querying pg_policies directly via REST if possible or testing query");
    // Test direct SELECT with eq("business_id", ...)
    const { data: testData, error: testError } = await supabase
      .from("interactions")
      .select("id, business_id, interaction_type, created_at")
      .eq("business_id", "8ac05e2a-9942-4727-abbe-b98973e69a1e");
    console.log("Query test count:", testData?.length, "Error:", testError);
  } else {
    console.log("Policies:", data);
  }
}

checkRLS();
