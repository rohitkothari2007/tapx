import { spawn } from "child_process";
import fs from "fs";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = "C:\\Users\\khush\\Desktop\\tapx\\scratch\\chrome_user_data_part1";

if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

// Launch Chrome
const chromeProcess = spawn(chromePath, [
  "--remote-debugging-port=9222",
  `--user-data-dir=${userDataDir}`,
  "--headless=new",
  "--no-first-run",
  "--no-default-browser-check"
]);

await new Promise((r) => setTimeout(r, 3000));

async function main() {
  try {
    const versionRes = await fetch("http://127.0.0.1:9222/json/version");
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

    // Target 1: Client Portal
    const target1 = await sendBrowserCommand("Target.createTarget", { url: "http://localhost:3000/client/login" });
    const tab1WsUrl = `ws://127.0.0.1:9222/devtools/page/${target1.targetId}`;

    const ws1 = new WebSocket(tab1WsUrl);
    await new Promise((res) => ws1.on("open", res));

    let tab1MsgId = 1;
    function sendTab1(method, params = {}) {
      return new Promise((resolve) => {
        const id = tab1MsgId++;
        const handler = (data) => {
          const parsed = JSON.parse(data.toString());
          if (parsed.id === id) {
            ws1.removeListener("message", handler);
            resolve(parsed.result);
          }
        };
        ws1.on("message", handler);
        ws1.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendTab1("Page.enable");
    await sendTab1("Runtime.enable");
    await new Promise((r) => setTimeout(r, 2000));

    // Perform Login on Tab 1
    await sendTab1("Runtime.evaluate", {
      expression: `
        (function() {
          const emailInput = document.querySelector('input[type="email"]');
          const passInput = document.querySelector('input[type="password"]');
          const submitBtn = document.querySelector('button[type="submit"]');
          if (emailInput && passInput && submitBtn) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(emailInput, "rohitjkothari12@gmail.com");
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            nativeInputValueSetter.call(passInput, "Yuva@5666");
            passInput.dispatchEvent(new Event('input', { bubbles: true }));
            submitBtn.click();
            return "LOGGED_IN";
          }
          return "NOT_FOUND";
        })()
      `,
    });

    await new Promise((r) => setTimeout(r, 4000));

    // Click Analytics tab on Tab 1
    await sendTab1("Runtime.evaluate", {
      expression: `
        (function() {
          const items = Array.from(document.querySelectorAll('.nav-item'));
          const analyticsBtn = items.find(b => b.textContent.includes('Analytics'));
          if (analyticsBtn) {
            analyticsBtn.click();
            return "ANALYTICS_TAB_CLICKED";
          }
          return "ANALYTICS_TAB_NOT_FOUND";
        })()
      `,
    });

    await new Promise((r) => setTimeout(r, 3000));

    // Capture baseline screenshot of Tab 1 (Analytics Page)
    const shotBefore = await sendTab1("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "C:\\Users\\khush\\.gemini\\antigravity\\brain\\b396a373-5bfc-4233-8cbe-9ba5c4b1f019\\part1_analytics_before_click.png",
      Buffer.from(shotBefore.data, "base64")
    );

    // Read initial counts from Tab 1 DOM
    const initialStats = await sendTab1("Runtime.evaluate", {
      expression: `
        (function() {
          const text = document.body.innerText;
          const matchRev = text.match(/Google Review Clicks?\\s*(\\d+)/i) || text.match(/Review Clicks?\\s*(\\d+)/i);
          return {
            fullTextSnippet: text.substring(text.indexOf("Today's Action Summary"), text.indexOf("Today's Action Summary") + 400),
            reviewCount: matchRev ? parseInt(matchRev[1]) : null
          };
        })()
      `,
    });

    console.log("Tab 1 Baseline Analytics Stats:", initialStats.result.value);

    // Target 2: Tap page /tap/YVS001
    const target2 = await sendBrowserCommand("Target.createTarget", { url: "http://localhost:3000/tap/YVS001" });
    const tab2WsUrl = `ws://127.0.0.1:9222/devtools/page/${target2.targetId}`;

    const ws2 = new WebSocket(tab2WsUrl);
    await new Promise((res) => ws2.on("open", res));

    let tab2MsgId = 1;
    function sendTab2(method, params = {}) {
      return new Promise((resolve) => {
        const id = tab2MsgId++;
        const handler = (data) => {
          const parsed = JSON.parse(data.toString());
          if (parsed.id === id) {
            ws2.removeListener("message", handler);
            resolve(parsed.result);
          }
        };
        ws2.on("message", handler);
        ws2.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendTab2("Page.enable");
    await sendTab2("Runtime.enable");

    // Poll until tap page loads buttons
    let buttonClicked = false;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const clickRes = await sendTab2("Runtime.evaluate", {
        expression: `
          (function() {
            const els = Array.from(document.querySelectorAll('button, a, div'));
            const revBtn = els.find(el => el.textContent.trim().toLowerCase().includes('review us') || el.textContent.trim().toLowerCase().includes('google review'));
            if (revBtn) {
              revBtn.click();
              return "CLICKED: " + revBtn.textContent;
            }
            return null;
          })()
        `,
      });

      if (clickRes.result.value) {
        console.log("Tab 2 Button Click Result:", clickRes.result.value);
        buttonClicked = true;
        break;
      }
    }

    if (!buttonClicked) {
      console.log("Could not find Review Us button on Tab 2!");
    }

    // Wait 2.5s for Realtime push on Tab 1 without refresh!
    console.log("Waiting 2.5 seconds for live realtime update on Tab 1 (NO REFRESH)...");
    await new Promise((r) => setTimeout(r, 2500));

    // Read updated counts from Tab 1 DOM
    const updatedStats = await sendTab1("Runtime.evaluate", {
      expression: `
        (function() {
          const text = document.body.innerText;
          const matchRev = text.match(/Google Review Clicks?\\s*(\\d+)/i) || text.match(/Review Clicks?\\s*(\\d+)/i);
          return {
            fullTextSnippet: text.substring(text.indexOf("Today's Action Summary"), text.indexOf("Today's Action Summary") + 400),
            reviewCount: matchRev ? parseInt(matchRev[1]) : null
          };
        })()
      `,
    });

    console.log("Tab 1 Live Updated Analytics Stats (without refresh):", updatedStats.result.value);

    // Capture updated screenshot of Tab 1
    const shotAfter = await sendTab1("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "C:\\Users\\khush\\.gemini\\antigravity\\brain\\b396a373-5bfc-4233-8cbe-9ba5c4b1f019\\part1_analytics_after_click_live.png",
      Buffer.from(shotAfter.data, "base64")
    );

    ws1.close();
    ws2.close();
    browserWs.close();
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    chromeProcess.kill();
    process.exit(0);
  }
}

main();
