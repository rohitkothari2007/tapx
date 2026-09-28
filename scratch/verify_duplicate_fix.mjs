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

async function simulateJoin(name, phone) {
  const cleanName = name.trim();
  const rawPhoneDigits = phone.replace(/\D/g, "");
  const cleanPhone = rawPhoneDigits.slice(-10);

  // 1. Lookup
  const { data: existingCustomer, error: lookupErr } = await supabase
    .from("customers")
    .select("id, name, phone")
    .or(`phone.eq.${cleanPhone},phone.eq.91${cleanPhone},phone.eq.+91${cleanPhone}`)
    .maybeSingle();

  let customerId = existingCustomer?.id;

  if (!customerId) {
    const { data: newCustomer, error: insertErr } = await supabase
      .from("customers")
      .insert({ name: cleanName, phone: cleanPhone })
      .select("id")
      .single();
    customerId = newCustomer.id;
  }

  // 2. Membership lookup
  const { data: existingMem, error: memErr } = await supabase
    .from("loyalty_memberships")
    .select("id, visits, reward_claimed")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .maybeSingle();

  let memId = existingMem?.id;
  if (!memId) {
    const { data: newMem } = await supabase
      .from("loyalty_memberships")
      .insert({ business_id: businessId, customer_id: customerId, visits: 1 })
      .select("id")
      .single();
    memId = newMem.id;
  }

  return { customerId, memId, isExisting: !!existingCustomer };
}

async function runVerification() {
  console.log("=== ENROLLMENT TEST 1: Typed as +91 9123456789 ===");
  const res1 = await simulateJoin("Fix Verification User", "+91 9123456789");
  console.log("Result 1:", res1);

  console.log("\n=== ENROLLMENT TEST 2: Typed as 9123456789 (Without +91) ===");
  const res2 = await simulateJoin("Fix Verification User", "9123456789");
  console.log("Result 2:", res2);

  if (res1.customerId === res2.customerId && res2.isExisting === true) {
    console.log("\n✅ SUCCESS: Returned SAME Customer ID! Zero duplicate customer rows created!");
  } else {
    console.log("\n❌ FAIL: Duplicate customer created!");
  }

  process.exit(0);
}

runVerification();
