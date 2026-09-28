import { spawn } from "child_process";
import fs from "fs";
import WebSocket from "ws";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

async function run() {
  console.log("Launching headless Chrome...");
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--window-size=1280,900"
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const list = await listRes.json();
    const browserWsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl;

    console.log("Connecting to browser WS:", browserWsUrl);
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

    const { targetId } = await sendBrowserCDP("Target.createTarget", { url: "http://localhost:3000/devices" });
    console.log("Created targetId:", targetId);

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

    await sendCDP("Page.enable");
    await sendCDP("DOM.enable");
    await sendCDP("Runtime.enable");

    // Wait 5 seconds for Next dev server compilation & page load
    console.log("Waiting for http://localhost:3000/devices to render...");
    await new Promise((r) => setTimeout(r, 5000));

    console.log("Clicking + Provision Devices button in live DOM...");
    const evalRes = await sendCDP("Runtime.evaluate", {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const provBtn = btns.find(b => b.textContent.includes('Provision Devices'));
          if (provBtn) {
            provBtn.click();
            return 'CLICKED_PROVISION_BUTTON';
          }
          return 'BUTTON_NOT_FOUND: ' + btns.map(b => b.textContent.trim()).join(' | ');
        })()
      `
    });
    console.log("Eval result:", evalRes.result?.value);

    // Wait 1.5 seconds for modal animation
    await new Promise((r) => setTimeout(r, 1500));

    console.log("Capturing live screenshot...");
    const screenshotResult = await sendCDP("Page.captureScreenshot", { format: "png" });

    const targetPath = "C:\\Users\\khush\\.gemini\\antigravity\\brain\\b396a373-5bfc-4233-8cbe-9ba5c4b1f019\\live_provision_modal_real.png";
    fs.writeFileSync(targetPath, Buffer.from(screenshotResult.data, "base64"));
    console.log("Screenshot saved cleanly to:", targetPath);

    ws.close();
    browserWs.close();
  } catch (err) {
    console.error("CDP Error:", err);
  } finally {
    chromeProc.kill();
  }
}

run();
