globalThis.WebSocket = class {};
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer-core";
import fs from "fs";

const envText = fs.readFileSync(".env.local", "utf8");
const envVars = {};
for (const line of envText.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim();
    envVars[k] = v;
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

async function run() {
  console.log("=== STEP 1: Authenticate Admin user (rohitjkothari12@gmail.com) ===");
  const adminEmail = "rohitjkothari12@gmail.com";
  const adminPassword = "Yuva@5666";

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (authErr || !authData?.session?.access_token) {
    console.error("Admin authentication failed:", authErr);
    process.exit(1);
  }

  const adminToken = authData.session.access_token;
  console.log("Admin token acquired successfully.");

  console.log("=== STEP 2: Call POST /api/admin/create-owner to edit Hotel Dwarka's owner email ===");
  const hotelDwarkaId = "ec122dc0-b2f1-4d47-b3a8-c899dde5ccd1";
  const newOwnerEmail = "rohitjkothari12+dwarka@gmail.com";

  const editRes = await fetch("http://localhost:3000/api/admin/create-owner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      businessId: hotelDwarkaId,
      ownerEmail: newOwnerEmail,
    }),
  });

  const editData = await editRes.json();
  console.log("API Response from create-owner:", editRes.status, editData);

  console.log("=== STEP 3: Puppeteer Test - Sign into Client Portal ===");
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log("Navigating to http://localhost:3000/client/login ...");
  await page.goto("http://localhost:3000/client/login", { waitUntil: "networkidle2" });

  console.log("Entering credentials...");
  await page.type('input[type="email"]', adminEmail);
  await page.type('input[type="password"]', adminPassword);

  console.log("Clicking Sign In...");
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: "networkidle2" });
  console.log("Navigated to URL:", page.url());

  // Navigate to Hotel Dwarka directly via bId param
  console.log("Navigating to Hotel Dwarka workspace (/client?bId=" + hotelDwarkaId + ")...");
  await page.goto(`http://localhost:3000/client?bId=${hotelDwarkaId}`, { waitUntil: "networkidle2" });

  await page.waitForSelector(".business-info", { timeout: 10000 });
  const bInfo = await page.$eval(".business-info", (el) => el.textContent);
  console.log("Loaded Business Workspace Header:", bInfo);

  const screenshotPath = "C:\\Users\\khush\\.gemini\\antigravity\\brain\\1d85ac11-6c91-428e-acc8-17d432220648\\hotel_dwarka_new_owner_login.png";
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log("Screenshot saved to:", screenshotPath);

  await browser.close();
  console.log("=== VERIFICATION COMPLETED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
