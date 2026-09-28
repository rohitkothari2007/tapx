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

const businessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";

async function runFullTest() {
  console.log("=== STEP 1: ENROLL CUSTOMER FOR THE FIRST TIME ===");
  const name1 = "Kalpana Kothari";
  const phone1 = "8855039977";
  const cleanPhone1 = phone1.replace(/\D/g, "");

  console.log("Looking up customer by phone:", cleanPhone1);
  const { data: existingCust1, error: custErr1 } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("phone", cleanPhone1)
    .maybeSingle();

  console.log("Existing customer 1:", existingCust1, custErr1);

  let custId1 = existingCust1?.id;
  if (!custId1) {
    console.log("Inserting new customer...");
    const { data: newCust, error: insErr } = await supabase
      .from("customers")
      .insert({ name: name1, phone: cleanPhone1 })
      .select("id")
      .single();
    console.log("Insert result:", newCust, insErr);
    custId1 = newCust?.id;
  }

  console.log("Customer ID 1:", custId1);

  console.log("Looking up loyalty membership for business:", businessId, "and customer:", custId1);
  const { data: existingMem1, error: memErr1 } = await supabase
    .from("loyalty_memberships")
    .select("id, visits, reward_claimed")
    .eq("business_id", businessId)
    .eq("customer_id", custId1)
    .maybeSingle();

  console.log("Existing membership 1:", existingMem1, memErr1);

  let memId1 = existingMem1?.id;
  if (!memId1) {
    console.log("Inserting new loyalty membership...");
    const { data: newMem, error: insMemErr } = await supabase
      .from("loyalty_memberships")
      .insert({
        business_id: businessId,
        customer_id: custId1,
        visits: 1,
        reward_claimed: false,
      })
      .select("id, visits, reward_claimed")
      .single();
    console.log("Insert membership result:", newMem, insMemErr);
    memId1 = newMem?.id;
  }

  console.log("\n=== STEP 2: QUERY FROM /client DASHBOARD PERSPECTIVE ===");
  const { data: clientMembers, error: clientErr } = await supabase
    .from("loyalty_memberships")
    .select("id, customer_id, visits, reward_claimed, updated_at, customer:customers(name, phone)")
    .eq("business_id", businessId);

  console.log("Client dashboard members query error:", clientErr);
  console.log("Client dashboard members result:", JSON.stringify(clientMembers, null, 2));

  console.log("\n=== STEP 3: SECOND ENROLLMENT WITH EXACT SAME PHONE ===");
  console.log("Looking up customer by phone second time:", cleanPhone1);
  const { data: existingCust2, error: custErr2 } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("phone", cleanPhone1)
    .maybeSingle();

  console.log("Existing customer 2 lookup result:", existingCust2, custErr2);

  let custId2 = existingCust2?.id;
  if (!custId2) {
    console.log("ERROR: SECOND LOOKUP DID NOT FIND EXISTING CUSTOMER!");
  } else {
    console.log("SUCCESS: SECOND LOOKUP FOUND SAME CUSTOMER ID:", custId2);
  }

  console.log("Looking up loyalty membership second time...");
  const { data: existingMem2, error: memErr2 } = await supabase
    .from("loyalty_memberships")
    .select("id, visits, reward_claimed")
    .eq("business_id", businessId)
    .eq("customer_id", custId2)
    .maybeSingle();

  console.log("Existing membership 2 lookup result:", existingMem2, memErr2);

  process.exit(0);
}

runFullTest();
