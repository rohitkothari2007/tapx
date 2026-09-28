import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function queryInteractions() {
  const businessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";
  console.log(`Querying interactions for business_id = '${businessId}'...`);

  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error querying interactions:", error);
  } else {
    console.log(`Found ${data?.length || 0} interaction rows:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

queryInteractions();
