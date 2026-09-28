import { spawn } from "child_process";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const envFile = fs.readFileSync(".env.local", "utf8");
const url = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
const supabase = createClient(url, key, { realtime: { transport: ws } });

const businessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";
const deviceId = "48fb22b0-934b-4ed8-bd1d-d8307a09b70c"; // YVS001 real device id

async function prepareData() {
  console.log("Preparing social proof test data for Yuva Selection...");

  // Insert 5 google_review_click rows
  const reviewRows = Array.from({ length: 5 }, () => ({
    business_id: businessId,
    device_id: deviceId,
    device_code: "YVS001",
    interaction_type: "google_review_click",
  }));

  const instaRows = Array.from({ length: 5 }, () => ({
    business_id: businessId,
    device_id: deviceId,
    device_code: "YVS001",
    interaction_type: "instagram_click",
  }));

  const { error: revErr } = await supabase.from("interactions").insert(reviewRows);
  if (revErr) console.error("Review insert err:", revErr);

  const { error: instaErr } = await supabase.from("interactions").insert(instaRows);
  if (instaErr) console.error("Insta insert err:", instaErr);

  // Check counts
  const { data: currentLogs } = await supabase
    .from("interactions")
    .select("interaction_type")
    .eq("business_id", businessId);

  const counts = {};
  (currentLogs || []).forEach((r) => {
    counts[r.interaction_type] = (counts[r.interaction_type] || 0) + 1;
  });

  console.log("Updated All-Time Counts for Yuva Selection:", counts);
}

async function captureTapPage() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const userDataDir = "C:\\Users\\khush\\Desktop\\tapx\\scratch\\chrome_user_data_part2";

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const chromeProcess = spawn(chromePath, [
    "--remote-debugging-port=9223",
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check"
  ]);

  await new Promise((r) => setTimeout(r, 3000));

  try {
    const versionRes = await fetch("http://127.0.0.1:9223/json/version");
    const versionData = await versionRes.json();

    const { WebSocket } = await import("ws");
    const browserWs = new WebSocket(versionData.webSocketDebuggerUrl);
    await new Promise((res) => browserWs.on("open", res));

    let msgId = 1;
    function sendBrowserCommand(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (data) => {
          const parsed = JSON.parse(data.toString());
          if (parsed.id === id) {
            browserWs.removeListener("message", handler);
            resolve(parsed.result);
          }
        };
        browserWs.on("message", handler);
        browserWs.send(JSON.stringify({ id, method, params }));
      });
    }

    const target = await sendBrowserCommand("Target.createTarget", { url: "http://localhost:3000/tap/YVS001" });
    const tabWsUrl = `ws://127.0.0.1:9223/devtools/page/${target.targetId}`;

    const wsTab = new WebSocket(tabWsUrl);
    await new Promise((res) => wsTab.on("open", res));

    let tabMsgId = 1;
    function sendTab(method, params = {}) {
      return new Promise((resolve) => {
        const id = tabMsgId++;
        const handler = (data) => {
          const parsed = JSON.parse(data.toString());
          if (parsed.id === id) {
            wsTab.removeListener("message", handler);
            resolve(parsed.result);
          }
        };
        wsTab.on("message", handler);
        wsTab.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendTab("Page.enable");
    await sendTab("Runtime.enable");

    // Set viewport to mobile size
    await sendTab("Emulation.setDeviceMetricsOverride", {
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      mobile: true
    });

    await new Promise((r) => setTimeout(r, 4500));

    // Evaluate social proof text presence in DOM
    const domCheck = await sendTab("Runtime.evaluate", {
      expression: `
        (function() {
          const text = document.body.innerText;
          const hasReviewProof = text.includes("people have visited to leave a review");
          const hasInstaProof = text.includes("people have visited our Instagram");
          return {
            hasReviewProof,
            hasInstaProof,
            textSnippet: text.substring(0, 600)
          };
        })()
      `,
    });

    console.log("DOM Social Proof Check Result:", domCheck.result.value);

    // Capture screenshot
    const shot = await sendTab("Page.captureScreenshot", { format: "png" });
    const screenshotPath = "C:\\Users\\khush\\.gemini\\antigravity\\brain\\b396a373-5bfc-4233-8cbe-9ba5c4b1f019\\part2_tap_social_proof_live.png";
    fs.writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));
    console.log("Part 2 screenshot saved to:", screenshotPath);

    wsTab.close();
    browserWs.close();
    chromeProcess.kill();
  } catch (err) {
    console.error("Capture error:", err);
    chromeProcess.kill();
  }
}

async function main() {
  await prepareData();
  await captureTapPage();
  process.exit(0);
}

main();
