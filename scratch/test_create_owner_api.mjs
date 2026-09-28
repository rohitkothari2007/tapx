import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

// Check with service role if SUPABASE_SERVICE_ROLE_KEY is set or query database tables directly
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Service role key present:", !!supabaseServiceKey);

async function testCreateOwnerLogic() {
  if (!supabaseServiceKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY environment variable is not defined!");
  }
}

testCreateOwnerLogic();
