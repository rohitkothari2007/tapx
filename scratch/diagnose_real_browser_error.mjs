import fs from "fs";

globalThis.WebSocket = class {
  constructor() {}
  addEventListener() {}
  removeEventListener() {}
};

async function testLiveVercelPage() {
  console.log("=== DIAGNOSING LIVE VERCEL PAGE BUNDLE & RPC ===");

  const res = await fetch("https://tapx-roan.vercel.app/tap/YVS-001");
  const html = await res.text();

  console.log("Page status:", res.status);
  console.log("HTML contains get_or_join_tap_loyalty:", html.includes("get_or_join_tap_loyalty"));

  // Find JS script tags in HTML
  const scriptRegex = /\/_next\/static\/chunks\/[a-zA-Z0-9_-]+\.js/g;
  const scriptMatches = html.match(scriptRegex) || [];

  console.log("Found script chunks:", scriptMatches.length);

  let foundRpcInBundle = false;

  for (const scriptUrl of scriptMatches) {
    try {
      const scriptRes = await fetch(`https://tapx-roan.vercel.app${scriptUrl}`);
      const scriptText = await scriptRes.text();
      if (scriptText.includes("get_or_join_tap_loyalty")) {
        console.log("✅ FOUND 'get_or_join_tap_loyalty' IN VERCEL BUNDLE:", scriptUrl);
        foundRpcInBundle = true;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!foundRpcInBundle) {
    console.log("❌ CRITICAL: 'get_or_join_tap_loyalty' IS NOT IN THE DEPLOYED VERCEL JS BUNDLE!");
  }

  process.exit(0);
}

testLiveVercelPage();
