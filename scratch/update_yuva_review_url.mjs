import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function updateYuvaReviewUrl() {
  console.log("Updating YUVA SELECTION google_review_url...");
  const newReviewUrl = "https://g.page/r/CXrdGmw-RmMwEBM/review";

  const { data, error } = await supabase
    .from("businesses")
    .update({ google_review_url: newReviewUrl })
    .eq("name", "YUVA SELECTION")
    .select();

  if (error) {
    console.error("Error updating review URL:", error);
  } else {
    console.log("SUCCESS! Updated YUVA SELECTION business record:");
    console.log(JSON.stringify(data, null, 2));
  }
}

updateYuvaReviewUrl();
