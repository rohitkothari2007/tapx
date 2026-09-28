import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function findUserId(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("Login error:", error.message);
    return;
  }
  console.log("Logged in User ID:", data.user.id);
  console.log("Logged in Email:", data.user.email);
  return { userId: data.user.id, token: data.session.access_token };
}

const email = process.argv[2];
const password = process.argv[3];

if (email && password) {
  findUserId(email, password);
} else {
  console.log("Usage: node scratch/get_user_id.mjs <email> <password>");
}
