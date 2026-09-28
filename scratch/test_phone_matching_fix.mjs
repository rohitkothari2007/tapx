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

async function testPhoneMatching(inputPhone) {
  const rawDigits = inputPhone.replace(/\D/g, "");
  const tenDigitPhone = rawDigits.slice(-10);

  console.log(`\nTesting input phone: "${inputPhone}" (normalized: "${tenDigitPhone}")`);

  const { data: existingCustomer, error: customerLookupError } = await supabase
    .from("customers")
    .select("id, name, phone")
    .or(`phone.eq.${tenDigitPhone},phone.eq.91${tenDigitPhone},phone.eq.+91${tenDigitPhone}`)
    .maybeSingle();

  console.log("Lookup result:", { existingCustomer, customerLookupError });
}

async function runTests() {
  // Test with Rohit Kothari's phone (stored as 917387879977 in DB)
  await testPhoneMatching("7387879977");
  await testPhoneMatching("917387879977");
  await testPhoneMatching("+91 7387879977");

  // Test with Kalpana Kothari's phone (stored as 8855039977 in DB)
  await testPhoneMatching("8855039977");
  await testPhoneMatching("+91 8855039977");

  process.exit(0);
}

runTests();
