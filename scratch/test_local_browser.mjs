import { exec } from "child_process";
import fs from "fs";
import path from "path";

const edgePaths = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const foundExe = edgePaths.find((p) => fs.existsSync(p));
console.log("Found Browser Executable:", foundExe);

if (!foundExe) {
  console.error("No browser executable found!");
  process.exit(1);
}

const urls = [
  "https://tapx-roan.vercel.app",
  "https://tapx-roan.vercel.app/",
  "https://tapx-roan.vercel.app/t/YVS001",
  "https://tapx-roan.vercel.app/tap/YVS001",
];

async function testUrl(url) {
  return new Promise((resolve) => {
    console.log(`\n========================================`);
    console.log(`TESTING WITH LOCAL REAL BROWSER (HEADLESS): ${url}`);
    console.log(`========================================`);

    // Run browser in headless dump-dom mode to see what real browser engine parses & renders
    const cmd = `"${foundExe}" --headless --disable-gpu --dump-dom "${url}"`;
    exec(cmd, { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ Browser execution error for ${url}:`, err.message);
        resolve();
        return;
      }
      console.log(`DOM Output Length: ${stdout.length} bytes`);
      console.log(`DOM Snippet (first 400 chars):`);
      console.log(stdout.substring(0, 400).replace(/\s+/g, " "));

      if (stdout.includes("This page couldn't load")) {
        console.log("⚠️ DETECTED 'This page couldn't load' ERROR IN RENDERED DOM!");
      }
      if (stdout.includes("Deployment Protection")) {
        console.log("⚠️ DETECTED VERCEL DEPLOYMENT PROTECTION IN RENDERED DOM!");
      }
      if (stdout.includes("TAPX")) {
        console.log("✅ TAPX App Content rendered in DOM!");
      }
      resolve();
    });
  });
}

async function main() {
  for (const url of urls) {
    await testUrl(url);
  }
}

main();
