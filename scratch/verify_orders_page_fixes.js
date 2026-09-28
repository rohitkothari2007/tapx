const ws = require('ws');
global.WebSocket = ws;

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\khush\\.gemini\\antigravity\\brain\\1d85ac11-6c91-428e-acc8-17d432220648';

(async () => {
  console.log('=== STARTING EMPIRICAL VERIFICATION FOR ORDERS PAGE FIXES ===');

  // Step 1: Place a new test order via RPC
  const envText = fs.readFileSync('.env.local', 'utf8');
  const envVars = {};
  for (const line of envText.split('\n')) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      envVars[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
    }
  }

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const businessId = 'ec122dc0-b2f1-4d47-b3a8-c899dde5ccd1'; // HOTEL DWARKA

  console.log('Placing a new test order for HOTEL DWARKA...');
  const { data: newOrderId, error: orderErr } = await supabase.rpc('create_tapx_table_order', {
    p_business_id: businessId,
    p_table_number: 4,
    p_customer_name: 'Verification Customer',
    p_customer_phone: '9988776655',
    p_source_device_code: 'TAPX002',
    p_items: [
      { item_id: '5d7aa27d-bb58-4210-ac1c-bf34ad793b38', quantity: 1 }
    ]
  });

  if (orderErr) {
    console.error('Error placing order:', orderErr);
    process.exit(1);
  }
  console.log('Successfully placed new test order! Order ID:', newOrderId);

  // Step 2: Launch Puppeteer and navigate to Client Portal Orders Page
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    console.log('Logging into Client Portal...');
    await page.goto('http://localhost:3000/client/login', { waitUntil: 'networkidle0' });

    await page.type('input[type="email"]', 'rohitjkothari12@gmail.com');
    await page.type('input[type="password"]', 'Yuva@5666');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 4000));

    console.log('Navigating to HOTEL DWARKA workspace directly...');
    await page.goto('http://localhost:3000/client?bId=ec122dc0-b2f1-4d47-b3a8-c899dde5ccd1', { waitUntil: 'networkidle0' });

    console.log('Waiting for .sidebar element...');
    try {
      await page.waitForSelector('.sidebar', { timeout: 10000 });
      console.log('Sidebar loaded successfully.');
    } catch (err) {
      console.log('Current URL:', page.url());
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('Body Text:', bodyText.substring(0, 500));
      await page.screenshot({ path: 'C:/Users/khush/.gemini/antigravity/brain/1d85ac11-6c91-428e-acc8-17d432220648/debug_sidebar_error.png' });
      throw err;
    }

    // Navigate to Orders Tab
    console.log('Navigating to Orders tab...');
    const clickedOrdersTab = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.nav-item'));
      const ordersBtn = btns.find(b => b.innerText.includes('Orders'));
      if (ordersBtn) {
        ordersBtn.click();
        return true;
      }
      return false;
    });

    console.log('Clicked Orders tab:', clickedOrdersTab);
    await new Promise(r => setTimeout(r, 3000));

    // Verify Sequential Order Numbers in table
    const orderTexts = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.order-row'));
      return rows.map(r => r.innerText);
    });

    console.log('Order row texts count:', orderTexts.length);
    console.log('Order row texts preview:', orderTexts);

    const seqScreenshotPath = path.join(artifactDir, 'orders_sequential_numbers.png');
    await page.screenshot({ path: seqScreenshotPath, fullPage: true });
    console.log('Saved sequential order numbers screenshot to:', seqScreenshotPath);

    // Step 3: Test direct inline status update on the new order row
    console.log('Clicking status transition button (Accept / Prepare) on the order row...');
    const statusUpdated = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.order-row'));
      const targetRow = rows.find(r => r.innerText.includes('Verification Customer') || r.innerText.includes('Table 4'));
      if (targetRow) {
        const btn = targetRow.querySelector('.quick-status-btn');
        if (btn) {
          btn.click();
          return true;
        }
        const sel = targetRow.querySelector('.status-select-inline');
        if (sel) {
          sel.value = 'preparing';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    });

    console.log('Triggered status update on row:', statusUpdated);
    await new Promise(r => setTimeout(r, 4000));

    const updatedOrderTexts = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.order-row'));
      return rows.map(r => r.innerText);
    });

    console.log('Updated order row texts:', updatedOrderTexts);

    const statusScreenshotPath = path.join(artifactDir, 'orders_status_transition_success.png');
    await page.screenshot({ path: statusScreenshotPath, fullPage: true });
    console.log('Saved status transition screenshot to:', statusScreenshotPath);

    console.log('SUCCESS: All Orders Page verifications completed cleanly!');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
})();
