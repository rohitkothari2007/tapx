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
const anonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(supabaseUrl, anonKey);

async function inspectCustomersPolicies() {
  console.log("=== TESTING RLS ON CUSTOMERS TABLE ===");

  // 1. Insert a test customer
  const testPhone = "77777" + Math.floor(10005 + Math.random() * 89995);
  console.log("Inserting customer with phone:", testPhone);
  const { data: insertedCustomer, error: insertErr } = await supabase
    .from("customers")
    .insert({ name: "Direct Form Test", phone: testPhone })
    .select("id, name, phone")
    .single();

  console.log("Insert result:", { insertedCustomer, insertErr });

  if (!insertedCustomer) {
    process.exit(1);
  }

  // 2. Insert membership
  const businessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";
  const { data: insertedMem, error: memErr } = await supabase
    .from("loyalty_memberships")
    .insert({ business_id: businessId, customer_id: insertedCustomer.id, visits: 2 })
    .select("id")
    .single();

  console.log("Membership insert result:", { insertedMem, memErr });

  // 3. Query loyalty_memberships with joined customer as ANON (public)
  const { data: anonMembers, error: anonErr } = await supabase
    .from("loyalty_memberships")
    .select("id, customer_id, visits, customer:customers(name, phone)")
    .eq("id", insertedMem.id);

  console.log("Anon query with join result:", JSON.stringify(anonMembers, null, 2), anonErr);

  process.exit(0);
}

inspectCustomersPolicies();
