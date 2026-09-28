import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function inspectVirinchi() {
  console.log("=== FINDING VIRINCHI BUSINESS ===");
  const { data: businesses, error: bizError } = await supabase
    .from("businesses")
    .select("*")
    .ilike("name", "%virinchi%");

  if (bizError) {
    console.error("Error fetching businesses:", bizError);
    return;
  }

  console.log("Found businesses:", businesses);

  if (!businesses || businesses.length === 0) {
    const { data: allBiz } = await supabase.from("businesses").select("id, name, slug");
    console.log("All businesses in DB:", allBiz);
    return;
  }

  for (const biz of businesses) {
    console.log(`\n--- Testing delete_tapx_business RPC for ${biz.name} (id: ${biz.id}) ---`);
    const { data, error } = await supabase.rpc("delete_tapx_business", { p_business_id: biz.id });
    console.log("RPC Result:", JSON.stringify({ data, error }, null, 2));
  }
}

inspectVirinchi();
