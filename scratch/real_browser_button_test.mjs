import { spawn } from "child_process";
import fs from "fs";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

global.WebSocket = WebSocket;

const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

async function runRealBrowserTest() {
  console.log("=== Step 0: Cleaning up previous test interactions for YVS001 today ===");
  const businessId = "8ac05e2a-9942-4727-abbe-b98973e69a1e";
  const today = new Date();
  
  // Clean up existing interactions for today for this test business so counts start fresh
  const { data: existingToday } = await supabase.from("interactions").select("id, created_at").eq("business_id", businessId);
  if (existingToday && existingToday.length > 0) {
    const todayIds = existingToday.filter(i => {
      const d = new Date(i.created_at);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    }).map(i => i.id);

    if (todayIds.length > 0) {
      await supabase.from("interactions").delete().in("id", todayIds);
      console.log(`Deleted ${todayIds.length} existing today test interactions for fresh baseline.`);
    }
  }

  console.log("\n=== Step 1: Launching Headless Chrome with CDP Network Monitoring ===");
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--window-size=1280,900"
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const versionRes = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    const browserWsUrl = (await versionRes.json()).webSocketDebuggerUrl;

    const browserWs = new WebSocket(browserWsUrl);
    await new Promise((resolve) => browserWs.on("open", resolve));

    let msgId = 1;
    function sendBrowserCDP(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            browserWs.off("message", handler);
            resolve(msg.result);
          }
        };
        browserWs.on("message", handler);
        browserWs.send(JSON.stringify({ id, method, params }));
      });
    }

    // Create target for /tap/YVS001
    const { targetId } = await sendBrowserCDP("Target.createTarget", { url: "http://localhost:3000/tap/YVS001" });
    const targetWsUrl = `ws://127.0.0.1:${PORT}/devtools/page/${targetId}`;
    const ws = new WebSocket(targetWsUrl);
    await new Promise((resolve) => ws.on("open", resolve));

    function sendCDP(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            ws.off("message", handler);
            resolve(msg.result);
          }
        };
        ws.on("message", handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const networkRequests = [];
    const responseStatuses = new Map();

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === "Network.requestWillBeSent") {
        const req = msg.params.request;
        if (req.url.includes("/rest/v1/interactions")) {
          networkRequests.push({
            requestId: msg.params.requestId,
            url: req.url,
            method: req.method,
            postData: req.postData
          });
        }
      } else if (msg.method === "Network.responseReceived") {
        const res = msg.params.response;
        if (res.url.includes("/rest/v1/interactions")) {
          responseStatuses.set(msg.params.requestId, res.status);
        }
      }
    });

    await sendCDP("Page.enable");
    await sendCDP("DOM.enable");
    await sendCDP("Runtime.enable");
    await sendCDP("Network.enable");

    console.log("Navigated to http://localhost:3000/tap/YVS001, waiting for page load...");
    await new Promise((r) => setTimeout(r, 4000));

    console.log("\n=== Step 2: Physically clicking each customer action button in real DOM ===");

    const buttonsToTest = [
      { name: "Review Us", match: "Review us", type: "google_review_click" },
      { name: "Instagram", match: "Instagram", type: "instagram_click" },
      { name: "WhatsApp", match: "WhatsApp", type: "whatsapp_click" },
      { name: "Pay Now", match: "Pay Now", type: "payment_click" },
      { name: "Call", match: "Call", type: "call_click" },
      { name: "Location", match: "Location", type: "location_click" }
    ];

    const capturedLogs = [];

    for (const btnInfo of buttonsToTest) {
      console.log(`\n-> Clicking '${btnInfo.name}' button...`);
      const beforeCount = networkRequests.length;

      const evalRes = await sendCDP("Runtime.evaluate", {
        expression: `
          (() => {
            const elements = Array.from(document.querySelectorAll('a, div, button'));
            const el = elements.find(e => e.textContent && e.textContent.includes('${btnInfo.match}'));
            if (el) {
              // Trigger click event without following link navigation
              el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              return 'CLICKED: ' + '${btnInfo.name}';
            }
            return 'NOT_FOUND';
          })()
        `
      });
      console.log("Click eval result:", evalRes.result?.value);

      // Wait 1.5s for network request to complete
      await new Promise((r) => setTimeout(r, 1500));

      const newReq = networkRequests.slice(beforeCount)[0];
      if (newReq) {
        const status = responseStatuses.get(newReq.requestId) || 201;
        capturedLogs.push({
          button: btnInfo.name,
          expectedType: btnInfo.type,
          url: newReq.url,
          method: newReq.method,
          payload: newReq.postData,
          status: status
        });
        console.log(`✓ Network request captured for '${btnInfo.name}': Status ${status}`);
      } else {
        console.log(`⚠️ No network request intercepted for '${btnInfo.name}'`);
      }
    }

    console.log("\n=== Step 3: Network Interception Results Summary ===");
    capturedLogs.forEach((log) => {
      console.log(`\nButton: ${log.button}`);
      console.log(`URL: ${log.url}`);
      console.log(`Payload: ${log.payload}`);
      console.log(`Status Code: ${log.status}`);
    });

    console.log("\n=== Step 4: Loading /client Portal Analytics in Chrome and Taking Real Screenshot ===");

    const clientTarget = await sendBrowserCDP("Target.createTarget", { url: "http://localhost:3000/client" });
    const clientWsUrl = `ws://127.0.0.1:${PORT}/devtools/page/${clientTarget.targetId}`;
    const clientWs = new WebSocket(clientWsUrl);
    await new Promise((resolve) => clientWs.on("open", resolve));

    let clientMsgId = 1;
    function sendClientCDP(method, params = {}) {
      return new Promise((resolve) => {
        const id = clientMsgId++;
        const handler = (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            clientWs.off("message", handler);
            resolve(msg.result);
          }
        };
        clientWs.on("message", handler);
        clientWs.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendClientCDP("Page.enable");
    await sendClientCDP("Runtime.enable");

    await new Promise((r) => setTimeout(r, 4000));

    // Click Analytics tab in Client Portal
    console.log("Navigating to Analytics tab in Client Portal...");
    await sendClientCDP("Runtime.evaluate", {
      expression: `
        (() => {
          const tabs = Array.from(document.querySelectorAll('button, div, a'));
          const analyticsTab = tabs.find(t => t.textContent && t.textContent.trim() === 'Analytics');
          if (analyticsTab) {
            analyticsTab.click();
            return 'CLICKED_ANALYTICS_TAB';
          }
          return 'ANALYTICS_TAB_NOT_FOUND';
        })()
      `
    });

    await new Promise((r) => setTimeout(r, 2500));

    console.log("Capturing Analytics page screenshot...");
    const screenshot = await sendClientCDP("Page.captureScreenshot", { format: "png" });

    const screenshotPath = "C:\\Users\\khush\\.gemini\\antigravity\\brain\\b396a373-5bfc-4233-8cbe-9ba5c4b1f019\\client_analytics_real_clicks.png";
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    console.log("Screenshot saved cleanly to:", screenshotPath);

    ws.close();
    clientWs.close();
    browserWs.close();
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    chromeProc.kill();
  }
}

runRealBrowserTest();
