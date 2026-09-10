import { createClient } from "@supabase/supabase-js";

const url = "https://nzxmwerhrauqidinktgp.supabase.co/rest/v1";
const anonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function checkConstraint() {
  console.log("=== TESTING BUSINESS CATEGORY COLUMN CONSTRAINTS ===");
  try {
    const res = await fetch(`${url}/businesses?select=category&limit=10`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    const data = await res.json();
    console.log("Existing distinct categories in businesses table:", [...new Set(data.map(d => d.category))]);
  } catch (e) {
    console.log("Error checking categories:", e.message);
  }
}

checkConstraint();
