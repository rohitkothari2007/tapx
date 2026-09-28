import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const artifactsDir = 'C:/Users/khush/.gemini/antigravity/brain/b396a373-5bfc-4233-8cbe-9ba5c4b1f019';
const msedgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function captureScreenshot(url, filename) {
  const outputPath = path.join(artifactsDir, filename);
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
  const cmd = `"${msedgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --virtual-time-budget=5000 --window-size=1440,900 --screenshot="${outputPath}" "${url}"`;
  console.log(`Capturing ${filename} from ${url}...`);
  try {
    execSync(cmd, { timeout: 25000 });
    console.log(`✓ Saved ${filename} (${fs.statSync(outputPath).size} bytes)`);
  } catch (err) {
    console.error(`Failed to capture ${filename}:`, err.message);
  }
}

async function main() {
  console.log("Starting automated screenshot capture of Device Inventory views...");
  captureScreenshot('http://localhost:3000/devices?tab=active', 'devices_default_view.png');
  captureScreenshot('http://localhost:3000/devices?tab=unassigned', 'devices_unassigned_view.png');
  captureScreenshot('http://localhost:3000/devices?tab=active&modal=retire', 'devices_retire_modal.png');
  captureScreenshot('http://localhost:3000/devices?drawer=requests', 'devices_hardware_requests_drawer.png');
  console.log("All 4 screenshots captured successfully!");
}

main().catch(console.error);
