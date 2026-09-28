import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import WebSocket from "ws";

global.WebSocket = WebSocket;

const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDailyActionAnalytics() {
  const businessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";
  console.log(`=== Testing Daily Action Analytics for Business ${businessId} ===`);

  // 1. Get a device for this business
  const { data: devices } = await supabase.from("devices").select("id, device_code").eq("business_id", businessId).limit(1);
  const device = devices?.[0] || { id: "test-device-id", device_code: "YVS001" };

  console.log("Using device:", device);

  const actionTypes = [
    "nfc_tap",
    "google_review_click",
    "instagram_click",
    "whatsapp_click",
    "call_click",
    "location_click",
    "payment_click"
  ];

  console.log("\nSimulating 1 click for each button on the tap page...");
  const insertPayloads = actionTypes.map((type) => ({
    device_id: device.id,
    business_id: businessId,
    device_code: device.device_code,
    interaction_type: type,
    created_at: new Date().toISOString()
  }));

  const { data: inserted, error: insertError } = await supabase.from("interactions").insert(insertPayloads).select();
  if (insertError) {
    console.error("Insert error:", insertError);
    return;
  }
  console.log(`Inserted ${inserted.length} action interaction rows successfully.`);

  // 2. Fetch using exact client portal query pattern
  console.log("\nQuerying interactions table using client portal RLS query pattern...");
  const { data: rawInteractions, error: fetchError } = await supabase
    .from("interactions")
    .select("id, device_id, business_id, interaction_type, created_at, device_code")
    .eq("business_id", businessId);

  if (fetchError) {
    console.error("Fetch error:", fetchError);
    return;
  }

  // 3. Compute today's counts matching Client Portal logic
  const today = new Date();
  const counts = {
    totalTaps: 0,
    googleReviewClicks: 0,
    instagramClicks: 0,
    whatsappClicks: 0,
    callClicks: 0,
    locationClicks: 0,
    paymentClicks: 0,
  };

  (rawInteractions || []).forEach((item) => {
    if (!item.created_at) return;
    const date = new Date(item.created_at);
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    if (!isToday) return;

    const type = (item.interaction_type || "").toLowerCase();
    if (type === "nfc_tap") counts.totalTaps += 1;
    else if (type === "google_review_click") counts.googleReviewClicks += 1;
    else if (type === "instagram_click") counts.instagramClicks += 1;
    else if (type === "whatsapp_click") counts.whatsappClicks += 1;
    else if (type === "call_click") counts.callClicks += 1;
    else if (type === "location_click") counts.locationClicks += 1;
    else if (type === "payment_click") counts.paymentClicks += 1;
  });

  console.log("\n=== Client Portal 'Today' Action Analytics Summary ===");
  console.log("Total Taps:", counts.totalTaps);
  console.log("Google Review Clicks:", counts.googleReviewClicks);
  console.log("Instagram Clicks:", counts.instagramClicks);
  console.log("WhatsApp Clicks:", counts.whatsappClicks);
  console.log("Calls:", counts.callClicks);
  console.log("Location Views:", counts.locationClicks);
  console.log("Payment Attempts:", counts.paymentClicks);
}

testDailyActionAnalytics();
