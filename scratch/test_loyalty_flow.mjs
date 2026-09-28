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

async function testLoyaltyEnrollment() {
  console.log("=== SIMULATING TAP ENROLLMENT WITH ANON CLIENT ===");
  const testPhone = "9999999999";
  const testName = "Test User 1";

  // Step 1: Lookup existing customer by phone
  console.log("1. Looking up customer by phone:", testPhone);
  const { data: existingCustomer, error: lookupErr } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("phone", testPhone)
    .maybeSingle();

  console.log("Lookup result:", { existingCustomer, lookupErr });

  let customerId = existingCustomer?.id;

  if (!customerId) {
    console.log("2. Customer not found, inserting new customer...");
    const { data: newCustomer, error: insertErr } = await supabase
      .from("customers")
      .insert({ name: testName, phone: testPhone })
      .select("id, name, phone")
      .single();

    console.log("Insert customer result:", { newCustomer, insertErr });
    customerId = newCustomer?.id;
  }

  console.log("Customer ID obtained:", customerId);

  // Directly check customers table for this customerId
  const { data: customerRow, error: getErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId);
  console.log("Actual customer row in DB:", { customerRow, getErr });

  // Now test second time lookup with SAME phone number
  console.log("\n3. Testing second time lookup with SAME phone number:", testPhone);
  const { data: secondLookup, error: secondErr } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("phone", testPhone)
    .maybeSingle();

  console.log("Second lookup result:", { secondLookup, secondErr });

  process.exit(0);
}

testLoyaltyEnrollment();
