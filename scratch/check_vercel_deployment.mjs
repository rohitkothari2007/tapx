import fs from "fs";

globalThis.WebSocket = class {
  constructor() {}
  addEventListener() {}
  removeEventListener() {}
};

async function verifyLiveVercel() {
  console.log("=== CHECKING LIVE VERCEL DEPLOYMENT REACHABILITY ===");
  try {
    const res = await fetch("https://tapx-roan.vercel.app/tap/YVS-001");
    console.log("Vercel HTTP Status:", res.status);
    console.log("Vercel Deployment Header:", res.headers.get("x-vercel-id"));
  } catch (err) {
    console.error("Fetch error:", err);
  }

  process.exit(0);
}

verifyLiveVercel();
