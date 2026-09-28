import puppeteer from "puppeteer";
import fs from "fs";

async function runBrowserTest() {
  console.log("Launching Real Chromium Browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const urlsToTest = [
    "https://tapx-roan.vercel.app",
    "https://tapx-roan.vercel.app/",
    "https://tapx-roan.vercel.app/t/YVS001",
    "https://tapx-roan.vercel.app/tap/YVS001",
  ];

  for (const url of urlsToTest) {
    console.log(`\n========================================`);
    console.log(`TESTING IN REAL CHROMIUM BROWSER: ${url}`);
    console.log(`========================================`);

    const page = await browser.newPage();
    const consoleLogs = [];
    const failedRequests = [];
    const responses = [];

    page.on("console", (msg) => consoleLogs.push(`[Console ${msg.type()}] ${msg.text()}`));
    page.on("requestfailed", (req) => {
      failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText || "FAILED"}`);
    });
    page.on("response", (res) => {
      responses.push(`${res.status()} ${res.url()}`);
    });

    try {
      const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
      console.log(`Status Code: ${response?.status()}`);
      console.log(`Final URL: ${page.url()}`);
      console.log(`Page Title: await ${await page.title()}`);

      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log(`Body Text Snippet (first 300 chars): ${bodyText.substring(0, 300).replace(/\s+/g, " ")}`);

      if (consoleLogs.length > 0) {
        console.log("Console Logs:");
        consoleLogs.forEach((l) => console.log(`  ${l}`));
      }

      if (failedRequests.length > 0) {
        console.log("Failed Network Requests:");
        failedRequests.forEach((f) => console.log(`  ❌ ${f}`));
      }
    } catch (err) {
      console.error(`❌ REAL BROWSER NAVIGATION ERROR for ${url}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

runBrowserTest();
